# CanIShadow — Index

- `CLAUDE.md` — session start/end instructions for Claude Code
- `MIGRATION.md` — **authoritative rebuild target**: base44 → Next.js/Supabase (Supabase DDL, base44→Supabase call map, NPPES search, ported route handlers). Wins on stack/schema/architecture.
- `SPEC.md` — original build plan, schema, seed pipeline, sprint tasks (predates the base44 build — MIGRATION.md supersedes where they conflict)
- `PRM.md` — design tokens, Tailwind config, component specs, type contracts
- `build-log.md` — reverse-chronological record of what's actually been built (source of truth over SPEC.md)
- `reference-base44/` — the exported base44 MVP being ported (read-only reference; see its `_REFERENCE-NOTES.md`)

## App (rebuilt on Next.js/Supabase — see build-log.md 2026-07-24)

- `src/app/` — `layout.tsx` (fonts + metadata), `globals.css` (Tailwind v4 `@theme` tokens — the only place colors are defined), `page.tsx` (server, `force-dynamic`, fetches clinics → `HomeClient`), `search/page.tsx` (NPPES search UI), `api/search/route.ts` + `api/geocode/route.ts`
- `src/components/` — `HomeClient` (orchestrator), `MapView` (Leaflet + CARTO), `ClinicDrawer`, `ProviderList`, `ContactHistory`, `LogCallForm` (status-derivation brain), `SearchResultCard`, `SearchLogForm`, `FilterBar`, `Legend`, `Header`, `StatusBadge`
- `src/lib/` — `supabase.ts` (anon client), `status.ts` (verbatim from reference), `date.ts` (date-fns helpers), `search/` (`types.ts`, `nppes.ts` default, `tavily.ts` optional, `index.ts`)
- `src/types/clinic.ts` — domain types mirroring the MIGRATION §1 schema (`Clinic`, `ContactLog`, `Provider`, `ClinicInsert`, status consts)
- `scripts/` — `seed-demo.ts` (8 demo rows, `npm run seed:demo`), `seed-nppes.ts` (documented stub → SPEC.md §Seed)
- `data/zips.ts` — Essex/Hudson NJ + Manhattan seed zips + taxonomy filters (for the future seed pipeline)
- Config: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `.eslintrc.json`, `.env.local.example`, `.claude/launch.json`

<!-- Claude Code: add a line here whenever a new top-level file, script, or major component is created. -->
