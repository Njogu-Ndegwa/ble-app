"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/i18n";
import type { GeoLocation, RiderStation } from "../types";
import {
  StationPillMarker,
  StationTeardropMarker,
  UserLocationMarker,
  buildClusterChipElement,
} from "./StationMarker";
import type { RiderMapProps, RiderMapControls } from "./RiderMapTypes";

/**
 * Rider map — Leaflet + OpenStreetMap backend used inside mainland China.
 *
 * Google Maps (tiles, JS SDK, Routes API) is blocked by the Great Firewall, so
 * in China `RiderMap` mounts THIS instead of `RiderMapGoogle`. It implements
 * the same `RiderMapProps` at "Scope 1 — Find & locate":
 *
 *   - OpenStreetMap raster tiles (WGS-84, so NO coordinate conversion is
 *     needed — the station/GPS coordinates align natively).
 *   - Station markers reusing the exact `StationMarker` visuals via `divIcon`.
 *   - Live user-location marker.
 *   - Tap-to-select → pan to the station.
 *   - A dashed straight line from the user to the selected station (stands in
 *     for the Google route line, which needs the blocked Routes API).
 *
 * NOT implemented (see the design doc): an in-app road route line + ETA, and
 * tilted follow-mode navigation. The "Navigate" action deep-links out to Amap
 * (see `deepLinks.ts`). `routePath` / `routeBounds` / `routeKey` /
 * `navMode` / follow-mode props are accepted but ignored here.
 *
 * The whole module is dynamically imported with `ssr: false` (see
 * `RiderMap.tsx`), so the top-level `leaflet` import only ever runs client-side.
 */

const DEFAULT_CENTER: [number, number] = [20, 20];
const WORLD_ZOOM = 2;
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** Build a Leaflet divIcon from one of our React marker components so the
 *  Leaflet map renders pixel-identical pins to the Google map. */
function componentIcon(
  node: React.ReactElement,
  size: [number, number],
  anchor: [number, number],
): L.DivIcon {
  return L.divIcon({
    html: renderToStaticMarkup(node),
    className: "rm-leaflet-divicon",
    iconSize: size,
    iconAnchor: anchor,
  });
}

function pillVariantOf(batteries: number): "empty" | "low" | "available" {
  return batteries === 0 ? "empty" : batteries <= 2 ? "low" : "available";
}

