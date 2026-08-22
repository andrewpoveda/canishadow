import { supabase } from "@/lib/supabase";
import type { Clinic, ContactLog } from "@/types/clinic";

export type CallOutcome = "yes" | "no" | "call_back";

export interface LogClinicCallInput {
  submissionKey: string;
  clinicId: string | null;
  outcome: CallOutcome;
  providerName?: string;
  loggedBy?: string;
  contactEmail?: string;
  notes?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  providerCount?: number;
  specialties?: string[];
  npi?: string;
}

export interface LogClinicCallResult {
  clinic: Clinic;
  log: ContactLog;
  created: boolean;
}

function isResult(value: unknown): value is LogClinicCallResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const clinic = record.clinic;
  const log = record.log;
  return (
    typeof record.created === "boolean" &&
    Boolean(clinic && typeof clinic === "object" && "id" in clinic) &&
    Boolean(log && typeof log === "object" && "id" in log)
  );
}

export async function logClinicCall(input: LogClinicCallInput) {
  const { data, error } = await supabase.rpc("log_clinic_call", {
    p_submission_key: input.submissionKey,
    p_clinic_id: input.clinicId,
    p_outcome: input.outcome,
    p_provider_name: input.providerName?.trim() || null,
    p_logged_by: input.loggedBy?.trim() || null,
    p_contact_email: input.contactEmail?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_name: input.name?.trim() || null,
    p_address: input.address?.trim() || null,
    p_city: input.city?.trim() || null,
    p_state: input.state || null,
    p_zip: input.zip || null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_phone: input.phone?.trim() || null,
    p_provider_count: input.providerCount ?? 1,
    p_specialties: input.specialties ?? [],
    p_npi: input.npi || null,
  });

  if (error) throw error;
  if (!isResult(data)) throw new Error("Invalid call-log response");
  return data;
}
