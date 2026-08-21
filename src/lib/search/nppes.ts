import { z } from "zod";
import { normalizeClinicAddress } from "@/lib/clinic-address";
import { isUsStateCode } from "@/lib/us-states";
import { citiesMatch } from "./validation";
import {
  SEARCH_SPECIALTIES,
  type ClinicSearchInput,
  type ClinicSearchProvider,
  type ClinicSearchResult,
  type NpiEnumerationType,
  type SearchSpecialty,
} from "./types";

const NPPES_URL = "https://npiregistry.cms.hhs.gov/api/";
const TAXONOMY_PREFIXES = ["207Q", "207R", "2080"];
const NPI_TYPES: NpiEnumerationType[] = ["NPI-2", "NPI-1"];
const UPSTREAM_LIMIT = 200;
const RESULT_LIMIT = 50;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1_000;
const DEFAULT_CACHE_SIZE = 100;

const NppesLocationSchema = z
  .object({
    address_purpose: z.string().nullish(),
    address_1: z.string().nullish(),
    address_2: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    postal_code: z.string().nullish(),
    telephone_number: z.string().nullish(),
  })
  .passthrough();

const NppesTaxonomySchema = z
  .object({
    code: z.string().nullish(),
    desc: z.string().nullish(),
    primary: z.boolean().nullish(),
  })
  .passthrough();

const NppesResultSchema = z
  .object({
    number: z.union([z.string(), z.number()]).nullish(),
    enumeration_type: z.enum(["NPI-1", "NPI-2"]).nullish(),
    basic: z
      .object({
        organization_name: z.string().nullish(),
        first_name: z.string().nullish(),
        middle_name: z.string().nullish(),
        last_name: z.string().nullish(),
        credential: z.string().nullish(),
        status: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    addresses: z.array(NppesLocationSchema).nullish(),
    practiceLocations: z.array(NppesLocationSchema).nullish(),
    taxonomies: z.array(NppesTaxonomySchema).nullish(),
  })
  .passthrough();

const NppesResponseSchema = z
  .object({
    result_count: z.number().nullish(),
    results: z.array(NppesResultSchema).nullish(),
    Errors: z.array(z.unknown()).nullish(),
  })
  .passthrough();

type NppesResult = z.infer<typeof NppesResultSchema>;
type NppesLocation = z.infer<typeof NppesLocationSchema>;

interface NppesProviderOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
  cacheSize?: number;
}

interface Candidate extends ClinicSearchResult {
  address: string;
  city: string;
  state: NonNullable<ClinicSearchResult["state"]>;
  zip: string;
  enumerationType: NpiEnumerationType;
  groupKey: string;
}

interface GroupedResult {
  result: ClinicSearchResult;
  hasOrganization: boolean;
  individualNpis: Set<string>;
  specialties: Set<string>;
}

class NppesRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function clean(value: string | null | undefined) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function formatAddress(location: NppesLocation) {
  const parts = [clean(location.address_1), clean(location.address_2)].filter(
    (part): part is string => Boolean(part),
  );
  return [...new Set(parts)].join(" ");
}

function relevantTaxonomies(result: NppesResult) {
  return (result.taxonomies || []).filter((taxonomy) =>
    TAXONOMY_PREFIXES.some((prefix) => taxonomy.code?.startsWith(prefix)),
  );
}

function matchingLocations(result: NppesResult, input: ClinicSearchInput) {
  const primaryLocations = (result.addresses || []).filter(
    (address) => address.address_purpose === "LOCATION",
  );
  const allLocations = [...primaryLocations, ...(result.practiceLocations || [])];

  return allLocations.filter((location) => {
    const state = clean(location.state)?.toUpperCase();
    return state === input.state && citiesMatch(clean(location.city), input.city);
  });
}

function resultName(result: NppesResult, type: NpiEnumerationType, address: string) {
  const organizationName = clean(result.basic?.organization_name);
  if (type === "NPI-2" && organizationName) return organizationName;

  const personName = [
    clean(result.basic?.first_name),
    clean(result.basic?.middle_name),
    clean(result.basic?.last_name),
  ]
    .filter(Boolean)
    .join(" ");
  const credential = clean(result.basic?.credential);
  if (personName) return credential ? `${personName}, ${credential}` : personName;

  return organizationName || `Medical Office — ${address}`;
}

function toCandidates(
  results: NppesResult[],
  input: ClinicSearchInput,
  queriedType: NpiEnumerationType,
) {
  const candidates: Candidate[] = [];

  for (const result of results) {
    if (result.basic?.status && result.basic.status !== "A") continue;

    const taxonomies = relevantTaxonomies(result);
    if (taxonomies.length === 0) continue;

    const enumerationType = result.enumeration_type || queriedType;
    const npi = result.number == null ? undefined : String(result.number);

    for (const location of matchingLocations(result, input)) {
      const address = formatAddress(location);
      const state = clean(location.state)?.toUpperCase();
      const city = clean(location.city);
      const zip = clean(location.postal_code)?.slice(0, 5);
      if (!address || !city || !state || !isUsStateCode(state) || !zip) continue;

      candidates.push({
        name: resultName(result, enumerationType, address),
        phone: clean(location.telephone_number),
        address,
        city,
        state,
        zip,
        npi,
        specialties: taxonomies
          .map((taxonomy) => clean(taxonomy.desc))
          .filter((value): value is string => Boolean(value)),
        enumerationType,
        providerCount: enumerationType === "NPI-1" ? 1 : undefined,
        groupKey: `${normalizeClinicAddress(address)}|${zip}`,
      });
    }
  }

  return candidates;
}

function groupCandidates(candidates: Candidate[]) {
  const groups = new Map<string, GroupedResult>();

  for (const candidate of candidates) {
    const existing = groups.get(candidate.groupKey);
    const candidateSpecialties = candidate.specialties || [];
    const candidateNpi = candidate.npi;

    if (!existing) {
      const individualNpis = new Set<string>();
      if (candidate.enumerationType === "NPI-1" && candidateNpi) {
        individualNpis.add(candidateNpi);
      }
      const { groupKey: _groupKey, ...result } = candidate;
      groups.set(candidate.groupKey, {
        result,
        hasOrganization: candidate.enumerationType === "NPI-2",
        individualNpis,
        specialties: new Set(candidateSpecialties),
      });
      continue;
    }

    for (const specialty of candidateSpecialties) {
      existing.specialties.add(specialty);
    }
    if (candidate.enumerationType === "NPI-1" && candidateNpi) {
      existing.individualNpis.add(candidateNpi);
    }

    if (candidate.enumerationType === "NPI-2" && !existing.hasOrganization) {
      existing.result.name = candidate.name;
      existing.result.npi = candidate.npi;
      existing.result.enumerationType = "NPI-2";
      existing.result.phone = candidate.phone || existing.result.phone;
      existing.hasOrganization = true;
    } else if (!existing.result.phone && candidate.phone) {
      existing.result.phone = candidate.phone;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group.result,
      specialties: [...group.specialties].sort(),
      providerCount: Math.max(group.individualNpis.size, 1),
    }))
    .sort((a, b) => {
      const organizationRank =
        Number(b.enumerationType === "NPI-2") -
        Number(a.enumerationType === "NPI-2");
      if (organizationRank !== 0) return organizationRank;

      const phoneRank = Number(Boolean(b.phone)) - Number(Boolean(a.phone));
      if (phoneRank !== 0) return phoneRank;

      return a.name.localeCompare(b.name);
    })
    .slice(0, RESULT_LIMIT);
}

