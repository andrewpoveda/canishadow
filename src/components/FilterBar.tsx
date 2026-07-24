"use client";

// Segmented control (PRM.md §5.4). The All/Verified/Unverified axis keys off the `verified`
// boolean, not pin colour (MIGRATION.md §0.1) — the predicate lives in HomeClient.
export type FilterKey = "all" | "verified" | "unverified";

export default function FilterBar({
  filter,
  onChange,
  counts,
}: {
  filter: FilterKey;
  onChange: (key: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  const segments: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "verified", label: "Verified", count: counts.verified },
    { key: "unverified", label: "Unverified", count: counts.unverified },
  ];
  return (
    <div className="pointer-events-auto flex rounded-pill bg-paper-2 p-1 shadow-float">
      {segments.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`flex min-h-[44px] items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-medium transition-colors duration-200 ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
            filter === s.key ? "bg-ink text-paper" : "text-ink-2"
          }`}
        >
          {s.label}
          <span className="font-mono text-[11px]">{s.count}</span>
        </button>
      ))}
    </div>
  );
}
