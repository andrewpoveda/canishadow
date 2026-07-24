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
| 4. Clinic search | (not specified — SPEC seeds from NPPES) | **Tavily** web search (paid API / hackathon credits, inconsistent data) | **Drop Tavily as the default. Use NPPES** — free, no key, authoritative federal provider registry, same source we seed from. Tavily demoted to an optional feature flag (§4). App runs on $0 with no search key. |

Decision 3 is the important one. The whole crowdsourced flywheel depends on students
being able to write. Locking writes to the dashboard (SPEC's original plan) kills the
feature that made the demo. Recommendation: enable public INSERT on `contact_logs` and
controlled UPDATE on `clinics` (§4), matching the public-INSERT pattern you already run
on AP MED's mentor/mentee tables.

### 0.1 Two independent axes — colour ≠ verified

This corrects base44's model, which wrongly conflated "has a call outcome" with "verified."
CanIShadow has **two separate axes**, and they must not be merged:

- **Colour = call outcome** (`status` / `effectiveStatus`): green `verified_yes` · red
  `verified_no` · yellow `call_back` · gray `unknown` (not yet called).
- **Trust = `verified` boolean**: `true` = **AP MED team double-checked it**; `false` =
  **crowdsourced** — a public student logged it, not yet team-confirmed.

So a pin can be *verified green* (team called and confirmed a yes) or *unverified green*
(a student logged a yes, pending team review) — same colour, different trust. The
**All / Verified / Unverified filter keys off the `verified` boolean, not off colour.**

Why this matters for Decision 3: open public writes are safe *because* everything a student
logs lands as `verified = false`. Crowdsourced pins are visibly provisional until your team
promotes them, so the trust signal ("every green pin is a verified phone call") stays intact
for the Verified view while the Unverified view carries the community-sourced volume.

> Open sub-question for you: in the filter, should **Unverified** mean *only* crowdsourced
> logs (with not-yet-called gray pins as a separate third bucket / hidden), or should
> Unverified = everything not team-verified (crowdsourced **and** uncalled)? Pick one Monday;
> it only changes the filter predicate, not the schema.

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
  verified boolean not null default false,         -- true = AP MED team double-checked; false = crowdsourced/uncalled (drives the Verified/Unverified filter — see §0.1)
  last_verified date,
  verified_by text,                                -- name of the team member who verified (when verified = true)
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
| `Search.jsx` | `base44.functions.invoke("tavilySearch", { query })` | `fetch('/api/search', { method:'POST', body: JSON.stringify({ city, state, specialty }) })` — now NPPES-backed (§4), structured input not free text |
| `SearchLogForm.jsx` | `base44.functions.invoke("geocodeAddress", {...})` | `fetch('/api/geocode', { method:'POST', body: JSON.stringify({...}) })` |

**Filter predicate — change from the reference.** `Home.jsx` computes the Verified count as
`effectiveStatus(c) !== "unknown"` (i.e. "has an outcome"). Per §0.1 that's wrong for us:
Verified must key off the `verified` boolean. Replace with `clinics.filter(c => c.verified)`
for the Verified bucket and `c => !c.verified` for Unverified (or the three-way split if you
choose it). Colour still comes from `effectiveStatus`; the filter no longer does.

Delete entirely: `src/api/base44Client.js`, `src/lib/app-params.js`,
`src/lib/AuthContext.jsx`, `base44/` folder, and the `@base44/*` deps.

`src/lib/supabase.ts` — same anon-client pattern as AP MED.

---

## 4. Edge functions → Next.js route handlers

Both base44 Deno functions port almost line-for-line to App Router route handlers.

### Clinic search — provider abstraction (NPPES default, no Tavily lock-in)

**Decision (§0 row 4):** search is never hardcoded to a vendor. It goes behind a small
`ClinicSearchProvider` interface with swappable implementations. Default = **NPPES**
(free, no key, medical-specific, authoritative). Tavily is an optional flag using your
hackathon credits — off by default, and if it's off or out of credits the app falls back
to NPPES with zero breakage. Manual entry in `SearchLogForm` is always the final fallback.

```
src/lib/search/
├── types.ts        # ClinicSearchResult, ClinicSearchProvider interface
├── nppes.ts        # default — free federal NPI registry
├── tavily.ts       # optional — only used if SEARCH_PROVIDER=tavily & key present
└── index.ts        # picks provider from env, defaults to nppes
```

```ts
// src/lib/search/types.ts
export type ClinicSearchResult = {
  name: string; phone?: string;
  address?: string; city?: string; state?: string; zip?: string;
  npi?: string; specialties?: string[];
};
export interface ClinicSearchProvider {
  search(input: { city: string; state: string; specialty?: string }): Promise<ClinicSearchResult[]>;
}
```

#### `src/lib/search/nppes.ts` (default — free, no key)

NPPES NPI Registry API is public domain, no auth, and returns clinic name + practice-location
address + phone, filtered to real providers. Same source as the seed pipeline (SPEC.md §Seed),
so the taxonomy-prefix filtering matches.

```ts
import type { ClinicSearchProvider, ClinicSearchResult } from './types';

// FM 207Q*, IM 207R*, Peds 2080* — keep in sync with the seed pipeline
const KEEP = ['207Q', '207R', '2080'];

export const nppes: ClinicSearchProvider = {
  async search({ city, state, specialty }) {
    const params = new URLSearchParams({
      version: '2.1', city, state, limit: '50',
      ...(specialty ? { taxonomy_description: specialty } : {}),
    });
    const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params}`);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results || [])
      .filter((r: any) => (r.taxonomies || []).some((t: any) => KEEP.some((k) => t.code?.startsWith(k))))
      .map((r: any): ClinicSearchResult => {
        const loc = (r.addresses || []).find((a: any) => a.address_purpose === 'LOCATION') || r.addresses?.[0] || {};
        const name = r.basic?.organization_name
          || [r.basic?.first_name, r.basic?.last_name].filter(Boolean).join(' ')
          || `Medical Office — ${loc.address_1 || ''}`;
        return {
          name, phone: loc.telephone_number, address: loc.address_1,
          city: loc.city, state: loc.state, zip: (loc.postal_code || '').slice(0, 5),
          npi: r.number,
          specialties: (r.taxonomies || []).map((t: any) => t.desc).filter(Boolean),
        };
      });
  },
};
```

#### `src/lib/search/index.ts`

```ts
import { nppes } from './nppes';
// import { tavily } from './tavily'; // optional — only if you wire it later
export function getSearchProvider() {
  // if (process.env.SEARCH_PROVIDER === 'tavily' && process.env.TAVILY_API_KEY) return tavily;
  return nppes;
}
```

#### `src/app/api/search/route.ts`

```ts
export const runtime = 'nodejs';
import { getSearchProvider } from '@/lib/search';

