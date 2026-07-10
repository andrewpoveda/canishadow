# CanIShadow — Product Requirements & Manifest (PRM)

**Version 1.0 · Jul 10, 2026 · Companion to `SPEC.md` (sprint plan). Where the two conflict on visual values, this file wins.**

---

## 1. Design thesis

CanIShadow is not a consumer map app; it is a **public verification ledger rendered as a map**. Every green pin exists because a human made a phone call and got a yes. The design language borrows AP MED's editorial calm — warm paper, slate ink, Instrument Serif display — and adds one clinical instrument of its own: the **call record**. The drawer is not a "place card" (Yelp); it is a ledger entry documenting who verified what, and when.

Everything quiet, one signature. The signature is the ledger.

**Anti-goal:** anything that reads as vibe-coded — gradient heroes, emoji in UI chrome, glassmorphism, default shadcn gray-950 dark mode, rounded-2xl-everything, `#16A34A` Tailwind green. None of these appear anywhere.

---

## 2. Brand relationship to AP MED

Same family, different room. Shared: paper background, ink scale, Instrument Serif for display, Inter for UI. Distinct: CanIShadow owns the clinical teal `#0F5144` (AP MED does not use it), a mono utility face for ledger metadata, and a map-first layout with near-zero chrome. Footer attribution: `Built by Andrew Poveda · AP MED` — set in the mono face, linked to ap-med.org.

---

## 3. Design tokens

### 3.1 Palette (complete — no colors outside this table)

| Token | Hex | Role |
|---|---|---|
| `paper` | `#FAF9F6` | App background, drawer sheet, header |
| `paper-2` | `#F1EFEA` | Recessed surfaces: filter track, skeleton base, legend bg |
| `ink` | `#0F1B2D` | Primary text, wordmark (deep slate, not black) |
| `ink-2` | `#43506B` | Secondary text: addresses, counts, labels |
| `ink-3` | `#8A93A6` | Tertiary: placeholders, dividers at 40% opacity, **unknown pins** |
| `verified` | `#0F5144` | Deep clinical teal — verified-yes pins, badges, primary actions |
| `verified-tint` | `#E4EFEA` | Verified badge background, drawer accent wash |
| `declined` | `#8E3B3B` | Muted crimson — verified-no pins, badges |
| `declined-tint` | `#F3E7E6` | Declined badge background |
| `line` | `#E3E0D8` | Hairline borders, drawer grab handle |

Rules: text on `paper` is always `ink`/`ink-2`/`ink-3` — never teal or crimson (status colors are for status only). White (`#FFFFFF`) appears only as pin strokes and text on solid `verified`/`declined` fills. No pure black anywhere.

**Contrast note (a real problem, solved):** `#0F5144` at 16px on a street map reads nearly black. Pins therefore never rely on hue alone — see the pin system in §5.2 (white stroke, tint halo, size hierarchy) and the map style choice (§5.1), which desaturates the basemap so status colors are the only saturated objects on screen. This is also the accessibility answer for red/green color-blind users: verified pins are *bigger and haloed*, not just greener.

### 3.2 Typography

| Role | Face | Usage |
|---|---|---|
| Display | **Instrument Serif** (400, italic 400) | Clinic names in drawer, wordmark, empty-state headlines. Never below 20px, never for UI controls. |
| UI / Body | **Inter** (400 / 500 / 600) | Everything interactive: filters, badges, addresses, buttons. |
| Ledger | **JetBrains Mono** (400 / 500) | Verification metadata only: dates, provider counts, `verified by` lines, footer attribution. Tabular, small caps via tracking, 11–13px. |

Loaded via `next/font/google` with `display: swap`; exposed as CSS variables `--font-display`, `--font-sans`, `--font-mono`.

Type scale (px / line-height): 28/32 display (drawer clinic name), 20/26 display-sm (empty states), 15/22 body, 13/18 label, 11/16 mono-meta (tracking `0.06em`, uppercase).

### 3.3 Space, radius, elevation, motion

