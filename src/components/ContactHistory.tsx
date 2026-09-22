"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ledgerDate } from "@/lib/date";
import { captureOperationalError } from "@/lib/monitoring";
import { contactTargetSummary } from "@/lib/contact-history";
import LogCallForm from "@/components/LogCallForm";
import type { Clinic, ContactLog, ContactReport } from "@/types/clinic";

// Outreach ledger (PRM.md §5.3). base44 ContactLog.filter(..., "-created_date")
// → supabase.from('contact_logs').order('created_at', { ascending: false }) (MIGRATION.md §3).
const OUTCOME_LABEL: Record<ContactLog["outcome"], string> = {
  yes: "SAID YES",
  no: "SAID NO",
  call_back: "CALL BACK",
  no_answer: "NO ANSWER",
};

const REPORT_LABEL: Record<ContactReport["reason"], string> = {
  wrong_number: "WRONG NUMBER",
  practice_closed: "PRACTICE REPORTED CLOSED",
};

export default function ContactHistory({
  clinic,
  onClinicUpdate,
}: {
  clinic: Clinic;
  onClinicUpdate: (updated: Clinic) => void;
}) {
  const [logs, setLogs] = useState<ContactLog[] | null>(null);
  const [reports, setReports] = useState<ContactReport[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLogs(null);
    setReports(null);
    setShowForm(false);
    void Promise.all([
      supabase
        .from("contact_logs")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_reports")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("created_at", { ascending: false }),
    ]).then(([logResult, reportResult]) => {
      if (logResult.error) {
        captureOperationalError(logResult.error, {
          operation: "load_contact_history",
          message: "Unable to load contact history",
        });
      }
      if (reportResult.error) {
        captureOperationalError(reportResult.error, {
          operation: "load_contact_reports",
          message: "Unable to load contact reports",
        });
      }
      setLogs((logResult.data as ContactLog[] | null) ?? []);
      setReports((reportResult.data as ContactReport[] | null) ?? []);
    });
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
            <CallHistoryEntry key={log.id} log={log} />
          ))}
        </ul>
      )}
      {reports && reports.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
            Contact reports · {reports.length}
          </p>
          <ul className="mt-2 space-y-3">
            {reports.map((report) => (
              <li key={report.id} className="border-l-2 border-line pl-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
                  {ledgerDate(report.created_at).toUpperCase()} · {REPORT_LABEL[report.reason]} · PENDING REVIEW
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">
                  {report.target_name} · NPI {report.target_npi} · {report.target_enumeration_type}
                </p>
                <p className="text-[13px] text-ink-2">
                  {report.target_address}, {report.target_city}, {report.target_state} {report.target_zip}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  This report does not change shadowing status.
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {logs && logs.length === 0 && !showForm && (
        <p className="mt-2 text-[13px] text-ink-3">No calls logged yet.</p>
      )}
    </div>
  );
}

function CallHistoryEntry({ log }: { log: ContactLog }) {
  const target = contactTargetSummary(log);
  return (
    <li className="border-l-2 border-line pl-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
        {ledgerDate(log.created_at).toUpperCase()} · {OUTCOME_LABEL[log.outcome] || log.outcome}
        {log.logged_by ? ` · BY ${log.logged_by.toUpperCase()}` : ""}
      </p>
      <p className="mt-0.5 text-[13px] font-medium text-ink">{target.identity}</p>
      {target.address && <p className="text-[13px] text-ink-2">{target.address}</p>}
      {target.phone && <p className="text-[13px] text-ink-2">{target.phone}</p>}
      {log.notes && <p className="mt-0.5 text-[13px] text-ink-2">{log.notes}</p>}
    </li>
  );
}
