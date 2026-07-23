import React from "react";
import { STATUS_META } from "@/lib/status";

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return (
    <span className={`inline-flex items-center rounded-pill px-3.5 py-2 text-[13px] font-medium ${meta.badgeClass}`}>
      {meta.badgeLabel}
    </span>
  );
}