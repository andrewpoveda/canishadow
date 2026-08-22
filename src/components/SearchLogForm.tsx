"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { normalizeClinicAddress } from "@/lib/clinic-address";
import { logClinicCall, type CallOutcome } from "@/lib/log-clinic-call";
import { US_STATES, type UsStateCode } from "@/lib/us-states";
import type { ClinicSearchResult } from "@/lib/search/types";
import type { Clinic } from "@/types/clinic";

// Add a searched clinic to the map + log the call (MIGRATION.md §3/§4). Prefills from the
// NPPES ClinicSearchResult (structured address, so geocoding has real data). base44 → Supabase,
// geocodeAddress edge fn → /api/geocode. New crowdsourced rows land verified = false (§0.1).
const OUTCOMES: { key: CallOutcome; label: string }[] = [
  { key: "yes", label: "Said yes" },
  { key: "no", label: "Said no" },
  { key: "call_back", label: "Call back later" },
];

interface GeocodeResponse {
  matched: boolean;
  lat?: number;
  lng?: number;
}

interface SearchLogFormState {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: UsStateCode;
  zip: string;
  outcome: CallOutcome;
  yourName: string;
  contactEmail: string;
  notes: string;
}

async function findExistingClinic(address: string, zip: string) {
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("clinics")
      .select("*")
      .eq("zip", zip)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return { clinic: null, failed: true };
    const page = (data as Clinic[] | null) ?? [];
    const clinic = page.find(
      (candidate) => normalizeClinicAddress(candidate.address) === address,
    );
    if (clinic) return { clinic, failed: false };
    if (page.length < pageSize) return { clinic: null, failed: false };
  }
}

