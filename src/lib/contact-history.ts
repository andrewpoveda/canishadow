import type { ContactLog } from "@/types/clinic";

export function contactTargetSummary(log: ContactLog) {
  const identity = [
    log.target_name || "Clinic location",
    log.target_npi ? `NPI ${log.target_npi}` : "NPI not recorded",
    log.target_enumeration_type
      ? log.target_enumeration_type === "NPI-2"
        ? "organization"
        : "individual provider"
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const address = [log.target_address, log.target_city, log.target_state, log.target_zip]
    .filter(Boolean)
    .join(", ");

  const phone = log.target_phone
    ? [
        `Registry number at time of call: ${log.target_phone}`,
        log.target_phone_source,
        log.target_phone_status === "unconfirmed" ? "not confirmed current" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return { identity, address, phone };
}
