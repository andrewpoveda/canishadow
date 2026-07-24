// Seed regions (SPEC.md §Seed). Consumed by the future scripts/seed-nppes.ts pipeline.
// Essex + Hudson counties NJ, plus Manhattan.

export const ESSEX_NJ = [
  "07102", "07103", "07104", "07105", "07106", "07107", "07108", "07109",
  "07110", "07111", "07112", // Newark + Belleville/Nutley
  "07017", "07018", "07019", // East Orange
  "07050", "07051", "07052", // Orange / West Orange
  "07042", "07043", "07044", // Montclair / Verona
  "07003", // Bloomfield
  "07039", // Livingston
  "07040", "07041", // Maplewood / Millburn
  "07079", // South Orange
  "07068", // Roseland
  "07006", // Caldwell
];

export const HUDSON_NJ = [
  "07302", "07303", "07304", "07305", "07306", "07307", // Jersey City
  "07310", "07311", // Jersey City waterfront
  "07030", // Hoboken
  "07087", // Union City
  "07093", // West New York
  "07047", // North Bergen
  "07002", // Bayonne
  "07032", // Kearny
  "07094", // Secaucus
];

// Manhattan: prioritize uptown + midtown primary-care density; financial district is thin.
export const MANHATTAN_NY = [
  "10001", "10002", "10003", "10009", "10010", "10011", "10012", "10013",
  "10014", "10016", "10017", "10018", "10019", "10021", "10022", "10023",
  "10024", "10025", "10026", "10027", "10028", "10029", "10030", "10031",
  "10032", "10033", "10034", "10035", "10036", "10037", "10038", "10039",
  "10040",
];

export const SEED_ZIPS: { zip: string; state: "NJ" | "NY" }[] = [
  ...ESSEX_NJ.map((zip) => ({ zip, state: "NJ" as const })),
  ...HUDSON_NJ.map((zip) => ({ zip, state: "NJ" as const })),
  ...MANHATTAN_NY.map((zip) => ({ zip, state: "NY" as const })),
];

// NPPES taxonomy_description filters + the code-prefix gate (post-filter). Keep in sync
// with src/lib/search/nppes.ts.
export const TAXONOMIES = [
  "Family Medicine",
  "Internal Medicine",
  "Pediatrics",
];
export const TAXONOMY_CODE_PREFIXES = ["207Q", "207R", "2080"];
