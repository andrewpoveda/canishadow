# CanIShadow — Sprint Spec (Mon Jul 13 → Wed Jul 15)

**Goal:** a pitchable, phone-first demo live at canishadow.com by Wednesday night, July 15. Demo bar: stranger opens it on your phone, sees a live map of real NJ/NYC clinics, taps a pin, drawer slides up, understands the product in 20 seconds.

**What this is:** open-source map of clinics that do / don't take shadowing students. Gray pins = unknown, green = verified yes, red = verified no. Verification happens via cold calls (the content series).

**Explicitly OUT of scope this week:** auth, crowdsourced submissions, opt-out flow, PWA wrapper, admin UI. Status updates happen manually in the Supabase dashboard until post-event.

---

## Locked decisions

| Decision | Choice |
|---|---|
| Name / domain | CanIShadow — canishadow.com (Porkbun, ~$11/yr) |
| Seed scope | Essex County NJ + Hudson County NJ + Manhattan |
| Specialties | Family Medicine, Internal Medicine, Pediatrics only |
| Branding | Separate repo/brand, "built by Andrew Poveda (AP MED)" in README + footer |
| License | MIT |

---

## Stack & conventions (match AP MED patterns)

> **SUPERSEDED (map + env vars) — see MIGRATION.md §0/§7 and build-log.md 2026-07-24.**
> The app shipped on **Leaflet + free OpenStreetMap tiles**, NOT Mapbox. There is no `NEXT_PUBLIC_MAPBOX_TOKEN`
> — the only required secrets are the three Supabase keys (NPPES search, US Census geocode, and
> OpenStreetMap tiles are all free/no-key). The bullets/env block below are the original pre-build plan.

Current observability uses `@sentry/nextjs` across browser, Node.js, and edge runtimes. The App
Router global error boundary reports render failures, navigation tracing is initialized through
the instrumentation entry points, and the Next.js config tunnels browser events through
`/monitoring` while preserving the existing PostHog rewrites. User information, cookies, headers,
bodies, query parameters, database values, and stack-frame locals are excluded from events, and
Session Replay is disabled; traces sample at 100% in development and 10% in production. The Sentry
auth token is build-only and optional at runtime; it is used solely for production source-map uploads.
Expected validation/no-match responses are not reported, while caught Supabase, NPPES, Census, and
call-log failures are captured before the existing fallback UI or HTTP response is returned. These
handled errors use generic messages and allowlisted error name/code tags rather than forwarding raw
database or service error details that could echo submitted form values.
The browser-only `beforeSend` filter excludes CANISHADOW-4's exact unhandled `getReader`
TypeError signature only when its stack consists entirely of injected `<script>` frames and
`ext:core/01_core.js` runtime frames. Missing evidence, application frames, other messages,
and chained exceptions remain reportable; server and edge reporting are unchanged.

- Next.js App Router + TypeScript + Tailwind, deployed on Vercel
- Supabase (Postgres) — **new project**, not the AP MED project
- Mapbox GL via `react-map-gl`
- Any route/page that reads from Supabase: `export const dynamic = 'force-dynamic'`
- **Never** run `npm audit fix --force`
- Env vars:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
SUPABASE_SERVICE_ROLE_KEY=   # seed scripts ONLY — never NEXT_PUBLIC, never imported client-side
```

---

## Database schema

> **SUPERSEDED — see MIGRATION.md §1/§2 and build-log.md.** The live rebuild uses three tables:
> `clinics` is the map's location row with the composite `(address, zip)` key, `contact_logs`
> stores each selected NPI/full-address target snapshot, and `contact_reports` stores pending
> contact-quality reports separately from shadowing outcomes. Address normalization preserves
> suites/floors/units. NPI-specific outcomes do not change a shared location pin's status, and a
> contact report never counts as shadowing `no` or closes a wider organization.
>
> The app also has a **4-state** status, `providers` jsonb, a separate `verified` trust flag, and
> anonymous idempotent call logging. The first two checked-in migrations expanded state coverage
> and installed atomic call logging; build-log.md records them as applied to production. The
> identity migration `20260922191944_preserve_nppes_call_target_identity.sql` is applied to
> production. The deployed site still needs the matching client update; the old call-log RPC was
> retired so logs cannot silently omit the selected NPI. The original seed scope below describes
> only the preloaded NJ/NYC dataset.

One table. Pins are **locations**, not individual providers.

```sql
create table clinics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,                    -- org name from NPI-2, else "Medical Office — 123 Main St"
  address text not null,                 -- normalized street address (dedupe key)
  city text not null,
  state text not null,                   -- 'NJ' | 'NY'
  zip text not null,
  lat double precision,
  lng double precision,
  phone text,
  status text not null default 'unknown'
    check (status in ('unknown','verified_yes','verified_no')),
  provider_count int not null default 1, -- seed/map metadata; live NPI search targets stay separate
  specialties text[] not null default '{}',  -- e.g. {'Family Medicine','Pediatrics'}
  npi text,                              -- org NPI if from an NPI-2 record
  last_verified date,                    -- null until a real call happens
  verified_by text,                      -- 'andrew' for now; users later
  notes text,                            -- "front desk said email Dr. X", etc.
  source text not null default 'nppes'
);

