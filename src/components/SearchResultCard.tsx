"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import SearchLogForm from "@/components/SearchLogForm";
import ReportContactForm from "@/components/ReportContactForm";
import type { ClinicSearchResult, ClinicSearchTarget } from "@/lib/search/types";

// Result card for a NPPES ClinicSearchResult (adapted from the base44 Tavily card).
export default function SearchResultCard({
  result,
}: {
  result: ClinicSearchResult;
}) {
  const [logging, setLogging] = useState(false);
  const [reporting, setReporting] = useState(false);
  const target = isCompleteTarget(result) ? result : null;
  const addressLine = [result.address, result.city, result.state, result.zip]
    .filter(Boolean)
    .join(", ");
  const specialties = result.specialties ?? [];

  return (
    <div className="rounded-sheet border border-line bg-paper p-4">
      {result.npi && (
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
          {result.enumerationType === "NPI-2"
            ? "Organization"
            : "Individual provider"}{" "}
          · NPI {result.npi}
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
      {(result.providerCount ?? 0) > 1 && (
        <p className="mt-1 text-[13px] leading-[18px] text-ink-2">
          {result.providerCount} registered providers at this location
        </p>
      )}
      {target?.phone && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <a
            href={`tel:${target.phone}`}
            aria-label={`Call the unconfirmed NPPES registry number for ${target.name}, NPI ${target.npi}: ${target.phone}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-pill bg-paper-2 px-3.5 text-[13px] font-medium text-ink"
          >
            <Phone className="h-3.5 w-3.5" />
            {target.phone}
          </a>
        </div>
      )}
      {target && !target.phone && (
        <p className="mt-2 text-[13px] text-ink-2">No phone is listed for this NPI practice location.</p>
      )}
      <p className="mt-2 text-[13px] leading-[18px] text-ink-2">
        NPPES NPI Registry data. This number is unconfirmed and may be out of date;
        an active record does not confirm that the practice is open.
      </p>
      {target ? (
        <>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setLogging(!logging);
                setReporting(false);
              }}
              className="min-h-[44px] rounded-pill border border-line px-3.5 text-[13px] font-medium text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {logging ? "Cancel" : "Log call for this NPI"}
            </button>
            <button
              onClick={() => {
                setReporting(!reporting);
                setLogging(false);
              }}
              className="min-h-[44px] rounded-pill border border-line px-3.5 text-[13px] font-medium text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {reporting ? "Cancel report" : "Report contact issue"}
            </button>
          </div>
          {logging && <SearchLogForm result={target} />}
          {reporting && <ReportContactForm target={target} />}
        </>
      ) : (
        <p className="mt-2 text-[13px] text-ink-3">
          This result has no complete NPI practice identity and cannot be used for call logging.
        </p>
      )}
    </div>
  );
}

function isCompleteTarget(result: ClinicSearchResult): result is ClinicSearchTarget {
  return Boolean(
    result.npi && /^\d{10}$/.test(result.npi) &&
      result.enumerationType && result.address && result.city && result.state &&
      result.zip && result.phoneSource === "NPPES NPI Registry" &&
      result.phoneStatus === "unconfirmed",
  );
}
