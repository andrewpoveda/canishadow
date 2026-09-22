import type { ClinicSearchTarget } from "@/lib/search/types";

export type ContactIssueReason = "wrong_number" | "practice_closed";

export function buildContactReportRpcArgs(input: {
  submissionKey: string;
  target: ClinicSearchTarget;
  reason: ContactIssueReason;
}) {
  return {
    p_submission_key: input.submissionKey,
    p_npi: input.target.npi,
    p_enumeration_type: input.target.enumerationType,
    p_name: input.target.name,
    p_phone: input.target.phone || null,
    p_address: input.target.address,
    p_city: input.target.city,
    p_state: input.target.state,
    p_zip: input.target.zip,
    p_reason: input.reason,
  };
}
