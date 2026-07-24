import type { ClinicSearchProvider, ClinicSearchResult } from "./types";

// OPTIONAL provider (MIGRATION.md §4) — broad-web search on your hackathon credits.
// OFF by default; NPPES is the default and the app ships on $0 without this. Only used
// when SEARCH_PROVIDER=tavily AND TAVILY_API_KEY is present (see ./index.ts). If it's off
// or out of credits, search falls back to NPPES with zero breakage.
//
// Ported from reference-base44/base44/functions/tavilySearch/entry.ts, adapted to the
// structured ClinicSearchProvider shape. Tavily returns web pages, not registry records,
// so name/phone are best-effort scraped and address/zip are usually absent — the user
// fills those in manually in SearchLogForm.
interface TavilyResult {
  title?: string;
  content?: string;
}
interface TavilyResponse {
  results?: TavilyResult[];
}

export const tavily: ClinicSearchProvider = {
  async search({ city, state, specialty }) {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return [];

    const query = `${specialty ? `${specialty} ` : ""}clinics in ${city} ${state} doctor office phone number address`;
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        max_results: 8,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as TavilyResponse;
    const phoneRe = /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g;
    return (data.results || []).map((r): ClinicSearchResult => {
      const phone = ((r.content || "").match(phoneRe) || [])[0];
      return {
        name: r.title || "Medical office",
        phone,
        city,
        state,
      };
    });
  },
};
