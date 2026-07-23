import React, { useState } from "react";
import { STATUS_META } from "@/lib/status";

const ROWS = [
  { status: "verified_yes", label: "Takes shadowing students" },
  { status: "verified_no", label: "Not taking students" },
  { status: "call_back", label: "Call back in a few months" },
  { status: "unknown", label: "Not yet called" },
];

export default function Legend() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Show legend"
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-pill bg-paper shadow-float focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="font-mono text-[13px] text-ink-2">?</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-64 rounded-sheet bg-paper p-4 shadow-float">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">Legend</span>
        <button onClick={() => setOpen(false)} aria-label="Close legend" className="-m-2 p-2 text-[13px] text-ink-3">
          ✕
        </button>
      </div>
      <ul className="mt-3 space-y-2.5">
        {ROWS.map((r) => (
          <li key={r.status} className="flex items-center gap-3">
            <span
              className="inline-block rounded-pill border-2 border-white"
              style={{
                width: STATUS_META[r.status].radius * 2 + 4,
                height: STATUS_META[r.status].radius * 2 + 4,
                backgroundColor: STATUS_META[r.status].fill,
                boxShadow: STATUS_META[r.status].halo ? `0 0 0 4px ${STATUS_META[r.status].halo}` : "none",
              }}
            />
            <span className="text-[13px] text-ink-2">{r.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
        Free & open source · Built by{" "}
        <a href="https://ap-med.org" target="_blank" rel="noopener noreferrer" className="text-ink-2 underline">
          Andrew Poveda · AP MED
        </a>
      </p>
    </div>
  );
}