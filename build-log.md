# CanIShadow — Build Log

Reverse-chronological record of what was actually built, session by session. Newest entry on top. This is the source of truth over SPEC.md when the two disagree — SPEC.md is the plan, this is what really happened.

<!-- Claude Code: append a new entry above this line at the end of every session. Format: date, one-line summary, then bullets for specifics (what shipped, what broke, what changed from plan, and why). -->

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