function isRetryable(error: unknown) {
  return (
    !(error instanceof NppesRequestError) ||
    error.status == null ||
    error.status === 429 ||
    (error.status != null && error.status >= 500)
  );
}

async function readNppes(
  fetchImpl: typeof fetch,
  input: ClinicSearchInput,
  specialty: SearchSpecialty,
  enumerationType: NpiEnumerationType,
  timeoutMs: number,
  retries: number,
) {
  const params = new URLSearchParams({
    version: "2.1",
    city: input.city,
    state: input.state,
    address_purpose: "LOCATION",
    enumeration_type: enumerationType,
    taxonomy_description: specialty,
    limit: String(UPSTREAM_LIMIT),
  });

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${NPPES_URL}?${params}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "CanIShadow/1.0 (https://canishadow.com)",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new NppesRequestError(
          `NPPES returned ${response.status}`,
          response.status,
        );
      }

      const parsed = NppesResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.Errors?.length) {
        throw new NppesRequestError("NPPES returned an invalid response");
      }
      return parsed.data.results || [];
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createNppesProvider(
  options: NppesProviderOptions = {},
): ClinicSearchProvider {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? 1;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const cacheSize = options.cacheSize ?? DEFAULT_CACHE_SIZE;
  const cache = new Map<
    string,
    { expiresAt: number; value: Promise<ClinicSearchResult[]> }
  >();

  return {
    async search(input) {
      const cacheKey = JSON.stringify(input);
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.value;
      if (cached) cache.delete(cacheKey);

      const specialties = input.specialty
        ? [input.specialty]
        : [...SEARCH_SPECIALTIES];
      const searches = specialties.flatMap((specialty) =>
        NPI_TYPES.map(async (enumerationType) => {
          const results = await readNppes(
            fetchImpl,
            input,
            specialty,
            enumerationType,
            timeoutMs,
            retries,
          );
          return toCandidates(results, input, enumerationType);
        }),
      );

      const value = Promise.allSettled(searches)
        .then((settled) => {
          const successful = settled.filter(
            (result): result is PromiseFulfilledResult<Candidate[]> =>
              result.status === "fulfilled",
          );
          if (successful.length === 0) {
            throw new Error("NPPES is unavailable");
          }
          return groupCandidates(successful.flatMap((result) => result.value));
        })
        .catch((error) => {
          cache.delete(cacheKey);
          throw error;
        });

      if (cache.size >= cacheSize) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value });
      return value;
    },
  };
}

export const nppes = createNppesProvider();
