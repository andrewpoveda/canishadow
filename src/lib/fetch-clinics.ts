import type { Clinic } from "@/types/clinic";

// Supabase projects commonly cap one REST response at 1,000 rows. Page through
// the full public ledger so nationwide growth never silently drops older pins.
const CLINIC_PAGE_SIZE = 1000;

type FetchClinicPage = (from: number, to: number) => Promise<Clinic[]>;

export async function collectMappableClinics(
  fetchPage: FetchClinicPage,
  pageSize = CLINIC_PAGE_SIZE,
): Promise<Clinic[]> {
  const clinics = new Map<string, Clinic>();
  let from = 0;

  while (true) {
    const page = await fetchPage(from, from + pageSize - 1);
    for (const clinic of page) clinics.set(clinic.id, clinic);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return [...clinics.values()].filter(
    (clinic) =>
      clinic.lat != null &&
      clinic.lng != null &&
      clinic.notes !== "geocode_failed",
  );
}

export async function fetchMappableClinics(): Promise<Clinic[]> {
  const { supabase } = await import("@/lib/supabase");
  return collectMappableClinics(async (from, to) => {
    const { data, error } = await supabase
      .from("clinics")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    return (data as Clinic[] | null) ?? [];
  });
}
