"use client";

import { useRef, useState } from "react";
import {
  reportClinicContact,
  type ContactIssueReason,
} from "@/lib/report-clinic-contact";
import { captureOperationalError } from "@/lib/monitoring";
import type { ClinicSearchTarget } from "@/lib/search/types";

export default function ReportContactForm({
  target,
}: {
  target: ClinicSearchTarget;
}) {
  const [reason, setReason] = useState<ContactIssueReason>(
    target.phone ? "wrong_number" : "practice_closed",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionKey = useRef<string | null>(null);
  const reasons: { key: ContactIssueReason; label: string }[] = [
    ...(target.phone
      ? [{ key: "wrong_number" as const, label: "The number is incorrect" }]
      : []),
    { key: "practice_closed", label: "The practice appears to be closed" },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    submissionKey.current ??= crypto.randomUUID();

    try {
      await reportClinicContact({
        submissionKey: submissionKey.current,
        target,
        reason,
      });
      setSaved(true);
    } catch (reportError) {
      captureOperationalError(reportError, {
        operation: "report_nppes_contact",
        message: "Unable to save a contact report",
      });
      setError("Couldn't save the report. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <p className="mt-3 rounded-sheet bg-paper-2 p-4 text-[13px] leading-[18px] text-ink-2">
        Report saved for review. It does not change this listing&apos;s shadowing status.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2.5 rounded-sheet bg-paper-2 p-4">
      <p className="text-[13px] leading-[18px] text-ink-2">
        This report applies only to {target.name}, NPI {target.npi}, at this full practice address.
        A reviewer must assess it; it will not mark other providers or organizations closed.
      </p>
      <div className="space-y-1.5">
        {reasons.map((item) => (
          <label key={item.key} className="flex min-h-[44px] items-center gap-2 text-[13px] text-ink">
            <input
              type="radio"
              name={`contact-report-${target.npi}`}
              value={item.key}
              checked={reason === item.key}
              onChange={() => setReason(item.key)}
              className="accent-ink"
            />
            {item.label}
          </label>
        ))}
      </div>
      {error && <p className="text-[13px] text-declined">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="min-h-[44px] rounded-pill border border-line bg-paper px-3.5 text-[13px] font-medium text-ink-2 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {saving ? "Submitting…" : "Submit report for review"}
      </button>
    </form>
  );
}
