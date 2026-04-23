"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
// leaflet.markercluster's default CSS is required so cluster bubbles get
// their size/border-radius — without it they collapse to 0×0 and markers
// appear to "vanish" at low zoom. Our own styles in globals.css override
// the look but rely on this base layout.
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { RiderStation, GeoLocation } from "../types";
import {
  makeStationIcon,
  makeUserLocationIcon,
  makeClusterIcon,
} from "./StationMarker";
import { useRouting } from "./useRouting";

// react-leaflet components are client-only and rely on `window`; load them
// dynamically to avoid SSR errors.
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);
// Marker clustering. The underlying `leaflet.markercluster` plugin owns the
// cluster container styles — see the `MarkerCluster.css` import above.
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-cluster").then((m: any) => m.default ?? m),
  { ssr: false },
) as unknown as React.ComponentType<any>;

// Single basemap for both light and dark themes. CARTO Voyager is highly
// legible on small mobile viewports; the dark CARTO tiles (`dark_all`) are
// too harsh and collapse labels/road contrast in practice. This matches the
// pattern used by most operational map apps (PlugShare, ChargePoint, etc.)
// where the map is its own always-light surface regardless of app theme.
const BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface RiderMapProps {
  stations: RiderStation[];
  userLocation: GeoLocation | null;
  selectedStationId: number | null;
  onSelectStation: (id: number | null) => void;
  /** When truthy, we render a driving route from the user to this station. */
  routeTargetId?: number | null;
  /** Default center used before user location is known. */
  defaultCenter?: [number, number];
  /** Compact/preview mode disables clustering and shrinks markers. */
  preview?: boolean;
  /** Called with the Leaflet map once it's ready. */
  onMapReady?: (map: LeafletMap) => void;
}

const DEFAULT_CENTER: [number, number] = [-1.2921, 36.8219]; // Nairobi

/**
 * Shared map component used by both `RiderHome` (preview) and `RiderStations`
 * (full-screen). Uses react-leaflet with CARTO basemaps that follow the app
 * theme, a live user-location chevron, and OSRM-backed driving routes.
 */
export default function RiderMap({
  stations,
  userLocation,
  selectedStationId,
  onSelectStation,
  routeTargetId,
  defaultCenter = DEFAULT_CENTER,
  preview = false,
  onMapReady,
}: RiderMapProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const markerRefs = useRef<Map<number, LeafletMarker>>(new Map());
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (!cancelled) setLeaflet(L);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const initialCenter = useMemo<[number, number]>(() => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    const withCoords = stations.filter((s) => s.lat && s.lng);
    if (withCoords.length === 0) return defaultCenter;
    const sum = withCoords.reduce(
      (acc, s) => ({ lat: acc.lat + (s.lat || 0), lng: acc.lng + (s.lng || 0) }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / withCoords.length, sum.lng / withCoords.length];
  }, [userLocation, stations, defaultCenter]);

  // Notify parent once the map instance is ready
  useEffect(() => {
    if (map) onMapReadyRef.current?.(map);
  }, [map]);

  // Fit bounds once we have stations
  useEffect(() => {
    if (!map || !leaflet) return;
    const valid = stations.filter(
      (s) => typeof s.lat === "number" && typeof s.lng === "number",
    );
    if (valid.length === 0) return;
    if (preview) {
      const bounds = leaflet.latLngBounds(
        valid.map((s) => [s.lat!, s.lng!] as [number, number]),
      );
      if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15, animate: false });
    }
  }, [map, leaflet, stations, userLocation, preview]);

  // Pan to selected station
  useEffect(() => {
    if (!map || selectedStationId == null) return;
    const station = stations.find((s) => s.id === selectedStationId);
    if (!station || typeof station.lat !== "number" || typeof station.lng !== "number") return;
    map.flyTo([station.lat, station.lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.5,
    });
  }, [map, selectedStationId, stations]);

  const routeTarget = useMemo(() => {
    const id = routeTargetId ?? selectedStationId;
    if (id == null) return null;
    const s = stations.find((x) => x.id === id);
    if (!s || s.lat == null || s.lng == null) return null;
    return { lat: s.lat, lng: s.lng };
  }, [routeTargetId, selectedStationId, stations]);

  useRouting(map, userLocation, routeTarget, !preview && !!routeTarget);

  if (!leaflet) {
    return (
      <div className="rm-map-loading">
        <div className="loading-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
      </div>
    );
  }

  return (
    <div className={`rm-map-wrap${preview ? " rm-map-preview" : ""}`}>
      <MapContainer
        center={initialCenter}
        zoom={13}
        scrollWheelZoom={!preview}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
        attributionControl={!preview}
        ref={(m) => {
          setMap(m ?? null);
        }}
      >
        <TileLayer
          url={BASEMAP_URL}
          attribution={ATTRIBUTION}
          maxZoom={19}
          subdomains={["a", "b", "c", "d"]}
        />

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={makeUserLocationIcon(userLocation.heading ?? null)}
            interactive={false}
          />
        )}

        {(() => {
          const valid = stations.filter(
            (s) => typeof s.lat === "number" && typeof s.lng === "number",
          );
          const markers = valid.map((station) => {
            const isSelected = selectedStationId === station.id;
            const variant = isSelected
              ? "selected"
              : station.batteries === 0
                ? "empty"
                : station.batteries <= 2
                  ? "low"
                  : "available";
            return (
              <Marker
                key={station.id}
                position={[station.lat!, station.lng!]}
                icon={makeStationIcon(variant, station.batteries)}
                eventHandlers={{
                  click: () => onSelectStation(station.id),
                  add: (e: any) => markerRefs.current.set(station.id, e.target),
                  remove: () => markerRefs.current.delete(station.id),
                }}
              />
            );
          });
          // Cluster on both the preview and full-screen map so the two views
          // render the exact same marker layout. Preview just gets a slightly
          // tighter radius since the map is smaller.
          return (
            <MarkerClusterGroup
              chunkedLoading
              showCoverageOnHover={false}
              spiderfyOnMaxZoom={!preview}
              maxClusterRadius={preview ? 40 : 60}
              iconCreateFunction={(cluster: any) =>
                makeClusterIcon(cluster.getChildCount())
              }
            >
              {markers}
            </MarkerClusterGroup>
          );
        })()}
      </MapContainer>
    </div>
  );
}