export default function SearchLogForm({
  result,
}: {
  result: ClinicSearchResult;
}) {
  const [form, setForm] = useState<SearchLogFormState>({
    name: result.name,
    phone: result.phone || "",
    address: result.address || "",
    city: result.city || "",
    state: result.state || "NJ",
    zip: result.zip || "",
    outcome: "yes",
    yourName: "",
    contactEmail: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [createdClinic, setCreatedClinic] = useState(false);
  const submissionKey = useRef<string | null>(null);

  const set =
    <K extends keyof SearchLogFormState>(k: K) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((current) => ({
        ...current,
        [k]: e.target.value as SearchLogFormState[K],
      }));

  const inputClass =
    "w-full rounded-pill border border-line bg-paper px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const normalized = {
      name: form.name.replace(/\s+/g, " ").trim(),
      phone: form.phone.trim(),
      enteredAddress: form.address.replace(/\s+/g, " ").trim(),
      address: normalizeClinicAddress(form.address),
      city: form.city.replace(/\s+/g, " ").trim(),
      zip: form.zip.replace(/\D/g, "").slice(0, 5),
      yourName: form.yourName.replace(/\s+/g, " ").trim(),
      contactEmail: form.contactEmail.trim(),
      notes: form.notes.trim(),
    };
    if (!normalized.name || !normalized.address || !normalized.city) {
      setSaving(false);
      setError("Clinic name, street address, and city are required.");
      return;
    }
    if (normalized.zip.length !== 5) {
      setSaving(false);
      setError("Enter a valid 5-digit ZIP code.");
      return;
    }

    const outcome = form.outcome;
    const existing = await findExistingClinic(normalized.address, normalized.zip);
    if (existing.failed) {
      setSaving(false);
      setError("Couldn't save the clinic. Try again.");
      return;
    }

    let clinic = existing.clinic;
    let geocoded: { lat: number; lng: number } | null = null;

    if (!clinic || clinic.lat == null || clinic.lng == null) {
      let geo: GeocodeResponse;
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: normalized.enteredAddress,
            city: normalized.city,
            state: form.state,
            zip: normalized.zip,
          }),
        });
        if (!res.ok) throw new Error("geocoder unavailable");
        geo = (await res.json()) as GeocodeResponse;
      } catch {
        setSaving(false);
        setError("Couldn't reach the geocoder — try again.");
        return;
      }

      if (!geo.matched || geo.lat == null || geo.lng == null) {
        setSaving(false);
        setError("Couldn't locate that address — check the street, city and zip.");
        return;
      }
      geocoded = { lat: geo.lat, lng: geo.lng };
    }

    submissionKey.current ??= crypto.randomUUID();
    let saved;
    try {
      saved = await logClinicCall({
        submissionKey: submissionKey.current,
        clinicId: clinic?.id ?? null,
        outcome,
        loggedBy: normalized.yourName,
        contactEmail: normalized.contactEmail,
        notes: normalized.notes,
        name: normalized.name,
        address: normalized.address,
        city: normalized.city,
        state: form.state,
        zip: normalized.zip,
        lat: geocoded?.lat ?? clinic?.lat ?? undefined,
        lng: geocoded?.lng ?? clinic?.lng ?? undefined,
        phone: normalized.phone,
        providerCount: result.providerCount ?? 1,
        specialties: result.specialties ?? [],
        npi: result.npi ?? undefined,
      });
    } catch {
      setSaving(false);
      setError("Couldn't save the clinic and call. Try again.");
      return;
    }

    if (saved.created) {
      track("clinic_added", {
        outcome,
        state: form.state,
        has_npi: Boolean(result.npi),
      });
    } else {
      track("call_logged", {
        clinic_id: saved.clinic.id,
        outcome,
        resulting_status: saved.clinic.status,
        has_provider: false,
      });
    }

    setSaving(false);
    setCreatedClinic(saved.created);
    setSavedId(saved.clinic.id);
  };

  if (savedId) {
    return (
      <div className="mt-3 rounded-sheet bg-verified-tint p-4">
        <p className="text-[13px] font-medium text-verified">
          {createdClinic
            ? "Logged — the clinic is now on the map."
            : "Logged — the existing clinic was updated."}
        </p>
        <Link
          href={`/?clinic=${savedId}`}
          className="mt-1 inline-block text-[13px] font-medium text-ink underline"
        >
          View on map
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2.5 rounded-sheet bg-paper-2 p-4">
      <div className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setForm({ ...form, outcome: o.key })}
            className={`min-h-[36px] rounded-pill px-3.5 text-[13px] font-medium ${
              form.outcome === o.key ? "bg-ink text-paper" : "bg-paper text-ink-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <input
        value={form.name}
        onChange={set("name")}
        placeholder="Clinic name"
        required
        maxLength={300}
        className={inputClass}
      />
      <input
        value={form.phone}
        onChange={set("phone")}
        placeholder="Phone"
        maxLength={50}
        className={inputClass}
      />
      <input
        value={form.address}
        onChange={set("address")}
        placeholder="Street address"
        required
        maxLength={300}
        className={inputClass}
      />
      <div className="flex gap-2">
        <input
          value={form.city}
          onChange={set("city")}
          placeholder="City"
          required
          maxLength={150}
          className={inputClass}
        />
        <select
          value={form.state}
          onChange={set("state")}
          aria-label="State"
          autoComplete="address-level1"
          className="rounded-pill border border-line bg-paper px-3 text-[13px] text-ink"
        >
          {US_STATES.map(({ code, name }) => (
            <option key={code} value={code}>
              {code} — {name}
            </option>
          ))}
        </select>
        <input
          value={form.zip}
          onChange={set("zip")}
          placeholder="Zip"
          required
          inputMode="numeric"
          pattern="[0-9]{5}(-[0-9]{4})?"
          className={`${inputClass} max-w-[100px]`}
        />
      </div>
      <input
        value={form.yourName}
        onChange={set("yourName")}
        placeholder="Your name"
        maxLength={200}
        className={inputClass}
      />
      <input
        value={form.contactEmail}
        onChange={set("contactEmail")}
        type="email"
        placeholder="Clinic contact email — optional"
        maxLength={320}
        className={inputClass}
      />
      <textarea
        value={form.notes}
        onChange={set("notes")}
        placeholder="Notes"
        rows={2}
        maxLength={2000}
        className="w-full rounded-sheet border border-line bg-paper px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink"
      />
      {error && <p className="text-[13px] text-declined">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="min-h-[44px] w-full rounded-pill bg-ink text-[13px] font-medium text-paper disabled:opacity-60"
      >
        {saving ? "Saving…" : "Add to map & log call"}
      </button>
    </form>
  );
}
