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
| 1. Map | Mapbox via `react-map-gl` (needs paid token; geocoding TOS headaches) | **Leaflet + OpenStreetMap tiles** (`react-leaflet`) | **Keep Leaflet, but use OpenStreetMap tiles.** CARTO began requiring API keys in August 2026; direct OpenStreetMap tiles keep the current low-traffic app keyless. Drop Mapbox from SPEC. |
| 2. Data model | One `clinics` table, 3-state status, pins = locations only | Added `call_back` status, embedded `providers[]`, `contact_email`, **a second `ContactLog` table**, per-provider yes/no | **Keep the richer base44 model.** The provider-level detail + contact history is the demo. Use both tables below. |
| 3. Writes / RLS | **No public INSERT** — updates via dashboard, submissions post-event | Public crowdsourced logging — any student can log a call | Keep anonymous call logging through bounded RPCs. NPI-specific outcomes stay attached to their selected targets and do not change a shared location pin's status. |
| 4. Clinic search | (not specified — SPEC seeds from NPPES) | **Tavily** web search (paid API / hackathon credits, inconsistent data) | Use the free NPPES API directly. The live target flow is NPPES-only because web snippets do not provide a stable NPI plus exact practice location. NPPES data is unconfirmed registry data, not proof that a phone works or a practice is open. |

Decision 3 is the important one. The whole crowdsourced flywheel depends on students
being able to write. The shipped path uses bounded, idempotent RPCs instead of direct public
inserts, so call outcomes keep their selected target and contact reports cannot mutate the
shadowing ledger.

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

NPPES search calls retain the selected NPI target in `contact_logs` and do not change a
location pin's shadowing status. Co-located NPI records are not assumed to belong to the same
clinic. The existing map drawer's manual location call can still update that location's status.

> Open sub-question for you: in the filter, should **Unverified** mean *only* crowdsourced
> logs (with not-yet-called gray pins as a separate third bucket / hidden), or should
> Unverified = everything not team-verified (crowdsourced **and** uncalled)? Pick one Monday;
> it only changes the filter predicate, not the schema.

---

## 1. Supabase schema

Three tables. `clinics` is the map of physical locations, `contact_logs` is the call history,
and `contact_reports` stores contact-quality reports separately from shadowing outcomes.
`clinics` retains the composite `(address, zip)` location key. NPI-specific details live on each
call/report record, so multiple NPIs at one address do not silently become one target.
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
  state text not null check (state in (
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL',
    'GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
    'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
    'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
    'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI',
    'WY','AS','GU','MP','PR','VI'
  )),
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
create unique index clinics_addr_zip_key on clinics (address, zip);

-- ---------- contact_logs ----------
create table contact_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  outcome text not null check (outcome in ('yes','no','call_back','no_answer')),
  notes text,
  logged_by text,
  contact_email text,
  submission_key uuid,
  target_npi text,
  target_enumeration_type text,                -- NPI-1 | NPI-2
  target_name text,
  target_address text,                         -- full canonical practice address, including suite/unit
  target_city text,
  target_state text,
  target_zip text,
  target_phone text,
  target_specialties text[] not null default '{}',
  target_source text,                          -- NPPES NPI Registry | CanIShadow map location
  target_phone_source text,
  target_phone_status text                     -- unconfirmed for NPPES registry numbers
);

create index contact_logs_clinic_idx on contact_logs (clinic_id);
create unique index contact_logs_submission_key_key on contact_logs (submission_key)
  where submission_key is not null;

-- ---------- contact_reports ----------
create table contact_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  clinic_id uuid references clinics(id) on delete set null,
  reason text not null check (reason in ('wrong_number','practice_closed')),
  target_npi text not null,
  target_enumeration_type text not null,
  target_name text not null,
  target_address text not null,
  target_city text not null,
  target_state text not null,
  target_zip text not null,
  target_phone text,
  target_source text not null default 'NPPES NPI Registry',
  review_status text not null default 'pending_review',
  submission_key uuid not null unique
);
```

Contact-quality reports are not rows in `contact_logs`; they never count as `no`, and they do
not set a clinic/location status. A report applies only to the selected NPI and full practice
location and stays pending review until a person assesses it.

**Naming note:** base44 uses `created_date`; we use Postgres-standard `created_at`.
Every `-created_date` sort in the reference code becomes
`.order('created_at', { ascending: false })`.

---

## 2. RLS policies

Crowdsourced call writes use the narrowly granted `log_clinic_call(...)` security-definer RPC
from `supabase/migrations/20260922191944_preserve_nppes_call_target_identity.sql`. It locks the
location row, saves the exact target snapshot, and uses `submission_key` to make network retries
idempotent. The identity migration removes direct public inserts on
`contact_logs`; wrong-number/closed-practice reports use a separate `report_clinic_contact(...)`
RPC and `contact_reports` table. The applied identity migration revokes direct contact-log writes;
legacy broad clinic insert/update policies remain for the coordinated app/database rollout
and should be tightened separately.

```sql
alter table clinics       enable row level security;
alter table contact_logs  enable row level security;
alter table contact_reports enable row level security;

