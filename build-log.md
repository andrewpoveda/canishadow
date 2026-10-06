# CanIShadow — Build Log

Reverse-chronological record of what was actually built, session by session. Newest entry on top. This is the source of truth over SPEC.md when the two disagree — SPEC.md is the plan, this is what really happened.

## 2026-10-06 — Prepare the Sentry fix for PR validation

Prepared the CANISHADOW-4 filter and regression tests for a pull request. The repository
had no GitHub Actions workflows, so added CI on pull requests and main pushes using
Node 22, npm ci, tests, TypeScript, and lint with read-only repository permissions and
no production secrets. Updated index.md. Merge remains a separate user decision.

## 2026-10-06 — Filter CANISHADOW-4's injected-runtime error

Inspected Sentry issue 7776644769 through the user's authenticated browser after the
API rejected the available token. Its single production event reports an unhandled
getReader TypeError with only anonymous script and Deno `ext:core/01_core.js` frames,
which indicates an external runtime rather than an application stack. Added a
browser-only beforeSend filter for that exact message, mechanism, and stack signature.
It retains matching messages with application frames, missing stack evidence, other
errors, and chained exceptions. Server/edge monitoring and application behavior are
unchanged. Updated SPEC.md and index.md with the filter behavior.

Verification: all 16 Node/tsx tests pass, including three filter regressions;
TypeScript, Next.js lint, and git diff whitespace checks pass. No production deploy
or Sentry issue-status change was made; the filter takes effect on the next deploy.

## 2026-09-22 — Keep NPPES contacts and call history on the exact target

Reworked the NPPES result-to-call path after confirming that suite stripping merged
407 E Gilbert St Suite 7 (NPI 1427857218) with Suite 1 (NPI 1487752895), and could
associate a phone with the wrong organization. Address normalization now standardizes
formatting while preserving suite, floor, and unit values. Search deduplicates only the
same NPI/type at the same full practice location; different NPIs remain separate even
at one exact address, and a phone can only follow duplicate observations of its own
NPI/location.

Search cards identify each NPI target, link only its registry phone, and label that
number unconfirmed. The call form keeps the selected NPI and full location read-only;
the RPC stores an immutable target snapshot on each contact log and verifies address,
ZIP, and state against the map location. The `(address, zip)` map-location key remains
in place. Multiple NPIs at one location share a physical map row but retain distinct
names, NPIs, addresses, and phone snapshots in call history. NPI-specific yes/no
outcomes do not change that shared location's status or aggregate provider/phone data.
The migration revokes direct public contact-log writes so target validation goes
through the RPC.

Added separate pending contact reports for wrong numbers and apparently closed
practices. They are tied to one NPI/location, never become shadowing `no` outcomes,
and never close an organization or update map status. Wrong-number reporting is only
offered when that selected target has a registry number. Existing ambiguous
`clinics.phone` values are no longer displayed in the map drawer.

Added regressions for the confirmed San Bernardino suite collision, distinct NPIs at
the same suite, NPI/phone preservation through RPC arguments and displayed history,
and separate contact reports. Added a rollback-only Supabase SQL regression script
for schema, suite identity, shared-location target snapshots, and status separation.
Updated MIGRATION.md, SPEC.md, and index.md for the shipped behavior.

Verification: 13 TypeScript tests pass using the Node test runner with the tsx import;
`npx tsc --noEmit`, `npm run lint`, `npm run build`, and `git diff --check` pass. The
standard `npm test` launcher hit a sandbox Unix-socket permission error, so the same
test files were run directly through Node. The rollback-only SQL regression was not run
against production. Applied migration `20260922191944_preserve_nppes_call_target_identity.sql`
to the live CanIShadow project after confirming the old RPC, direct-write policy, and
table grants matched its preconditions. Postflight verified the new target columns and
report table/RPC, removal of the old RPC, suite/apartment normalization, and anon SELECT
with no direct contact-log write privileges. Existing row counts remained 12 clinics and
6 contact logs; `contact_reports` is empty. The matching app has not been deployed, so
call logging through the current site is unavailable until that deploy. No production
rows or app deployment were changed. Supabase advisors report the two intentionally
anonymous SECURITY DEFINER RPCs, an existing leaked-password-protection warning, and
unused-index notices (including new indexes on the empty reports table).

## 2026-09-20 — Revisit the reported replay before implementation

Successfully opened the authenticated PostHog recording and inspected the relevant
search/selection sequence. Around 02:28–02:29 the visitor highlights "ARCHIS DESAI
MD INC."; the activity timeline shows the window hidden around 02:30 and visible
again around 03:57. Earlier hidden/visible intervals also occur after the initial
search. This is consistent with taking a clinic name elsewhere for research, but
the replay does not establish a clipboard copy, Google destination, or completed
phone call. Do not confuse Andrew's own Google tabs with the visitor's recorded
activity. The entire recording was not continuously reviewed.

