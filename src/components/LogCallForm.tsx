"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { logClinicCall, type CallOutcome } from "@/lib/log-clinic-call";
import type { Clinic, ContactLog } from "@/types/clinic";

// The database transaction derives status while holding the clinic row lock, so simultaneous
// calls cannot overwrite each other. A student's log never flips the team's `verified` flag.
const OUTCOMES: { key: CallOutcome; label: string }[] = [
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
  const [outcome, setOutcome] = useState<CallOutcome>("yes");
  const [providerName, setProviderName] = useState("");
  const [yourName, setYourName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionKey = useRef<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    submissionKey.current ??= crypto.randomUUID();
    let result;
    try {
      result = await logClinicCall({
        submissionKey: submissionKey.current,
        clinicId: clinic.id,
        outcome,
        providerName,
        loggedBy: yourName,
        contactEmail,
        notes,
      });
    } catch {
      setSaving(false);
      setError("Couldn't save that call. Try again.");
      return;
    }

    track("call_logged", {
      clinic_id: clinic.id,
      outcome,
      resulting_status: result.clinic.status,
      has_provider: Boolean(providerName && outcome !== "call_back"),
    });

    setSaving(false);
    onLogged(result.log, result.clinic);
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
          maxLength={200}
          className={inputClass}
        />
      )}
      <input
        value={yourName}
        onChange={(e) => setYourName(e.target.value)}
        placeholder="Your name"
        maxLength={200}
        className={inputClass}
      />
      <input
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        type="email"
        placeholder="Clinic contact email — optional"
        maxLength={320}
        className={inputClass}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (who you spoke to, what they said)"
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
        {saving ? "Saving…" : "Log this call"}
      </button>
    </form>
  );
}
