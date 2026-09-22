import assert from "node:assert/strict";
import test from "node:test";
import { buildLogClinicCallRpcArgs } from "./call-log-rpc";
import { contactTargetSummary } from "./contact-history";
import { buildContactReportRpcArgs } from "./contact-report-rpc";
import type { ClinicSearchTarget } from "./search/types";
import type { ContactLog } from "@/types/clinic";

const target: ClinicSearchTarget = {
  name: "Apple Physicians Choice",
  npi: "1427857218",
  enumerationType: "NPI-2",
  address: "407 E GILBERT ST SUITE 7",
  city: "SAN BERNARDINO",
  state: "CA",
  zip: "92404",
  phone: "951-204-0909",
  phoneSource: "NPPES NPI Registry",
  phoneStatus: "unconfirmed",
  specialties: ["Family Medicine"],
};

test("call submission preserves the selected NPI, full suite address, and its phone", () => {
  const args = buildLogClinicCallRpcArgs({
    submissionKey: "submission-1",
    clinicId: null,
    outcome: "yes",
    name: target.name,
    address: target.address,
    city: target.city,
    state: target.state,
    zip: target.zip,
    phone: target.phone,
    npi: target.npi,
    targetEnumerationType: target.enumerationType,
    specialties: target.specialties,
  });

  assert.equal(args.p_npi, "1427857218");
  assert.equal(args.p_target_enumeration_type, "NPI-2");
  assert.equal(args.p_address, "407 E GILBERT ST SUITE 7");
  assert.equal(args.p_phone, "951-204-0909");
});

test("contact reports retain the same exact target and a separate report reason", () => {
  const args = buildContactReportRpcArgs({
    submissionKey: "report-1",
    target,
    reason: "wrong_number",
  });

  assert.equal(args.p_npi, target.npi);
  assert.equal(args.p_enumeration_type, "NPI-2");
  assert.equal(args.p_address, target.address);
  assert.equal(args.p_phone, target.phone);
  assert.equal(args.p_reason, "wrong_number");
  assert.equal("p_outcome" in args, false);
});

test("call history presents the immutable NPI target, full suite, and phone provenance", () => {
  const log = {
    id: "log-1",
    created_at: "2026-09-22T12:00:00Z",
    clinic_id: "clinic-1",
    outcome: "yes",
    notes: null,
    logged_by: null,
    contact_email: null,
    submission_key: "submission-1",
    target_npi: target.npi,
    target_enumeration_type: target.enumerationType,
    target_name: target.name,
    target_address: target.address,
    target_city: target.city,
    target_state: target.state,
    target_zip: target.zip,
    target_phone: target.phone ?? null,
    target_specialties: target.specialties ?? null,
    target_source: "NPPES NPI Registry",
    target_phone_source: "NPPES NPI Registry",
    target_phone_status: "unconfirmed",
  } satisfies ContactLog;

  assert.deepEqual(contactTargetSummary(log), {
    identity: "Apple Physicians Choice · NPI 1427857218 · organization",
    address: "407 E GILBERT ST SUITE 7, SAN BERNARDINO, CA, 92404",
    phone:
      "Registry number at time of call: 951-204-0909 · NPPES NPI Registry · not confirmed current",
  });
});
