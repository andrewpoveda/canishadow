export const runtime = "nodejs";

import { getSearchProvider } from "@/lib/search";
import type { ClinicSearchInput } from "@/lib/search/types";
import {
  parseSearchInput,
  SearchValidationError,
} from "@/lib/search/validation";

// NPPES-backed clinic search (MIGRATION.md §4). Structured input (city + state + optional
// specialty), not free text. Upstream failures stay distinct from a valid empty result set.
export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 2_048) {
    return Response.json({ error: "request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  let input: ClinicSearchInput;
  try {
    input = parseSearchInput(body);
  } catch (error) {
    if (error instanceof SearchValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "invalid search input" }, { status: 400 });
  }

  try {
    const results = await getSearchProvider().search(input);
    return Response.json(
      { results, query: input },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "The provider registry is temporarily unavailable. Try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