export async function POST(req: Request) {
  const { city, state, specialty } = await req.json();
  if (!city || !state) return Response.json({ error: 'city and state required' }, { status: 400 });
  try {
    const results = await getSearchProvider().search({ city, state, specialty });
    return Response.json({ results });
  } catch {
    return Response.json({ error: 'search failed' }, { status: 502 });
  }
}
```

**UI adaptation:** NPPES needs structured `city` + `state` (and optional specialty), not a
free-text blob. Change the search form from one text box to: a city input, an NJ/NY select,
and an optional specialty select (Family Medicine / Internal Medicine / Pediatrics). The
result card + `SearchLogForm` already carry name/phone/address, so they map onto
`ClinicSearchResult` directly. Manual entry stays available for anything search misses.

Tavily (`reference-base44/base44/functions/tavilySearch/entry.ts`) is kept in the reference
folder only — port it into `src/lib/search/tavily.ts` later *if* you ever want broad-web
coverage on your credits. Not needed to ship.

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
- Rate-limit the clinic-insert path (open INSERT invites spam). NPPES itself is free, but
  be polite to it — cache/debounce repeat searches.
- Server-side geocode validation before an INSERT lands a pin. Less of a risk now that
  NPPES returns structured, real practice addresses (vs Tavily's scraped web blurbs), but
  still validate the Census match before dropping a pin.
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
│   │   ├── search/page.tsx          # NPPES search (city/state/specialty) + log flow
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
│   │   ├── status.ts                # copy reference-base44/src/lib/status.js verbatim
│   │   └── search/                  # ClinicSearchProvider — nppes (default) + optional tavily (§4)
│   │       ├── types.ts  ├─ nppes.ts  ├─ tavily.ts (optional)  └─ index.ts
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

# Optional — leave unset to run 100% free on NPPES:
# SEARCH_PROVIDER=tavily       # only if you ever opt into broad-web search
# TAVILY_API_KEY=              # only needed when SEARCH_PROVIDER=tavily
```

**Supabase keys are the only required secrets.** No Mapbox token (Leaflet + CARTO are free),
no geocoder key (Census is free), no search key (NPPES is free). The app ships on $0.

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
> **Phase 3 — write path (the flywheel).** Build the `ClinicSearchProvider` abstraction
> with **NPPES as the default provider** (§4) — free, no key, do NOT use Tavily. Then
> `/api/search` (NPPES-backed) + `/api/geocode` route handlers, then `search/page.tsx` with
> structured city/state/specialty inputs, `SearchLogForm`, `LogCallForm` with the exact
> status-derivation logic. Add the §4 guardrails. Checkpoint: search a real clinic → log
> "said yes" → pin drops green (unverified).
>
> **Phase 4 — real data.** `seed-nppes.ts` + `geocode.ts` per SPEC.md §Seed (base44 skipped this).
>
> Conventions: `export const dynamic = 'force-dynamic'` on any route reading Supabase;
> never expose `SUPABASE_SERVICE_ROLE_KEY` client-side; never run `npm audit fix --force`;
> mobile-first, 44px tap targets.
```
