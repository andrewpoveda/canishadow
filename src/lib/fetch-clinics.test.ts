import assert from "node:assert/strict";
import test from "node:test";
import { collectMappableClinics } from "./fetch-clinics";
import type { Clinic } from "@/types/clinic";

function clinic(id: string, overrides: Partial<Clinic> = {}) {
  return {
    id,
    created_at: "2026-08-21T00:00:00Z",
    name: id,
    address: `${id} MAIN ST`,
    city: "NEW YORK",
    state: "NY",
    zip: "10001",
    lat: 40.7,
    lng: -74,
    phone: null,
    status: "unknown",
    provider_count: 1,
    specialties: [],
    providers: [],
    contact_email: null,
    npi: null,
    verified: false,
    last_verified: null,
    verified_by: null,
    notes: null,
    source: "nppes",
    ...overrides,
  } satisfies Clinic;
}

test("loads every clinic page, dedupes IDs, and excludes unmappable rows", async () => {
  const calls: Array<[number, number]> = [];
  const pages = [
    [clinic("one"), clinic("two")],
    [clinic("two"), clinic("no-coordinates", { lat: null })],
    [clinic("geocode-failed", { notes: "geocode_failed" })],
  ];

  const result = await collectMappableClinics(async (from, to) => {
    calls.push([from, to]);
    return pages[calls.length - 1] ?? [];
  }, 2);

  assert.deepEqual(calls, [
    [0, 1],
    [2, 3],
    [4, 5],
  ]);
  assert.deepEqual(result.map(({ id }) => id), ["one", "two"]);
});
