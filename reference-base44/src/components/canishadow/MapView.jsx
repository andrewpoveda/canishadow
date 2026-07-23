import React from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS_META, PIN_ORDER, effectiveStatus } from "@/lib/status";

export default function MapView({ clinics, selectedId, onSelect }) {
  const ordered = PIN_ORDER.flatMap((s) => clinics.filter((c) => effectiveStatus(c) === s));

  return (
    <MapContainer
      center={[40.72, -74.1]}
      zoom={11}
      zoomControl={false}
      minZoom={9}
      maxBounds={[[40.3, -74.7], [41.1, -73.4]]}
      className="absolute inset-0 z-0"
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {ordered.map((c) => {
        const meta = STATUS_META[effectiveStatus(c)];
        const selected = c.id === selectedId;
        const r = selected ? meta.radius * 1.4 : meta.radius;
        return (
          <React.Fragment key={c.id}>
            {(meta.halo || selected) && (
              <CircleMarker
                center={[c.lat, c.lng]}
                radius={r + 5}
                pathOptions={{ stroke: false, fillColor: meta.halo || "#E4EFEA", fillOpacity: 0.7 }}
              />
            )}
            <CircleMarker
              center={[c.lat, c.lng]}
              radius={r}
              pathOptions={{ color: "#FFFFFF", weight: meta.strokeWeight, fillColor: meta.fill, fillOpacity: 1 }}
              eventHandlers={{ click: () => onSelect(c) }}
            />
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}