import assert from "node:assert/strict";
import test from "node:test";
import { createNppesProvider } from "./nppes";
import { parseSearchInput, SearchValidationError } from "./validation";

const familyMedicine = [
  { code: "207Q00000X", desc: "Family Medicine", primary: true },
];

function nppesResponse(results: unknown[], status = 200) {
  return new Response(JSON.stringify({ result_count: results.length, results }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("normalizes NYC aliases and accepts nationwide state codes", () => {
  assert.deepEqual(parseSearchInput({ city: " NYC ", state: "ny" }), {
    city: "New York",
    state: "NY",
    specialty: undefined,
  });
  assert.equal(
    parseSearchInput({ city: "Manhattan", state: "NY" }).city,
    "New York",
  );
  assert.equal(
    parseSearchInput({ city: "New York City", state: "NY" }).city,
    "New York",
  );
  assert.deepEqual(
    parseSearchInput({
      city: "Los Angeles",
      state: "ca",
      specialty: "Pediatrics",
    }),
    { city: "Los Angeles", state: "CA", specialty: "Pediatrics" },
  );
});

test("rejects invalid request shapes, states, and specialties", () => {
  for (const value of [null, [], { city: "New York" }, { city: "", state: "NY" }]) {
    assert.throws(() => parseSearchInput(value), SearchValidationError);
  }
  assert.throws(
    () => parseSearchInput({ city: "Toronto", state: "ON" }),
    /valid U\.S\. state or territory/,
  );
  assert.throws(
    () => parseSearchInput({ city: "New*", state: "NY" }),
    /unsupported characters/,
  );
  assert.throws(
    () =>
      parseSearchInput({
        city: "New York",
        state: "NY",
        specialty: "Cardiology",
      }),
    /unsupported specialty/,
  );
});

test("queries NPI-1 and NPI-2, maps exact secondary locations, and dedupes by address plus ZIP", async () => {
  const calls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const type = url.searchParams.get("enumeration_type");

    if (type === "NPI-2") {
      return nppesResponse([
        {
          number: "1111111111",
          enumeration_type: "NPI-2",
          basic: { organization_name: "Downtown Family Health", status: "A" },
          addresses: [
            {
              address_purpose: "LOCATION",
              address_1: "10 Broadway Ste 200",
              city: "NEW YORK",
              state: "NY",
              postal_code: "100041234",
              telephone_number: "212-555-0100",
            },
          ],
          taxonomies: familyMedicine,
        },
      ]);
    }

    return nppesResponse([
      {
        number: "2222222222",
        enumeration_type: "NPI-1",
        basic: {
          first_name: "Avery",
          last_name: "Doctor",
          credential: "MD",
          status: "A",
        },
        addresses: [
          {
            address_purpose: "LOCATION",
            address_1: "1 South Tulsa Avenue",
            city: "TULSA",
            state: "OK",
            postal_code: "74101",
          },
        ],
        practiceLocations: [
          {
            address_1: "10 BROADWAY SUITE 400",
            city: "NEW YORK",
            state: "NY",
            postal_code: "100041234",
            telephone_number: "212-555-0101",
          },
        ],
        taxonomies: familyMedicine,
      },
      {
        number: "3333333333",
        enumeration_type: "NPI-1",
        basic: { first_name: "Blake", last_name: "Doctor", status: "A" },
        addresses: [
          {
            address_purpose: "LOCATION",
            address_1: "10 BROADWAY FL 3",
            city: "NEW YORK",
            state: "NY",
            postal_code: "10004",
            telephone_number: "212-555-0102",
          },
        ],
        taxonomies: familyMedicine,
      },
      {
        number: "4444444444",
        enumeration_type: "NPI-1",
        basic: { first_name: "Casey", last_name: "Doctor", status: "A" },
        addresses: [
          {
            address_purpose: "LOCATION",
            address_1: "99 Main Street",
            city: "BOSTON",
            state: "MA",
            postal_code: "02108",
          },
        ],
        practiceLocations: [
          {
            address_1: "20 Madison Ave",
            city: "NEW YORK",
            state: "NY",
            postal_code: "10010",
            telephone_number: "212-555-0200",
          },
        ],
        taxonomies: familyMedicine,
      },
    ]);
  };

  const provider = createNppesProvider({ fetchImpl, retries: 0 });
  const input = {
    city: "New York",
    state: "NY" as const,
    specialty: "Family Medicine" as const,
  };
  const results = await provider.search(input);

  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map((url) => url.searchParams.get("enumeration_type")).sort(),
    ["NPI-1", "NPI-2"],
  );
  for (const url of calls) {
    assert.equal(url.searchParams.get("city"), "New York");
    assert.equal(url.searchParams.get("address_purpose"), "LOCATION");
    assert.equal(url.searchParams.get("taxonomy_description"), "Family Medicine");
    assert.equal(url.searchParams.get("limit"), "200");
  }

  assert.equal(results.length, 2);
  assert.deepEqual(results[0], {
    name: "Downtown Family Health",
    phone: "212-555-0100",
    address: "10 Broadway Ste 200",
    city: "NEW YORK",
    state: "NY",
    zip: "10004",
    npi: "1111111111",
    specialties: ["Family Medicine"],
    enumerationType: "NPI-2",
    providerCount: 2,
  });
  assert.equal(results[1].address, "20 Madison Ave");
  assert.equal(results[1].city, "NEW YORK");
  assert.equal(results[1].state, "NY");
  assert.equal(results[1].phone, "212-555-0200");
  assert.notEqual(results[1].address, "99 Main Street");

  await provider.search(input);
  assert.equal(calls.length, 2, "repeat searches should use the bounded TTL cache");
});

test("an all-primary-care search makes targeted queries instead of filtering a broad page", async () => {
  const calls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(new URL(String(input)));
    return nppesResponse([]);
  };
  const provider = createNppesProvider({ fetchImpl, retries: 0 });

  assert.deepEqual(
    await provider.search({ city: "Austin", state: "TX" }),
    [],
  );
  assert.equal(calls.length, 6);
  assert.deepEqual(
    new Set(calls.map((url) => url.searchParams.get("taxonomy_description"))),
    new Set(["Family Medicine", "Internal Medicine", "Pediatrics"]),
  );
  assert.ok(
    calls.every((url) => Boolean(url.searchParams.get("enumeration_type"))),
  );
});

