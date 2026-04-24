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
import { useI18n } from "@/i18n";

/** True only in development builds. Used to gate the on-screen debug banner
 * so end users never see "API: loading…" / "tiles: ok" chrome. */
const IS_DEV = process.env.NODE_ENV !== "production";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { RiderStation, GeoLocation, NavMode } from "../types";
import {
  StationPillMarker,
  StationTeardropMarker,
  UserLocationMarker,
  buildClusterChipElement,
  type ClusterAvailability,
} from "./StationMarker";
import { MAPS_API_KEY, MAP_ID } from "./config";

/**
 * Rider map, backed by Google Maps JavaScript API via `@vis.gl/react-google-maps`.
 *
 * This component is purely a canvas + camera controller. It does NOT own
 * routing state — `RiderStations` calls `useRouting` at the screen level and
 * passes the resulting `routePath` / `routeBounds` in as props. That split
 * is what makes the three-state navigation UX (idle / preview / following)
 * possible without the map and the screen fighting each other over the
 * camera.
 *
 * Public props:
 *
 *  - `stations` / `userLocation`                live data
 *  - `selectedStationId` / `onSelectStation`    pin selection model
 *  - `routePath` + `routeBounds` + `routeKey`   drawn route (optional)
 *  - `navMode` (`idle` | `preview` | `following`)
 *                                               drives camera behavior
 *  - `onFollowingPausedChange`                  fired when the user drags
 *                                               the map during following
 *  - `onFitRequest` / `onRecenterRequest`       imperative camera commands
 *                                               from the parent
 *  - `preview`                                  shrinks markers and locks
 *                                               gestures for the home-screen
 *                                               mini-map
 */

const DEFAULT_CENTER: [number, number] = [-1.2921, 36.8219]; // Nairobi

interface RiderMapProps {
  stations: RiderStation[];
  userLocation: GeoLocation | null;
  selectedStationId: number | null;
  onSelectStation: (id: number | null) => void;
  /** When set, we render the given decoded path as a two-layer polyline. */
  routePath?: google.maps.LatLngLiteral[] | null;
  /** Tight bounds used to fit the camera on the route during preview. */
  routeBounds?: { sw: google.maps.LatLngLiteral; ne: google.maps.LatLngLiteral } | null;
  /** Opaque key that changes only when the *destination* changes. Triggers a
   *  one-shot `fitBounds` in preview mode. */
  routeKey?: string | null;
  /** Navigation state machine. Defaults to `idle` for backwards compat. */
  navMode?: NavMode;
  /**
   * When the rider is in `following` mode and manually interacts with the
   * map (drag / pinch), this fires with `true`. The parent should stash the
   * pause state so the Recenter pill appears. Firing with `false` is the
   * parent's job after the rider taps Recenter.
   */
  onFollowingPausedChange?: (paused: boolean) => void;
  /** External "paused" signal while in `following` mode. */
  followingPaused?: boolean;
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
  /** Ref-style handle: parent can call `recenter()` / `fitAll()` on demand. */
  mapControlsRef?: React.MutableRefObject<RiderMapControls | null>;
}

export interface RiderMapControls {
  /** Pan+zoom to the user's current location, requesting a one-shot fix if needed. */
  recenter: (user: GeoLocation) => void;
  /** Fit the camera to all stations + user, one time. */
  fitAll: () => void;
}

/**
 * Top-level provider that owns the Google Maps JS loader. Mount this ONCE,
 * as high in the tree as is practical (e.g. at the rider page level) so it
 * stays mounted across tab switches. Remounting the provider forces the JS
 * library to re-initialize, which in some browsers results in a blank map
 * on the second mount. Keeping it stable fixes "the map disappears after a
 * refresh / after switching tabs".
 *
 * The `geometry` library is required so `useRouting` can decode the
 * Routes-API-encoded polyline via `google.maps.geometry.encoding.decodePath`.
 */
