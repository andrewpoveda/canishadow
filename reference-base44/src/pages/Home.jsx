import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import MapView from "@/components/canishadow/MapView";
import ClinicDrawer from "@/components/canishadow/ClinicDrawer";
import FilterBar from "@/components/canishadow/FilterBar";
import Header from "@/components/canishadow/Header";
import Legend from "@/components/canishadow/Legend";
import { effectiveStatus } from "@/lib/status";

export default function Home() {
  const [clinics, setClinics] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    base44.entities.Clinic.list(null, 1000).then((rows) => {
      const geocoded = rows.filter((c) => c.lat != null && c.lng != null && c.notes !== "geocode_failed");
      setClinics(geocoded);
      const id = new URLSearchParams(window.location.search).get("clinic");
      if (id) {
        const c = geocoded.find((x) => x.id === id);
        if (c) setSelected(c);
      }
    });
  }, []);

  const handleClinicUpdate = (updated) => {
    setClinics((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

  const counts = useMemo(() => {
    const all = clinics || [];
    const verified = all.filter((c) => effectiveStatus(c) !== "unknown").length;
    return { all: all.length, verified, unverified: all.length - verified };
  }, [clinics]);

  const visible = useMemo(() => {
    const all = clinics || [];
    if (filter === "verified") return all.filter((c) => effectiveStatus(c) !== "unknown");
    if (filter === "unverified") return all.filter((c) => effectiveStatus(c) === "unknown");
    return all;
  }, [clinics, filter]);

  if (!clinics) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-paper-2">
        <p className="font-display text-[20px] leading-[26px] text-ink-2">Loading clinics…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-paper">
      <MapView clinics={visible} selectedId={selected?.id} onSelect={setSelected} />
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
          <p className="font-display text-[20px] leading-[26px] text-ink">No verified clinics here yet.</p>
          <p className="mt-1 text-[15px] text-ink-2">Calls in progress — new pins land weekly.</p>
        </div>
      )}
      <ClinicDrawer clinic={selected} onClose={() => setSelected(null)} onClinicUpdate={handleClinicUpdate} />
    </div>
  );
}