-- Anyone can read the map.
create policy "clinics public read"  on clinics      for select using (true);
create policy "logs public read"     on contact_logs for select using (true);
create policy "contact reports public read" on contact_reports for select using (true);

-- Students can add a clinic from the search flow, and append call logs.
create policy "clinics public insert" on clinics      for insert with check (true);
-- No direct contact_logs or contact_reports insert policy; writes go through RPCs.

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
| `pages/Home.jsx` | `base44.entities.Clinic.list(null, 1000)` | `fetchMappableClinics()` paginates stable 1,000-row Supabase ranges until the full ledger is loaded |
| `SearchLogForm.jsx` | clinic create + call log | `logClinicCall(...)` → transactional `log_clinic_call` RPC |
| `LogCallForm.jsx` | clinic update + call log | `logClinicCall(...)` → the same row-locking RPC |
| `ContactHistory.jsx` | `base44.entities.ContactLog.filter({ clinic_id }, "-created_date")` | Read call snapshots from `contact_logs` and separate pending contact reports from `contact_reports`; report rows never count as calls. |
| `LogCallForm.jsx` / `SearchLogForm.jsx` | `base44.entities.ContactLog.create({...})` | included atomically in `log_clinic_call`; retries reuse `submission_key` |
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

### Clinic search — free NPPES records with explicit target identity

The live search calls NPPES directly. The interface remains small, but only the NPPES adapter
is wired into the result/log flow: every actionable result must carry an NPI, enumeration type,
and exact practice location. Web snippets and paid place directories are not used as a fallback.

```
src/lib/search/
├── types.ts        # ClinicSearchResult, ClinicSearchProvider interface
├── validation.ts   # request validation + NYC/DC city aliases
├── nppes.ts        # default — free federal NPI registry
├── nppes.test.ts   # provider/validation regressions
└── index.ts        # selects the NPPES registry adapter
```

```ts
// src/lib/search/types.ts
export type ClinicSearchResult = {
  name: string; phone?: string;
  address?: string; city?: string; state?: UsStateCode; zip?: string;
  npi?: string; specialties?: string[]; providerCount?: number;
  enumerationType?: 'NPI-1' | 'NPI-2';
  phoneSource?: 'NPPES NPI Registry'; phoneStatus?: 'unconfirmed';
};
export interface ClinicSearchProvider {
  search(input: ClinicSearchInput): Promise<ClinicSearchResult[]>;
}
```

#### `src/lib/search/nppes.ts` (default — free, no key)

NPPES NPI Registry API is public, read-only, and requires no auth. It returns registered
provider/organization names, practice locations, and phone numbers. An NPI identifies a
registry record; active status does not prove a phone is current or a practice is open. The
production adapter in `src/lib/search/nppes.ts` is the source of truth:

1. Query each requested primary-care taxonomy (all three when no specialty is selected)
   separately for NPI-2 organizations and NPI-1 individuals, up to NPPES's 200-row limit.
2. Validate responses with Zod and keep active 207Q/207R/2080 taxonomy records only.
3. Choose an exact requested-city/state address from primary or secondary practice locations;
   never fall back to mailing/billing addresses.
4. Normalize address formatting while retaining suite, floor, and unit values. Deduplicate only
   by `(enumeration type, NPI, full canonical practice address, city, state, ZIP)`. Different NPIs remain
   separate even at the same suite. Only duplicate observations of one NPI/location may combine
   specialties or use that same target's phone; a co-located NPI never supplies a name or phone.
5. Rank organizations and phone-bearing records first and return at most 50 individual targets.
   Each phone remains attached to its NPI and is labeled as unconfirmed NPPES data.
6. Time out, retry transient failures once, accept partial NPI-type success, and cache bounded
   repeat searches for 15 minutes.

#### `src/lib/search/index.ts`

The search route always uses NPPES. The optional Tavily adapter is no longer wired because
scraped text does not supply a stable NPI/practice-location target.

