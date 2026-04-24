"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMap,
  Polyline,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { RiderStation, GeoLocation } from "../types";
import {
  StationPillMarker,
  StationTeardropMarker,
  UserLocationMarker,
  buildClusterChipElement,
} from "./StationMarker";
import { useRouting } from "./useRouting";

/**
 * Rider map, backed by Google Maps JavaScript API via `@vis.gl/react-google-maps`.
 *
 * The component keeps the same public shape as the old Leaflet version so
 * `RiderHome` (preview) and `RiderStations` (full-screen) don't need to change:
 *
 * - Accepts the same props (`stations`, `userLocation`, `selectedStationId`,
 *   `onSelectStation`, `routeTargetId`, `preview`, `onMapReady`).
 * - Renders the same visual marker system (pill / teardrop + halo / user
 *   chevron / cluster chip) via React content inside `AdvancedMarker`.
 * - Handles routing through the Directions API, drawing the result as a
 *   single branded polyline.
 *
 * The API key and Map ID are inlined here. The key MUST be restricted in
 * Google Cloud Console (HTTP referrers + allowed APIs) — that referrer check
 * is what prevents anyone who inspects the bundle from reusing it elsewhere.
 * When it's time to rotate the key, change it in one place, here.
 *
 * The Map ID is created in Google Cloud Console (Map Management → Map IDs,
 * JavaScript / Vector type). Swapping it attaches a different cloud-based
 * style to the map without any code redeploy.
 */

const DEFAULT_CENTER: [number, number] = [-1.2921, 36.8219]; // Nairobi

const API_KEY = "AIzaSyDJ6octhDtaSW02NfWPn6NrxyMeNVB_IcU";
const MAP_ID = "634a14997c640edb8e36b1ce";

interface RiderMapProps {
  stations: RiderStation[];
  userLocation: GeoLocation | null;
  selectedStationId: number | null;
  onSelectStation: (id: number | null) => void;
  /** When set, we render a driving route from the user to this station. */
  routeTargetId?: number | null;
  /** Default center used before user location is known. */
  defaultCenter?: [number, number];
  /** Compact/preview mode disables clustering and shrinks markers. */
  preview?: boolean;
  /** Called with the Google map once it's ready. */
  onMapReady?: (map: google.maps.Map) => void;
}

export default function RiderMap(props: RiderMapProps) {
  const handleApiError = useCallback((error: unknown) => {
    console.error("[RiderMap] Google Maps JS API failed to load:", error);
  }, []);

  return (
    <APIProvider
      apiKey={API_KEY}
      libraries={["marker", "routes"]}
      onLoad={() => console.log("[RiderMap] Google Maps JS API loaded")}
      onError={handleApiError}
    >
      <RiderMapInner {...props} />
    </APIProvider>
  );
}