- Spacing: 4px base grid. Drawer padding 20px; pill padding 8×14px; tap targets ≥ 44px.
- Radius: exactly two values. `--radius-pill: 999px` (filters, badges) and `--radius-sheet: 16px` (drawer top corners, legend). Nothing else is rounded.
- Elevation: one shadow, used only by floating surfaces (drawer, filter bar, legend): `0 8px 28px rgb(15 27 45 / 0.14)`. No layered shadow stacks.
- Motion: 180ms `cubic-bezier(0.2, 0, 0, 1)` for drawer enter/exit and pill state changes. Verified pins get a single 400ms scale-settle when first added to the map — no infinite pulses. All motion behind `prefers-reduced-motion`.

---

## 4. Tailwind configuration (v4, CSS-first)

`create-next-app` scaffolds Tailwind v4 — there is no `tailwind.config.ts`; tokens live in `src/app/globals.css`. This block is the entire theming surface. **No arbitrary color values (`bg-[#...]`) are permitted in components; if a color isn't a token, it doesn't ship.**

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* palette */
  --color-paper: #FAF9F6;
  --color-paper-2: #F1EFEA;
  --color-ink: #0F1B2D;
  --color-ink-2: #43506B;
  --color-ink-3: #8A93A6;
  --color-verified: #0F5144;
  --color-verified-tint: #E4EFEA;
  --color-declined: #8E3B3B;
  --color-declined-tint: #F3E7E6;
  --color-line: #E3E0D8;

  /* type */
  --font-display: var(--font-instrument-serif), Georgia, serif;
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;

  /* shape & elevation */
  --radius-pill: 999px;
  --radius-sheet: 16px;
  --shadow-float: 0 8px 28px rgb(15 27 45 / 0.14);

  /* motion */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}

@layer base {
  html { background: var(--color-paper); color: var(--color-ink); }
  body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
}
```

Font wiring in `src/app/layout.tsx`:

```tsx
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrument = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains-mono" });
// <html className={`${inter.variable} ${instrument.variable} ${mono.variable}`}>
```

Usage in components: `bg-paper`, `text-ink-2`, `bg-verified`, `rounded-pill`, `shadow-float`, `font-display`, `font-mono`.

---

## 5. Component specifications

### 5.1 Basemap

- Style: `mapbox://styles/mapbox/light-v11`, further quieted at runtime: reduce POI label density, mute road colors toward `paper-2` via style config (`config` param or a forked style in Mapbox Studio if runtime overrides fight back — timebox to 30 min, the stock light style is acceptable).
- Rationale: the basemap must be *background*. Status colors are the only saturated elements on screen.
- Initial viewport: `{ latitude: 40.72, longitude: -74.10, zoom: 10.5 }`. `maxBounds` loosely around NJ/NYC so demo users can't scroll to Kansas.
- Attribution control bottom-left, compact.

### 5.2 Pin system (hue + size + halo — never hue alone)

| Status | Fill | Stroke | Halo | Size |
|---|---|---|---|---|
| `unknown` | `ink-3` | `#FFFFFF` 1.5px | none | 8px dot |
| `verified_yes` | `verified` | `#FFFFFF` 2px | 20px `verified-tint` at 70% | 12px dot |
| `verified_no` | `declined` | `#FFFFFF` 2px | none | 10px dot |

- Verified-yes pins render on top of the stack (layer order: unknown → no → yes).
- Clusters: `paper` circle, `line` border, `ink` count in `font-mono` 12px. Cluster size steps at 10/50/150 points (28/36/44px). Clusters are deliberately achromatic — a cluster contains mixed statuses, so it must not imply one.
- Selected pin: 1.4× scale + halo, drawer opens.
- Implementation: Mapbox layers (`circle` paint properties) rather than DOM markers — 900+ DOM markers will chug on a phone; circle layers won't.

### 5.3 ClinicDrawer — the signature (ledger entry)

Bottom sheet, `paper`, `radius-sheet` top corners, `shadow-float`, 4px `line` grab handle, ~42% viewport height, swipe-down or scrim-tap to dismiss. Anatomy, top to bottom:

1. **Status rail** — a 3px full-width bar at the very top of the sheet: `verified` / `declined` / `line` (unknown). The one place color touches structure.
2. **Eyebrow** (`font-mono`, 11px, uppercase, tracked): `VERIFIED · JUL 15 2026 · BY ANDREW` — or `NOT YET VERIFIED` in `ink-3`, or `DECLINED · JUL 15 2026`. This line is the product.
3. **Clinic name** — `font-display` 28px, `ink`. Instrument Serif is what makes it editorial instead of app-like.
4. **Address + phone** — `body` in `ink-2`; phone is a `tel:` link, 500 weight, `ink` (not teal — see color rules).
5. **Meta row** — `font-mono` 11px `ink-2`: `12 PROVIDERS · FAMILY MEDICINE · PEDIATRICS` (specialty chips are overdesign at this density; a mono line is quieter and reads faster).
6. **Status badge** — pill, `verified-tint` bg + `verified` text `Takes shadowing students`, or `declined-tint`/`declined` `Not taking students`, or `paper-2`/`ink-2` `Unverified`.

Microcopy (final — replaces `SPEC.md` strings; note **no emoji**):
- Unverified drawer footer line (`ink-3`, 13px): `This clinic hasn't been called yet.`
- Empty filter result: display-sm headline `No verified clinics here yet.` + body `Calls in progress — new pins land weekly.`
- Loading toast: `Loading clinics…`
- Error state: `Couldn't load the map data. Refresh to retry.`

### 5.4 FilterBar

Floating top-center, offset 12px below header. A single segmented control (not three separate pills): `paper` track (`paper-2` on the inactive area), `radius-pill`, `shadow-float`. Segments: `All` · `Verified` · `Unverified`. Active segment: `ink` bg, `paper` text. Not teal — the filter is chrome, and chrome never wears status colors. Counts in `font-mono` inside each segment: `Verified 3`.

### 5.5 Header & Legend

- Header: 52px, transparent over the map (no bar), containing only the wordmark — `canishadow` in Instrument Serif italic 22px `ink` — and a GitHub mark (`ink-2`, 20px) right-aligned. Both sit on a subtle `paper` blur pill so they survive busy map tiles.
- Legend: collapsed by default to a 28px `?`-style dot bottom-right; expands to a `paper` card listing the three pin types with real rendered dots, and the footer attribution line (`font-mono` 11px): `FREE & OPEN SOURCE · BUILT BY ANDREW POVEDA · AP MED`.

### 5.6 States

- Skeleton: `paper-2` full-screen wash + centered `Loading clinics…` — never a spinner over half-loaded tiles.
- Geocode-failed rows are excluded server-side; the UI never renders a null-coordinate clinic.
- Offline / fetch failure: error state copy per §5.3, retry button (`ink` bg pill).

---

## 6. Accessibility & quality floor

- All interactive elements: visible focus ring (`2px` `ink` offset 2px), ≥44px hit area, real `<button>`/`<a>` semantics.
- Drawer: `role="dialog"`, focus-trapped, `Esc` dismisses on desktop.
- Status never communicated by color alone (size + halo + badge text carry it).
- `prefers-reduced-motion`: drawer snaps, no pin settle animation.
- Contrast: `ink` on `paper` 14.8:1; `ink-2` on `paper` 7.9:1; white on `verified` 8.6:1; white on `declined` 6.9:1 — all pass AA. `ink-3` is decorative/tertiary only, never for essential text.

---

## 7. File tree (supersedes SPEC.md §File tree)

```
canishadow/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # fonts, metadata, viewport (theme-color: #FAF9F6)
│   │   ├── globals.css             # §4 verbatim — the only place colors are defined
│   │   ├── page.tsx                # server component: fetch clinics → <MapView/>
│   │   └── api/clinics/route.ts    # GET, force-dynamic, returns ClinicDTO[]
│   ├── components/
│   │   ├── MapView.tsx             # 'use client' — Map, circle layers, clusters, selection state
│   │   ├── ClinicDrawer.tsx        # §5.3 ledger sheet
│   │   ├── FilterBar.tsx           # §5.4 segmented control
│   │   ├── Legend.tsx              # §5.5
│   │   └── StatusBadge.tsx         # single source of badge rendering (used by drawer + legend)
│   ├── lib/
│   │   ├── supabase.ts             # anon client
│   │   └── constants.ts            # STATUS map, map viewport, layer ids — no magic strings in components
│   └── types/
│       └── clinic.ts               # §8 verbatim
├── scripts/
│   ├── seed-nppes.ts               # zod-validated ingestion (§8.3)
│   └── geocode.ts                  # Census batch
├── data/zips.ts
├── .env.local.example
├── LICENSE
└── README.md
```

