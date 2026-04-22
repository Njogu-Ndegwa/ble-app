"use client";

import { useEffect, useState } from 'react';
import type { GeoLocation } from '../types';

/**
 * Shared geolocation watcher. Uses `navigator.geolocation.watchPosition` with
 * high accuracy, returning the most recent coordinates + heading (in degrees,
 * compass-style) when the browser supplies it.
 *
 * Returns `null` before the first fix or if the API is unavailable.
 */
export function useGeolocation(options?: PositionOptions) {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('geolocation-unsupported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading:
            typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
              ? pos.coords.heading
              : null,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options,
      },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [options]);

  return { location, error };
}

/**
 * Haversine distance in kilometers between two lat/lng pairs.
 */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Formats a km distance as "320 m" / "1.2 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
