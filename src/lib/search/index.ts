import type { ClinicSearchProvider } from "./types";
import { nppes } from "./nppes";
import { tavily } from "./tavily";

// Picks the provider from env, defaulting to NPPES (MIGRATION.md §4). Tavily is opt-in and
// only engaged when SEARCH_PROVIDER=tavily AND a key is present; otherwise we run free on NPPES.
export function getSearchProvider(): ClinicSearchProvider {
  if (process.env.SEARCH_PROVIDER === "tavily" && process.env.TAVILY_API_KEY) {
    return tavily;
  }
  return nppes;
}
