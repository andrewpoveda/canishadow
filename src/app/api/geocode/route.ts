export const runtime = "nodejs";

import { isUsStateCode } from "@/lib/us-states";

// Free US Census geocoder (MIGRATION.md §4 / SPEC.md §Seed) — no key, no billing, results
// are OK to store. Server-side validation before an INSERT lands a pin (§4 guardrails):
// callers must get { matched: true, lat, lng } back before dropping a marker.
interface CensusMatch {
  coordinates: { x: number; y: number };
  addressComponents?: { state?: string; zip?: string };
}
interface CensusResponse {
  result?: { addressMatches?: CensusMatch[] };
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 2_048) {
    return Response.json({ error: "request body too large" }, { status: 413 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }
  const body = parsedBody as Record<string, unknown>;
  for (const field of ["address", "city", "state", "zip"] as const) {
    if (body[field] != null && typeof body[field] !== "string") {
      return Response.json({ error: `invalid ${field}` }, { status: 400 });
    }
  }

  const address = (body.address as string | undefined)
    ?.replace(/\s+/g, " ")
    .trim();
  const city = (body.city as string | undefined)
    ?.replace(/\s+/g, " ")
    .trim();
  const state = (body.state as string | undefined)?.trim().toUpperCase();
  const rawZip = body.zip as string | undefined;
  const zip = rawZip?.replace(/\D/g, "").slice(0, 5);
  if (!address || !city || !state) {
    return Response.json(
      { error: "address, city and state are required" },
      { status: 400 },
    );
  }
  if (!isUsStateCode(state)) {
    return Response.json(
      { error: "state must be a valid U.S. state or territory" },
      { status: 400 },
    );
  }
  if (rawZip && zip?.length !== 5) {
    return Response.json({ error: "zip must contain 5 digits" }, { status: 400 });
  }

  const q = encodeURIComponent(`${address}, ${city}, ${state} ${zip || ""}`);
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${q}&benchmark=Public_AR_Current&format=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    return Response.json({ error: "geocoder unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    return Response.json({ error: "geocoder unavailable" }, { status: 502 });
  }

  let data: CensusResponse;
  try {
    data = (await res.json()) as CensusResponse;
  } catch {
    return Response.json({ error: "geocoder unavailable" }, { status: 502 });
  }
  const match = data?.result?.addressMatches?.[0];
  if (!match) return Response.json({ matched: false });

  const matchedState = match.addressComponents?.state?.toUpperCase();
  const matchedZip = match.addressComponents?.zip?.slice(0, 5);
  const coordinatesAreValid =
    Number.isFinite(match.coordinates?.y) &&
    Number.isFinite(match.coordinates?.x) &&
    match.coordinates.y >= -90 &&
    match.coordinates.y <= 90 &&
    match.coordinates.x >= -180 &&
    match.coordinates.x <= 180;
  if (
    !coordinatesAreValid ||
    !matchedState ||
    matchedState !== state ||
    (zip && (!matchedZip || matchedZip !== zip))
  ) {
    return Response.json({ matched: false });
  }

  return Response.json(
    {
      matched: true,
      lat: match.coordinates.y,
      lng: match.coordinates.x,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
