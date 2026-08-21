/**
 * Canonical address used by the product's `(address, zip)` dedup key.
 * Keep this aligned with the seed pipeline: one clinic location can contain
 * many providers on different floors or in different suites.
 */
export function normalizeClinicAddress(address: string) {
  return address
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(
      /\s+(?:#.*|\d+(?:ST|ND|RD|TH)?\s+(?:FL|FLOOR)\b.*|(?:APT|BLDG|BUILDING|FL|FLOOR|RM|ROOM|STE|SUITE|UNIT)\b.*)$/i,
      "",
    )
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\s+/g, " ")
    .trim();
}
