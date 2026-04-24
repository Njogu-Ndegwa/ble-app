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

/**
 * Module-level sticky flag: once the user has denied geolocation in this
 * session, don't bother re-arming watchPosition on every remount — the
 * browser will just fire PERMISSION_DENIED again instantly and we'd spam the
 * console + burn battery. Reset on a full page reload.
 */
let deniedForSession = false;

/**
 * Module-level compass heading source. Populated by a single shared
 * `deviceorientation` listener attached lazily on first request. Multiple
 * `useGeolocation` instances across the tree share one listener so we don't
 * register N handlers per tree depth.
 */
let compassHeading: number | null = null;
const compassListeners = new Set<(h: number | null) => void>();
let orientationAttached = false;
let iosPermissionRequested = false;

function handleOrientation(e: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
  // iOS exposes a true compass heading under `webkitCompassHeading`, which
  // is measured clockwise from north (0° = north). Other browsers give
  // `alpha`, which is counter-clockwise from east in most implementations —
  // we invert it so the unit matches: clockwise-from-north degrees.
  let heading: number | null = null;
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    heading = e.webkitCompassHeading;
  } else if (typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
    heading = (360 - e.alpha) % 360;
  }
  if (heading == null) return;
  compassHeading = heading;
  compassListeners.forEach((cb) => cb(heading));
}

function attachOrientationListener() {
  if (orientationAttached || typeof window === 'undefined') return;
  // Prefer `deviceorientationabsolute` where available — some Android
  // browsers give a non-absolute `alpha` otherwise, which drifts.
  const evt =
    'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute'
      : 'deviceorientation';
  window.addEventListener(evt, handleOrientation as EventListener, true);
  orientationAttached = true;
}

/**
 * Attempt to enable the device-orientation compass. On iOS 13+ this needs to
 * be called from a user gesture (tap) because
 * `DeviceOrientationEvent.requestPermission()` is gated. Callers should wire
 * this to a FAB press (e.g. "Recenter" / "Locate me"). On other platforms
 * it's a no-op that just ensures the shared listener is attached.
 */
export async function enableCompassHeading(): Promise<void> {
  if (typeof window === 'undefined') return;
  const anyDoe = (window as any).DeviceOrientationEvent;
  const needsIosPermission =
    anyDoe && typeof anyDoe.requestPermission === 'function' && !iosPermissionRequested;
  if (needsIosPermission) {
    try {
      const result: 'granted' | 'denied' = await anyDoe.requestPermission();
      iosPermissionRequested = true;
      if (result !== 'granted') return;
    } catch (err) {
      // Typically thrown when called outside a user gesture. Swallow —
      // caller's UX will still work, just without the compass fallback.
      console.warn('[useGeolocation] DeviceOrientation permission request failed:', err);
      return;
    }
  }
  attachOrientationListener();
}

function coordsToLocation(
  pos: GeolocationPosition,
  compassFallback: number | null,
): GeoLocation {
  const gpsHeading =
    typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
      ? pos.coords.heading
      : null;
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    heading: gpsHeading ?? compassFallback,
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
 *   5. Fall back to DeviceOrientation heading (compass) when the GPS heading
 *      is `null` (rider is stationary, browser never populates it) so the
 *      navigation cone and follow-mode camera still point the right way.
 *   6. Once the browser reports PERMISSION_DENIED, remember that at module
 *      scope so re-mounts of this hook don't re-arm watchPosition and
 *      re-trigger the same denial over and over.
 *
 * Returns `null` before the first fix or if the API is unavailable.
 */
export function useGeolocation(options?: PositionOptions) {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [status, setStatus] = useState<GeoStatus>(deniedForSession ? 'denied' : 'idle');
  const [error, setError] = useState<string | null>(deniedForSession ? 'denied' : null);

  // Keep latest options in a ref so the effect doesn't resubscribe on every
  // render when callers pass an inline `{}` literal (which would otherwise
  // tear down `watchPosition` before it ever delivers a first fix).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError(err.message);
    if (err.code === err.PERMISSION_DENIED) {
      deniedForSession = true;
      setStatus('denied');
    } else {
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  const requestLocation = useCallback((): Promise<GeoLocation> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable');
        reject(new Error('geolocation-unsupported'));
        return;
      }
      if (deniedForSession) {
        setStatus('denied');
        reject(new Error('geolocation-denied'));
        return;
      }
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'locating'));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = coordsToLocation(pos, compassHeading);
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
    if (deniedForSession) {
      // Short-circuit: don't even ask again. The user can re-grant via
      // browser settings, which will take effect on next page reload.
      setStatus('denied');
      return;
    }

    let cancelled = false;

    // Probe the Permissions API if available. When it reports `denied`
    // proactively, we skip the `getCurrentPosition` call entirely —
    // otherwise we race the callback and still end up toggling status
    // through `locating` → `denied` for no benefit.
    const proceed = () => {
      if (cancelled || deniedForSession) return;

      setStatus('locating');

      // Fast path: grab a cached/one-shot fix right away. This typically
      // resolves in milliseconds if the browser already has a recent fix,
      // which is what callers usually need for "center on me" / "route from
      // here" actions immediately after the screen mounts.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setLocation(coordsToLocation(pos, compassHeading));
          setStatus('ready');
          setError(null);
        },
        (err) => {
          if (cancelled) return;
          handleError(err);
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 300000, // 5 min cached fix is fine for the first paint
          ...optionsRef.current,
        },
      );

      // Live updates (high accuracy). Won't fight the one-shot above because
      // `setLocation` just replaces state with the newer fix.
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          setLocation(coordsToLocation(pos, compassHeading));
          setStatus('ready');
          setError(null);
        },
        (err) => {
          if (cancelled) return;
          handleError(err);
          if (err.code === err.PERMISSION_DENIED) {
            navigator.geolocation.clearWatch(watchId);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
          ...optionsRef.current,
        },
      );

      watchIdRef.current = watchId;
    };

    const watchIdRef = { current: null as number | null };

    if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: 'geolocation' })
        .then((result: PermissionStatus) => {
          if (cancelled) return;
          if (result.state === 'denied') {
            deniedForSession = true;
            setStatus('denied');
            setError('denied');
            return;
          }
          proceed();
        })
        .catch(() => {
          // Permissions API unavailable / blocked — fall back to the
          // legacy behavior of just calling geolocation directly.
          if (!cancelled) proceed();
        });
    } else {
      proceed();
    }

    // Subscribe to compass heading updates so stationary riders still have a
    // usable heading (GPS `heading` is null when speed is 0 on most browsers).
    const onCompass = (h: number | null) => {
      if (cancelled || h == null) return;
      setLocation((prev) =>
        prev && prev.heading == null ? { ...prev, heading: h } : prev,
      );
    };
    compassListeners.add(onCompass);
    attachOrientationListener();

    return () => {
      cancelled = true;
      compassListeners.delete(onCompass);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // We intentionally exclude `options` — the ref keeps it current without
    // tearing down the watcher on every parent render.
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