create index clinics_status_idx on clinics (status);
create index clinics_state_idx on clinics (state);

alter table clinics enable row level security;

-- Public read, NOTHING else. Seed writes use the service role key (bypasses RLS).
create policy "public read" on clinics for select using (true);
```

Note: unlike AP MED, **no public INSERT policy**. Submissions come post-event, with auth.

---

## Seed pipeline (Monday's real work)

Two scripts, run locally with the service role key. Both idempotent (safe to re-run).

### Script 1 — `scripts/seed-nppes.ts`

Source: **NPPES NPI Registry API** (`https://npiregistry.cms.hhs.gov/api/?version=2.1`). Public domain, no key.

**Known API constraints — design around them:**
- `limit` max 200, `skip` max 1000 → **hard cap of 1,200 results per query combination.** Do NOT query "all of Newark" in one shot. Iterate zip-by-zip × taxonomy-by-taxonomy.
- Filter by `taxonomy_description` (the API doesn't take raw codes as a filter): `"Family Medicine"`, `"Internal Medicine"`, `"Pediatrics"`. Then post-filter results by taxonomy **code prefix** to kill false matches: keep `207Q*` (FM), `207R*` (IM), `2080*` (peds). Drop subspecialties that don't fit shadowing (e.g. 207R nephrology fellows are fine to keep — don't over-engineer; prefix match is enough).
- Use the **location address** (`address_purpose === 'LOCATION'`), never the mailing address.

**Pull strategy per zip:**
1. `enumeration_type=NPI-2` (organizations) — these give clean clinic names.
2. `enumeration_type=NPI-1` (individuals) — these give density.

**Dedupe/grouping (the step that makes the map look professional):**
1. Normalize address formatting while preserving suite/floor/unit labels and values (`STE`/`SUITE`, `FL`/`FLOOR`, `UNIT`, `#...`); standardize `STREET→ST`, `AVENUE→AVE`, etc.
2. Keep map locations keyed by the full normalized `(address, zip)` composite, including the suite or unit.
3. Do not merge NPI records, names, provider counts, or phones solely because they share an address. A phone stays with its source NPI and is labeled unconfirmed; combine provider metadata only when NPPES explicitly identifies a relationship to the same clinic.
4. Skip hospital campuses if they dominate (optional flag): addresses with provider_count > 75 are probably a hospital — keep them but they're low-value cold-call targets.

**Zip lists** (put in `data/zips.ts`):
- Essex NJ: 07102–07112 (Newark), 07017–07019 (East Orange), 07050–07052 (Orange/West Orange), 07042–07044 (Montclair/Verona), 07003 (Bloomfield), 07109 (Belleville), 07110 (Nutley), 07039 (Livingston), 07040–07041 (Maplewood/Millburn), 07079 (South Orange), 07068 (Roseland), 07006 (Caldwell)
- Hudson NJ: 07302–07307, 07310–07311 (Jersey City), 07030 (Hoboken), 07087 (Union City), 07093 (West New York), 07047 (North Bergen), 07002 (Bayonne), 07032 (Kearny), 07094 (Secaucus)
- Manhattan: 10001–10040 (skip 10004–10006/10041+ if volume is heavy — financial district is thin on primary care anyway; prioritize 10025–10040 uptown + 10001–10003, 10009–10016, 10019, 10021–10029)

Output of script 1: rows inserted with `lat/lng = null`.

### Script 2 — `scripts/geocode.ts`

**Do NOT use Mapbox geocoding to fill the DB.** Mapbox's standard (temporary) geocoding TOS prohibits storing results; permanent geocoding is a paid tier. Use the **US Census Bureau geocoder** instead — free, no key, public domain, and explicitly fine to store:

- Batch endpoint: `https://geocoding.geo.census.gov/geocoder/locations/addressbatch` — accepts a CSV of up to 10,000 addresses per request (id, street, city, state, zip), returns matched coordinates.
- Flow: select rows where `lat is null` → build CSV → POST → parse response → update rows.
- Rows that fail to match (typically 5–15% — NPI addresses can be stale/billing): mark `notes = 'geocode_failed'` and exclude from the map. Don't hand-fix them this week.

Acceptance bar for Monday: `select count(*) from clinics where lat is not null` returns 300+ across the three regions, and pins render.

---

## File tree

```
canishadow/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # metadata, fonts, favicon
│   │   ├── page.tsx              # server component: fetches clinics, renders <MapView/>
│   │   └── api/clinics/route.ts  # GET all clinics (force-dynamic) — used for client refresh
│   ├── components/
│   │   ├── MapView.tsx           # 'use client' — react-map-gl Map + cluster layer + markers
│   │   ├── ClinicDrawer.tsx      # bottom sheet: location name/status/address and target-aware call history
│   │   ├── FilterBar.tsx         # floating pills: All / Verified Yes / Unverified
│   │   └── Legend.tsx            # gray/green/red key, collapsible
│   ├── lib/supabase.ts           # anon client (same pattern as AP MED)
│   └── types/clinic.ts
├── scripts/
│   ├── seed-nppes.ts
│   └── geocode.ts
├── data/zips.ts
├── .env.local.example
├── LICENSE                       # MIT
└── README.md
```

---

## UI spec (Tuesday)

- **Full-screen map**, mobile-first. Initial viewport centered ~40.72, -74.10 (between Newark and lower Manhattan), zoom ~10.5.
- **Clustering ON** (`react-map-gl` + supercluster or Mapbox's built-in cluster source). Unclustered pin colors: gray `#9CA3AF` (unknown), green `#16A34A` (verified_yes), red `#DC2626` (verified_no). Verified pins slightly larger + subtle pulse on green.
- **Tap pin → bottom drawer** (mobile sheet, ~40% height, swipe to dismiss): location name, status badge, address, map-level provider metadata, and contact history. Do not show a location-level phone when its NPI/source is ambiguous; NPPES phone links stay with their individual search result and are labeled unconfirmed. NPI-specific call outcomes do not set location status.
- **FilterBar**: three pills top-center — All / ✅ Verified / Unverified. Filtering re-renders the source data client-side.
- **Header**: minimal — "CanIShadow" wordmark left, GitHub icon right. No nav.
- **Footer line in drawer or about modal**: "Free & open source. Built by Andrew Poveda · AP MED".
- Empty/loading states: skeleton map tint + "loading clinics…" toast.
- Lighthouse-level polish not required; **thumb-reach and tap targets are** (44px min).

---

## Day-by-day plan

### Weekend (before Monday, ~1–2 hrs)
- [ ] Buy canishadow.com on Porkbun
- [ ] Create GitHub repo `canishadow` (public, MIT), new Supabase project, Mapbox account/token
- [ ] Run the schema SQL in Supabase
- [ ] `create-next-app` scaffold pushed to main

### Monday — plumbing (6–8 hrs)
- [ ] Supabase client + types
- [ ] `seed-nppes.ts` (fetch → filter → normalize → group → insert)
- [ ] `geocode.ts` (Census batch)
- [ ] Basic map rendering pins from DB
- **EOD bar:** 300+ real geocoded clinics on a real map. Ugly is fine.

### Tuesday — demo surface (6–8 hrs)
- [ ] Clustering + status colors
- [ ] ClinicDrawer with all fields
- [ ] FilterBar + Legend
- [ ] Mobile pass on your actual phone (Safari + Chrome)
- **EOD bar:** you'd hand it to a stranger.

### Wednesday — ship + story (4–6 hrs)
- [ ] Deploy to Vercel, wire canishadow.com, env vars in Vercel (remember: Sensitive/write-only — keep a local copy)
- [ ] README: hero screenshot, what/why (the dean story), stack, "how to run", roadmap (auth, submissions, opt-out, more regions), MIT badge
- [ ] QR code to canishadow.com saved to phone photos
- [ ] **8–10 cold calls, filmed (your side only).** Flip any yes to `verified_yes` via Supabase dashboard, on camera — first green pin is the money shot.
- [ ] Buffer for the unknown bug
- **EOD bar:** live URL, 2–3 green pins, first-episode footage in the can.

### Thursday Jul 16 — Health2Tech
Pitch lines:
- AP MED: "Free mentorship platform and podcast connecting pre-meds with physicians — signed MOU with LMSA Northeast, running a 30-pair pilot."
- CanIShadow: "Open-source map of clinics that take shadowing students. Built it Monday, started cold-calling Wednesday — three clinics already verified."

---

## Cold-call guardrails (for the series)

1. Film **your side only** — never publish office staff audio, even though NJ/NY are one-party consent. Better optics, better content.
2. No pin goes green without the office knowing: end every yes with "can I list Dr. X as shadowing-open on a free student directory?"
3. Public data only on pins: clinic name, public phone, public address. Never personal cells or direct emails.

---

## Claude Code kickoff prompt (paste this Monday morning)

> Read the spec in `SPEC.md` at the repo root (this file). We're building CanIShadow, a mobile-first Next.js 14+ App Router app in TypeScript + Tailwind, Supabase backend, Mapbox via react-map-gl.
>
> Work in this order and stop for my review at each checkpoint:
>
> **Phase 1:** Project scaffold per the file tree in the spec. Supabase client in `src/lib/supabase.ts`, `Clinic` type in `src/types/clinic.ts` matching the schema exactly. `.env.local.example` with the four env vars. Checkpoint: `npm run dev` renders an empty full-screen Mapbox map centered on 40.72,-74.10.
>
> **Phase 2:** `scripts/seed-nppes.ts` per the seed pipeline — respect the 1,200-result-per-query API cap by iterating zip × taxonomy, post-filter by taxonomy code prefixes 207Q/207R/2080, and use LOCATION addresses only. Normalize formatting while preserving suite/floor/unit identity. Keep map rows on the `(address, zip)` composite; do not merge different NPIs, names, or phones by address alone. Store target-specific source details separately. Make location imports idempotent on the full normalized address+ZIP. Then `scripts/geocode.ts` using the US Census batch geocoder (NOT Mapbox — TOS). Checkpoint: row counts printed per region.
>
> **Phase 3:** MapView with clustering, status-colored pins, ClinicDrawer bottom sheet, FilterBar, Legend, per the UI spec. `export const dynamic = 'force-dynamic'` on any route touching Supabase. Checkpoint: full demo flow on a 390px viewport.
>
> Conventions: never run `npm audit fix --force`. Never expose SUPABASE_SERVICE_ROLE_KEY to the client. Keep components small and typed. Mobile-first Tailwind throughout.

---

## Post-event backlog (do NOT touch this week)

1. Google auth + "I called, they said yes" submission form (`verified_by` = user)
2. Office opt-out route (email link → status frozen + hidden)
3. Report-stale button
4. PWA wrapper (`@ducanh2912/next-pwa`)
5. Expand regions (rest of North Jersey, outer boroughs)
6. Shareable per-clinic URLs (`/clinic/[id]`) for the video series
