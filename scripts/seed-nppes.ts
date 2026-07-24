/**
 * scripts/seed-nppes.ts — STUB. Not built this pass (per the build brief).
 *
 * TODO: implement the real ingestion pipeline per SPEC.md §"Seed pipeline (Monday's real
 * work)" and PRM.md §8.3. In short:
 *
 *   1. Iterate data/zips.ts × taxonomy_description ("Family Medicine" | "Internal Medicine"
 *      | "Pediatrics"), respecting the NPPES API cap (limit ≤ 200, skip ≤ 1000 → 1,200
 *      results max per query combination — page zip-by-zip, never "all of Newark" at once).
 *   2. Use LOCATION addresses only (address_purpose === "LOCATION"), never MAILING.
 *   3. Post-filter by taxonomy code prefix /^(207Q|207R|2080)/ to kill false matches.
 *   4. Normalize address (uppercase, strip STE/SUITE/FL/UNIT/#…, collapse whitespace,
 *      STREET→ST / AVENUE→AVE) and group by (normalized_address, zip):
 *        - provider_count = count of NPI-1 records in the group
 *        - name = NPI-2 org name if present, else "Medical Office — {street}"
 *        - specialties = union; phone = most frequent in the group
 *   5. Validate every record with the zod schema at the boundary (PRM.md §8.3) — parse,
 *      never coerce; log + skip failures.
 *   6. Upsert on the (address, zip) unique index (idempotent re-runs). Insert with
 *      lat/lng = null; scripts/geocode.ts (US Census batch) fills coordinates next.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) — server-only, never client-imported.
 * The default live clinic-search provider already shares this taxonomy filter — see
 * src/lib/search/nppes.ts (keep the KEEP prefixes in sync).
 */

async function main() {
  console.log(
    "seed-nppes: not implemented yet. See SPEC.md §Seed. Use `npm run seed:demo` for now.",
  );
}

main();
