"use client";

import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { Coords } from "./deepLinks";
import { MAPS_API_KEY } from "./config";

export interface RouteSummary {
  distanceKm: number;
  durationMin: number;
}

export interface RouteBounds {
  /** South-west corner. */
  sw: google.maps.LatLngLiteral;
  /** North-east corner. */
  ne: google.maps.LatLngLiteral;
}

export interface RoutingResult {
  summary: RouteSummary | null;
  isLoading: boolean;
  error: string | null;
  /** Decoded path ready for a `<Polyline>`. */
  path: google.maps.LatLngLiteral[] | null;
  /** Tight bounds of the whole route, for one-shot `fitBounds`. */
  bounds: RouteBounds | null;
  /** Stable key that changes only when the *destination* changes. Consumers
   *  can use it to run fit-bounds exactly once per new destination without
   *  refitting on every rider-move refresh. */
  destKey: string | null;
}

/**
 * Minimum distance (meters) the rider must move from the last routed origin
 * before we recompute the route. GPS noise on mobile can jitter the reported
 * position by a few meters even when the rider is standing still; without
 * this gate, `watchPosition` would cause the route to refetch on every tick,
 * which manifests as flicker and burns through Routes API quota.
 */
const ORIGIN_MOVE_THRESHOLD_M = 75;

/**
 * After a fetch failure we do NOT want the hook to immediately retry on the
 * very next `watchPosition` tick — that's what caused the "Couldn't compute
 * route" toast storm. Instead, we gate retries behind this cool-down so the
 * rider sees at most one error per window and the Routes API isn't hammered
 * while it's either rate-limiting or rejecting the request.
 *
 * The cool-down is cleared whenever the destination changes so a fresh
 * selection is always routed immediately.
 */
const ERROR_BACKOFF_MS = 15_000;

const ROUTES_API_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Fields we ask the Routes API to return. Field masking is REQUIRED by the
 * Routes API; it also lets us avoid unnecessary processing/billing. We only
 * need the bits we actually render (duration, distance, polyline, viewport).
 */
const ROUTES_FIELD_MASK =
  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.viewport";

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

