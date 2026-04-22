"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Coords } from "./deepLinks";

export interface RouteSummary {
  distanceKm: number;
  durationMin: number;
}

/**
 * Fetches a driving route between `from` and `to` and renders it as a polyline
 * on the given Leaflet map.
 *
 * Uses the OSRM public demo server (`router.project-osrm.org`) for the first
 * cut; swap to a self-hosted OSRM / Valhalla by changing `OSRM_URL`.
 */
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export function useRouting(
  map: LeafletMap | null,
  from: Coords | null,
  to: Coords | null,
  enabled: boolean,
) {
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !from || !to || !enabled) return;
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Dynamic import so Leaflet never runs on the server
        const L = await import("leaflet");

        const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const json = await res.json();
        const route = json?.routes?.[0];
        if (!route) throw new Error("no-route");

        const coords: [number, number][] = (route.geometry.coordinates as number[][]).map(
          ([lng, lat]) => [lat, lng],
        );

        if (cancelled) return;

        // Remove existing layer before drawing new one
        if (layerRef.current) {
          layerRef.current.removeFrom(map);
          layerRef.current = null;
        }

        const line = L.polyline(coords, {
          color: "var(--color-brand)",
          weight: 5,
          opacity: 0.85,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        // Brand color may not parse in raw SVG — override with concrete hex as fallback
        line.setStyle({ color: "#00e5e5" });

        map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 });
        layerRef.current = line;

        setSummary({
          distanceKm: route.distance / 1000,
          durationMin: route.duration / 60,
        });
      } catch (err: any) {
        if (!cancelled) {
          console.warn("[useRouting] OSRM failed:", err?.message || err);
          setError(err?.message || "Failed to compute route");
          setSummary(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // Intentionally depend on coordinate primitives to avoid re-running when
    // callers recreate the `from`/`to` object literals each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, from?.lat, from?.lng, to?.lat, to?.lng, enabled]);

  // Clean up the route layer whenever the target is cleared
  useEffect(() => {
    if (!map) return;
    if ((!to || !enabled) && layerRef.current) {
      layerRef.current.removeFrom(map);
      layerRef.current = null;
      setSummary(null);
    }
  }, [map, to, enabled]);

  return { summary, isLoading, error };
}
