import { STATUS_META, type EffectiveStatus } from "@/lib/status";

// Single source of badge rendering (used by ClinicDrawer + Legend).
export default function StatusBadge({ status }: { status: EffectiveStatus }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3.5 py-2 text-[13px] font-medium ${meta.badgeClass}`}
    >
      {meta.badgeLabel}
    </span>
  );
}
