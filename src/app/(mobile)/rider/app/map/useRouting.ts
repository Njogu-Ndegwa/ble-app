"use client";

import { useEffect, useRef, useState } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { Coords } from "./deepLinks";

export interface RouteSummary {
  distanceKm: number;
  durationMin: number;
}

export interface RoutingResult {
  summary: RouteSummary | null;
  isLoading: boolean;
  error: string | null;
  /** Path to be rendered by a Polyline. */
  path: google.maps.LatLngLiteral[] | null;
}

/**
 * Minimum distance (meters) the rider must move from the last routed origin
 * before we recompute the route. GPS noise on mobile can jitter the reported
 * position by a few meters even when the rider is standing still; without
 * this gate, `watchPosition` would cause the route to refetch and refit on
 * every tick, which manifests as the map "shaking".
 */
const ORIGIN_MOVE_THRESHOLD_M = 75;

/**
 * Haversine distance in meters.
 */
function distanceMeters(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Fetches a driving route between `from` and `to` via the Google Directions
 * API and exposes the resulting path for a caller-managed Polyline.
 *
 * Design notes:
 *
 * - **No re-fetch on GPS jitter.** We keep the origin used for the last fetch
 *   in a ref and only recompute when the destination changes OR the rider has
 *   moved more than {@link ORIGIN_MOVE_THRESHOLD_M}. This alone eliminates the
 *   shaking loop that the Leaflet/OSRM version had.
 * - **Fit bounds only once per new destination.** Subsequent refreshes (e.g.
 *   when the rider actually moves) update the polyline in place without
 *   animating the viewport again.
 */
export function useRouting(
  from: google.maps.LatLngLiteral | Coords | null,
  to: google.maps.LatLngLiteral | Coords | null,
  enabled: boolean,
): RoutingResult {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");

  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<google.maps.LatLngLiteral[] | null>(null);

  const serviceRef = useRef<google.maps.DirectionsService | null>(null);
  const lastOriginRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastDestKeyRef = useRef<string | null>(null);
  const fittedDestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!routesLib) return;
    serviceRef.current = new routesLib.DirectionsService();
  }, [routesLib]);

  useEffect(() => {
    if (!enabled || !from || !to) {
      setPath(null);
      setSummary(null);
      setError(null);
      lastOriginRef.current = null;
      lastDestKeyRef.current = null;
      fittedDestKeyRef.current = null;
      return;
    }

    const service = serviceRef.current;
    if (!service) return;

    const destKey = `${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
    const destChanged = destKey !== lastDestKeyRef.current;
    const origin: google.maps.LatLngLiteral = { lat: from.lat, lng: from.lng };
    const movedEnough =
      lastOriginRef.current == null ||
      distanceMeters(origin, lastOriginRef.current) >= ORIGIN_MOVE_THRESHOLD_M;

    if (!destChanged && !movedEnough) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    service
      .route({
        origin,
        destination: { lat: to.lat, lng: to.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      })
      .then((response) => {
        if (cancelled) return;
        const route = response?.routes?.[0];
        const leg = route?.legs?.[0];
        if (!route || !leg) {
          setError("no-route");
          setPath(null);
          setSummary(null);
          return;
        }

        const coords = route.overview_path.map((p) => ({
          lat: p.lat(),
          lng: p.lng(),
        }));
        setPath(coords);
        setSummary({
          distanceKm: (leg.distance?.value ?? 0) / 1000,
          durationMin: (leg.duration?.value ?? 0) / 60,
        });
        lastOriginRef.current = origin;
        lastDestKeyRef.current = destKey;

        if (map && fittedDestKeyRef.current !== destKey) {
          const bounds = route.bounds;
          if (bounds) {
            map.fitBounds(bounds, 48);
          }
          fittedDestKeyRef.current = destKey;
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to compute route";
        console.warn("[useRouting] DirectionsService failed:", message);
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally depend on primitive coordinates (not object identity) so
    // callers recreating `{lat,lng}` literals per render don't re-trigger the
    // effect. Internal throttling further suppresses GPS jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled, from?.lat, from?.lng, to?.lat, to?.lng]);

  return { summary, isLoading, error, path };
}
