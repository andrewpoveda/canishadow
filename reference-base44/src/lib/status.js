export const COLORS = {
  paper: "#FAF9F6",
  paper2: "#F1EFEA",
  ink: "#0F1B2D",
  ink3: "#8A93A6",
  verified: "#0F5144",
  verifiedTint: "#E4EFEA",
  declined: "#8E3B3B",
  callback: "#9A7B2D",
  callbackTint: "#F4EDDB",
  line: "#E3E0D8",
};

export const STATUS_META = {
  unknown: {
    fill: COLORS.ink3,
    strokeWeight: 1.5,
    radius: 4,
    halo: null,
    badgeLabel: "Unverified",
    badgeClass: "bg-paper-2 text-ink-2",
    railClass: "bg-line",
  },
  call_back: {
    fill: COLORS.callback,
    strokeWeight: 2,
    radius: 5,
    halo: null,
    badgeLabel: "Call back in a few months",
    badgeClass: "bg-callback-tint text-callback",
    railClass: "bg-callback",
  },
  verified_no: {
    fill: COLORS.declined,
    strokeWeight: 2,
    radius: 5,
    halo: null,
    badgeLabel: "Not taking students",
    badgeClass: "bg-declined-tint text-declined",
    railClass: "bg-declined",
  },
  verified_yes: {
    fill: COLORS.verified,
    strokeWeight: 2,
    radius: 6,
    halo: COLORS.verifiedTint,
    badgeLabel: "Takes shadowing students",
    badgeClass: "bg-verified-tint text-verified",
    railClass: "bg-verified",
  },
};

export const PIN_ORDER = ["unknown", "call_back", "verified_no", "verified_yes"];

/** Pin/badge status — green if at least one provider said yes, regardless of clinic-level status. */
export function effectiveStatus(clinic) {
  if ((clinic.providers || []).some((p) => p.response === "yes")) return "verified_yes";
  return clinic.status || "unknown";
}