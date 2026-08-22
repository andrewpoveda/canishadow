# CanIShadow — Build Log

Reverse-chronological record of what was actually built, session by session. Newest entry on top. This is the source of truth over SPEC.md when the two disagree — SPEC.md is the plan, this is what really happened.

<!-- Claude Code: append a new entry above this line at the end of every session. Format: date, one-line summary, then bullets for specifics (what shipped, what broke, what changed from plan, and why). -->

## 2026-08-22 — Release nationwide map and search to production

Merged PR #1 into `main` and confirmed Vercel automatically promoted merge commit
`de2f5d847aa4debca5061a02421c2c8f5ad950eb` to `canishadow.com`. The production build is
ready with no alias errors, and Vercel reported no runtime error clusters after release.

**Live verification:** the public NYC Family Medicine search returned 50 results and all 50
displayed `NEW YORK, NY`; Los Angeles Pediatrics returned 50 results and all 50 displayed
`LOS ANGELES, CA`. Real browser input zoomed the production Leaflet map from level 11 out to
level 3, confirming the old NJ/NYC boundary is gone. An existing production clinic deep link
opened its selected drawer correctly, and the browser console remained clean. Production
requests observed during the check returned only 200/304 statuses.

**Database/cleanup:** confirmed the live project still has 12 clinics and 6 contact logs.
The temporary NYC clinic and call created for the controlled preview E2E remain fully removed
(zero rows for the exact QA address and submission key). Both production migrations remain
applied. Supabase reports only the two intentional anonymous/signed-in security-definer RPC
warnings plus the informational unused status-index notice; no schema change was made during
this final release check.

## 2026-08-21 — Unblock nationwide map navigation and rebuild NPPES city search

Expanded the product from an NJ/NY-only interaction model to nationwide navigation,
registry search, and call-log form support, with NYC-specific regression coverage.

**Map:** removed Leaflet's `minZoom=9` and hard NJ/NYC `maxBounds`, while keeping the
existing NJ/NYC opening view. Selecting a pin or opening `/?clinic=<id>` now recenters at
neighborhood zoom (with reduced-motion support), including clinics outside the opening
viewport. On phones, the selected pin is positioned in the visible strip above the 80%-height
drawer instead of being hidden behind it. Deep links select from server data immediately and
refresh safely on mount. Server and client map reads now paginate stable 1,000-row Supabase
ranges until the complete ledger is loaded instead of silently truncating nationwide growth.

**NPPES search:** replaced the broad first-50 query with targeted Family Medicine,
Internal Medicine, and Pediatrics requests across both NPI-1 and NPI-2. The adapter now
validates upstream JSON, uses exact city/state practice locations (including matching
secondary `practiceLocations`), drops inactive/irrelevant records, groups normalized
`(address, zip)` locations, prefers NPI-2 organization names, retains provider counts,
and caps ranked results at 50. Added timeouts, one retry for transient failures, a bounded
15-minute cache, partial-provider failure handling, strict request validation, and clear
502 errors instead of disguising registry outages as zero results. `NYC`, `New York City`,
and `Manhattan` normalize to NPPES's `New York`; Washington DC aliases also normalize.

**Nationwide UI/schema contract:** added a shared state/territory allowlist used by search,
geocoding, types, and both state selectors. Removed the form bug that rewrote every state
except NY to NJ. Added
`supabase/migrations/202608200001_expand_clinic_states.sql` and applied it to the live,
separate CanIShadow Supabase project before deploying the nationwide logging UI.

**Write-path hardening:** repeated canonically equivalent `(address, zip)` submissions now
reuse the oldest existing clinic instead of always inserting (case, punctuation, common
street suffixes, floors, and suites normalize through one shared helper). Both call forms now
use one row-locking Supabase RPC that creates/reuses the clinic, derives its current status,
and appends the ledger entry in one transaction. A client-generated `submission_key` makes a
lost-response retry return the original result instead of adding a second call. Concurrent
clinic creation is serialized by canonical `(address, zip)`, and anonymous calls cannot
replace a team-verified clinic's trusted status/date/byline. Geocoding validates request
size/state/ZIP, times out, rejects invalid coordinates and mismatched returned state/ZIP,
and only then allows a pin insert. Applied
`supabase/migrations/202608210001_atomic_call_logging.sql` before deploying the new client.
Added `supabase/tests/atomic_call_logging.sql`, a rollback-only gate covering creation,
ledger insertion, retry idempotency, and protection of team-verified fields. Both migrations
were first rehearsed inside a rolled-back transaction, then applied and verified on the live
Postgres 17 project; the rollback-only RPC test passed after the persistent apply.