export default function RiderMapLeaflet({
  stations,
  userLocation,
  selectedStationId,
  onSelectStation,
  defaultCenter = DEFAULT_CENTER,
  preview = false,
  onPreviewClick,
  mapControlsRef,
}: RiderMapProps) {
  const { t } = useI18n();

  const validStations = useMemo(
    () =>
      stations.filter(
        (s) => typeof s.lat === "number" && typeof s.lng === "number",
      ),
    [stations],
  );

  const initialCenter = useMemo<[number, number]>(() => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    if (validStations.length === 0) return [defaultCenter[0], defaultCenter[1]];
    const sum = validStations.reduce(
      (acc, s) => ({ lat: acc.lat + (s.lat || 0), lng: acc.lng + (s.lng || 0) }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / validStations.length, sum.lng / validStations.length];
  }, [userLocation, validStations, defaultCenter]);

  const initialZoom = useMemo<number>(() => {
    if (userLocation || validStations.length > 0) return 13;
    return WORLD_ZOOM;
  }, [userLocation, validStations.length]);

  const selectedStation = useMemo(
    () =>
      selectedStationId != null
        ? validStations.find((s) => s.id === selectedStationId) ?? null
        : null,
    [validStations, selectedStationId],
  );

  const stationMarkers = validStations.map((station) => {
    const isSelected = selectedStationId === station.id;
    const icon = isSelected
      ? componentIcon(
          <StationTeardropMarker batteries={station.batteries} />,
          [40, 50],
          [20, 50],
        )
      : componentIcon(
          <StationPillMarker
            variant={pillVariantOf(station.batteries)}
            batteries={station.batteries}
          />,
          [44, 44],
          [22, 22],
        );
    return (
      <Marker
        key={station.id}
        position={[station.lat!, station.lng!]}
        icon={icon}
        zIndexOffset={isSelected ? 1000 : 0}
        eventHandlers={{ click: () => onSelectStation(station.id) }}
      />
    );
  });

  return (
    <div className={`rm-map-wrap${preview ? " rm-map-preview" : ""}`}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="rm-leaflet-dark"
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl={!preview}
        dragging={!preview}
        doubleClickZoom={!preview}
        scrollWheelZoom={!preview}
        touchZoom={!preview}
        boxZoom={!preview}
        keyboard={!preview}
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />

        <LeafletController
          stations={validStations}
          userLocation={userLocation}
          selectedStationId={selectedStationId}
          preview={preview}
          mapControlsRef={mapControlsRef}
        />

        {/* Straight-line guidance to the selected station (Scope 1). */}
        {userLocation && selectedStation && (
          <Polyline
            positions={[
              [userLocation.lat, userLocation.lng],
              [selectedStation.lat!, selectedStation.lng!],
            ]}
            pathOptions={{
              color: "#00e5e5",
              weight: 4,
              opacity: 0.9,
              dashArray: "6 10",
            }}
          />
        )}

        {/* User location. */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={componentIcon(
              <UserLocationMarker heading={userLocation.heading ?? null} />,
              [40, 40],
              [20, 20],
            )}
            interactive={false}
            zIndexOffset={2000}
          />
        )}

        {/* Stations — clustered on the full map, flat in the preview mini-map. */}
        {preview ? (
          stationMarkers
        ) : (
          <MarkerClusterGroup
            chunkedLoading
            showCoverageOnHover={false}
            iconCreateFunction={clusterIcon}
          >
            {stationMarkers}
          </MarkerClusterGroup>
        )}
      </MapContainer>

      {/* Preview mode: transparent click-catcher so a tap opens the full
          stations screen instead of interacting with the mini-map. Mirrors
          the Google backend. */}
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

/** Cluster chip — reuses the brand chip builder (count only; availability
 *  aggregation is a Google-backend nicety we skip in the China fallback). */
function clusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount();
  const el = buildClusterChipElement(count);
  const size = count < 10 ? 36 : count < 100 ? 44 : 50;
  return L.divIcon({
    html: el.outerHTML,
    className: "rm-leaflet-divicon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Imperative camera controller — the Leaflet equivalent of the Google
 * `MapController`. Scoped inside `<MapContainer>` so it can call `useMap()`.
 *
 *   1. Publishes `recenter` / `fitAll` to the parent via `mapControlsRef`.
 *   2. Fits the camera to stations + user once on first mount.
 *   3. Pans to the selected station when the selection changes (idle behavior;
 *      the China backend has no route/follow camera to fight with).
 *   4. `invalidateSize()` after mount so tiles paint fully when the container
 *      was sized/hidden during init (the classic Leaflet "grey tiles" fix).
 */
function LeafletController({
  stations,
  userLocation,
  selectedStationId,
  preview,
  mapControlsRef,
}: {
  stations: RiderStation[];
  userLocation: GeoLocation | null;
  selectedStationId: number | null;
  preview: boolean;
  mapControlsRef?: React.MutableRefObject<RiderMapControls | null>;
}) {
  const map = useMap();
  const didFitInitialRef = useRef(false);
  const stationsRef = useRef<RiderStation[]>(stations);

  useEffect(() => {
    stationsRef.current = stations;
  }, [stations]);

  // Fix grey/half-loaded tiles when the container settles after init.
  useEffect(() => {
    const t0 = window.setTimeout(() => map.invalidateSize(), 0);
    const t1 = window.setTimeout(() => map.invalidateSize(), 250);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [map]);

  // Imperative handle for the parent's FABs (Recenter / Fit-all).
  useEffect(() => {
    if (!mapControlsRef) return;
    mapControlsRef.current = {
      recenter: (user: GeoLocation) => {
        const z = Math.max(map.getZoom() ?? 13, 16);
        map.setView([user.lat, user.lng], z);
      },
      fitAll: () => {
        const pts: [number, number][] = [];
        stationsRef.current.forEach((s) => {
          if (s.lat != null && s.lng != null) pts.push([s.lat, s.lng]);
        });
        if (userLocation) pts.push([userLocation.lat, userLocation.lng]);
        if (pts.length > 0) {
          map.fitBounds(L.latLngBounds(pts), { padding: [60, 60] });
        }
      },
    };
    return () => {
      if (mapControlsRef) mapControlsRef.current = null;
    };
  }, [map, mapControlsRef, userLocation]);

  // Initial fit to stations + user, once.
  useEffect(() => {
    if (didFitInitialRef.current) return;
    if (selectedStationId != null) return; // rider already zoomed somewhere
    const pts: [number, number][] = [];
    stations.forEach((s) => {
      if (s.lat != null && s.lng != null) pts.push([s.lat, s.lng]);
    });
    if (userLocation) pts.push([userLocation.lat, userLocation.lng]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(pts), { padding: preview ? [30, 30] : [60, 60] });
    }
    didFitInitialRef.current = true;
  }, [map, stations, userLocation, selectedStationId, preview]);

  // Pan to the selected station when the selection changes.
  useEffect(() => {
    if (selectedStationId == null) return;
    const station = stationsRef.current.find((s) => s.id === selectedStationId);
    if (!station || station.lat == null || station.lng == null) return;
    const z = Math.max(map.getZoom() ?? 13, 15);
    map.setView([station.lat, station.lng], z);
    // Intentionally NOT depending on `stations` — same ref trick as the
    // Google backend, so GPS-tick array rebuilds don't re-fire the pan.
  }, [map, selectedStationId]);

  return null;
}
