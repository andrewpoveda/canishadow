// ClinicSearchProvider abstraction (MIGRATION.md §4). Search is never hardcoded to a
// vendor — it goes behind this interface with swappable implementations. Default = NPPES.
export type ClinicSearchResult = {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  npi?: string;
  specialties?: string[];
};

export interface ClinicSearchProvider {
  search(input: {
    city: string;
    state: string;
    specialty?: string;
  }): Promise<ClinicSearchResult[]>;
}