**QA:** NPPES and map-pagination tests pass 6/6; TypeScript, ESLint, and the production Next
build are clean. Browser QA at desktop and 390×844 confirmed unrestricted zoom from level 11
to level 7, 50/50 exact New York results for `NYC` Family Medicine, 50/50 exact Los Angeles
results for Pediatrics, preserved NY call-form fields, immediate deep-link selection, and a
selected pin visibly above the mobile drawer with no console warnings/errors. Valid NYC Census
geocoding matched, malformed input returned 400, and invalid search state input returned 400.
PostHog initialization is now guarded against React development double-effects.
The connected Vercel Git integration produced a green protected preview from branch
`codex/nationwide-map-search`; live preview checks returned 200 for the homepage and both
search requests, with 50/50 exact matches for NYC Family Medicine and Los Angeles Pediatrics
and no Vercel runtime errors. A controlled preview browser submission then exercised the
complete NYC path: NPPES result → populated call form → Census geocode → atomic Supabase
clinic/contact-log write → success state → zoom-13 map deep link → selected clinic drawer and
contact history. The created row retained its NPI, phone, coordinates, callback status,
unverified flag, source, idempotency key, caller, and notes; the browser console stayed clean.
The temporary clinic and log were deleted by their exact IDs afterward, returning production
to its baseline of 12 clinics and 6 logs with zero matching QA rows remaining.
Read-only production data audit found 12 clinic rows and one pre-existing exact
`(address, zip)` duplicate pair, confirming the intended composite unique index is not live.
That pair needs an explicit reviewed merge before adding the DB uniqueness constraint; the
RPC's advisory lock prevents new canonical duplicates without modifying the existing pair.

**Known production follow-ups:** the database linter reports only the two expected warnings
for the intentionally anonymous `log_clinic_call` security-definer RPC;
its inputs are bounded, its search path is locked, and execute access is limited to `anon`
and `authenticated`. Tighter legacy table policies should follow after every deployed client
uses the RPC. Marker clustering or viewport aggregation should be added before a future bulk
seed makes the full nationwide ledger visually dense.

## 2026-08-09 — Wire PostHog analytics properly + event capture on the write path

`posthog-js` (1.414.0) was already a dependency but never initialized. Wired it into the App
Router the proper way and instrumented the two key flows.

**PostHog init:** new `src/app/providers.tsx` — `"use client"` component that runs `posthog.init()`
in a `useEffect`, **guarded on `NEXT_PUBLIC_POSTHOG_KEY`** so it's a complete no-op when the key
is unset (app still ships on $0 — Supabase keys stay the only required secrets). Uses
`defaults: "2025-05-24"` (auto pageviews/pageleaves incl. SPA history changes — no manual
PostHogPageView needed) + `person_profiles: "identified_only"`. Wrapped `{children}` in
`layout.tsx`. Added `/ingest` reverse-proxy rewrites + `skipTrailingSlashRedirect: true` to
`next.config.mjs` (US cloud — `us-assets`/`us.i`; swap to `eu-*` for EU) so ingestion survives
ad blockers.

**Event capture:** new typed helper `src/lib/analytics.ts` — `track(event, props)` with an
`EventMap` (event names + property shapes in one place, no magic strings; silent no-op when
analytics is off). Three events, both surfaces where a call is logged:
- `clinic_searched` (`search/page.tsx`, on NPPES results) — city, state, specialty, result_count
- `call_logged` (`LogCallForm`, existing pin) — clinic_id, outcome, resulting_status, has_provider
- `clinic_added` (`SearchLogForm`, search→add→log) — outcome, state, has_npi

Each fires only after the DB write succeeds, so failed attempts aren't counted.

**Env / deploy:** `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` documented in
`.env.local.example` (placeholder `phc_xxx`) and added to `.env.local` + Vercel. Note: user
first edited `.env.local.example` by mistake (still commented) — real key belongs only in
`.env.local` (gitignored) + Vercel; example placeholder restored. `NEXT_PUBLIC_*` are inlined
at build time, so Vercel needs a deploy *after* the vars are set.

**Verified:** `npx tsc --noEmit` clean; dev server restarted, key confirmed inlined into
`.next/static/chunks/app/layout.js`; `/` and `/search` both 200. `index.md` updated with
`providers.tsx`. No new deps installed (posthog-js was already present) — did not touch the
lockfile / the separate `npm audit` severity work in flight.

## 2026-07-24 — Full rebuild on Next.js/Supabase in one pass (base44 → our stack)

Rebuilt the entire base44 MVP on our stack per MIGRATION.md, in a single pass (read path +
write path + demo data), `npm run build` clean, verified live in-browser.

