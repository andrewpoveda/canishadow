import assert from "node:assert/strict";
import test from "node:test";
import { normalizeClinicAddress } from "./clinic-address";

test("normalizes suite formatting without removing the suite identity", () => {
  assert.equal(
    normalizeClinicAddress("407 E Gilbert Street, Ste. 7"),
    normalizeClinicAddress("407 E Gilbert St Suite 7"),
  );
  assert.notEqual(
    normalizeClinicAddress("407 E Gilbert St Ste 7"),
    normalizeClinicAddress("407 E Gilbert St Ste 1"),
  );
});

test("retains floor and unit distinctions while normalizing labels", () => {
  assert.equal(
    normalizeClinicAddress("10 Broadway # 4"),
    normalizeClinicAddress("10 Broadway Unit 4"),
  );
  assert.notEqual(
    normalizeClinicAddress("10 Broadway Floor 3"),
    normalizeClinicAddress("10 Broadway Floor 4"),
  );
  assert.equal(
    normalizeClinicAddress("10 Broadway Apt # 4"),
    normalizeClinicAddress("10 Broadway Apartment 4"),
  );
});
