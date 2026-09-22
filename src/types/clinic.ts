// Domain types — mirror the Supabase schema in MIGRATION.md §1 exactly.
// MIGRATION.md wins on schema over PRM.md §8.1 (which predates the 4-state
// `call_back` status, the embedded `providers` jsonb, and the `verified` boolean).

import type { UsStateCode } from "@/lib/us-states";

export const CLINIC_STATUS = {
  unknown: "unknown",
  verifiedYes: "verified_yes",
  verifiedNo: "verified_no",
  callBack: "call_back",
} as const;

export type ClinicStatus = (typeof CLINIC_STATUS)[keyof typeof CLINIC_STATUS];

/** One provider's answer at a clinic — the embedded `providers` jsonb array. */
export interface Provider {
  name: string;
  response: "yes" | "no";
}

/** Row shape — mirrors the `clinics` table exactly. Do not add UI-only fields here. */
export interface Clinic {
  id: string;
  created_at: string;
  name: string;
  address: string;
  city: string;
  state: UsStateCode;
  zip: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  status: ClinicStatus;
  provider_count: number;
  specialties: string[];
  providers: Provider[];
  contact_email: string | null;
  npi: string | null;
  /** true = AP MED team double-checked; false = crowdsourced/uncalled. Drives the Verified/Unverified filter (§0.1). */
  verified: boolean;
  last_verified: string | null; // ISO date
  verified_by: string | null;
  notes: string | null;
  source: string; // 'nppes' | 'student_search' | 'demo'
}

/** What the map renders — geocoded rows only, lat/lng narrowed to non-null. */
export type ClinicDTO = Clinic & { lat: number; lng: number };

/** Row shape for `contact_logs` — the one-to-many outreach history. */
export interface ContactLog {
  id: string;
  created_at: string;
  clinic_id: string;
  outcome: "yes" | "no" | "call_back" | "no_answer";
  notes: string | null;
  logged_by: string | null;
  contact_email: string | null;
  /** Client-generated idempotency key; null only for legacy ledger rows. */
  submission_key: string | null;
  /** Immutable snapshot of the exact target selected when this call was logged. */
  target_npi: string | null;
  target_enumeration_type: "NPI-1" | "NPI-2" | null;
  target_name: string | null;
  target_address: string | null;
  target_city: string | null;
  target_state: UsStateCode | null;
  target_zip: string | null;
  target_phone: string | null;
  target_specialties: string[] | null;
  target_source: string | null;
  target_phone_source: string | null;
  target_phone_status: "unconfirmed" | null;
}

/** A contact-quality report is separate from a shadowing-call outcome. */
export interface ContactReport {
  id: string;
  created_at: string;
  clinic_id: string | null;
  reason: "wrong_number" | "practice_closed";
  target_npi: string;
  target_enumeration_type: "NPI-1" | "NPI-2";
  target_name: string;
  target_address: string;
  target_city: string;
  target_state: UsStateCode;
  target_zip: string;
  target_phone: string | null;
  target_source: "NPPES NPI Registry";
  review_status: "pending_review" | "reviewed";
  submission_key: string | null;
}

/** Insert payloads — derived from the row types so schema drift is a compile error. */
export type ClinicInsert = Omit<Clinic, "id" | "created_at">;
export type ContactLogInsert = Omit<ContactLog, "id" | "created_at">;

/** Exhaustiveness helper — every switch on ClinicStatus must end with this. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled status: ${x}`);
}
