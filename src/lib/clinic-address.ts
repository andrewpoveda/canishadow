/** Canonical street address for the composite `(address, zip)` location key. */
export function normalizeClinicAddress(address: string) {
  return address
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\s*#\s*(?=\w)/g, " UNIT ")
    .replace(/\b(SUITE|APT)\s+UNIT\s+/g, "$1 ")
    .replace(/\b(?:STE|SUITES?)\b/g, " SUITE ")
    .replace(/\b(?:APT|APARTMENT)\b/g, " APT ")
    .replace(/\bUNITS?\b/g, " UNIT ")
    .replace(/\b(?:FL|FLOOR)\b/g, " FLOOR ")
    .replace(/\b(?:RM|ROOM)\b/g, " ROOM ")
    .replace(/\b(?:BLDG|BUILDING)\b/g, " BUILDING ")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\s+/g, " ")
    .trim();
}
