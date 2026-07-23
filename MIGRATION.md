# CanIShadow — base44 → Next.js/Supabase Migration Spec

Target for the rebuild. Read alongside `SPEC.md` (the original pre-build plan) and
`reference-base44/` (the working base44 export). This doc reconciles the two: **the
base44 MVP shipped more than SPEC.md scoped**, so where they disagree, this file wins.

The job is not to port base44's React verbatim. It's to rebuild the same product on
our stack (Next.js App Router + TypeScript + Tailwind + Supabase), reusing the parts
of the export that are stack-agnostic (design system, map, the two edge functions,
the component logic) and swapping out everything that talks to base44.

---

## 0. Three decisions to make before building

SPEC.md was written before the hackathon. The base44 build diverged from it in three
ways that matter. Decide these first — Claude Code should confirm each with you Monday.

| # | SPEC.md said | base44 actually built | Recommendation for rebuild |
|---|---|---|---|
| 1. Map | Mapbox via `react-map-gl` (needs paid token; geocoding TOS headaches) | **Leaflet + free CARTO tiles** (`react-leaflet`) | **Keep Leaflet + CARTO.** Free, no token, no TOS issue, already proven in the export. Drop Mapbox from SPEC. |
| 2. Data model | One `clinics` table, 3-state status, pins = locations only | Added `call_back` status, embedded `providers[]`, `contact_email`, **a second `ContactLog` table**, per-provider yes/no | **Keep the richer base44 model.** The provider-level detail + contact history is the demo. Use both tables below. |
| 3. Writes / RLS | **No public INSERT** — updates via dashboard, submissions post-event | Public crowdsourced logging — any student logs a call → pin drops/updates | **This is the real call (see §4).** The crowdsourced loop is what won 5th place. Recommend enabling public writes with light guardrails, not locking it down. |