function RiderMapInner({
  stations,
  userLocation,
  selectedStationId,
  onSelectStation,
  routeTargetId,
  defaultCenter = DEFAULT_CENTER,
  preview = false,
  onMapReady,
}: RiderMapProps) {
  const initialCenter = useMemo<google.maps.LatLngLiteral>(() => {
    if (userLocation) return { lat: userLocation.lat, lng: userLocation.lng };
    const withCoords = stations.filter(
      (s) => typeof s.lat === "number" && typeof s.lng === "number",
    );
    if (withCoords.length === 0) {
      return { lat: defaultCenter[0], lng: defaultCenter[1] };
    }
    const sum = withCoords.reduce(
      (acc, s) => ({ lat: acc.lat + (s.lat || 0), lng: acc.lng + (s.lng || 0) }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: sum.lat / withCoords.length,
      lng: sum.lng / withCoords.length,
    };
  }, [userLocation, stations, defaultCenter]);

  const validStations = useMemo(
    () =>
      stations.filter(
        (s) => typeof s.lat === "number" && typeof s.lng === "number",
      ),
    [stations],
  );

  const routeTarget = useMemo(() => {
    const id = routeTargetId ?? null;
    if (id == null) return null;
    const s = stations.find((x) => x.id === id);
    if (!s || s.lat == null || s.lng == null) return null;
    return { lat: s.lat, lng: s.lng };
  }, [routeTargetId, stations]);

  const routing = useRouting(
    userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null,
    routeTarget,
    !preview && !!routeTarget,
  );

  return (
    <div className={`rm-map-wrap${preview ? " rm-map-preview" : ""}`}>
      <MapDebugOverlay />
      <GoogleMap
        mapId={MAP_ID}
        defaultCenter={initialCenter}
        defaultZoom={13}
        gestureHandling={preview ? "none" : "greedy"}
        disableDefaultUI
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        <MapController
          stations={validStations}
          userLocation={userLocation}
          selectedStationId={selectedStationId}
          preview={preview}
          onMapReady={onMapReady}
        />

        {userLocation && (
          <AdvancedMarker
            position={{ lat: userLocation.lat, lng: userLocation.lng }}
          >
            <UserLocationMarker heading={userLocation.heading ?? null} />
          </AdvancedMarker>
        )}

        <StationMarkers
          stations={validStations}
          selectedStationId={selectedStationId}
          onSelectStation={onSelectStation}
          preview={preview}
        />

        {routing.path && routing.path.length > 1 && (
          <Polyline
            path={routing.path}
            strokeColor="#00e5e5"
            strokeOpacity={0.9}
            strokeWeight={5}
          />
        )}
      </GoogleMap>
    </div>
  );
}

/**
 * On-screen debug banner that surfaces Google Maps JS load status. Helps
 * distinguish "map container has zero size" from "API key rejected / billing
 * off / wrong Map ID" without opening devtools. It auto-hides once the API
 * reports LOADED and no `gm_authFailure` has been observed. Errors remain
 * visible so the user can act on them.
 */
function MapDebugOverlay() {
  const status = useApiLoadingStatus();
  const map = useMap();
  const [authFailed, setAuthFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () => {
      console.error(
        "[RiderMap] gm_authFailure: API key is invalid, referrer not allowed, Maps JS API not enabled, or billing disabled on the Google Cloud project.",
      );
      setAuthFailed(true);
    };
    return () => {
      if (w.gm_authFailure) delete w.gm_authFailure;
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    setMapReady(true);
    console.log("[RiderMap] Map instance ready");
    const listener = map.addListener("tilesloaded", () => {
      setTilesLoaded(true);
      console.log("[RiderMap] tilesloaded");
    });
    const div = map.getDiv();
    if (div) {
      const rect = div.getBoundingClientRect();
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      if (rect.width === 0 || rect.height === 0) {
        console.warn(
          "[RiderMap] Map container has zero size — the map will render blank. Check parent CSS (height/min-height).",
          rect,
        );
      }
    }
    return () => listener.remove();
  }, [map]);

  const statusLabel: Record<APILoadingStatus, string> = {
    [APILoadingStatus.NOT_LOADED]: "not loaded",
    [APILoadingStatus.LOADING]: "loading…",
    [APILoadingStatus.LOADED]: "loaded",
    [APILoadingStatus.FAILED]: "failed",
    [APILoadingStatus.AUTH_FAILURE]: "auth failure",
  };

  const hasError =
    authFailed ||
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE;

  const allGood =
    status === APILoadingStatus.LOADED && mapReady && tilesLoaded && !hasError;

  if (allGood) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 1000,
        maxWidth: "calc(100% - 16px)",
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.35,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        color: hasError ? "#fff" : "#111",
        background: hasError ? "rgba(200, 30, 30, 0.92)" : "rgba(255,255,255,0.92)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        pointerEvents: "none",
      }}
    >
      <div>API: {statusLabel[status]}</div>
      <div>map: {mapReady ? "ready" : "—"} · tiles: {tilesLoaded ? "ok" : "—"}</div>
      {size && (
        <div>
          size: {size.w}×{size.h}
          {(size.w === 0 || size.h === 0) && " (ZERO — parent has no height)"}
        </div>
      )}
      {hasError && (
        <div style={{ marginTop: 4 }}>
          Check console. Likely: key invalid, referrer blocked, Maps JS API
          disabled, billing off, or Map ID not in this project.
        </div>
      )}
    </div>
  );
}

/**
 * Side-effect component scoped inside `<Map>` so it has access to the map
 * instance via `useMap()`. Handles: exposing the map to the parent, initial
 * fit-to-stations (preview mode), and panning to the selected station.
 */
