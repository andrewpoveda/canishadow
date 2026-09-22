import type { LogClinicCallInput } from "@/lib/log-clinic-call";

export function buildLogClinicCallRpcArgs(input: LogClinicCallInput) {
  return {
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
    p_target_enumeration_type: input.targetEnumerationType || null,
  };
}
