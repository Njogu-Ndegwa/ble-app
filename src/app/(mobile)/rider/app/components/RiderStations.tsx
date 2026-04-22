"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, Navigation, MapPin, Zap, X, Compass } from "lucide-react";
import { toast } from "react-hot-toast";
import { useI18n } from "@/i18n";
import { useGeolocation, haversineKm, formatDistance } from "../hooks/useGeolocation";
import type { RiderStation } from "../types";
import MapBottomSheet, { type SheetSnap } from "../map/MapBottomSheet";

// Leaflet/react-leaflet are client-only and read `window` at module load, so
// the map must be dynamically imported with SSR disabled.
const RiderMap = dynamic(() => import("../map/RiderMap"), { ssr: false });
import {
  googleMapsUrl,
  appleMapsUrl,
  wazeUrl,
  openExternalMap,
} from "../map/deepLinks";

type FilterKey = "all" | "available" | "nearby";

interface RiderStationsProps {
  stations: RiderStation[];
  isLoading: boolean;
  initialSelectedStationId?: number | null;
  onStationDeselected?: () => void;
}

/**
 * Full-screen station finder — world-class UX.
 *
 * Stack:
 *  - `RiderMap` (react-leaflet + CARTO basemap that follows the theme)
 *  - Search bar floating on top
 *  - Draggable bottom sheet with station list + detail card
 *  - FABs for "locate me" and "navigate"
 *  - Deep links to Google / Apple / Waze for external navigation
 */