function MapController({
  stations,
  userLocation,
  selectedStationId,
  preview,
  onMapReady,
}: {
  stations: RiderStation[];
  userLocation: GeoLocation | null;
  selectedStationId: number | null;
  preview: boolean;
  onMapReady?: (map: google.maps.Map) => void;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const onMapReadyRef = useRef(onMapReady);
  const didFitOnceRef = useRef(false);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    if (map) onMapReadyRef.current?.(map);
  }, [map]);

  useEffect(() => {
    if (!map || !coreLib || !preview) return;
    if (didFitOnceRef.current) return;
    if (stations.length === 0) return;

    const bounds = new coreLib.LatLngBounds();
    stations.forEach((s) => bounds.extend({ lat: s.lat!, lng: s.lng! }));
    if (userLocation) {
      bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
    }
    map.fitBounds(bounds, 30);
    didFitOnceRef.current = true;
  }, [map, coreLib, preview, stations, userLocation]);

  useEffect(() => {
    if (!map || selectedStationId == null) return;
    const station = stations.find((s) => s.id === selectedStationId);
    if (!station || station.lat == null || station.lng == null) return;
    map.panTo({ lat: station.lat, lng: station.lng });
    const currentZoom = map.getZoom() ?? 13;
    if (currentZoom < 15) map.setZoom(15);
  }, [map, selectedStationId, stations]);

  return null;
}

/**
 * Renders an `AdvancedMarker` for every station and manages the
 * `@googlemaps/markerclusterer` instance so clusters use our brand chip.
 *
 * Clustering is enabled on the full-screen map and disabled in preview mode
 * (matches the old Leaflet behavior where preview felt too small for
 * clustering to help).
 */
function StationMarkers({
  stations,
  selectedStationId,
  onSelectStation,
  preview,
}: {
  stations: RiderStation[];
  selectedStationId: number | null;
  onSelectStation: (id: number | null) => void;
  preview: boolean;
}) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");

  const markerMapRef = useRef(
    new Map<number, google.maps.marker.AdvancedMarkerElement>(),
  );
  const refCallbacksRef = useRef(
    new Map<
      number,
      (m: google.maps.marker.AdvancedMarkerElement | null) => void
    >(),
  );
  const [markersVersion, setMarkersVersion] = useState(0);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  // Return a stable ref callback per station id so React doesn't detach and
  // re-attach the marker on every render (which would thrash the clusterer).
  const getMarkerRef = useCallback((id: number) => {
    let cb = refCallbacksRef.current.get(id);
    if (!cb) {
      cb = (marker: google.maps.marker.AdvancedMarkerElement | null) => {
        if (marker) {
          markerMapRef.current.set(id, marker);
        } else {
          markerMapRef.current.delete(id);
        }
        setMarkersVersion((v) => v + 1);
      };
      refCallbacksRef.current.set(id, cb);
    }
    return cb;
  }, []);

  useEffect(() => {
    if (!map || !markerLib) return;
    if (preview) {
      clustererRef.current?.clearMarkers();
      clustererRef.current?.setMap(null);
      clustererRef.current = null;
      return;
    }

    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        renderer: {
          render: ({ count, position }) => {
            const content = buildClusterChipElement(count);
            return new markerLib.AdvancedMarkerElement({
              position,
              content,
              zIndex: 1000 + count,
            });
          },
        },
      });
    }

    const markers = Array.from(markerMapRef.current.values());
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(markers);
  }, [map, markerLib, markersVersion, preview]);

  useEffect(
    () => () => {
      clustererRef.current?.setMap(null);
      clustererRef.current = null;
    },
    [],
  );

  return (
    <>
      {stations.map((station) => {
        const isSelected = selectedStationId === station.id;
        const pillVariant: "empty" | "low" | "available" =
          station.batteries === 0
            ? "empty"
            : station.batteries <= 2
              ? "low"
              : "available";

        return (
          <AdvancedMarker
            key={station.id}
            ref={getMarkerRef(station.id)}
            position={{ lat: station.lat!, lng: station.lng! }}
            clickable
            onClick={() => onSelectStation(station.id)}
            zIndex={isSelected ? 2000 : undefined}
            anchorLeft="-50%"
            anchorTop={isSelected ? "-100%" : "-50%"}
          >
            {isSelected ? (
              <StationTeardropMarker batteries={station.batteries} />
            ) : (
              <StationPillMarker
                variant={pillVariant}
                batteries={station.batteries}
              />
            )}
          </AdvancedMarker>
        );
      })}
    </>
  );
}
