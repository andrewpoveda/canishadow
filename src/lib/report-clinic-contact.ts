import { supabase } from "@/lib/supabase";
import type { ClinicSearchTarget } from "@/lib/search/types";
import { buildContactReportRpcArgs } from "@/lib/contact-report-rpc";
import type { ContactIssueReason } from "@/lib/contact-report-rpc";

export { buildContactReportRpcArgs } from "@/lib/contact-report-rpc";
export type { ContactIssueReason } from "@/lib/contact-report-rpc";

export async function reportClinicContact(input: {
  submissionKey: string;
  target: ClinicSearchTarget;
  reason: ContactIssueReason;
}) {
  const { data, error } = await supabase.rpc(
    "report_clinic_contact",
    buildContactReportRpcArgs(input),
  );
  if (error) throw error;
  return data;
}
