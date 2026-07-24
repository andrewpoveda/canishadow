export const runtime = "nodejs";

// Free US Census geocoder (MIGRATION.md §4 / SPEC.md §Seed) — no key, no billing, results
// are OK to store. Server-side validation before an INSERT lands a pin (§4 guardrails):
// callers must get { matched: true, lat, lng } back before dropping a marker.
interface CensusMatch {
  coordinates: { x: number; y: number };
}
interface CensusResponse {
  result?: { addressMatches?: CensusMatch[] };
}

export async function POST(req: Request) {
  let body: { address?: string; city?: string; state?: string; zip?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { address, city, state, zip } = body;
  if (!address || !city || !state) {
    return Response.json(
      { error: "address, city and state are required" },
      { status: 400 },
    );
  }

  const q = encodeURIComponent(`${address}, ${city}, ${state} ${zip || ""}`);
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${q}&benchmark=Public_AR_Current&format=json`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return Response.json({ error: "geocoder unavailable" }, { status: 502 });
  }
  if (!res.ok) {
    return Response.json({ error: "geocoder unavailable" }, { status: 502 });
  }

  const data = (await res.json()) as CensusResponse;
  const match = data?.result?.addressMatches?.[0];
  if (!match) return Response.json({ matched: false });

  return Response.json({
    matched: true,
    lat: match.coordinates.y,
    lng: match.coordinates.x,
  });
}
