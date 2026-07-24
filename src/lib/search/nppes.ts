import type { ClinicSearchProvider, ClinicSearchResult } from "./types";

// Default provider (MIGRATION.md §4) — free, no key, authoritative federal NPI registry.
// Same source as the seed pipeline (SPEC.md §Seed), so the taxonomy-prefix filter matches.
// FM 207Q*, IM 207R*, Peds 2080* — keep in sync with the seed pipeline.
const KEEP = ["207Q", "207R", "2080"];

interface NppesTaxonomy {
  code?: string;
  desc?: string;
  primary?: boolean;
}
interface NppesAddress {
  address_purpose?: string;
  address_1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  telephone_number?: string;
}
interface NppesBasic {
  organization_name?: string;
  first_name?: string;
  last_name?: string;
}
interface NppesResult {
  number?: string | number;
  basic?: NppesBasic;
  addresses?: NppesAddress[];
  taxonomies?: NppesTaxonomy[];
}
interface NppesResponse {
  results?: NppesResult[];
}

export const nppes: ClinicSearchProvider = {
  async search({ city, state, specialty }) {
    const params = new URLSearchParams({
      version: "2.1",
      city,
      state,
      // Match the city against the PRACTICE LOCATION, not the mailing/billing address —
      // otherwise a provider who bills from Hoboken but practices in Hazlet shows up.
      address_purpose: "LOCATION",
      limit: "50",
      ...(specialty ? { taxonomy_description: specialty } : {}),
    });
    const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as NppesResponse;

    // NPPES city matching can still be loose, so hard-filter to the city the user typed.
    const wanted = city.trim().toLowerCase();

    return (data.results || [])
      .filter((r) =>
        (r.taxonomies || []).some((t) =>
          KEEP.some((k) => t.code?.startsWith(k)),
        ),
      )
      .map((r): ClinicSearchResult => {
        const loc =
          (r.addresses || []).find((a) => a.address_purpose === "LOCATION") ||
          r.addresses?.[0] ||
          {};
        const name =
          r.basic?.organization_name ||
          [r.basic?.first_name, r.basic?.last_name].filter(Boolean).join(" ") ||
          `Medical Office — ${loc.address_1 || ""}`;
        return {
          name,
          phone: loc.telephone_number,
          address: loc.address_1,
          city: loc.city,
          state: loc.state,
          zip: (loc.postal_code || "").slice(0, 5),
          npi: r.number != null ? String(r.number) : undefined,
          specialties: (r.taxonomies || [])
            .map((t) => t.desc)
            .filter((d): d is string => Boolean(d)),
        };
      })
      .filter((c) => (c.city || "").trim().toLowerCase() === wanted);
  },
};
