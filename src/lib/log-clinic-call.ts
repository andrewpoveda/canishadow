import { supabase } from "@/lib/supabase";
import { buildLogClinicCallRpcArgs } from "@/lib/call-log-rpc";
import type { Clinic, ContactLog } from "@/types/clinic";

export { buildLogClinicCallRpcArgs } from "@/lib/call-log-rpc";

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
  targetEnumerationType?: "NPI-1" | "NPI-2";
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
  const { data, error } = await supabase.rpc(
    "log_clinic_call",
    buildLogClinicCallRpcArgs(input),
  );

  if (error) throw error;
  if (!isResult(data)) throw new Error("Invalid call-log response");
  return data;
}
