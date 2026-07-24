import HomeClient from "@/components/HomeClient";
import { supabase } from "@/lib/supabase";
import type { Clinic } from "@/types/clinic";

// Any route reading Supabase must be force-dynamic (CLAUDE.md non-negotiable).
export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .limit(1000);

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-1 bg-paper-2 px-8 text-center">
        <p className="font-display text-[20px] leading-[26px] text-ink">
          Couldn&apos;t load the map data.
        </p>
        <p className="text-[15px] text-ink-2">Refresh to retry.</p>
      </div>
    );
  }

  // Geocode-failed / null-coordinate rows are excluded server-side (PRM.md §5.6) —
  // the UI never renders a clinic without a pin.
  const clinics = ((data as Clinic[] | null) ?? []).filter(
    (c) => c.lat != null && c.lng != null && c.notes !== "geocode_failed",
  );

  return <HomeClient initialClinics={clinics} />;
}
