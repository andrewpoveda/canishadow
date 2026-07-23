import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function ProviderList({ clinic }) {
  const [open, setOpen] = useState(false);
  const providers = clinic.providers || [];

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-[44px] items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {clinic.provider_count} {clinic.provider_count === 1 ? "PROVIDER" : "PROVIDERS"}
        {(clinic.specialties || []).map((s) => ` · ${s.toUpperCase()}`).join("")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 rounded-sheet bg-paper-2 px-4 py-3">
          {providers.length === 0 ? (
            <p className="text-[13px] text-ink-3">No individual provider responses logged yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {providers.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-ink">{p.name}</span>
                  <span
                    className={`font-mono text-[11px] uppercase tracking-[0.06em] ${
                      p.response === "yes" ? "text-verified" : "text-declined"
                    }`}
                  >
                    {p.response === "yes" ? "Said yes" : "Said no"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}