---

## 8. Type-safe contracts

### 8.1 Domain types — `src/types/clinic.ts`

```ts
export const CLINIC_STATUS = {
  unknown: "unknown",
  verifiedYes: "verified_yes",
  verifiedNo: "verified_no",
} as const;

export type ClinicStatus = (typeof CLINIC_STATUS)[keyof typeof CLINIC_STATUS];

/** Row shape — mirrors the DB exactly. Do not add UI-only fields here. */
export interface Clinic {
  id: string;
  created_at: string;
  name: string;
  address: string;
  city: string;
  state: "NJ" | "NY";
  zip: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  status: ClinicStatus;
  provider_count: number;
  specialties: string[];
  npi: string | null;
  last_verified: string | null;   // ISO date
  verified_by: string | null;
  notes: string | null;
  source: string;
}

/** What the API returns to the map — geocoded rows only, nulls narrowed. */
export type ClinicDTO = Omit<Clinic, "lat" | "lng" | "notes" | "source" | "created_at"> & {
  lat: number;
  lng: number;
};

/** Exhaustiveness helper — every switch on ClinicStatus must end with this. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled status: ${x}`);
}
```

Pin styling, badge copy, and layer filters all derive from a single `STATUS_META` record in `lib/constants.ts` keyed by `ClinicStatus` (`Record<ClinicStatus, { fill: string; label: string; size: number }>`), so adding a status is a one-file change and TypeScript errors anywhere it's unhandled.

### 8.2 API contract — `GET /api/clinics`

- `export const dynamic = "force-dynamic"`.
- Query: `select ... where lat is not null and lng is not null`.
- Response: `{ clinics: ClinicDTO[] }`, `Cache-Control: no-store`. No pagination this week (≤ ~1,500 rows; payload ≈ 300KB, acceptable; revisit post-event).

### 8.3 Ingestion validation — `scripts/seed-nppes.ts`

NPPES responses are messy; parse, never trust. Zod schema at the boundary:

```ts
const NppesAddress = z.object({
  address_purpose: z.enum(["LOCATION", "MAILING"]),
  address_1: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  telephone_number: z.string().optional(),
});

const NppesResult = z.object({
  number: z.string(),                       // NPI
  enumeration_type: z.enum(["NPI-1", "NPI-2"]),
  basic: z.object({ organization_name: z.string().optional() }).passthrough(),
  addresses: z.array(NppesAddress).min(1),
  taxonomies: z.array(z.object({
    code: z.string(),
    desc: z.string().optional(),
    primary: z.boolean().optional(),
  })),
});
```

Rows failing parse are logged and skipped, never coerced. Taxonomy gate: `code` must match `/^(207Q|207R|2080)/`. Insert path uses a `ClinicInsert` type derived from `Clinic` (`Omit<Clinic, "id" | "created_at">`) so schema drift is a compile error. Upsert key: `(address, zip)` unique index:

```sql
create unique index clinics_addr_zip_key on clinics (address, zip);
```

(Add this to the SPEC.md schema — it's both the idempotency mechanism and the dedupe enforcement.)

---

## 9. Anti-vibe-code checklist (review gate before Wednesday deploy)

- [ ] Zero arbitrary Tailwind color values in components (`grep -rn "\[#" src/components` returns nothing)
- [ ] Zero emoji in UI chrome or microcopy
- [ ] Exactly two radii, one shadow, one easing in the shipped CSS
- [ ] Instrument Serif appears only in: wordmark, clinic names, empty-state headlines
- [ ] Status colors appear only on: pins, status rail, badges — never on chrome, links, or filters
- [ ] Every `switch` on `ClinicStatus` ends in `assertNever`
- [ ] Drawer reads as a ledger entry (eyebrow → name → meta), not a place card
- [ ] Screenshot on a 390px viewport looks like ap-med.org's cousin, not a Mapbox tutorial
