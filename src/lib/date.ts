import { format, parseISO } from "date-fns";

// Replaces base44's `moment` (MIGRATION.md §5 — prefer date-fns).
// parseISO treats a date-only "yyyy-MM-dd" as local midnight, avoiding the UTC
// off-by-one that `new Date("yyyy-MM-dd")` would introduce.

/** "2026-07-15" or a full ISO timestamp → "Jul 15 2026" (caller uppercases for ledger rows). */
export function ledgerDate(value: string): string {
  return format(parseISO(value), "MMM d yyyy");
}

/** Today as "yyyy-MM-dd" for `last_verified`. */
export function todayISODate(): string {
  return format(new Date(), "yyyy-MM-dd");
}