Decision 3 is the important one. The whole "every green pin is a verified phone call"
flywheel depends on students being able to write. Locking writes to the dashboard
(SPEC's original plan) kills the feature that made the demo. Recommendation: enable
public INSERT on `contact_logs` and controlled UPDATE on `clinics` (§4), matching the
public-INSERT pattern you already run on AP MED's mentor/mentee tables.

---

## 1. Supabase schema

Two tables. `clinics` is the map; `contact_logs` is the outreach history (one-to-many).
Note `providers` is **`jsonb`** (array of objects), not `text[]` — this is the one place
the base44 model differs from AP MED's array-column pattern.

```sql
-- ---------- clinics ----------
create table clinics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  address text not null,
  city text not null,
  state text not null check (state in ('NJ','NY')),
  zip text not null,
  lat double precision,
  lng double precision,
  phone text,
  status text not null default 'unknown'
    check (status in ('unknown','verified_yes','verified_no','call_back')),
  provider_count int not null default 1,
  specialties text[] not null default '{}',
  providers jsonb not null default '[]',          -- [{ "name": "Dr. Smith", "response": "yes" }]
  contact_email text,
  npi text,
  last_verified date,
  verified_by text,
  notes text,
  source text not null default 'nppes'             -- 'nppes' | 'student_search' | 'demo'
);

create index clinics_status_idx on clinics (status);
create index clinics_state_idx  on clinics (state);

-- ---------- contact_logs ----------
create table contact_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  outcome text not null check (outcome in ('yes','no','call_back','no_answer')),
  notes text,
  logged_by text,
  contact_email text
);

create index contact_logs_clinic_idx on contact_logs (clinic_id);
```

**Naming note:** base44 uses `created_date`; we use Postgres-standard `created_at`.
Every `-created_date` sort in the reference code becomes
`.order('created_at', { ascending: false })`.

---

## 2. RLS policies

Reflects Decision 3 (crowdsourced writes ON). If you decide to lock writes down instead,
drop the INSERT/UPDATE policies and do all writes with the service-role key.

```sql
alter table clinics       enable row level security;
alter table contact_logs  enable row level security;

-- Anyone can read the map.
create policy "clinics public read"  on clinics      for select using (true);
create policy "logs public read"     on contact_logs for select using (true);

-- Students can add a clinic from the search flow, and append call logs.
create policy "clinics public insert" on clinics      for insert with check (true);
create policy "logs public insert"    on contact_logs for insert with check (true);

-- Students can flip status / append providers / add contact_email via the log-call flow.
-- (Broad for the MVP; tighten post-event — see guardrails in §4.)
create policy "clinics public update" on clinics      for update using (true) with check (true);
```

Seed scripts still use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Never expose it client-side.

---

## 3. base44 call → Next.js/Supabase equivalent

Every base44 SDK call in `reference-base44/` and its replacement. This is the literal
find-and-replace map for the port.

| Reference file | base44 call | Supabase / Next.js replacement |
|---|---|---|
| `pages/Home.jsx` | `base44.entities.Clinic.list(null, 1000)` | `supabase.from('clinics').select('*').limit(1000)` |
| `SearchLogForm.jsx` | `base44.entities.Clinic.create({...})` | `supabase.from('clinics').insert({...}).select().single()` |
| `LogCallForm.jsx` | `base44.entities.Clinic.update(id, updates)` | `supabase.from('clinics').update(updates).eq('id', id).select().single()` |
| `ContactHistory.jsx` | `base44.entities.ContactLog.filter({ clinic_id }, "-created_date")` | `supabase.from('contact_logs').select('*').eq('clinic_id', id).order('created_at', { ascending: false })` |
| `LogCallForm.jsx` / `SearchLogForm.jsx` | `base44.entities.ContactLog.create({...})` | `supabase.from('contact_logs').insert({...}).select().single()` |
| `Search.jsx` | `base44.functions.invoke("tavilySearch", { query })` | `fetch('/api/search', { method:'POST', body: JSON.stringify({ query }) })` |
| `SearchLogForm.jsx` | `base44.functions.invoke("geocodeAddress", {...})` | `fetch('/api/geocode', { method:'POST', body: JSON.stringify({...}) })` |

Delete entirely: `src/api/base44Client.js`, `src/lib/app-params.js`,
`src/lib/AuthContext.jsx`, `base44/` folder, and the `@base44/*` deps.

`src/lib/supabase.ts` — same anon-client pattern as AP MED.

---

## 4. Edge functions → Next.js route handlers

Both base44 Deno functions port almost line-for-line to App Router route handlers.

### `src/app/api/search/route.ts` (was `tavilySearch`)

Server-side only — keep the Tavily key off the client.

```ts
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query) return Response.json({ error: 'query required' }, { status: 400 });

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query: `${query} clinic doctor office phone number address`,
      max_results: 8,
      search_depth: 'basic',
    }),
  });
  if (!res.ok) return Response.json({ error: 'search failed' }, { status: 502 });

  const data = await res.json();
  const phoneRe = /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g;
  const results = (data.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    content: (r.content || '').slice(0, 320),
    phones: [...new Set(((r.content || '').match(phoneRe) || []).slice(0, 3))],
  }));
  return Response.json({ results });
}
```

### `src/app/api/geocode/route.ts` (was `geocodeAddress`)

Free US Census geocoder — **no key, no billing, results are OK to store.** Keep this
over Google Places (this matches SPEC.md's geocoding decision too).

```ts
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { address, city, state, zip } = await req.json();
  if (!address || !city || !state)
    return Response.json({ error: 'address, city and state are required' }, { status: 400 });

  const q = encodeURIComponent(`${address}, ${city}, ${state} ${zip || ''}`);
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${q}&benchmark=Public_AR_Current&format=json`;
  const res = await fetch(url);
  if (!res.ok) return Response.json({ error: 'geocoder unavailable' }, { status: 502 });

  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) return Response.json({ matched: false });
  return Response.json({ matched: true, lat: match.coordinates.y, lng: match.coordinates.x });
}
```

**Status-derivation logic to preserve** (from `LogCallForm.jsx` — this is the product's
brain, port it exactly): after a log, push `{name,response}` onto `providers` unless
outcome is `call_back`; a clinic is `verified_yes` if **any** provider said yes; `verified_no`
only if a "no" and no prior yes; `call_back` only if it was `unknown`. The pin-color rule
lives in `reference-base44/src/lib/status.js` → `effectiveStatus()` — **copy that file as-is.**

### Guardrails to add during the port (weren't in the 2-hr build)
- Rate-limit `/api/search` and the clinic-insert path (Tavily costs money; open INSERT invites spam).
- Server-side geocode validation before an INSERT lands a pin (the demo had a Brooklyn
  number under a Hoboken clinic — bad search data pollutes the map).
- Consider a `verified_at` staleness decay post-event so old "yes" pins fade.

---

## 5. Dependency diet

The export ships ~70 deps (base44 dumps the full shadcn/Radix kit). The CanIShadow
components use almost none of it. Rebuild needs roughly:

**Keep:** `react-leaflet` + `leaflet`, `framer-motion` (drawer), `lucide-react` (icons),
`@supabase/supabase-js`, and either `moment` or (better) `date-fns` for the date formatting.

**Drop:** everything `@base44/*`, `@stripe/*`, `three`, `recharts`, `react-quill`,
`canvas-confetti`, `jspdf`, `html2canvas`, and the unused `src/components/ui/*` shadcn
files — the `canishadow/` components are hand-rolled and don't import them.

---

## 6. Rebuild file tree

```
canishadow/                          # (this repo — build here, NOT in reference-base44/)
├── src/
│   ├── app/
│   │   ├── layout.tsx               # fonts (Instrument Serif display + mono), metadata
│   │   ├── page.tsx                 # server comp: fetch clinics, render <MapView/> ('force-dynamic')
│   │   ├── search/page.tsx          # the Tavily search + log flow
│   │   └── api/
│   │       ├── search/route.ts      # §4
│   │       └── geocode/route.ts     # §4
│   ├── components/
│   │   ├── MapView.tsx              # port of reference MapView.jsx (Leaflet + CARTO)
│   │   ├── ClinicDrawer.tsx         # framer-motion bottom sheet
│   │   ├── ProviderList.tsx         # provider-count dropdown (yes/no names)
│   │   ├── ContactHistory.tsx       # outreach log + LogCallForm
│   │   ├── LogCallForm.tsx          # status-derivation logic lives here
│   │   ├── SearchLogForm.tsx        # geocode → insert clinic + log
│   │   ├── FilterBar.tsx  ├─ Legend.tsx  ├─ Header.tsx  └─ StatusBadge.tsx
│   ├── lib/
│   │   ├── supabase.ts              # anon client (AP MED pattern)
│   │   └── status.ts                # copy reference-base44/src/lib/status.js verbatim
│   └── types/clinic.ts
├── scripts/
│   ├── seed-nppes.ts                # from SPEC.md §Seed pipeline (real data — base44 skipped this)
│   └── geocode.ts                   # Census batch geocoder
├── data/zips.ts                     # from SPEC.md
├── MIGRATION.md  ├─ SPEC.md  ├─ PRM.md  ├─ build-log.md  ├─ index.md
├── reference-base44/                # read-only reference (do not build here)
└── README.md · LICENSE (MIT)
```

The seed pipeline (`seed-nppes.ts` + `geocode.ts`) is the one big piece base44 never
built — it hand-seeded ~51 demo pins instead. For real data, build it per SPEC.md §Seed.

---

## 7. Env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # seed scripts ONLY — never NEXT_PUBLIC, never client-imported
TAVILY_API_KEY=                # server-only, used by /api/search
```

No Mapbox token (Leaflet + CARTO are free). No geocoder key (Census is free).

---

## 8. Suggested build order (Claude Code kickoff)

> Read `MIGRATION.md`, `SPEC.md`, and skim `reference-base44/`. We're rebuilding CanIShadow
> on Next.js App Router + TS + Tailwind + Supabase, reusing the base44 export as reference.
> Confirm the three decisions in MIGRATION.md §0 with me first, then work in phases,
> stopping for review at each:
>
> **Phase 1 — scaffold + schema.** `create-next-app`, Supabase client in `src/lib/supabase.ts`,
> run the §1 DDL + §2 RLS in Supabase, `Clinic`/`ContactLog` types in `src/types`, copy
> `status.ts` from reference verbatim, `.env.local.example` per §7. Checkpoint: empty
> full-screen Leaflet/CARTO map centered on 40.72,-74.10.
>
> **Phase 2 — read path.** Port `MapView`, `ClinicDrawer`, `ProviderList`, `ContactHistory`,
> `FilterBar`, `Legend`, `Header`, `StatusBadge` from reference, swapping base44 reads for
> Supabase (§3). Seed a few rows by hand to see pins. Checkpoint: tap pin → drawer with
> provider dropdown + outreach history, on a 390px viewport.
>
> **Phase 3 — write path (the flywheel).** `/api/search` + `/api/geocode` route handlers
> (§4), then `search/page.tsx`, `SearchLogForm`, `LogCallForm` with the exact status-derivation
> logic. Add the §4 guardrails (rate limit, geocode validation). Checkpoint: search a real
> clinic → log "said yes" → pin drops green.
>
> **Phase 4 — real data.** `seed-nppes.ts` + `geocode.ts` per SPEC.md §Seed (base44 skipped this).
>
> Conventions: `export const dynamic = 'force-dynamic'` on any route reading Supabase;
> never expose `SUPABASE_SERVICE_ROLE_KEY` client-side; never run `npm audit fix --force`;
> mobile-first, 44px tap targets.
```
