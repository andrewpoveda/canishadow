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

test("queries both NPI types, maps exact secondary locations, and keeps each NPI/location separate", async () => {
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
              telephone_number: null,
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
        number: "2222222222",
        enumeration_type: "NPI-1",
        basic: {
          first_name: "Avery",
          last_name: "Doctor",
          credential: "MD",
          status: "A",
        },
        practiceLocations: [
          {
            address_1: "10 Broadway Suite 400",
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

  assert.equal(results.length, 4);
  assert.deepEqual(results[0], {
    name: "Downtown Family Health",
    phone: undefined,
    address: "10 Broadway Ste 200",
    city: "NEW YORK",
    state: "NY",
    zip: "10004",
    npi: "1111111111",
    specialties: ["Family Medicine"],
    enumerationType: "NPI-2",
    providerCount: undefined,
    phoneSource: "NPPES NPI Registry",
    phoneStatus: "unconfirmed",
  });
  assert.equal(results[1].npi, "2222222222");
  assert.equal(results[1].name, "Avery Doctor, MD");
  assert.equal(results[1].address, "10 BROADWAY SUITE 400");
  assert.equal(results[1].phone, "212-555-0101");
  assert.equal(results[1].providerCount, 1);
  assert.equal(results[2].npi, "3333333333");
  assert.equal(results[2].address, "10 BROADWAY FL 3");
  assert.equal(results[2].phone, "212-555-0102");
  assert.notEqual(results[2].address, "99 Main Street");
  assert.equal(results[3].npi, "4444444444");
  assert.equal(results[3].address, "20 Madison Ave");
  assert.equal(results[3].phone, "212-555-0200");

  await provider.search(input);
  assert.equal(calls.length, 2, "repeat searches should use the bounded TTL cache");
});

test("keeps the confirmed San Bernardino suite collision as two exact NPI targets", async () => {
  const organizations = [
    {
      number: "1427857218",
      enumeration_type: "NPI-2",
      basic: { organization_name: "Apple Physicians Choice", status: "A" },
      addresses: [
        {
          address_purpose: "LOCATION",
          address_1: "407 E Gilbert St Ste 7",
          city: "SAN BERNARDINO",
          state: "CA",
          postal_code: "92404",
          telephone_number: "951-204-0909",
        },
      ],
      taxonomies: familyMedicine,
    },
    {
      number: "1487752895",
      enumeration_type: "NPI-2",
      basic: { organization_name: "San Bernardino Physicians Associates", status: "A" },
      addresses: [
        {
          address_purpose: "LOCATION",
          address_1: "407 E Gilbert St Ste 1",
          city: "SAN BERNARDINO",
          state: "CA",
          postal_code: "92404",
          telephone_number: "909-889-1136",
        },
      ],
      taxonomies: familyMedicine,
    },
  ];
  const provider = createNppesProvider({
    fetchImpl: async (input) =>
      new URL(String(input)).searchParams.get("enumeration_type") === "NPI-2"
        ? nppesResponse(organizations)
        : nppesResponse([]),
    retries: 0,
  });

  const results = await provider.search({
    city: "San Bernardino",
    state: "CA",
    specialty: "Family Medicine",
  });

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map(({ npi, name, address, phone }) => ({ npi, name, address, phone })),
    [
      {
        npi: "1427857218",
        name: "Apple Physicians Choice",
        address: "407 E Gilbert St Ste 7",
        phone: "951-204-0909",
      },
      {
        npi: "1487752895",
        name: "San Bernardino Physicians Associates",
        address: "407 E Gilbert St Ste 1",
        phone: "909-889-1136",
      },
    ],
  );
});

test("does not merge distinct NPIs at an identical suite or borrow their phone numbers", async () => {
  const provider = createNppesProvider({
    fetchImpl: async (input) =>
      new URL(String(input)).searchParams.get("enumeration_type") === "NPI-2"
        ? nppesResponse([
            {
              number: "1111111111",
              enumeration_type: "NPI-2",
              basic: { organization_name: "Broadway Clinic A", status: "A" },
              addresses: [
                {
                  address_purpose: "LOCATION",
                  address_1: "10 Broadway Suite 4",
                  city: "NEW YORK",
                  state: "NY",
                  postal_code: "10004",
                  telephone_number: "212-555-0101",
                },
              ],
              taxonomies: familyMedicine,
            },
            {
              number: "2222222222",
              enumeration_type: "NPI-2",
              basic: { organization_name: "Broadway Clinic B", status: "A" },
              addresses: [
                {
                  address_purpose: "LOCATION",
                  address_1: "10 Broadway Suite 4",
                  city: "NEW YORK",
                  state: "NY",
                  postal_code: "10004",
                  telephone_number: "212-555-0102",
                },
              ],
              taxonomies: familyMedicine,
            },
          ])
        : nppesResponse([]),
    retries: 0,
  });

  const results = await provider.search({
    city: "New York",
    state: "NY",
    specialty: "Family Medicine",
  });

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map(({ npi, name, phone }) => [npi, name, phone]),
    [
      ["1111111111", "Broadway Clinic A", "212-555-0101"],
      ["2222222222", "Broadway Clinic B", "212-555-0102"],
    ],
  );
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
