"use client";

import React, { useCallback } from "react";
import dynamic from "next/dynamic";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MAPS_API_KEY } from "./config";
import { isChina } from "./isChina";
import type { RiderMapProps } from "./RiderMapTypes";

// Re-export the control handle so existing consumers keep importing it from
// `../map/RiderMap` unchanged.
export type { RiderMapControls } from "./RiderMapTypes";

/** True only in development builds — gates a load-success console line. */
const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * The Rider map has two interchangeable backends, chosen by `isChina()`:
 *
 *  - **Google Maps** (`RiderMapGoogle`) — the default, used everywhere Google
 *    is reachable. Rich tiles, Routes-API turn-by-turn, tilted follow mode.
 *  - **Leaflet + OpenStreetMap** (`RiderMapLeaflet`) — used inside mainland
 *    China, where every `*.googleapis.com` domain is blocked by the Great
 *    Firewall and the Google map would render a permanent blank page.
 *
 * Both satisfy the same `RiderMapProps` (see `RiderMapTypes.ts`), so no
 * consumer needs to know which one is mounted. Both are dynamically imported
 * with `ssr: false` so (a) the heavy engine only ships to the client and
 * (b) in China we never even load the Google chunk, and vice versa.
 */
const RiderMapGoogle = dynamic(() => import("./RiderMapGoogle"), {
  ssr: false,
});
const RiderMapLeaflet = dynamic(() => import("./RiderMapLeaflet"), {
  ssr: false,
});

/**
 * Top-level provider that owns the Google Maps JS loader. Mount this ONCE,
 * as high in the tree as is practical (e.g. at the rider page level) so it
 * stays mounted across tab switches.
 *
 * In China this is a pure passthrough — mounting Google's `<APIProvider>`
 * there would fire a blocked request to `maps.googleapis.com` that hangs and
 * blanks the map. The Leaflet backend needs no provider.
 *
 * The `geometry` library is required (non-China) so `useRouting` can decode
 * the Routes-API-encoded polyline via `google.maps.geometry.encoding.decodePath`.
 */
export function RiderMapProvider({ children }: { children: React.ReactNode }) {
  const handleApiError = useCallback((error: unknown) => {
    console.error("[RiderMap] Google Maps JS API failed to load:", error);
  }, []);

  if (isChina()) {
    return <>{children}</>;
  }

  return (
    <APIProvider
      apiKey={MAPS_API_KEY}
      libraries={["marker", "geometry"]}
      onLoad={
        IS_DEV
          ? () => console.log("[RiderMap] Google Maps JS API loaded")
          : undefined
      }
      onError={handleApiError}
    >
      {children}
    </APIProvider>
  );
}

/**
 * The rider map. Picks the Leaflet/OSM backend in China, the Google backend
 * everywhere else. Expects an ancestor `<RiderMapProvider>`.
 */
export default function RiderMap(props: RiderMapProps) {
  return isChina() ? (
    <RiderMapLeaflet {...props} />
  ) : (
    <RiderMapGoogle {...props} />
  );
}
