"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/date";
import type { ClinicSearchResult } from "@/lib/search/types";
import type { ClinicInsert, ClinicStatus } from "@/types/clinic";

// Add a searched clinic to the map + log the call (MIGRATION.md §3/§4). Prefills from the
// NPPES ClinicSearchResult (structured address, so geocoding has real data). base44 → Supabase,
// geocodeAddress edge fn → /api/geocode. New crowdsourced rows land verified = false (§0.1).
type Outcome = "yes" | "no" | "call_back";

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: "yes", label: "Said yes" },
  { key: "no", label: "Said no" },
  { key: "call_back", label: "Call back later" },
];
const STATUS_FOR: Record<Outcome, ClinicStatus> = {
  yes: "verified_yes",
  no: "verified_no",
  call_back: "call_back",
};

interface GeocodeResponse {
  matched: boolean;
  lat?: number;
  lng?: number;
}

export default function SearchLogForm({
  result,
}: {
  result: ClinicSearchResult;
}) {
  const [form, setForm] = useState({
    name: result.name,
    phone: result.phone || "",
    address: result.address || "",
    city: result.city || "",
    state: result.state === "NY" ? "NY" : "NJ",
    zip: result.zip || "",
    outcome: "yes",
    yourName: "",
    contactEmail: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm({ ...form, [k]: e.target.value });

  const inputClass =
    "w-full rounded-pill border border-line bg-paper px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    let geo: GeocodeResponse;
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
        }),
      });
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

    const outcome = form.outcome as Outcome;
    const insert: ClinicInsert = {
      name: form.name,
      address: form.address,
      city: form.city,
      state: form.state === "NY" ? "NY" : "NJ",
      zip: form.zip,
      lat: geo.lat,
      lng: geo.lng,
      phone: form.phone || null,
      status: STATUS_FOR[outcome],
      provider_count: 1,
      specialties: result.specialties ?? [],
      providers: [],
      contact_email: form.contactEmail || null,
      npi: result.npi ?? null,
      verified: false, // crowdsourced — pending AP MED team review (§0.1)
      last_verified: todayISODate(),
      verified_by: form.yourName || "student",
      notes: null,
      source: "student_search",
    };

    const { data: clinic, error: insertError } = await supabase
      .from("clinics")
      .insert(insert)
      .select()
      .single();

    if (insertError || !clinic) {
      setSaving(false);
      setError("Couldn't save the clinic. Try again.");
      return;
    }

    await supabase.from("contact_logs").insert({
      clinic_id: clinic.id,
      outcome,
      notes: form.notes || null,
      logged_by: form.yourName || null,
      contact_email: form.contactEmail || null,
    });

    setSaving(false);
    setSavedId(clinic.id);
  };

  if (savedId) {
    return (
      <div className="mt-3 rounded-sheet bg-verified-tint p-4">
        <p className="text-[13px] font-medium text-verified">
          Logged — the clinic is now on the map.
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
        className={inputClass}
      />
      <input
        value={form.phone}
        onChange={set("phone")}
        placeholder="Phone"
        className={inputClass}
      />
      <input
        value={form.address}
        onChange={set("address")}
        placeholder="Street address"
        required
        className={inputClass}
      />
      <div className="flex gap-2">
        <input
          value={form.city}
          onChange={set("city")}
          placeholder="City"
          required
          className={inputClass}
        />
        <select
          value={form.state}
          onChange={set("state")}
          className="rounded-pill border border-line bg-paper px-3 text-[13px] text-ink"
        >
          <option value="NJ">NJ</option>
          <option value="NY">NY</option>
        </select>
        <input
          value={form.zip}
          onChange={set("zip")}
          placeholder="Zip"
          required
          className={`${inputClass} max-w-[100px]`}
        />
      </div>
      <input
        value={form.yourName}
        onChange={set("yourName")}
        placeholder="Your name"
        className={inputClass}
      />
      <input
        value={form.contactEmail}
        onChange={set("contactEmail")}
        type="email"
        placeholder="Clinic contact email — optional"
        className={inputClass}
      />
      <textarea
        value={form.notes}
        onChange={set("notes")}
        placeholder="Notes"
        rows={2}
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
