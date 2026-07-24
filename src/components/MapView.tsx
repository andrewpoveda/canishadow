"use client";

import React from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS_META, PIN_ORDER, effectiveStatus } from "@/lib/status";
import type { Clinic } from "@/types/clinic";

// Ported from reference-base44/src/components/canishadow/MapView.jsx — Leaflet + free CARTO
// tiles (MIGRATION.md §0, no Mapbox). Circle layers keep hundreds of pins smooth on a phone.
export default function MapView({
  clinics,
  selectedId,
  onSelect,
}: {
  clinics: Clinic[];
  selectedId?: string | null;
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
      minZoom={9}
      maxBounds={[
        [40.3, -74.7],
        [41.1, -73.4],
      ]}
      className="absolute inset-0 z-0"
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {ordered.map((c) => {
        if (c.lat == null || c.lng == null) return null;
        const center: [number, number] = [c.lat, c.lng];
        const meta = STATUS_META[effectiveStatus(c)];
        const selected = c.id === selectedId;
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
