"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoLocation } from '../types';

/**
 * Geolocation readiness:
 * - `idle`        no request in flight yet (mount tick only)
 * - `locating`    waiting on the first fix from the browser
 * - `ready`       at least one fix has arrived (`location` is set)
 * - `denied`      the user explicitly refused permission
 * - `unavailable` `navigator.geolocation` is missing (insecure origin / unsupported)
 * - `error`       any other positional error (e.g. timeout, position unavailable)
 */
export type GeoStatus =
  | 'idle'
  | 'locating'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'error';

function coordsToLocation(pos: GeolocationPosition): GeoLocation {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    heading:
      typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
        ? pos.coords.heading
        : null,
    accuracy: pos.coords.accuracy,
  };
}

/**
 * Shared geolocation watcher.
 *
 * Strategy:
 *   1. On mount, fire `getCurrentPosition` with a generous `maximumAge` so we
 *      get a near-instant first fix whenever the browser has a cached one.
 *   2. In parallel, start `watchPosition` (high accuracy) for live updates
 *      so the heading/accuracy stay fresh.
 *   3. Expose `status` so callers can distinguish "still acquiring" from
 *      "denied / unavailable" — these have very different UX.
 *   4. Expose `requestLocation()` so UI actions (e.g. "Navigate") can ask
 *      for a one-shot fix on demand when `location` is still `null`.
 *
 * Returns `null` before the first fix or if the API is unavailable.
 */
export function useGeolocation(options?: PositionOptions) {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Keep latest options in a ref so the effect doesn't resubscribe on every
  // render when callers pass an inline `{}` literal (which would otherwise
  // tear down `watchPosition` before it ever delivers a first fix).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError(err.message);
    if (err.code === err.PERMISSION_DENIED) setStatus('denied');
    else setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
  }, []);

  const requestLocation = useCallback((): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable');
        reject(new Error('geolocation-unsupported'));
        return;
      }
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'locating'));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = coordsToLocation(pos);
          setLocation(loc);
          setStatus('ready');
          setError(null);
          resolve(loc);
        },
        (err) => {
          handleError(err);
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
          ...optionsRef.current,
        },
      );
    });
  }, [handleError]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setError('geolocation-unsupported');
      return;
    }

    setStatus('locating');

    // Fast path: grab a cached/one-shot fix right away. This typically
    // resolves in milliseconds if the browser already has a recent fix,
    // which is what callers usually need for "center on me" / "route from
    // here" actions immediately after the screen mounts.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(coordsToLocation(pos));
        setStatus('ready');
        setError(null);
      },
      handleError,
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000, // 5 min cached fix is fine for the first paint
        ...optionsRef.current,
      },
    );

    // Live updates (high accuracy). Won't fight the one-shot above because
    // `setLocation` just replaces state with the newer fix.
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation(coordsToLocation(pos));
        setStatus('ready');
        setError(null);
      },
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        ...optionsRef.current,
      },
    );

    return () => navigator.geolocation.clearWatch(id);
    // We intentionally exclude `options` — the ref keeps it current without
    // tearing down the watcher on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleError]);

  return { location, status, error, requestLocation };
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