export default function RiderStations({
  stations,
  isLoading,
  initialSelectedStationId,
  onStationDeselected,
}: RiderStationsProps) {
  const { t } = useI18n();
  const { location } = useGeolocation();

  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedStationId ?? null,
  );
  const [routeTargetId, setRouteTargetId] = useState<number | null>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  // Surface a "station was selected externally" once, then clear it.
  useEffect(() => {
    if (initialSelectedStationId != null) {
      setSelectedId(initialSelectedStationId);
      setSnap("half");
    }
  }, [initialSelectedStationId]);

  const withDistance = useMemo(() => {
    return stations.map((s) => {
      if (!location || s.lat == null || s.lng == null) {
        return { ...s, distanceKm: null as number | null };
      }
      const km = haversineKm(location, { lat: s.lat, lng: s.lng });
      return { ...s, distanceKm: km };
    });
  }, [stations, location]);

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = withDistance;
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q),
      );
    }
    if (filter === "available") {
      list = list.filter((s) => s.batteries > 0);
    } else if (filter === "nearby") {
      list = list.filter((s) => s.distanceKm != null && s.distanceKm < 5);
    }
    return [...list].sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }, [withDistance, search, filter]);

  const selected = selectedId != null ? stations.find((s) => s.id === selectedId) : null;
  const selectedWithDistance = selected
    ? withDistance.find((s) => s.id === selected.id) || null
    : null;

  const handleSelect = (id: number | null) => {
    setSelectedId(id);
    setRouteTargetId(null);
    if (id == null) {
      onStationDeselected?.();
      setSnap("half");
    } else {
      setSnap("half");
    }
  };

  const handleLocateMe = () => {
    if (!location) {
      toast.error(t("rider.locationRequired") || "Location is not available");
      return;
    }
    // Force a re-render fly; handled inside RiderMap via effect when userLocation changes.
    // We can't call map.flyTo from here without a ref; instead, we just reset selection
    // so the map fits initial center which includes user.
    setSelectedId(null);
    setRouteTargetId(null);
    setSnap("half");
  };

  const handleNavigateInApp = (station: RiderStation) => {
    if (!location) {
      toast.error(t("rider.locationRequired") || "Location is required for navigation");
      return;
    }
    setRouteTargetId(station.id);
    setSnap("peek");
  };

  const handleOpenExternal = (
    app: "google" | "apple" | "waze",
    station: RiderStation,
  ) => {
    if (station.lat == null || station.lng == null) return;
    const dest = { lat: station.lat, lng: station.lng };
    const url =
      app === "google"
        ? googleMapsUrl(dest, station.name)
        : app === "apple"
          ? appleMapsUrl(dest)
          : wazeUrl(dest);
    openExternalMap(url);
  };

  return (
    <div className="rider-screen active" style={{ padding: 0, position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <RiderMap
          stations={stations}
          userLocation={location}
          selectedStationId={selectedId}
          onSelectStation={handleSelect}
          routeTargetId={routeTargetId}
        />

        {/* Search bar overlay */}
        <div className="rm-map-search">
          <Search size={16} className="rm-map-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("rider.stations.search") || "Search stations..."}
          />
        </div>

        {/* Locate Me FAB */}
        <button
          className="rm-fab"
          style={{ bottom: `calc(${snapToOffset(snap)} + 14px)` }}
          onClick={handleLocateMe}
          aria-label={t("rider.map.locateMe") || "Locate me"}
        >
          <Compass size={18} />
        </button>
      </div>

      <MapBottomSheet
        snap={snap}
        onSnapChange={setSnap}
        header={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {filteredStations.length}{" "}
                {filteredStations.length === 1
                  ? t("rider.stations.stationSingular") || "station"
                  : t("rider.stations.stationPlural") || "stations"}
              </span>
              {selected && (
                <button
                  onClick={() => handleSelect(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 4,
                  }}
                  aria-label={t("common.close") || "Close"}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="rm-filter-pills">
              <button
                className={`rm-filter-pill${filter === "all" ? " active" : ""}`}
                onClick={() => setFilter("all")}
              >
                {t("rider.all") || "All"}
              </button>
              <button
                className={`rm-filter-pill${filter === "available" ? " active" : ""}`}
                onClick={() => setFilter("available")}
              >
                {t("rider.map.available") || "Available"}
              </button>
              <button
                className={`rm-filter-pill${filter === "nearby" ? " active" : ""}`}
                onClick={() => setFilter("nearby")}
              >
                {t("rider.map.within5km") || "Within 5 km"}
              </button>
            </div>
          </div>
        }
      >
        {isLoading && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div
              className="loading-spinner"
              style={{ width: 24, height: 24, borderWidth: 2, margin: "0 auto" }}
            />
          </div>
        )}

        {/* Station detail */}
        {!isLoading && selected && selectedWithDistance && (
          <div className="rm-station-detail">
            <div className="rm-station-detail-title">{selected.name}</div>
            <div className="rm-station-detail-meta">
              {selected.address && (
                <span>
                  <MapPin size={12} style={{ display: "inline", marginRight: 3 }} />
                  {selected.address}
                </span>
              )}
              {selectedWithDistance.distanceKm != null && (
                <span>· {formatDistance(selectedWithDistance.distanceKm)}</span>
              )}
              <span>
                · <Zap size={12} style={{ display: "inline", marginRight: 3 }} />
                {selected.batteries} {t("rider.batteriesAvailable") || "available"}
              </span>
            </div>
            <div className="rm-station-detail-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleNavigateInApp(selected)}
                disabled={!location}
              >
                <Navigation size={14} />
                <span>{t("rider.map.navigate") || "Navigate"}</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleOpenExternal("google", selected)}
              >
                {t("rider.map.openInGoogle") || "Google Maps"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleOpenExternal("apple", selected)}
              >
                {t("rider.map.openInApple") || "Apple Maps"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleOpenExternal("waze", selected)}
              >
                {t("rider.map.openInWaze") || "Waze"}
              </button>
            </div>
          </div>
        )}

        {/* Station list */}
        {!isLoading &&
          filteredStations.map((station) => (
            <div
              key={station.id}
              className={`list-card${selectedId === station.id ? " list-card-selected" : ""}`}
              onClick={() => handleSelect(station.id)}
              style={{ cursor: "pointer" }}
            >
              <div className="list-card-body">
                <div className="list-card-content">
                  <div className="list-card-primary">{station.name}</div>
                  {station.address && (
                    <div className="list-card-secondary">{station.address}</div>
                  )}
                  <div className="list-card-meta">
                    <Zap size={10} />
                    <span>
                      {station.batteries}{" "}
                      {t("rider.batteriesAvailable") || "available"}
                    </span>
                    {station.distanceKm != null && (
                      <>
                        <span>·</span>
                        <span>{formatDistance(station.distanceKm)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="list-card-actions">
                  <span
                    className={
                      station.batteries === 0
                        ? "list-card-badge--overdue"
                        : station.batteries <= 2
                          ? "list-card-badge--progress"
                          : "list-card-badge--completed"
                    }
                  >
                    {station.batteries === 0
                      ? t("rider.map.empty") || "Empty"
                      : station.batteries <= 2
                        ? t("rider.map.low") || "Low"
                        : t("rider.map.available") || "Available"}
                  </span>
                </div>
              </div>
            </div>
          ))}

        {!isLoading && filteredStations.length === 0 && (
          <div style={{ padding: "30px 0", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {t("rider.stations.empty") || "No stations match your filters"}
            </p>
          </div>
        )}
      </MapBottomSheet>
    </div>
  );
}

// Convert snap point to a pixel offset for FAB positioning
function snapToOffset(snap: SheetSnap): string {
  if (snap === "peek") return "96px";
  if (snap === "half") return "45vh";
  return "85vh";
}