Product implication: an external lookup shortcut may reduce friction, but it does
not solve the need to connect registry identities to current, location-specific
office contact information. Implementation remains on hold at the user's request;
no application, database, or deployment changes.

## 2026-09-20 — Investigate clinic phone accuracy and registry identity collisions

Read-only investigation of the reported San Bernardino search results; no application,
database, or deployment changes. Live NPPES NPI 1427857218 supplies Apple Physicians
Choice at 407 E Gilbert St Ste 7 with 951-204-0909, matching the production search.
The same Family Medicine organization query also returns NPI 1487752895, San Bernardino
Physicians Associates, at Ste 1 with 909-889-1136 (the number in the user's Google
screenshot). Search normalizes away suites and collapses these records into the first
organization's card. It can also borrow another grouped record's phone when the chosen
record lacks one. SearchLogForm uses the same suite-stripping helper when matching and
saving clinics, so a durable fix must cover both discovery and call-log association.
These observations do not establish which number currently reaches either office.

The deceased-physician example has an active organization record: NPI 1184621666,
ABRAHAM CHEN, D.O., INC, last updated 2023-03-07. Rose Hills' obituary confirms the
physician died July 7, 2025. An active organization NPI does not establish that the
named physician is alive or the practice remains open. Recommended follow-up: preserve
suite and record identity, keep name/address/phone provenance together, label registry
contacts as unconfirmed, and add reviewed corrections/closure suppression separate
from shadowing outcomes. Official-site contact verification can supplement discovery;
an MCP alone does not improve the underlying data.

Verification: queried the public production search and public NPPES API; inspected
search grouping, its existing regression fixture, and the save-path normalization.
The authenticated PostHog replay page opened in Safari, but the player stayed blank
before Safari became unavailable; the full recording was not reviewed. Existing
uncommitted Sentry work was preserved. No tests run because application code was unchanged.

## 2026-09-13 — Add Sentry error monitoring across browser and server runtimes

Ran Sentry's Next.js wizard for the `ap-med/canishadow` project and installed
`@sentry/nextjs`. Added browser, Node.js, and edge initialization, App Router global-error
capture, navigation trace propagation, and the `/monitoring` event tunnel. The Sentry wrapper
composes with the existing Next.js config, so Leaflet transpilation, PostHog ingestion rewrites,
and trailing-slash behavior remain unchanged.

Kept error collection privacy-conscious: user information, cookies, headers, bodies, query
parameters, database values, and stack-frame locals are explicitly excluded, while Session Replay
is disabled. Performance traces sample at 100% in development and 10% in production. The
wizard-generated build token remains in an ignored local file; it has not been copied to Vercel
without explicit credential-transfer authorization. Runtime error delivery does not depend on that
token, while readable production source maps do.

Added targeted capture to real recoverable failure paths that automatic instrumentation cannot see:
initial/background clinic reads, contact-history reads, call-log RPC writes, NPPES search failures,
and Census request/response decoding failures. Existing fallback copy and HTTP statuses are
unchanged, and expected 400/413 validation responses and legitimate geocoder no-matches are not
reported. Handled exceptions are sanitized to generic operation errors with only allowlisted name
and code tags, so rejected database rows cannot leak call-form values into Sentry details.

Verified live delivery against Sentry with one browser exception and one API/server exception.
The wizard example also surfaced a hydration warning caused by its own inline demo CSS; removed
both temporary example routes after verification so the production app exposes no deliberate
error endpoint. `npm run lint` and a production `npm run build` pass; the build was run with
source-map upload disabled pending authorization. `npx tsc --noEmit` passes, and all six existing
automated tests pass. A production-mode browser smoke test loaded the map and search form with no
console errors or framework overlay; `/` and `/search` returned 200, invalid search input retained
its existing 400 response, and both removed example routes returned 404.

## 2026-09-12 — Remove CARTO API-key watermark

CARTO began requiring API keys for its previously keyless raster basemaps in late August 2026,
causing repeated "API KEY REQUIRED" text to appear inside the production map tiles without any
application change. Replaced the CARTO Positron tile endpoint with Leaflet's keyless
OpenStreetMap tile endpoint, retained required OpenStreetMap attribution, and capped the tile
layer at OpenStreetMap's supported zoom level 19. No clinic, search, geocoding, or database
behavior changed. Updated the agent and migration documentation so it no longer promises
keyless CARTO service.

<!-- Claude Code: append a new entry above this line at the end of every session. Format: date, one-line summary, then bullets for specifics (what shipped, what broke, what changed from plan, and why). -->

## 2026-08-22 — Track shared coding-agent instructions

Added the previously local-only root `AGENTS.md` to version control so Codex and other
compatible coding agents receive the same project rules on every machine. Updated both
`AGENTS.md` and `CLAUDE.md` to describe the shipped nationwide map/search scope, the completed
base44 rebuild, and the correct split between live single-address Census geocoding and future
batch seed geocoding. Documentation only; no application, database, or deployment behavior
changed.

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
