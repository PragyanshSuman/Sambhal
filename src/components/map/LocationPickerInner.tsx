"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/geo";

const icon = L.divIcon({
  className: "",
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.2 0 0 7.1 0 15.9 0 27.8 16 42 16 42s16-14.2 16-26.1C32 7.1 24.8 0 16 0z" fill="#e8772e"/><circle cx="16" cy="16" r="6" fill="white"/></svg>`,
});

function ClickToMove({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Follow({ value }: { value: LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().contains([value.lat, value.lng])) map.setView([value.lat, value.lng]);
  }, [value.lat, value.lng, map]);
  return null;
}

export default function LocationPickerInner({ value, onChange }: { value: LatLng; onChange: (p: LatLng) => void }) {
  const markerRef = useRef<L.Marker>(null);
  const handlers = useMemo(
    () => ({
      dragend() {
        const ll = markerRef.current?.getLatLng();
        if (ll) onChange({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onChange],
  );

  return (
    <MapContainer center={[value.lat, value.lng]} zoom={17} className="h-64 w-full rounded-xl" scrollWheelZoom={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={[value.lat, value.lng]} draggable icon={icon} ref={markerRef} eventHandlers={handlers} />
      <ClickToMove onChange={onChange} />
      <Follow value={value} />
    </MapContainer>
  );
}
