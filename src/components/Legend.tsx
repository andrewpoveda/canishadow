"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { STATUS_META, type EffectiveStatus } from "@/lib/status";

// PRM.md §5.5 — collapsed to a "?" dot, expands to the pin key + attribution. The reference's
// "✕" close glyph is swapped for a lucide <X> to keep UI chrome emoji-free (non-negotiable).
const ROWS: { status: EffectiveStatus; label: string }[] = [
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
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
          Legend
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close legend"
          className="-m-2 flex h-9 w-9 items-center justify-center p-2 text-ink-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-2.5">
        {ROWS.map((r) => {
          const meta = STATUS_META[r.status];
          return (
            <li key={r.status} className="flex items-center gap-3">
              <span
                className="inline-block rounded-pill border-2 border-white"
                style={{
                  width: meta.radius * 2 + 4,
                  height: meta.radius * 2 + 4,
                  backgroundColor: meta.fill,
                  boxShadow: meta.halo ? `0 0 0 4px ${meta.halo}` : "none",
                }}
              />
              <span className="text-[13px] text-ink-2">{r.label}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
        Free &amp; open source · Built by{" "}
        <a
          href="https://ap-med.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-2 underline"
        >
          Andrew Poveda · AP MED
        </a>
      </p>
    </div>
  );
}
