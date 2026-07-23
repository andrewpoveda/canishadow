import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SearchResultCard from "@/components/canishadow/SearchResultCard";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("tavilySearch", { query: query.trim() });
      setResults(res.data.results || []);
    } catch {
      setError("Search failed. Try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-4">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="Back to map"
            className="flex h-11 w-11 items-center justify-center rounded-pill bg-paper-2">
            <ArrowLeft className="h-5 w-5 text-ink-2" />
          </Link>
          <span className="font-display text-[22px] italic text-ink">canishadow</span>
        </div>
        <h1 className="mt-6 font-display text-[28px] leading-8 text-ink">Find clinics to call</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-ink-2">
          Search for local clinics, call them yourself, and log whether they said yes or no — every logged call becomes a pin on the map.
        </p>
        <form onSubmit={search} className="mt-5 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. pediatric clinics in Hoboken NJ"
            className="min-h-[44px] w-full rounded-pill border border-line bg-paper px-4 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <button type="submit" disabled={loading} aria-label="Search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-ink text-paper disabled:opacity-60">
            <SearchIcon className="h-5 w-5" />
          </button>
        </form>
        {loading && <p className="mt-6 font-display text-[20px] text-ink-2">Searching…</p>}
        {error && <p className="mt-6 text-[13px] text-declined">{error}</p>}
        {results && !loading && (
          <div className="mt-6 space-y-3">
            {results.length === 0 && <p className="text-[15px] text-ink-2">No results — try a more specific search.</p>}
            {results.map((r, i) => (
              <SearchResultCard key={i} result={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}