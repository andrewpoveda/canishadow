# CanIShadow — CLAUDE.md

Open-source map of NJ/NYC clinics' shadowing status. Built by Andrew Poveda (AP MED), separate repo/brand.

## Every session start
Read `CLAUDE.md` (this file), `MIGRATION.md`, `SPEC.md`, `PRM.md`, and `build-log.md` before doing anything. Also skim `reference-base44/` — the exported base44 MVP we are porting from.

We are **rebuilding the base44 MVP on Next.js/Supabase.** `MIGRATION.md` is the authoritative rebuild target: **it wins on stack, schema, and architecture wherever it conflicts with SPEC.md or this file** (SPEC.md predates the build). `build-log.md` is the source of truth for what's actually been built — SPEC.md is the *plan*, build-log.md is the *reality*; where they disagree, build-log.md wins.

**PRM.md wins on any visual/design conflict with SPEC.md.**

## Every session end
- Append an entry to `build-log.md` (reverse-chronological, newest on top) summarizing what was done this session — features shipped, bugs fixed, decisions made, anything that diverged from the original SPEC.md plan.
- If anything architectural changed (schema, file structure, stack choice, API contracts), update the relevant section of `SPEC.md` directly so it stays accurate — don't let it rot into a stale plan.
- If any new top-level files or scripts were created, update `index.md` so it stays a true map of the repo.

## Non-negotiables
- Colors: only the tokens in PRM.md §3.1 (paper, ink, verified #0F5144, declined #8E3B3B, etc.) — no arbitrary hex, no Tailwind default green/red
- No emoji in UI chrome or microcopy
- DB dedup key is composite `(address, zip)` — never unique on `address` alone
- Seed pipeline pulls both NPI-1 (individuals) and NPI-2 (organizations) from NPPES — org records give clean clinic names. NPPES is also the default live clinic-search provider (MIGRATION.md §4) — free, no key, no Tavily
- Geocoding via US Census batch geocoder only — free, no key, results OK to store
- Scope: read-only map + drawer + filters **plus the crowdsourced call-logging + NPPES search flow** (the flywheel — this is the core of the rebuild, per MIGRATION.md). Anonymous logging is IN; new rows land `verified = false`. Still OUT: auth/login and the opt-out flow (post-event backlog)
- Never run `npm audit fix --force`
- Any route/page reading Supabase needs `export const dynamic = 'force-dynamic'`

## Stack
Next.js App Router + TS + Tailwind (design tokens from PRM.md §3.1 / `reference-base44/tailwind.config.js`) · Supabase (new project, separate from AP MED's) · **Leaflet + free CARTO tiles via `react-leaflet` (NOT Mapbox — MIGRATION.md §0)** · Vercel

## Env vars
Supabase keys are the ONLY required secrets — the app ships on $0 (NPPES, US Census, and CARTO are all free/no-key).
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # seed scripts only, never client-side
# Optional broad-web search only — leave unset to run free on NPPES:
# SEARCH_PROVIDER=tavily
# TAVILY_API_KEY=
```
