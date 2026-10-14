import type { Dictionary } from "@/i18n/dictionaries";

export type LatLng = { lat: number; lng: number };

export class GeoError extends Error {
  constructor(public code: "unsupported" | "denied" | "failed") {
    super(code);
  }
}

/** The device's current position. Rejects with a GeoError. */
export function currentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new GeoError("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new GeoError(err.code === err.PERMISSION_DENIED ? "denied" : "failed")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

export function geoMessage(err: unknown, t: Dictionary) {
  return err instanceof GeoError ? t.geo[err.code] : t.geo.failed;
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Map starts here when the viewer's location is unknown: Indiranagar, Bengaluru.
export const DEFAULT_CENTER: LatLng = { lat: 12.9715, lng: 77.6412 };

/**
 * Neighbourhood and city for a point, from OpenStreetMap's free Nominatim service.
 * Best effort: returns nulls on any failure. Policy: https://operations.osmfoundation.org/policies/nominatim/
 */
export async function reverseGeocode(p: LatLng, signal?: AbortSignal) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${p.lat}&lon=${p.lng}`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return { locality: null, city: null };
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    return {
      locality: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.village ?? a.town ?? null,
      city: a.city ?? a.town ?? a.state_district ?? a.county ?? null,
    };
  } catch {
    return { locality: null, city: null };
  }
}
