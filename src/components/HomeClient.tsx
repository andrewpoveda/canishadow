"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ClinicDrawer from "@/components/ClinicDrawer";
import FilterBar, { type FilterKey } from "@/components/FilterBar";
import Header from "@/components/Header";
import Legend from "@/components/Legend";
import { effectiveStatus } from "@/lib/status";
import { supabase } from "@/lib/supabase";
import type { Clinic } from "@/types/clinic";

// Leaflet touches window/document — never SSR it.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 z-0 bg-paper-2" />,
});

// Orchestrator ported from reference-base44/src/pages/Home.jsx. THE ONE DELIBERATE CHANGE
// (MIGRATION.md §0.1 / §3): the All/Verified/Unverified axis keys off the `verified` boolean,
// not pin colour. Verified = team-checked; Unverified = has an outcome but not team-checked;
// gray not-yet-called pins appear only under All.
export default function HomeClient({
  initialClinics,
}: {
  initialClinics: Clinic[];
}) {
  const [clinics, setClinics] = useState<Clinic[]>(initialClinics);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Clinic | null>(null);

  // Revalidate against Supabase on mount. initialClinics gives instant SSR paint, but a
  // soft client navigation (e.g. "View on map" after logging a call) can serve a cached RSC
  // payload from Next's Router Cache — so we always re-fetch client-side to guarantee that
  // freshly-logged pins appear and the filter counts are correct.
  useEffect(() => {
    let active = true;
    supabase
      .from("clinics")
      .select("*")
      .limit(1000)
      .then(({ data }) => {
        if (!active || !data) return;
        const fresh = (data as Clinic[]).filter(
          (c) => c.lat != null && c.lng != null && c.notes !== "geocode_failed",
        );
        setClinics(fresh);
        // Deep-link: /?clinic=<id> opens that clinic's drawer (works for just-logged pins too).
        const id = new URLSearchParams(window.location.search).get("clinic");
        if (id) {
          const c = fresh.find((x) => x.id === id);
          if (c) setSelected(c);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleClinicUpdate = (updated: Clinic) => {
    setClinics((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

  const isVerified = (c: Clinic) => c.verified === true;
  const isUnverified = (c: Clinic) =>
    !c.verified && effectiveStatus(c) !== "unknown";

  const counts = useMemo<Record<FilterKey, number>>(() => {
    return {
      all: clinics.length,
      verified: clinics.filter(isVerified).length,
      unverified: clinics.filter(isUnverified).length,
    };
  }, [clinics]);

  const visible = useMemo(() => {
    if (filter === "verified") return clinics.filter(isVerified);
    if (filter === "unverified") return clinics.filter(isUnverified);
    return clinics;
  }, [clinics, filter]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-paper">
      <MapView
        clinics={visible}
        selectedId={selected?.id}
        onSelect={setSelected}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000]">
        <Header />
        <div className="mt-3 flex justify-center">
          <FilterBar filter={filter} onChange={setFilter} counts={counts} />
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-6 right-3 z-[1000]">
        <Legend />
      </div>
      {visible.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[900] flex flex-col items-center justify-center px-8 text-center">
          <p className="font-display text-[20px] leading-[26px] text-ink">
            No clinics here yet.
          </p>
          <p className="mt-1 text-[15px] text-ink-2">
            Calls in progress — new pins land weekly.
          </p>
        </div>
      )}
      <ClinicDrawer
        clinic={selected}
        onClose={() => setSelected(null)}
        onClinicUpdate={handleClinicUpdate}
      />
    </div>
  );
}
