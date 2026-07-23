Deno.serve(async (req) => {
  try {
    const { address, city, state, zip } = await req.json();
    if (!address || !city || !state) {
      return Response.json({ error: "address, city and state are required" }, { status: 400 });
    }

    const q = encodeURIComponent(`${address}, ${city}, ${state} ${zip || ""}`);
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${q}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url);
    if (!res.ok) return Response.json({ error: "Geocoder unavailable" }, { status: 502 });

    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return Response.json({ matched: false });

    return Response.json({ matched: true, lat: match.coordinates.y, lng: match.coordinates.x });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});