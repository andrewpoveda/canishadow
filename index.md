# CanIShadow — Index

- `AGENTS.md` — session start/end instructions and non-negotiables for Codex agents
- `CLAUDE.md` — session start/end instructions for Claude Code
- `MIGRATION.md` — **authoritative rebuild target**: base44 → Next.js/Supabase (Supabase DDL, base44→Supabase call map, NPPES search, ported route handlers). Wins on stack/schema/architecture.
- `SPEC.md` — original build plan, schema, seed pipeline, sprint tasks (predates the base44 build — MIGRATION.md supersedes where they conflict)
- `PRM.md` — design tokens, Tailwind config, component specs, type contracts
- `build-log.md` — reverse-chronological record of what's actually been built (source of truth over SPEC.md)
- `reference-base44/` — the exported base44 MVP being ported (read-only reference; see its `_REFERENCE-NOTES.md`)

## App (rebuilt on Next.js/Supabase — see build-log.md 2026-07-24)

- `src/app/` — `layout.tsx` (fonts + metadata/trace propagation, wraps app in `PostHogProvider`), `global-error.tsx` (Sentry-reporting App Router fallback), `providers.tsx` (client PostHog init — no-op without `NEXT_PUBLIC_POSTHOG_KEY`), `globals.css` (Tailwind v4 `@theme` tokens — the only place colors are defined), `page.tsx` (server, `force-dynamic`, fetches clinics → `HomeClient`), `search/page.tsx` (nationwide NPPES search UI), `api/search/route.ts` + `api/geocode/route.ts`
- `src/instrumentation.ts` + `src/instrumentation-client.ts` — initialize Sentry request/error monitoring for Node.js, edge, and browser contexts
- `src/components/` — `HomeClient` (orchestrator), `MapView` (Leaflet + OpenStreetMap), `ClinicDrawer`, `ProviderList`, `ContactHistory` (NPI target snapshots and separate contact reports), `LogCallForm`, `SearchResultCard`, `SearchLogForm`, `ReportContactForm`, `FilterBar`, `Legend`, `Header`, `StatusBadge`
- `src/lib/` — `supabase.ts` (anon client), `log-clinic-call.ts` and `call-log-rpc.ts` (typed atomic call-log RPC), `report-clinic-contact.ts` and `contact-report-rpc.ts` (separate wrong-number/closed-practice reporting), `contact-history.ts` (target identity shown in history), `monitoring.ts`, `fetch-clinics.ts` (paginated full-ledger map loading + test), `status.ts`, `date.ts`, `clinic-address.ts` (suite-preserving `(address, zip)` normalization + test), `us-states.ts`, `search/` (`types.ts`, `validation.ts`, `nppes.ts` + collision/identity tests, `index.ts`; NPPES is the only live provider)
- `src/types/clinic.ts` — domain types mirroring the MIGRATION §1 schema (`Clinic`, target-aware `ContactLog`, `ContactReport`, `Provider`, `ClinicInsert`, status consts)
- `scripts/` — `seed-demo.ts` (8 demo rows, `npm run seed:demo`), `seed-nppes.ts` (documented stub → SPEC.md §Seed)
- `data/zips.ts` — Essex/Hudson NJ + Manhattan seed zips + taxonomy filters (for the future seed pipeline)
- `supabase/migrations/` — three applied migrations; `20260922191944_preserve_nppes_call_target_identity.sql` adds target snapshots, separate reports, and RPC-only contact-log writes
- `supabase/tests/atomic_call_logging.sql` — rollback-only staging verification for clinic creation, ledger insertion, retry idempotency, and verified-status protection
- `supabase/tests/identity_safe_contact_logging.sql` — rollback-only suite-collision, same-location/different-NPI, and non-shadowing contact-report regression coverage
- Config: `package.json`, `tsconfig.json`, `next.config.mjs` (PostHog rewrites + Sentry build/tunnel wrapper), `sentry.server.config.ts`, `sentry.edge.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.env.local.example`, `.claude/launch.json`

<!-- Claude Code: add a line here whenever a new top-level file, script, or major component is created. -->
