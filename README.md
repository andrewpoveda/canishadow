# CanIShadow

Open-source map of NJ/NYC clinics that do — or don't — take shadowing students.
Every green pin is a verified phone call. Free & open source, built by
[Andrew Poveda · AP MED](https://ap-med.org).

## What it is

A phone-first map. Tap a pin, a ledger-style drawer slides up: clinic name, status,
address, tappable phone, who verified it and when. Two independent signals:

- **Pin colour = call outcome** — green (takes students) · red (not taking) ·
  yellow (call back) · gray (not yet called).
- **Verified / Unverified filter = trust** — `verified` clinics were double-checked by
  the AP MED team; `unverified` ones were crowdsourced by students and are pending review.

Anyone can search the federal provider registry, call a clinic, and log the outcome —
new pins land `verified = false` until the team promotes them.

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind v4** (CSS-first tokens)
- **Supabase** (Postgres + RLS) — `clinics` + `contact_logs`
- **Leaflet** + free **CARTO** tiles via `react-leaflet` (no Mapbox)
- **NPPES** NPI registry for clinic search · **US Census** batch geocoder — both free, no key
- Deployed on **Vercel**

Ships on $0: Supabase keys are the only required secrets.

## Run it

```bash
npm install
cp .env.local.example .env.local   # fill in the three Supabase keys
npm run seed:demo                  # ~8 demo pins so the map renders
npm run dev
```

The `clinics` + `contact_logs` schema and RLS policies are in `MIGRATION.md` §1–§2.

## Roadmap

Google auth + student submissions with attribution · office opt-out flow ·
report-stale button · the real NPPES seed pipeline (`scripts/seed-nppes.ts`) ·
more regions · shareable `/clinic/[id]` pages.

## License

MIT.
