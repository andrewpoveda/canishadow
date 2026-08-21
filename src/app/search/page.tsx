"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import SearchResultCard from "@/components/SearchResultCard";
import { track } from "@/lib/analytics";
import { US_STATES, type UsStateCode } from "@/lib/us-states";
import {
  SEARCH_SPECIALTIES,
  type ClinicSearchInput,
  type ClinicSearchResult,
} from "@/lib/search/types";

// NPPES-backed search (MIGRATION.md §4). Structured U.S. city + state + optional specialty,
// not the free-text box the base44/Tavily version used.
export default function SearchPage() {
  const [city, setCity] = useState("");
  const [state, setState] = useState<UsStateCode>("NJ");
  const [specialty, setSpecialty] = useState("");
  const [results, setResults] = useState<ClinicSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: city.trim(),
          state,
          specialty: specialty || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        query?: ClinicSearchInput;
        results?: ClinicSearchResult[];
      };
      if (!res.ok) throw new Error(data.error || "Search failed. Try again.");
      const found = data.results || [];
      setResults(found);
      track("clinic_searched", {
        city: data.query?.city || city.trim(),
        state: data.query?.state || state,
        specialty: specialty || null,
        result_count: found.length,
      });
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Search failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "min-h-[44px] w-full rounded-pill border border-line bg-paper px-4 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink";

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to map"
            className="flex h-11 w-11 items-center justify-center rounded-pill bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ArrowLeft className="h-5 w-5 text-ink-2" />
          </Link>
          <span className="font-display text-[22px] italic text-ink">
            canishadow
          </span>
        </div>
        <h1 className="mt-6 font-display text-[28px] leading-8 text-ink">
          Find clinics to call
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-ink-2">
          Search the federal provider registry, call the clinic yourself, and
          log whether they said yes or no — every logged call becomes a pin on
          the map.
        </p>
        <form onSubmit={search} className="mt-5 space-y-2.5">
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (e.g. New York City)"
              autoComplete="address-level2"
              required
              className={inputClass}
            />
            <select
              value={state}
              onChange={(e) => setState(e.target.value as UsStateCode)}
              aria-label="State"
              autoComplete="address-level1"
              className="min-h-[44px] w-28 shrink-0 rounded-pill border border-line bg-paper px-3 text-[15px] text-ink"
            >
              {US_STATES.map(({ code, name }) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              aria-label="Specialty"
              className={`${inputClass} appearance-none`}
            >
              <option value="">All primary care</option>
              {SEARCH_SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading}
              aria-label="Search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
        {loading && (
          <p className="mt-6 font-display text-[20px] text-ink-2">Searching…</p>
        )}
        {error && <p className="mt-6 text-[13px] text-declined">{error}</p>}
        {results && !loading && (
          <div className="mt-6 space-y-3">
            {results.length === 0 && (
              <p className="text-[15px] text-ink-2">
                No primary care results found. Try the city&apos;s official name or a
                different specialty.
              </p>
            )}
            {results.map((r, i) => (
              <SearchResultCard key={`${r.npi ?? r.name}-${i}`} result={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