function parseDurationSeconds(duration: string | undefined): number {
  // Routes API returns durations as ISO-8601-ish strings like "853s".
  if (!duration) return 0;
  const n = parseFloat(duration);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fetches a DRIVE route between `from` and `to` via the Google Routes
 * API (v2) and exposes the resulting path + summary + bounds for the caller
 * to render.
 *
 * Design notes:
 *
 * - **DRIVE travel mode.** The rider fleet is e-bikes / scooters so in theory
 *   `TWO_WHEELER` would be the perfect match, but the Routes API only
 *   supports that mode in a handful of countries (mostly South/Southeast
 *   Asia). Outside that list every request fails with either a 400 or an
 *   empty `routes` array, which is exactly the "Couldn't compute route"
 *   storm we hit in production. `DRIVE` has global coverage, supports
 *   `TRAFFIC_AWARE` traffic data, and for our use case (scooters on city
 *   streets) produces a route that's close enough to reality — the same
 *   roads a car would take. Distance/ETA remains useful; worst case the
 *   ETA is slightly optimistic on congested city streets where a scooter
 *   would lane-split.
 * - **Field-masked request.** Per Routes API requirements, we send an
 *   `X-Goog-FieldMask` header so only the fields we render come back. This
 *   is both a correctness requirement and a cost optimization.
 * - **No re-fetch on GPS jitter.** We keep the origin used for the last
 *   fetch in a ref and only recompute when the destination changes OR the
 *   rider has moved more than {@link ORIGIN_MOVE_THRESHOLD_M}. This alone
 *   eliminates the shaking loop that the legacy version had.
 * - **No internal `useMap`.** Unlike the legacy version this hook does not
 *   own the camera. The caller receives `bounds` and decides when to call
 *   `map.fitBounds(...)` — which is necessary for a proper three-state
 *   (`idle` / `preview` / `following`) navigation experience.
 */
export function useRouting(
  from: google.maps.LatLngLiteral | Coords | null,
  to: google.maps.LatLngLiteral | Coords | null,
  enabled: boolean,
): RoutingResult {
  // `geometry` is loaded so we can decode the encoded polyline returned by
  // Routes API. Must be in the APIProvider's libraries array.
  const geometryLib = useMapsLibrary("geometry");

  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [bounds, setBounds] = useState<RouteBounds | null>(null);
  const [destKey, setDestKey] = useState<string | null>(null);

  const lastOriginRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastDestKeyRef = useRef<string | null>(null);
  const errorBackoffUntilRef = useRef<number>(0);
  const errorForDestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !from || !to || !geometryLib) {
      if (!enabled || !from || !to) {
        // Cleared destination or disabled: wipe local state so stale paths
        // don't linger after the caller exits routing.
        setPath(null);
        setSummary(null);
        setBounds(null);
        setDestKey(null);
        setError(null);
        lastOriginRef.current = null;
        lastDestKeyRef.current = null;
        errorBackoffUntilRef.current = 0;
        errorForDestKeyRef.current = null;
      }
      return;
    }

    const key = `${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
    const destChanged = key !== lastDestKeyRef.current;
    const origin: google.maps.LatLngLiteral = { lat: from.lat, lng: from.lng };
    const movedEnough =
      lastOriginRef.current == null ||
      distanceMeters(origin, lastOriginRef.current) >= ORIGIN_MOVE_THRESHOLD_M;

    if (!destChanged && !movedEnough) {
      return;
    }

    // Error back-off: if the previous attempt for this destination failed,
    // suppress re-tries (triggered by GPS ticks) until the back-off window
    // elapses. This is what stops the "Couldn't compute route" toast storm
    // on flaky networks / API errors. A destination change always clears
    // the back-off so the rider can retry by re-selecting the station.
    if (destChanged) {
      errorBackoffUntilRef.current = 0;
      errorForDestKeyRef.current = null;
    } else if (
      errorForDestKeyRef.current === key &&
      Date.now() < errorBackoffUntilRef.current
    ) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const body = {
      origin: {
        location: {
          latLng: { latitude: origin.lat, longitude: origin.lng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: to.lat, longitude: to.lng },
        },
      },
      // DRIVE rather than TWO_WHEELER: see the module-level JSDoc above for
      // why. TL;DR TWO_WHEELER is regionally limited and fails outside
      // South/Southeast Asia, while DRIVE works worldwide with traffic data.
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      polylineEncoding: "ENCODED_POLYLINE",
    };

    fetch(ROUTES_API_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_API_KEY,
        "X-Goog-FieldMask": ROUTES_FIELD_MASK,
      },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Routes API ${res.status}: ${errText || res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const route = data?.routes?.[0];
        const encoded: string | undefined = route?.polyline?.encodedPolyline;
        const vp = route?.viewport;
        if (!route || !encoded) {
          setError("no-route");
          setPath(null);
          setSummary(null);
          setBounds(null);
          // Pin this origin/dest so we don't immediately re-fetch on the
          // next GPS tick; gate further retries behind the error back-off.
          lastOriginRef.current = origin;
          lastDestKeyRef.current = key;
          errorForDestKeyRef.current = key;
          errorBackoffUntilRef.current = Date.now() + ERROR_BACKOFF_MS;
          return;
        }

        const decoded = geometryLib.encoding.decodePath(encoded).map((p) => ({
          lat: p.lat(),
          lng: p.lng(),
        }));

        const durSec = parseDurationSeconds(route.duration);
        const distM =
          typeof route.distanceMeters === "number" ? route.distanceMeters : 0;

        setPath(decoded);
        setSummary({
          distanceKm: distM / 1000,
          durationMin: durSec / 60,
        });
        if (
          vp &&
          vp.low &&
          vp.high &&
          typeof vp.low.latitude === "number" &&
          typeof vp.high.latitude === "number"
        ) {
          setBounds({
            sw: { lat: vp.low.latitude, lng: vp.low.longitude },
            ne: { lat: vp.high.latitude, lng: vp.high.longitude },
          });
        } else {
          // Fall back to a bounds computed from the decoded path.
          let minLat = Infinity,
            minLng = Infinity,
            maxLat = -Infinity,
            maxLng = -Infinity;
          decoded.forEach((p) => {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lng < minLng) minLng = p.lng;
            if (p.lng > maxLng) maxLng = p.lng;
          });
          setBounds({
            sw: { lat: minLat, lng: minLng },
            ne: { lat: maxLat, lng: maxLng },
          });
        }
        lastOriginRef.current = origin;
        lastDestKeyRef.current = key;
        errorBackoffUntilRef.current = 0;
        errorForDestKeyRef.current = null;
        setDestKey(key);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if ((err as any)?.name === "AbortError") return;
        const detail =
          err instanceof Error ? err.message : "Failed to compute route";
        console.warn("[useRouting] Routes API failed:", detail);
        // Store a stable, coarse error code (not the raw API message) so
        // the RiderStations dedup key — `${dest}:${routing.error}` — does
        // its job and we only surface one toast per destination.
        setError("fetch-failed");
        // Same back-off as the no-route branch: pin the last origin/dest
        // so background GPS ticks don't cause a retry storm.
        lastOriginRef.current = origin;
        lastDestKeyRef.current = key;
        errorForDestKeyRef.current = key;
        errorBackoffUntilRef.current = Date.now() + ERROR_BACKOFF_MS;
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // Intentionally depend on primitive coordinates (not object identity) so
    // callers recreating `{lat,lng}` literals per render don't re-trigger the
    // effect. Internal throttling further suppresses GPS jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, from?.lat, from?.lng, to?.lat, to?.lng, geometryLib]);

  return { summary, isLoading, error, path, bounds, destKey };
}