export function RiderMapProvider({ children }: { children: React.ReactNode }) {
  const handleApiError = useCallback((error: unknown) => {
    console.error("[RiderMap] Google Maps JS API failed to load:", error);
  }, []);

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
  routePath = null,
  routeBounds = null,
  routeKey = null,
  navMode = "idle",
  onFollowingPausedChange,
  followingPaused = false,
  defaultCenter = DEFAULT_CENTER,
  preview = false,
  onMapReady,
  onPreviewClick,
  mapControlsRef,
}: RiderMapProps) {
  const { t } = useI18n();

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
          routeBounds={routeBounds}
          routeKey={routeKey}
          navMode={navMode}
          followingPaused={followingPaused}
          onFollowingPausedChange={onFollowingPausedChange}
          hasActiveRoute={!!routePath && routePath.length > 1}
          mapControlsRef={mapControlsRef}
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

        {routePath && routePath.length > 1 && (
          <>
            {/* Two-layer polyline: dark outline underneath gives the brand
                cyan core enough contrast on both the dark and light base
                styles. Single-color lines wash out on the dark tile sheet
                where cyan sits too close to the highlighted road color. */}
            <Polyline
              path={routePath}
              strokeColor="#0f172a"
              strokeOpacity={0.95}
              strokeWeight={9}
              zIndex={1}
            />
            <Polyline
              path={routePath}
              strokeColor="#00e5e5"
              strokeOpacity={1}
              strokeWeight={5}
              zIndex={2}
            />
          </>
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
          aria-label={t("rider.map.openFullMap") || "Open full map"}
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
 * instance via `useMap()`. Handles every camera concern:
 *
 *   1. Exposing the map to the parent via `onMapReady` and `mapControlsRef`.
 *   2. Initial fit-to-stations (both preview-mini and first full-screen).
 *   3. Panning to the selected station pin (when it's a fresh selection).
 *      *Crucially*, the pan effect only depends on `selectedStationId`, not
 *      on the `stations` array identity — without that, every GPS tick
 *      (which rebuilds the array with fresh `distanceKm` values) would
 *      re-fire the pan and fight with `fitBounds`, producing the
 *      zoom-in/zoom-out oscillation the user reported.
 *   4. Route preview fit-bounds — runs once per *new* destination key only,
 *      never on origin-move refreshes, never while in `following` mode.
 *   5. Follow-mode camera — pans to the user on each GPS tick, with tilt,
 *      heading, and a one-time zoom-to-17 on entry. Gracefully restores
 *      tilt/heading on exit.
 *   6. Gesture-driven follow pause — `dragstart` / `zoom_changed` originated
 *      by the user (not by us) flips `followingPaused` via the callback so
 *      the parent can show the Recenter pill.
 */
function MapController({
  stations,
  userLocation,
  selectedStationId,
  preview,
  onMapReady,
  routeBounds,
  routeKey,
  navMode,
  followingPaused,
  onFollowingPausedChange,
  hasActiveRoute,
  mapControlsRef,
}: {
  stations: RiderStation[];
  userLocation: GeoLocation | null;
  selectedStationId: number | null;
  preview: boolean;
  onMapReady?: (map: google.maps.Map) => void;
  routeBounds: { sw: google.maps.LatLngLiteral; ne: google.maps.LatLngLiteral } | null;
  routeKey: string | null;
  navMode: NavMode;
  followingPaused: boolean;
  onFollowingPausedChange?: (paused: boolean) => void;
  hasActiveRoute: boolean;
  mapControlsRef?: React.MutableRefObject<RiderMapControls | null>;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary("core");
  const onMapReadyRef = useRef(onMapReady);
  const didFitInitialRef = useRef(false);
  const lastRouteKeyRef = useRef<string | null>(null);
  const didEnterFollowRef = useRef(false);
  const savedTiltRef = useRef<number | null>(null);
  const savedHeadingRef = useRef<number | null>(null);
  const pausedRef = useRef(followingPaused);
  const programmaticMoveRef = useRef(false);

  // Keep a ref-copy of the station list so the selection-pan effect can
  // look up the selected station WITHOUT depending on the array identity.
  // The `stations` array is rebuilt on every GPS tick (distances change)
  // which used to cause the pan effect to re-fire on every tick → the
  // oscillation bug.
  const stationsRef = useRef<RiderStation[]>(stations);
  useEffect(() => {
    stationsRef.current = stations;
  }, [stations]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    pausedRef.current = followingPaused;
  }, [followingPaused]);

  useEffect(() => {
    if (map) onMapReadyRef.current?.(map);
  }, [map]);

  // Expose imperative camera actions to the parent via a ref handle.
  useEffect(() => {
    if (!map || !coreLib || !mapControlsRef) return;
    mapControlsRef.current = {
      recenter: (user: GeoLocation) => {
        programmaticMoveRef.current = true;
        map.panTo({ lat: user.lat, lng: user.lng });
        const z = map.getZoom() ?? 14;
        if (z < 15) map.setZoom(16);
      },
      fitAll: () => {
        const bounds = new coreLib.LatLngBounds();
        let any = false;
        stationsRef.current.forEach((s) => {
          if (s.lat != null && s.lng != null) {
            bounds.extend({ lat: s.lat, lng: s.lng });
            any = true;
          }
        });
        if (userLocation) {
          bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
          any = true;
        }
        if (any) {
          programmaticMoveRef.current = true;
          map.fitBounds(bounds, 60);
        }
      },
    };
    return () => {
      if (mapControlsRef) mapControlsRef.current = null;
    };
  }, [map, coreLib, mapControlsRef, userLocation]);

  // ---------- Initial fit: preview mini + first full-screen mount ----------
  useEffect(() => {
    if (!map || !coreLib) return;
    if (didFitInitialRef.current) return;
    if (hasActiveRoute) return; // never fight an in-flight route
    if (selectedStationId != null) return; // rider already zoomed somewhere
    if (stations.length === 0) return;

    const bounds = new coreLib.LatLngBounds();
    stations.forEach((s) => bounds.extend({ lat: s.lat!, lng: s.lng! }));
    if (userLocation) {
      bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
    }
    programmaticMoveRef.current = true;
    map.fitBounds(bounds, preview ? 30 : 60);
    didFitInitialRef.current = true;
  }, [map, coreLib, preview, stations, userLocation, hasActiveRoute, selectedStationId]);

  // ---------- Selection pan: ONLY fires when selection itself changes ----------
  useEffect(() => {
    if (!map) return;
    if (selectedStationId == null) return;
    // Don't override the camera while a route is being shown or followed —
    // the route-preview or follow-mode camera owns it.
    if (hasActiveRoute || navMode !== "idle") return;

    const station = stationsRef.current.find((s) => s.id === selectedStationId);
    if (!station || station.lat == null || station.lng == null) return;
    programmaticMoveRef.current = true;
    map.panTo({ lat: station.lat, lng: station.lng });
    const currentZoom = map.getZoom() ?? 13;
    if (currentZoom < 15) map.setZoom(15);
    // Intentionally NOT depending on `stations` — see the ref trick above.
  }, [map, selectedStationId, navMode, hasActiveRoute]);

  // ---------- Route preview fit: once per new destination ----------
  useEffect(() => {
    if (!map || !coreLib) return;
    if (navMode !== "preview") return;
    if (!routeBounds || !routeKey) return;
    if (lastRouteKeyRef.current === routeKey) return;

    const bounds = new coreLib.LatLngBounds();
    bounds.extend(routeBounds.sw);
    bounds.extend(routeBounds.ne);
    programmaticMoveRef.current = true;
    map.fitBounds(bounds, 80);
    lastRouteKeyRef.current = routeKey;
  }, [map, coreLib, navMode, routeBounds, routeKey]);

  // ---------- Follow-mode camera ----------
  useEffect(() => {
    if (!map) return;
    if (navMode !== "following") {
      if (didEnterFollowRef.current) {
        // Exiting follow mode — restore the tilt/heading we took over.
        programmaticMoveRef.current = true;
        map.setTilt(savedTiltRef.current ?? 0);
        map.setHeading(savedHeadingRef.current ?? 0);
        didEnterFollowRef.current = false;
        lastRouteKeyRef.current = null; // allow a refit next time preview is re-entered
      }
      return;
    }

    // Entering follow mode: stash current orientation so we can restore it
    // when the rider exits, then tilt into navigation perspective.
    if (!didEnterFollowRef.current) {
      savedTiltRef.current = map.getTilt() ?? 0;
      savedHeadingRef.current = map.getHeading() ?? 0;
      programmaticMoveRef.current = true;
      map.setZoom(17);
      map.setTilt(45);
      didEnterFollowRef.current = true;
    }

    if (pausedRef.current) return; // rider is panning around manually
    if (!userLocation) return;

    programmaticMoveRef.current = true;
    map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
    if (typeof userLocation.heading === "number" && !Number.isNaN(userLocation.heading)) {
      map.setHeading(userLocation.heading);
    }
  }, [map, navMode, userLocation]);

  // ---------- Gesture-driven follow pause ----------
  useEffect(() => {
    if (!map) return;
    if (navMode !== "following") return;

    // Any user-initiated drag/zoom while in follow mode should pause auto-
    // follow. `dragstart` / `zoom_changed` fire for BOTH user and
    // programmatic moves — we use `programmaticMoveRef` to only act on
    // gestures we didn't initiate ourselves.
    const onUserGesture = () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        return;
      }
      if (!pausedRef.current) {
        pausedRef.current = true;
        onFollowingPausedChange?.(true);
      }
    };

    // Reset the programmatic flag on `idle` (after the camera settles) so a
    // subsequent *user* move isn't accidentally swallowed.
    const onIdle = () => {
      programmaticMoveRef.current = false;
    };

    const dragListener = map.addListener("dragstart", onUserGesture);
    const zoomListener = map.addListener("zoom_changed", onUserGesture);
    const idleListener = map.addListener("idle", onIdle);
    return () => {
      dragListener.remove();
      zoomListener.remove();
      idleListener.remove();
    };
  }, [map, navMode, onFollowingPausedChange]);

  return null;
}

/**
 * Renders an `AdvancedMarker` for every station and manages the
 * `@googlemaps/markerclusterer` instance so clusters use our brand chip,
 * colored by aggregate availability of the stations inside.
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
  const rafRef = useRef<number | null>(null);
  const lastMarkerIdKeyRef = useRef<string>("");

  // Keep a per-marker availability dataset so the cluster renderer can
  // aggregate without needing the original station list. Attached via a
  // WeakMap keyed on the marker element so GC'd markers clean themselves up.
  const markerStatsRef = useRef(
    new WeakMap<
      google.maps.marker.AdvancedMarkerElement,
      { batteries: number; variant: "available" | "low" | "empty" }
    >(),
  );

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

  // Publish per-station availability into the shared ref so the cluster
  // renderer can read it. Runs whenever the station list changes.
  useEffect(() => {
    stations.forEach((s) => {
      const m = markerMapRef.current.get(s.id);
      if (!m) return;
      const variant: "available" | "low" | "empty" =
        s.batteries === 0 ? "empty" : s.batteries <= 2 ? "low" : "available";
      markerStatsRef.current.set(m, { batteries: s.batteries, variant });
    });
  }, [stations, markersVersion]);

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
          render: ({ count, position, markers }) => {
            // Aggregate availability across the cluster's markers, read
            // back from the dataset we wrote above.
            let totalBatteries = 0;
            let worst: ClusterAvailability["worst"] = "available";
            (markers ?? []).forEach((m) => {
              const stats = markerStatsRef.current.get(
                m as google.maps.marker.AdvancedMarkerElement,
              );
              if (!stats) return;
              totalBatteries += stats.batteries;
              if (stats.variant === "empty" && worst !== "empty") {
                worst = "empty";
              } else if (stats.variant === "low" && worst === "available") {
                worst = "low";
              }
            });
            const content = buildClusterChipElement(count, {
              worst,
              totalBatteries,
            });
            return new markerLib.AdvancedMarkerElement({
              position,
              content,
              zIndex: 1000 + count,
            });
          },
        },
      });
    }

    // Debounce clusterer sync to a single rAF per burst. Without this, every
    // marker ref callback (one per station) fires `setMarkersVersion`,
    // triggering N `clearMarkers()`+`addMarkers()` cycles in a row on the
    // initial paint — visibly janky on low-end Android.
    const markers = Array.from(markerMapRef.current.values());
    const idKey = Array.from(markerMapRef.current.keys()).sort().join(",");
    if (idKey === lastMarkerIdKeyRef.current) {
      // Marker set itself hasn't changed (only marker *contents* did, like
      // battery counts). No need to touch the clusterer at all.
      return;
    }
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      clustererRef.current?.clearMarkers();
      clustererRef.current?.addMarkers(markers);
      lastMarkerIdKeyRef.current = idKey;
    });

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
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
