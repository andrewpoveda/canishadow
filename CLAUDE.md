# CanIShadow — CLAUDE.md

Open-source map of NJ/NYC clinics' shadowing status. Built by Andrew Poveda (AP MED), separate repo/brand.

## Every session start
Read `CLAUDE.md` (this file), `SPEC.md`, `PRM.md`, and `build-log.md` before doing anything. `build-log.md` is the source of truth for what's actually been built so far — SPEC.md is the *plan*, build-log.md is the *reality*. Where they disagree, build-log.md wins.

**PRM.md wins on any visual/design conflict with SPEC.md.**

## Every session end
- Append an entry to `build-log.md` (reverse-chronological, newest on top) summarizing what was done this session — features shipped, bugs fixed, decisions made, anything that diverged from the original SPEC.md plan.
- If anything architectural changed (schema, file structure, stack choice, API contracts), update the relevant section of `SPEC.md` directly so it stays accurate — don't let it rot into a stale plan.
- If any new top-level files or scripts were created, update `index.md` so it stays a true map of the repo.

## Non-negotiables
- Colors: only the tokens in PRM.md §3.1 (paper, ink, verified #0F5144, declined #8E3B3B, etc.) — no arbitrary hex, no Tailwind default green/red
- No emoji in UI chrome or microcopy
- DB dedup key is composite `(address, zip)` — never unique on `address` alone
- Seed pipeline pulls both NPI-1 (individuals) and NPI-2 (organizations) from NPPES — org records give clean clinic names
- Geocoding via US Census batch geocoder only — never Mapbox geocoding (TOS forbids storing results on the free tier)
- This week's scope: read-only map + drawer + filters. NO auth, submissions, or opt-out flow — those are post-event backlog (SPEC.md bottom)
- Never run `npm audit fix --force`
- Any route/page reading Supabase needs `export const dynamic = 'force-dynamic'`

## Stack
Next.js App Router + TS + Tailwind v4 (CSS-first theme, no tailwind.config.ts) · Supabase (new project, separate from AP MED's) · Mapbox via react-map-gl · Vercel

## Env vars
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
SUPABASE_SERVICE_ROLE_KEY=   # seed scripts only, never client-side
```
