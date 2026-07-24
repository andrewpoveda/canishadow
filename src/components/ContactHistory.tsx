"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ledgerDate } from "@/lib/date";
import LogCallForm from "@/components/LogCallForm";
import type { Clinic, ContactLog } from "@/types/clinic";

// Outreach ledger (PRM.md §5.3). base44 ContactLog.filter(..., "-created_date")
// → supabase.from('contact_logs').order('created_at', { ascending: false }) (MIGRATION.md §3).
const OUTCOME_LABEL: Record<ContactLog["outcome"], string> = {
  yes: "SAID YES",
  no: "SAID NO",
  call_back: "CALL BACK",
  no_answer: "NO ANSWER",
};

export default function ContactHistory({
  clinic,
  onClinicUpdate,
}: {
  clinic: Clinic;
  onClinicUpdate: (updated: Clinic) => void;
}) {
  const [logs, setLogs] = useState<ContactLog[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLogs(null);
    setShowForm(false);
    supabase
      .from("contact_logs")
      .select("*")
      .eq("clinic_id", clinic.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLogs((data as ContactLog[]) ?? []));
  }, [clinic.id]);

  const handleLogged = (log: ContactLog, updatedClinic: Clinic) => {
    setLogs([log, ...(logs || [])]);
    setShowForm(false);
    onClinicUpdate(updatedClinic);
  };

  const count = logs ? logs.length : 0;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
          Outreach ·{" "}
          {logs === null
            ? "…"
            : `Called ${count} ${count === 1 ? "time" : "times"}`}
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="min-h-[36px] rounded-pill bg-ink px-3.5 text-[13px] font-medium text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {showForm ? "Cancel" : "Log a call"}
        </button>
      </div>
      {showForm && <LogCallForm clinic={clinic} onLogged={handleLogged} />}
      {logs && logs.length > 0 && (
        <ul className="mt-3 space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="border-l-2 border-line pl-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
                {ledgerDate(log.created_at).toUpperCase()} ·{" "}
                {OUTCOME_LABEL[log.outcome] || log.outcome}
                {log.logged_by ? ` · BY ${log.logged_by.toUpperCase()}` : ""}
              </p>
              {log.notes && (
                <p className="mt-0.5 text-[13px] text-ink-2">{log.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {logs && logs.length === 0 && !showForm && (
        <p className="mt-2 text-[13px] text-ink-3">No calls logged yet.</p>
      )}
    </div>
  );
}