#### `src/app/api/search/route.ts`

The Node route rejects oversized/invalid bodies, canonicalizes aliases through
`parseSearchInput`, returns the canonical query with its results, disables response caching,
and returns a clear 502 when every upstream registry request fails.

**UI adaptation:** NPPES needs structured `city` + `state` (and optional specialty), not a
free-text blob. The shipped form accepts every U.S. state and territory plus an optional
specialty (Family Medicine / Internal Medicine / Pediatrics). `NYC`, `New York City`, and
`Manhattan` normalize to NPPES's `New York` value. An "all primary care" search issues
targeted requests for all three supported taxonomies, queries both NPI-1 and NPI-2, includes
matching secondary `practiceLocations`, then deduplicates individual targets by NPI plus full
canonical practice address and ZIP, retaining suites/units. The result card links each phone to
its own NPI and labels the number as unconfirmed NPPES data. The result identity fields are
read-only in `SearchLogForm`, so geocoding, logging, and history keep the selected NPI and full
suite address.

Wrong-number and practice-closed reports go to `contact_reports`, separate from shadowing call
outcomes. They apply only to the selected NPI/location, remain pending review, and do not update
the location pin or infer that a wider organization is closed. NPI call outcomes also remain
target-level and do not change the location pin's shadowing status; the map drawer's manual
location call remains the location-level status path.

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

**Location-level status logic to preserve** (from `LogCallForm.jsx`): after a map-location call,
push `{name,response}` onto `providers` unless outcome is `call_back`; a clinic is
`verified_yes` if **any** provider said yes; `verified_no` only if a "no" and no prior yes;
`call_back` only if it was `unknown`. NPI-specific search calls keep their outcomes in
`contact_logs` and do not change location status. The pin-color rule lives in
`reference-base44/src/lib/status.js` → `effectiveStatus()` — **copy that file as-is.**

### Guardrails to add during the port (weren't in the 2-hr build)
- Rate-limit the clinic-insert path (open INSERT invites spam). NPPES itself is free, but
  be polite to it — cache/debounce repeat searches.
- Server-side geocode validation before an INSERT lands a pin. NPPES returns structured
  practice addresses, but still validate the Census match before dropping a pin.
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
│   │   ├── search/page.tsx          # Nationwide NPPES search (city/state/specialty) + log flow
│   │   └── api/
│   │       ├── search/route.ts      # §4
│   │       └── geocode/route.ts     # §4
│   ├── components/
│   │   ├── MapView.tsx              # port of reference MapView.jsx (Leaflet + OpenStreetMap)
│   │   ├── ClinicDrawer.tsx         # framer-motion bottom sheet
│   │   ├── ProviderList.tsx         # provider-count dropdown (yes/no names)
│   │   ├── ContactHistory.tsx       # target-specific call history + separate contact reports
│   │   ├── LogCallForm.tsx          # status-derivation logic lives here
│   │   ├── SearchLogForm.tsx        # geocode full suite address → log selected NPI target
│   │   ├── ReportContactForm.tsx    # wrong-number / closed-practice report, separate from calls
│   │   ├── FilterBar.tsx  ├─ Legend.tsx  ├─ Header.tsx  └─ StatusBadge.tsx
│   ├── lib/
│   │   ├── supabase.ts              # anon client (AP MED pattern)
│   │   ├── status.ts                # copy reference-base44/src/lib/status.js verbatim
│   │   └── search/                  # NPPES search with NPI + full-location identity (§4)
│   │       ├── types.ts  ├─ nppes.ts  └─ index.ts
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

```

**Supabase keys are the only required secrets.** No Mapbox token (Leaflet + OpenStreetMap tiles are keyless),
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
> with the free NPPES adapter as the only live provider (§4). Then
> `/api/search` (NPPES-backed) + `/api/geocode` route handlers, then `search/page.tsx` with
> structured U.S. city/state/specialty inputs, `SearchLogForm`, and `ReportContactForm`.
> Keep each NPI target distinct; an NPI-specific call stays in target history and does not
> change the location-level map status. The map drawer's manual location call remains the
> location-status path.
>
> **Phase 4 — real data.** `seed-nppes.ts` + `geocode.ts` per SPEC.md §Seed (base44 skipped this).
>
> Conventions: `export const dynamic = 'force-dynamic'` on any route reading Supabase;
> never expose `SUPABASE_SERVICE_ROLE_KEY` client-side; never run `npm audit fix --force`;
> mobile-first, 44px tap targets.
```
