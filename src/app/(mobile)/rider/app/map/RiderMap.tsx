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

/** True only in development builds. Used to gate the on-screen debug banner
 * so end users never see "API: loading…" / "tiles: ok" chrome. */
const IS_DEV = process.env.NODE_ENV !== "production";
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
  /**
   * Preview-mode only. When provided, the entire preview surface becomes a
   * single clickable button that calls this handler. This both (a) prevents
   * Google's native logo / "Terms" links inside the embedded widget from
   * capturing taps and opening Google Maps in a new tab, and (b) matches the
   * product intent that a preview is a shortcut into the full stations tab,
   * not an interactive mini-map.
   */
  onPreviewClick?: () => void;
}

/**
 * Top-level provider that owns the Google Maps JS loader. Mount this ONCE,
 * as high in the tree as is practical (e.g. at the rider page level) so it
 * stays mounted across tab switches. Remounting the provider forces the JS
 * library to re-initialize, which in some browsers results in a blank map
 * on the second mount. Keeping it stable fixes "the map disappears after a
 * refresh / after switching tabs".
 */
export function RiderMapProvider({ children }: { children: React.ReactNode }) {
  const handleApiError = useCallback((error: unknown) => {
    console.error("[RiderMap] Google Maps JS API failed to load:", error);
  }, []);

  return (
    <APIProvider
      apiKey={API_KEY}
      libraries={["marker", "routes"]}
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
 * The rider map itself. Expects an ancestor `<RiderMapProvider>` to provide
 * the Google Maps JS runtime. Safe to mount/unmount freely — the heavy
 * library init happens once in the provider above.
 */
export default function RiderMap(props: RiderMapProps) {
  return <RiderMapInner {...props} />;
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
  onPreviewClick,
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
      {IS_DEV && <MapDebugOverlay />}
      <GoogleMap
        mapId={MAP_ID}
        defaultCenter={initialCenter}
        defaultZoom={13}
        gestureHandling={preview ? "none" : "greedy"}
        disableDefaultUI
        // `disableDefaultUI` hides zoom/pan/streetview, but the newer
        // "Keyboard shortcuts" button at the bottom-left is a separate
        // option that has to be turned off explicitly.
        keyboardShortcuts={false}
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

      {/* Preview mode: a transparent click-catcher above the map. Without
          this, taps on the Google logo / "Terms" link baked into the widget
          open Google Maps in a new tab instead of navigating into our
          stations screen. It sits below the `.rm-home-map-cta` label
          (z-index:400) so the label still reads, but above the map canvas. */}
      {preview && onPreviewClick && (
        <button
          type="button"
          onClick={onPreviewClick}
          aria-label="Open stations"
          className="rm-preview-click-catcher"
        />
      )}
    </div>
  );
}

/**
 * Dev-only diagnostic banner. Only renders a visible chip when something is
 * actually wrong: auth failure, load failure, or a zero-size container.
 * The happy-path "loading… / tiles ok" noise is intentionally gone — end
 * users should never see it, and developers can read the browser console.
 *
 * Gated by IS_DEV at the call site, so this component is tree-shaken out
 * in production builds entirely.
 */
function MapDebugOverlay() {
  const status = useApiLoadingStatus();
  const map = useMap();
  const [authFailed, setAuthFailed] = useState(false);
  const [zeroSize, setZeroSize] = useState(false);

  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () => {
      console.error(
        "[RiderMap] gm_authFailure: API key invalid, referrer not allowed, Maps JS API disabled, or billing off on the Google Cloud project.",
      );
      setAuthFailed(true);
    };
    return () => {
      if (w.gm_authFailure) delete w.gm_authFailure;
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    const div = map.getDiv();
    if (!div) return;
    const rect = div.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn(
        "[RiderMap] Map container has zero size — the map will render blank. Check parent CSS (height / min-height).",
        rect,
      );
      setZeroSize(true);
    }
  }, [map]);

  const hasError =
    authFailed ||
    zeroSize ||
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE;

  if (!hasError) return null;

  const reason = authFailed
    ? "Auth failed. Check API key, referrer, Maps JS API enabled, billing."
    : zeroSize
      ? "Map container has zero size — parent has no height."
      : status === APILoadingStatus.AUTH_FAILURE
        ? "Auth failure from Google Maps loader."
        : "Google Maps JS failed to load.";

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
        color: "#fff",
        background: "rgba(200, 30, 30, 0.92)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        pointerEvents: "none",
      }}
    >
      [RiderMap dev] {reason}
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
