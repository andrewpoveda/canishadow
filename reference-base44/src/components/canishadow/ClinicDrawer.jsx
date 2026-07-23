import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";
import { Link2, Mail } from "lucide-react";
import StatusBadge from "@/components/canishadow/StatusBadge";
import ProviderList from "@/components/canishadow/ProviderList";
import ContactHistory from "@/components/canishadow/ContactHistory";
import { STATUS_META, effectiveStatus } from "@/lib/status";

const EASE = [0.2, 0, 0, 1];

function eyebrow(clinic, status) {
  const date = clinic.last_verified
    ? moment(clinic.last_verified).format("MMM D YYYY").toUpperCase()
    : null;
  if (status === "verified_yes")
    return `VERIFIED${date ? ` · ${date}` : ""}${clinic.verified_by ? ` · BY ${clinic.verified_by.toUpperCase()}` : ""}`;
  if (status === "verified_no") return `DECLINED${date ? ` · ${date}` : ""}`;
  if (status === "call_back") return `CALL BACK${date ? ` · ${date}` : ""}`;
  return "NOT YET VERIFIED";
}

function introMailto(clinic) {
  const subject = encodeURIComponent(`Shadowing introduction — ${clinic.name}`);
  const body = encodeURIComponent(
    `Hi,\n\nI found ${clinic.name} on CanIShadow and understand you're open to shadowing students. I'd love to introduce myself before coming by — my resume and LinkedIn are attached/linked below.\n\nThank you,\n`
  );
  return `mailto:${clinic.contact_email}?subject=${subject}&body=${body}`;
}

export default function ClinicDrawer({ clinic, onClose, onClinicUpdate }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => setCopied(false), [clinic?.id]);

  const share = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?clinic=${clinic.id}`);
    setCopied(true);
  };

  const status = clinic ? effectiveStatus(clinic) : "unknown";

  return (
    <AnimatePresence>
      {clinic && (
        <>
          <motion.div
            className="fixed inset-0 z-[1100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={clinic.name}
            className="fixed bottom-0 left-0 right-0 z-[1200] mx-auto flex max-h-[80vh] max-w-xl flex-col overflow-hidden rounded-t-sheet bg-paper shadow-float"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.18, ease: EASE }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(e, info) => info.offset.y > 80 && onClose()}
          >
            <div className={`h-[3px] w-full shrink-0 ${STATUS_META[status].railClass}`} />
            <div className="overflow-y-auto p-5 pb-8">
              <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-line" />
              <div className="flex items-start justify-between gap-3">
                <p
                  className={`pt-2 font-mono text-[11px] uppercase tracking-[0.06em] ${
                    status === "unknown" ? "text-ink-3" : "text-ink-2"
                  }`}
                >
                  {eyebrow(clinic, status)}
                </p>
                <button
                  onClick={share}
                  className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-pill bg-paper-2 px-3 text-[11px] font-medium text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Share"}
                </button>
              </div>
              <h2 className="mt-2 font-display text-[28px] leading-8 text-ink">{clinic.name}</h2>
              <p className="mt-3 text-[15px] leading-[22px] text-ink-2">
                {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip}
              </p>
              {clinic.phone && (
                <a href={`tel:${clinic.phone}`} className="mt-1 inline-block py-1 text-[15px] font-medium text-ink">
                  {clinic.phone}
                </a>
              )}
              <ProviderList clinic={clinic} />
              <div className="mt-4">
                <StatusBadge status={status} />
              </div>
              {clinic.contact_email && (
                <div className="mt-4 rounded-sheet bg-paper-2 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
                    Contact · {clinic.contact_email}
                  </p>
                  <a
                    href={introMailto(clinic)}
                    className="mt-2.5 inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-ink px-4 text-[13px] font-medium text-paper"
                  >
                    <Mail className="h-4 w-4" />
                    Send intro email (resume / LinkedIn)
                  </a>
                  <p className="mt-2 text-[13px] text-ink-3">
                    Introduce yourself by email before walking in — the clinic said yes on the platform, not to a surprise visit.
                  </p>
                </div>
              )}
              {status === "unknown" && (
                <p className="mt-4 text-[13px] text-ink-3">This clinic hasn't been called yet.</p>
              )}
              <ContactHistory clinic={clinic} onClinicUpdate={onClinicUpdate} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}