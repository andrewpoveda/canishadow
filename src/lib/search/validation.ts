import { isUsStateCode } from "@/lib/us-states";
import {
  SEARCH_SPECIALTIES,
  type ClinicSearchInput,
  type SearchSpecialty,
} from "./types";

const SEARCH_SPECIALTY_SET = new Set<string>(SEARCH_SPECIALTIES);

const NYC_ALIASES = new Set([
  "manhattan",
  "manhattan new york",
  "manhattan nyc",
  "new york city",
  "nyc",
]);

export class SearchValidationError extends Error {}

function normalizedCityKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function canonicalizeSearchCity(city: string, state: string) {
  const trimmed = city.replace(/\s+/g, " ").trim();
  const key = normalizedCityKey(trimmed);

  if (state === "NY" && NYC_ALIASES.has(key)) return "New York";
  if (state === "DC" && ["dc", "washington dc"].includes(key)) {
    return "Washington";
  }

  return trimmed;
}

export function parseSearchInput(value: unknown): ClinicSearchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SearchValidationError("invalid request body");
  }

  const body = value as Record<string, unknown>;
  if (typeof body.city !== "string" || typeof body.state !== "string") {
    throw new SearchValidationError("city and state required");
  }

  const state = body.state.trim().toUpperCase();
  if (!isUsStateCode(state)) {
    throw new SearchValidationError("state must be a valid U.S. state or territory");
  }

  const city = canonicalizeSearchCity(body.city, state);
  if (city.length < 2 || city.length > 100) {
    throw new SearchValidationError("city must be between 2 and 100 characters");
  }
  if (/[*?\u0000-\u001f]/.test(city)) {
    throw new SearchValidationError("city contains unsupported characters");
  }

  let specialty: SearchSpecialty | undefined;
  if (body.specialty != null && body.specialty !== "") {
    if (
      typeof body.specialty !== "string" ||
      !SEARCH_SPECIALTY_SET.has(body.specialty)
    ) {
      throw new SearchValidationError("unsupported specialty");
    }
    specialty = body.specialty as SearchSpecialty;
  }

  return { city, state, specialty };
}

export function citiesMatch(actual: string | undefined, wanted: string) {
  if (!actual) return false;
  return normalizedCityKey(actual) === normalizedCityKey(wanted);
}
