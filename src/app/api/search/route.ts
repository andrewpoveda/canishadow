export const runtime = "nodejs";

import { getSearchProvider } from "@/lib/search";

// NPPES-backed clinic search (MIGRATION.md §4). Structured input (city + state + optional
// specialty), not free text. Falls back to an empty result set on provider failure so the
// UI can always offer manual entry.
export async function POST(req: Request) {
  let body: { city?: string; state?: string; specialty?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { city, state, specialty } = body;
  if (!city || !state) {
    return Response.json({ error: "city and state required" }, { status: 400 });
  }

  try {
    const results = await getSearchProvider().search({ city, state, specialty });
    return Response.json({ results });
  } catch {
    return Response.json({ error: "search failed" }, { status: 502 });
  }
}
