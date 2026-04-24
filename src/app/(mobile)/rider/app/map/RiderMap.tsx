"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Polyline,
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
  return (
    <APIProvider apiKey={API_KEY} libraries={["marker", "routes"]}>
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
