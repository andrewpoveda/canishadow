"use client";

import React, { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS_META, PIN_ORDER, effectiveStatus } from "@/lib/status";
import type { Clinic } from "@/types/clinic";

const SELECTED_CLINIC_ZOOM = 13;
const SELECTED_CLINIC_SCREEN_Y = 0.1;

function SelectedClinicController({ clinic }: { clinic: Clinic | null }) {
  const map = useMap();
  const id = clinic?.id;
  const lat = clinic?.lat;
  const lng = clinic?.lng;

  useEffect(() => {
    if (!id || lat == null || lng == null) return;

    const clinicCenter: [number, number] = [lat, lng];
    const zoom = Math.max(map.getZoom(), SELECTED_CLINIC_ZOOM);
    // The drawer can occupy 80% of a phone viewport. Offset the map center so
    // the selected pin sits at 10% screen height, in the visible map strip.
    const center = map.unproject(
      map
        .project(clinicCenter, zoom)
        .add([0, map.getSize().y * (0.5 - SELECTED_CLINIC_SCREEN_Y)]),
      zoom,
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      map.setView(center, zoom, { animate: false });
      return;
    }

    map.flyTo(center, zoom, { duration: 0.45 });
  }, [id, lat, lng, map]);

  return null;
}

// Ported from reference-base44/src/components/canishadow/MapView.jsx. Leaflet uses
// OpenStreetMap tiles with no client API key. Circle layers keep hundreds of pins smooth on a phone.
export default function MapView({
  clinics,
  selectedClinic,
  onSelect,
}: {
  clinics: Clinic[];
  selectedClinic: Clinic | null;
  onSelect: (clinic: Clinic) => void;
}) {
  // Draw order: unknown → call_back → verified_no → verified_yes (green on top).
  const ordered = PIN_ORDER.flatMap((s) =>
    clinics.filter((c) => effectiveStatus(c) === s),
  );

  return (
    <MapContainer
      center={[40.72, -74.1]}
      zoom={11}
      zoomControl={false}
      className="absolute inset-0 z-0"
      attributionControl={true}
    >
      <SelectedClinicController clinic={selectedClinic} />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      {ordered.map((c) => {
        if (c.lat == null || c.lng == null) return null;
        const center: [number, number] = [c.lat, c.lng];
        const meta = STATUS_META[effectiveStatus(c)];
        const selected = c.id === selectedClinic?.id;
        const r = selected ? meta.radius * 1.4 : meta.radius;
        return (
          <React.Fragment key={c.id}>
            {(meta.halo || selected) && (
              <CircleMarker
                center={center}
                radius={r + 5}
                pathOptions={{
                  stroke: false,
                  fillColor: meta.halo || "#E4EFEA",
                  fillOpacity: 0.7,
                }}
              />
            )}
            <CircleMarker
              center={center}
              radius={r}
              pathOptions={{
                color: "#FFFFFF",
                weight: meta.strokeWeight,
                fillColor: meta.fill,
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect(c) }}
            />
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
