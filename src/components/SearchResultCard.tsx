"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import SearchLogForm from "@/components/SearchLogForm";
import type { ClinicSearchResult } from "@/lib/search/types";

// Result card for a NPPES ClinicSearchResult (adapted from the base44 Tavily card).
export default function SearchResultCard({
  result,
}: {
  result: ClinicSearchResult;
}) {
  const [logging, setLogging] = useState(false);
  const addressLine = [result.address, result.city, result.state, result.zip]
    .filter(Boolean)
    .join(", ");
  const specialties = result.specialties ?? [];

  return (
    <div className="rounded-sheet border border-line bg-paper p-4">
      {result.npi && (
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
          NPI {result.npi}
        </p>
      )}
      <h3 className="mt-1 text-[15px] font-semibold text-ink">{result.name}</h3>
      {addressLine && (
        <p className="mt-1 text-[13px] leading-[18px] text-ink-2">
          {addressLine}
        </p>
      )}
      {specialties.length > 0 && (
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
          {specialties.slice(0, 3).join(" · ")}
        </p>
      )}
      {result.phone && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <a
            href={`tel:${result.phone}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-pill bg-paper-2 px-3.5 text-[13px] font-medium text-ink"
          >
            <Phone className="h-3.5 w-3.5" />
            {result.phone}
          </a>
        </div>
      )}
      <button
        onClick={() => setLogging(!logging)}
        className="mt-2.5 min-h-[44px] rounded-pill border border-line px-3.5 text-[13px] font-medium text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {logging ? "Cancel" : "Log call outcome"}
      </button>
      {logging && <SearchLogForm result={result} />}
    </div>
  );
}
