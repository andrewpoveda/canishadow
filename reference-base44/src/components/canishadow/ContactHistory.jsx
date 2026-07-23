import React, { useEffect, useState } from "react";
import moment from "moment";
import { base44 } from "@/api/base44Client";
import LogCallForm from "@/components/canishadow/LogCallForm";

const OUTCOME_LABEL = { yes: "SAID YES", no: "SAID NO", call_back: "CALL BACK", no_answer: "NO ANSWER" };

export default function ContactHistory({ clinic, onClinicUpdate }) {
  const [logs, setLogs] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLogs(null);
    setShowForm(false);
    base44.entities.ContactLog.filter({ clinic_id: clinic.id }, "-created_date").then(setLogs);
  }, [clinic.id]);

  const handleLogged = (log, updatedClinic) => {
    setLogs([log, ...(logs || [])]);
    setShowForm(false);
    onClinicUpdate(updatedClinic);
  };

  const count = logs ? logs.length : 0;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
          Outreach · {logs === null ? "…" : `Called ${count} ${count === 1 ? "time" : "times"}`}
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
                {moment(log.created_date).format("MMM D YYYY").toUpperCase()} · {OUTCOME_LABEL[log.outcome] || log.outcome}
                {log.logged_by ? ` · BY ${log.logged_by.toUpperCase()}` : ""}
              </p>
              {log.notes && <p className="mt-0.5 text-[13px] text-ink-2">{log.notes}</p>}
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