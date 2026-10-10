"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PATHS, STATUSES } from "@/lib/taxonomy";
import type { LatLng } from "@/lib/geo";
import type { ProblemCard } from "@/lib/types";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(color: string, done: boolean) {
  const key = `${color}-${done}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -12],
      html: `<span style="display:block;width:26px;height:26px;border-radius:9999px;background:${done ? "#16a34a" : color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
    });
    iconCache.set(key, icon);
  }
  return icon;
}

export type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export default function ProblemsMapInner({
  problems,
  center,
  zoom = 14,
  onBoundsChange,
  className = "h-full w-full",
}: {
  problems: ProblemCard[];
  center: LatLng;
  zoom?: number;
  onBoundsChange?: (b: Bounds) => void;
  className?: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const router = useRouter();

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Prevent double initialization
    if (mapContainerRef.current.hasChildNodes()) return;

    const m = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: zoom,
      scrollWheelZoom: true,
    });

    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION }).addTo(m);

    m.on('moveend', () => {
      if (onBoundsChange) {
        const b = m.getBounds();
        onBoundsChange({ minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() });
      }
    });

    // Initial bounds report
    if (onBoundsChange) {
      const b = m.getBounds();
      onBoundsChange({ minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() });
    }

    setMap(m);

    return () => {
      m.off();
      m.remove();
      setMap(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center
  useEffect(() => {
    if (map) {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 15));
    }
  }, [center.lat, center.lng, map]);

  // Update markers
  useEffect(() => {
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers
    problems.forEach((p) => {
      const photo = p.photos?.[0];
      const icon = pinIcon(PATHS[p.path].color, p.status === "verified");
      
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      
      marker.on('click', () => {
        router.push(`/problems/${p.id}`);
      });

      // Create tooltip HTML
      const tooltipContent = document.createElement('div');
      tooltipContent.className = 'w-56 pb-1 cursor-pointer';
      
      let html = '';
      if (photo) {
        html += `<img src="${photo}" alt="" class="mb-3 h-28 w-full rounded-xl object-cover shadow-sm" />`;
      }
      html += `
        <div class="flex flex-wrap gap-1 mb-2">
          <span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style="background-color: ${STATUSES[p.status].color}20; color: ${STATUSES[p.status].color}">
            ${STATUSES[p.status].label}
          </span>
          <span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-ink-soft border border-line/50">
            ${PATHS[p.path].short}
          </span>
        </div>
        <p class="my-1 text-sm font-bold leading-snug line-clamp-2 text-ink">${p.title}</p>
        <div class="mt-2 text-xs font-bold text-brand flex items-center gap-1">
          Click to view details &rarr;
        </div>
      `;
      
      tooltipContent.innerHTML = html;

      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -15],
        opacity: 1,
        className: 'hover-popup'
      });

      markersRef.current.push(marker);
    });
  }, [problems, router]);

  return <div ref={mapContainerRef} className={className} />;
}
