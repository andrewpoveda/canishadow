"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/date";
import type { Clinic, ContactLog, Provider } from "@/types/clinic";

// Status-derivation logic (MIGRATION.md §4 — "the product's brain"), ported exactly from
// reference-base44/src/components/canishadow/LogCallForm.jsx. base44 → Supabase, moment → date-fns.
//
// Note: logging a call does NOT flip `verified` — a student's log stays crowdsourced
// (verified stays whatever it was) until the AP MED team promotes it (§0.1).
type Outcome = "yes" | "no" | "call_back";

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: "yes", label: "Said yes" },
  { key: "no", label: "Said no" },
  { key: "call_back", label: "Call back later" },
];

export default function LogCallForm({
  clinic,
  onLogged,
}: {
  clinic: Clinic;
  onLogged: (log: ContactLog, updatedClinic: Clinic) => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [providerName, setProviderName] = useState("");
  const [yourName, setYourName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const providers: Provider[] = [...(clinic.providers || [])];
    if (providerName && outcome !== "call_back") {
      providers.push({ name: providerName, response: outcome });
    }
    const hasYes = providers.some((p) => p.response === "yes");

    const updates: Partial<Clinic> = {
      providers,
      last_verified: todayISODate(),
      verified_by: yourName || clinic.verified_by || "student",
    };
    if (outcome === "yes") updates.status = "verified_yes";
    else if (outcome === "no" && !hasYes) updates.status = "verified_no";
    else if (
      outcome === "call_back" &&
      !hasYes &&
      clinic.status === "unknown"
    )
      updates.status = "call_back";
    if (contactEmail) updates.contact_email = contactEmail;

    const { data: updatedRow, error: updateError } = await supabase
      .from("clinics")
      .update(updates)
      .eq("id", clinic.id)
      .select()
      .single();

    if (updateError) {
      setSaving(false);
      setError("Couldn't save that call. Try again.");
      return;
    }

    const { data: log, error: logError } = await supabase
      .from("contact_logs")
      .insert({
        clinic_id: clinic.id,
        outcome,
        notes: notes || null,
        logged_by: yourName || null,
        contact_email: contactEmail || null,
      })
      .select()
      .single();

    setSaving(false);
    if (logError || !log) {
      setError("Couldn't save that call. Try again.");
      return;
    }

    onLogged(log as ContactLog, (updatedRow as Clinic) ?? { ...clinic, ...updates });
  };

  const inputClass =
    "w-full rounded-pill border border-line bg-paper px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink";

  return (
    <form onSubmit={submit} className="mt-3 space-y-2.5 rounded-sheet bg-paper-2 p-4">
      <div className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setOutcome(o.key)}
            className={`min-h-[36px] rounded-pill px-3.5 text-[13px] font-medium transition-colors duration-200 ease-standard ${
              outcome === o.key ? "bg-ink text-paper" : "bg-paper text-ink-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {outcome !== "call_back" && (
        <input
          value={providerName}
          onChange={(e) => setProviderName(e.target.value)}
          placeholder="Provider name (e.g. Dr. Smith) — optional"
          className={inputClass}
        />
      )}
      <input
        value={yourName}
        onChange={(e) => setYourName(e.target.value)}
        placeholder="Your name"
        className={inputClass}
      />
      <input
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        type="email"
        placeholder="Clinic contact email — optional"
        className={inputClass}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (who you spoke to, what they said)"
        rows={2}
        className="w-full rounded-sheet border border-line bg-paper px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink"
      />
      {error && <p className="text-[13px] text-declined">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="min-h-[44px] w-full rounded-pill bg-ink text-[13px] font-medium text-paper disabled:opacity-60"
      >
        {saving ? "Saving…" : "Log this call"}
      </button>
    </form>
  );
}