**Stack shipped:** Next.js 14.2.35 (App Router) + React 18.3 + TypeScript + **Tailwind v4**
(CSS-first `@theme` in `globals.css`, no `tailwind.config`) + Supabase (`@supabase/supabase-js`)
+ **react-leaflet 4.2.1 + free CARTO tiles** (no Mapbox) + framer-motion (drawer) +
lucide-react + **date-fns** (replaced base44's `moment`). Hand-scaffolded (no create-next-app)
for full control over the v4/structure. Bumped Next 14.2.23 → 14.2.35 (a security advisory on
.23; normal version bump, not `audit fix --force`).

**Read path (Phase 2):** ported every `canishadow/` component to `src/components/` swapping
base44 for Supabase (MIGRATION §3): `MapView`, `ClinicDrawer`, `ProviderList`, `ContactHistory`,
`FilterBar`, `Legend`, `Header`, `StatusBadge`. `src/lib/status.ts` copied verbatim from
`status.js` (values/`STATUS_META`/`effectiveStatus` unchanged; only TS signatures added).
`page.tsx` is a server component (`force-dynamic`) that fetches clinics and hands them to a
client orchestrator `HomeClient` (the ported `Home.jsx` logic). `MapView` is dynamically
imported with `ssr:false` (Leaflet touches `window`). Deep-link `?clinic=<id>` preserved.

**Two-axis filter — the one deliberate change from the reference (MIGRATION §0.1/§3):** the
All/Verified/Unverified control keys off the `verified` boolean, NOT pin colour. Verified =
`verified === true`; Unverified = has an outcome but `verified === false`; gray not-yet-called
pins appear only under All. (Reference `Home.jsx` wrongly used `effectiveStatus !== "unknown"`.)
Pin COLOUR still comes from `effectiveStatus` (green if ANY provider said yes).

**Write path / the flywheel (Phase 3):** `ClinicSearchProvider` abstraction in `src/lib/search/`
(`types.ts`, `nppes.ts` = default, `tavily.ts` = optional/off, `index.ts` picks from env — NPPES
unless `SEARCH_PROVIDER=tavily` AND a key is present). Route handlers `/api/search` (NPPES) and
`/api/geocode` (free US Census), both `runtime='nodejs'` with input validation + graceful
failure. `search/page.tsx` rewritten to structured **city + NJ/NY + specialty** inputs (NPPES
needs structured input, not the free-text Tavily box). `SearchResultCard` + `SearchLogForm`
adapted from the Tavily shape to `ClinicSearchResult`; new crowdsourced rows insert with
`verified = false`. `LogCallForm` preserves the exact status-derivation brain (push provider
unless call_back; green if any yes; a log never flips `verified`).

**Demo data (Phase 4 partial):** `scripts/seed-demo.ts` (service-role key, idempotent — clears
`source='demo'` then inserts) seeded **8 clinics** spanning both axes: 3 team-verified, 3
crowdsourced (green/red/call_back, `verified=false`), 2 uncalled gray. Confirms the live schema
accepts every column (`verified`, `providers` jsonb, `call_back`). Real seed pipeline
(`scripts/seed-nppes.ts`) left a documented **stub** per the brief; `data/zips.ts` created for it.

**Verified live (in-browser + curl):** map renders with quieted CARTO basemap + coloured haloed
pins; filter counts All 8 / Verified 3 / Unverified 3; deep-linked Lenox Hill drawer renders the
full ledger (teal rail, `VERIFIED · JUL 14 2026 · BY ANDREW` mono eyebrow — date-fns correct, no
UTC off-by-one — Instrument Serif name, provider dropdown, badge, contact-email intro block,
outreach ledger). `/api/search` returned 50 real NPPES FM providers; `/api/geocode` matched
"744 Broad St, Newark" to 40.7367,-74.1714; missing-field validation → 400. Zero console errors.

**Anti-vibe-code gate (PRM §9) — all pass:** no arbitrary `[#...]` colors, no default Tailwind
green/red, no emoji in UI/microcopy (Legend's `✕` → lucide `<X>`), service-role key confined to
`scripts/` (never `src/`), `force-dynamic` on the Supabase-reading page, 44px tap targets.

**Divergences from plan / notes:** (1) Added a `callback` design token (`#9A7B2D` / tint
`#F4EDDB`) to `globals.css @theme` — PRM §3.1's palette predates the 4-state `call_back` status
(added by MIGRATION), and the verbatim `status.ts` references `bg-callback*`; values taken from
`reference-base44/tailwind.config.js` + `status.js`, so not an arbitrary hex. (2) NPPES `city`
filter isn't strict on the LOCATION address, so a search can return a few out-of-city rows — fine
for the MVP (user edits before saving; the future zip-by-zip seed pipeline is the precise path).
(3) Did NOT build `/api/clinics` — MIGRATION §6 fetches in the server page instead. (4) `.env.local`
left untouched (already had the 3 Supabase keys); `.env.local.example` written per §7.