test("returns partial results when one NPI type fails and errors when all upstream calls fail", async () => {
  const individual = {
    number: "5555555555",
    enumeration_type: "NPI-1",
    basic: { first_name: "Drew", last_name: "Doctor", status: "A" },
    addresses: [
      {
        address_purpose: "LOCATION",
        address_1: "100 Congress Ave",
        city: "AUSTIN",
        state: "TX",
        postal_code: "78701",
        telephone_number: "512-555-0100",
      },
    ],
    taxonomies: familyMedicine,
  };

  const partialFetch: typeof fetch = async (input) => {
    const type = new URL(String(input)).searchParams.get("enumeration_type");
    return type === "NPI-2"
      ? new Response("unavailable", { status: 503 })
      : nppesResponse([individual]);
  };
  const partial = createNppesProvider({ fetchImpl: partialFetch, retries: 0 });
  assert.equal(
    (
      await partial.search({
        city: "Austin",
        state: "TX",
        specialty: "Family Medicine",
      })
    ).length,
    1,
  );

  const failed = createNppesProvider({
    fetchImpl: async () => new Response("unavailable", { status: 503 }),
    retries: 0,
  });
  await assert.rejects(
    failed.search({
      city: "Austin",
      state: "TX",
      specialty: "Family Medicine",
    }),
    /NPPES is unavailable/,
  );
});
