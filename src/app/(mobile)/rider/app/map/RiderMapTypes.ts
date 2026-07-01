/**
 * Shared prop/handle contracts for the Rider map.
 *
 * The Rider map has two interchangeable backends — Google Maps
 * (`RiderMapGoogle`, used everywhere Google is reachable) and Leaflet/OSM
 * (`RiderMapLeaflet`, used inside mainland China where Google is blocked). Both
 * implement the SAME `RiderMapProps` so `RiderMap` can switch between them
 * without any consumer (`RiderStations`, `RiderHome`, `preview-stations`)
 * caring which one is mounted. Keeping the contract in its own module avoids a
 * circular import between the switch (`RiderMap.tsx`) and the two backends.
 *
 * `google.maps.*` types are used for the geometry props because the non-China
 * backend produces them and the shapes (`{ lat, lng }`) are structurally
 * identical to what Leaflet consumes — the Leaflet backend just reads the
 * fields, it never touches the Google runtime.
 */

import type { RiderStation, GeoLocation, NavMode } from "../types";

export interface RiderMapProps {
  stations: RiderStation[];
  userLocation: GeoLocation | null;
  selectedStationId: number | null;
  onSelectStation: (id: number | null) => void;
  /** When set, we render the given decoded path as a two-layer polyline.
   *  Always `null` on the Leaflet backend (Google Routes API is blocked in
   *  China), which instead draws a straight line to the selected station. */
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
  /**
   * Called with the underlying map once it's ready. Typed to the Google map
   * because that's the primary backend; the Leaflet backend does NOT call
   * this (its native handle is an `L.Map`, not a `google.maps.Map`) so callers
   * must not depend on it for the China path. `RiderStations` doesn't use it.
   */
  onMapReady?: (map: google.maps.Map) => void;
  /**
   * Preview-mode only. When provided, the entire preview surface becomes a
   * single clickable button that calls this handler.
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
