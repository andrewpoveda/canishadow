import React, { useState } from "react";
import { Phone } from "lucide-react";
import SearchLogForm from "@/components/canishadow/SearchLogForm";

export default function SearchResultCard({ result }) {
  const [logging, setLogging] = useState(false);

  return (
    <div className="rounded-sheet border border-line bg-paper p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
        {(() => { try { return new URL(result.url).hostname.replace("www.", ""); } catch { return result.url; } })()}
      </p>
      <h3 className="mt-1 text-[15px] font-semibold text-ink">{result.title}</h3>
      <p className="mt-1 text-[13px] leading-[18px] text-ink-2">{result.content}</p>
      {result.phones.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {result.phones.map((p) => (
            <a key={p} href={`tel:${p}`}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-pill bg-paper-2 px-3.5 text-[13px] font-medium text-ink">
              <Phone className="h-3.5 w-3.5" />
              {p}
            </a>
          ))}
        </div>
      )}
      <button onClick={() => setLogging(!logging)}
        className="mt-2.5 min-h-[36px] rounded-pill border border-line px-3.5 text-[13px] font-medium text-ink-2">
        {logging ? "Cancel" : "Log call outcome"}
      </button>
      {logging && <SearchLogForm result={result} />}
    </div>
  );
}