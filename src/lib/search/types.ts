import type { UsStateCode } from "@/lib/us-states";

export const SEARCH_SPECIALTIES = [
  "Family Medicine",
  "Internal Medicine",
  "Pediatrics",
] as const;

export type SearchSpecialty = (typeof SEARCH_SPECIALTIES)[number];
export type NpiEnumerationType = "NPI-1" | "NPI-2";

export type ClinicSearchInput = {
  city: string;
  state: UsStateCode;
  specialty?: SearchSpecialty;
};

// ClinicSearchProvider abstraction (MIGRATION.md §4). Search is never hardcoded to a
// vendor — it goes behind this interface with swappable implementations. Default = NPPES.
export type ClinicSearchResult = {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: UsStateCode;
  zip?: string;
  npi?: string;
  specialties?: string[];
  enumerationType?: NpiEnumerationType;
  providerCount?: number;
  phoneSource?: "NPPES NPI Registry";
  phoneStatus?: "unconfirmed";
};

/** A registry result with enough immutable identity to be called or reported safely. */
export type ClinicSearchTarget = ClinicSearchResult & {
  address: string;
  city: string;
  state: UsStateCode;
  zip: string;
  npi: string;
  enumerationType: NpiEnumerationType;
  phoneSource: "NPPES NPI Registry";
  phoneStatus: "unconfirmed";
};

export interface ClinicSearchProvider {
  search(input: ClinicSearchInput): Promise<ClinicSearchResult[]>;
}
