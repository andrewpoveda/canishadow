import HomeClient from "@/components/HomeClient";
import { fetchMappableClinics } from "@/lib/fetch-clinics";

// Any route reading Supabase must be force-dynamic (CLAUDE.md non-negotiable).
export const dynamic = "force-dynamic";

export default async function Page() {
  let clinics;
  try {
    clinics = await fetchMappableClinics();
  } catch {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-1 bg-paper-2 px-8 text-center">
        <p className="font-display text-[20px] leading-[26px] text-ink">
          Couldn&apos;t load the map data.
        </p>
        <p className="text-[15px] text-ink-2">Refresh to retry.</p>
      </div>
    );
  }

  return <HomeClient initialClinics={clinics} />;
}
