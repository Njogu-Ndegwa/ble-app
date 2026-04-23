"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Search,
  Navigation,
  Zap,
  X,
  Crosshair,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useI18n } from "@/i18n";
import {
  useGeolocation,
  haversineKm,
  formatDistance,
} from "../hooks/useGeolocation";
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
 * Full-screen, mobile-first station finder.
 *
 * Layout (top → bottom, floating on the map):
 *   1. Search bar + filter pills (top)
 *   2. Right-side FAB column (layers, locate-me)
 *   3. Bottom sheet:
 *      - Peek  → horizontal carousel of nearest stations (or detail card)
 *      - Half  → vertical list + header
 *      - Full  → full list
 *
 * The map itself is edge-to-edge; `.rider-main` gets a `rider-main--full`
 * modifier from the page shell so there are no gutters.
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
  const [snap, setSnap] = useState<SheetSnap>(
    initialSelectedStationId != null ? "peek" : "peek",
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  // Surface a "station was selected externally" once, then clear it.
  useEffect(() => {
    if (initialSelectedStationId != null) {
      setSelectedId(initialSelectedStationId);
      setSnap("peek");
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

  const selected = selectedId != null
    ? withDistance.find((s) => s.id === selectedId) ?? null
    : null;

  const carouselRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (id: number | null) => {
      setSelectedId(id);
      setRouteTargetId(null);
      if (id == null) {
        onStationDeselected?.();
        setSnap("peek");
      } else {
        setSnap("peek");
      }
    },
    [onStationDeselected],
  );

  // Keep the active carousel card scrolled into view when selection changes.
  useEffect(() => {
    if (selectedId == null || !carouselRef.current) return;
    const el = carouselRef.current.querySelector<HTMLElement>(
      `[data-station-id="${selectedId}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  const handleLocateMe = () => {
    if (!location) {
      toast.error(t("rider.locationRequired") || "Location is not available");
      return;
    }
    setSelectedId(null);
    setRouteTargetId(null);
    setSnap("peek");
  };

  const handleNavigateInApp = (station: RiderStation) => {
    if (!location) {
      toast.error(
        t("rider.locationRequired") || "Location is required for navigation",
      );
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

  const carouselStations = filteredStations.slice(0, 10);

  // FAB offset should follow the current sheet snap so controls never collide.
  const fabBottom =
    snap === "peek" ? 176 : snap === "half" ? "54vh" : "90vh";

  return (
    <div
      className="rider-screen active rm-screen"
      style={{ padding: 0, position: "relative", height: "100%" }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <RiderMap
          stations={stations}
          userLocation={location}
          selectedStationId={selectedId}
          onSelectStation={handleSelect}
          routeTargetId={routeTargetId}
        />

        {/* Top chrome: search + filter pills */}
        <div className="rm-chrome-top">
          <div className="rm-search">
            <Search size={16} className="rm-search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rider.stations.search") || "Search stations..."}
              aria-label={t("rider.stations.search") || "Search stations"}
            />
            {search && (
              <button
                className="rm-search-clear"
                onClick={() => setSearch("")}
                aria-label={t("common.clear") || "Clear"}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="rm-chips" role="tablist">
            <button
              role="tab"
              aria-selected={filter === "all"}
              className={`rm-chip${filter === "all" ? " rm-chip--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              {t("rider.all") || "All"}
            </button>
            <button
              role="tab"
              aria-selected={filter === "available"}
              className={`rm-chip${filter === "available" ? " rm-chip--active" : ""}`}
              onClick={() => setFilter("available")}
            >
              <span className="rm-chip-dot rm-chip-dot--available" />
              {t("rider.map.available") || "Available"}
            </button>
            <button
              role="tab"
              aria-selected={filter === "nearby"}
              className={`rm-chip${filter === "nearby" ? " rm-chip--active" : ""}`}
              onClick={() => setFilter("nearby")}
            >
              <Crosshair size={11} />
              {t("rider.map.within5km") || "Within 5 km"}
            </button>
          </div>
        </div>

        {/* Right-side FAB stack */}
        <div className="rm-fab-stack" style={{ bottom: typeof fabBottom === "number" ? `${fabBottom}px` : fabBottom }}>
          {selected && (
            <button
              className="rm-fab"
              onClick={() => handleSelect(null)}
              aria-label={t("common.clear") || "Clear"}
              title={t("common.clear") || "Clear"}
            >
              <X size={18} />
            </button>
          )}
          <button
            className="rm-fab rm-fab--primary"
            onClick={handleLocateMe}
            aria-label={t("rider.map.locateMe") || "Locate me"}
            title={t("rider.map.locateMe") || "Locate me"}
          >
            <Crosshair size={18} />
          </button>
        </div>
      </div>

      <MapBottomSheet
        snap={snap}
        onSnapChange={setSnap}
        hideHandle={false}
        header={
          selected ? null : (
            <div className="rm-peek-header">
              <span className="rm-peek-title">
                {filteredStations.length}{" "}
                {filteredStations.length === 1
                  ? t("rider.stations.stationSingular") || "station"
                  : t("rider.stations.stationPlural") || "stations"}{" "}
                {t("rider.map.nearby") || "nearby"}
              </span>
              <button
                className="rm-peek-link"
                onClick={() => setSnap(snap === "peek" ? "half" : "peek")}
              >
                {snap === "peek"
                  ? t("rider.map.seeList") || "See list"
                  : t("rider.map.seeMap") || "See map"}
              </button>
            </div>
          )
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

        {/* PEEK: detail-card OR horizontal carousel */}
        {!isLoading && snap === "peek" && (
          <>
            {selected ? (
              <DetailCard
                station={selected}
                onClose={() => handleSelect(null)}
                onNavigate={() => handleNavigateInApp(selected)}
                onOpenExternal={(app) => handleOpenExternal(app, selected)}
                canRoute={!!location}
                t={t}
              />
            ) : (
              <div className="rm-carousel" ref={carouselRef}>
                {carouselStations.map((station) => (
                  <CarouselCard
                    key={station.id}
                    station={station}
                    active={selectedId === station.id}
                    onClick={() => handleSelect(station.id)}
                    onNavigate={() => handleNavigateInApp(station)}
                    t={t}
                  />
                ))}
                {carouselStations.length === 0 && (
                  <div className="rm-carousel-empty">
                    {t("rider.stations.empty") || "No stations match your filters"}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* HALF / FULL: vertical list */}
        {!isLoading && snap !== "peek" && (
          <>
            {selected && (
              <DetailCard
                station={selected}
                onClose={() => handleSelect(null)}
                onNavigate={() => handleNavigateInApp(selected)}
                onOpenExternal={(app) => handleOpenExternal(app, selected)}
                canRoute={!!location}
                t={t}
                compact
              />
            )}

            <div className="rm-list">
              {filteredStations.map((station) => (
                <button
                  key={station.id}
                  className={`rm-list-item${
                    selectedId === station.id ? " rm-list-item--active" : ""
                  }`}
                  onClick={() => handleSelect(station.id)}
                >
                  <StatusBadge batteries={station.batteries} t={t} />
                  <div className="rm-list-body">
                    <div className="rm-list-title">{station.name}</div>
                    <div className="rm-list-meta">
                      {station.address && (
                        <span className="rm-list-meta-item">
                          <MapPin size={11} />
                          <span>{station.address}</span>
                        </span>
                      )}
                      {station.distanceKm != null && (
                        <span className="rm-list-meta-item">
                          <Crosshair size={11} />
                          <span>{formatDistance(station.distanceKm)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="rm-list-chevron" />
                </button>
              ))}

              {filteredStations.length === 0 && (
                <div style={{ padding: "30px 0", textAlign: "center" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    {t("rider.stations.empty") || "No stations match your filters"}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </MapBottomSheet>
    </div>
  );
}

// ---------- carousel card ----------
interface CarouselCardProps {
  station: RiderStation & { distanceKm: number | null };
  active: boolean;
  onClick: () => void;
  onNavigate: () => void;
  t: (key: string, vars?: any) => string | null | undefined;
}

function CarouselCard({
  station,
  active,
  onClick,
  onNavigate,
  t,
}: CarouselCardProps) {
  const status = batteryStatus(station.batteries);
  return (
    <div
      data-station-id={station.id}
      className={`rm-card${active ? " rm-card--active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className={`rm-card-badge rm-card-badge--${status}`}>
        <Zap size={14} />
        <span className="rm-card-badge-num">{station.batteries}</span>
      </div>
      <div className="rm-card-body">
        <div className="rm-card-title">{station.name}</div>
        <div className="rm-card-sub">
          <span>
            {status === "empty"
              ? t("rider.map.empty") || "Empty"
              : status === "low"
                ? t("rider.map.low") || "Low"
                : t("rider.map.available") || "Available"}
          </span>
          {station.distanceKm != null && (
            <>
              <span className="rm-card-dot" />
              <span>{formatDistance(station.distanceKm)}</span>
            </>
          )}
        </div>
      </div>
      <button
        className="rm-card-cta"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate();
        }}
        aria-label={t("rider.map.navigate") || "Navigate"}
      >
        <Navigation size={16} />
      </button>
    </div>
  );
}

// ---------- detail card (selected station) ----------
interface DetailCardProps {
  station: RiderStation & { distanceKm: number | null };
  onClose: () => void;
  onNavigate: () => void;
  onOpenExternal: (app: "google" | "apple" | "waze") => void;
  canRoute: boolean;
  t: (key: string, vars?: any) => string | null | undefined;
  compact?: boolean;
}

function DetailCard({
  station,
  onClose,
  onNavigate,
  onOpenExternal,
  canRoute,
  t,
  compact = false,
}: DetailCardProps) {
  const status = batteryStatus(station.batteries);
  return (
    <div className={`rm-detail${compact ? " rm-detail--compact" : ""}`}>
      <button
        className="rm-detail-close"
        onClick={onClose}
        aria-label={t("common.close") || "Close"}
      >
        <X size={14} />
      </button>

      <div className="rm-detail-head">
        <div className={`rm-detail-icon rm-detail-icon--${status}`}>
          <Zap size={18} />
        </div>
        <div className="rm-detail-head-text">
          <div className="rm-detail-title">{station.name}</div>
          {station.address && (
            <div className="rm-detail-address">{station.address}</div>
          )}
        </div>
      </div>

      <div className="rm-detail-stats">
        <div className="rm-detail-stat">
          <div className={`rm-detail-stat-value rm-detail-stat-value--${status}`}>
            {station.batteries}
          </div>
          <div className="rm-detail-stat-label">
            {t("rider.map.availableBatteries") || "Available"}
          </div>
        </div>
        {station.distanceKm != null && (
          <div className="rm-detail-stat">
            <div className="rm-detail-stat-value">
              {formatDistance(station.distanceKm)}
            </div>
            <div className="rm-detail-stat-label">
              {t("rider.map.distance") || "Distance"}
            </div>
          </div>
        )}
        {station.distanceKm != null && (
          <div className="rm-detail-stat">
            <div className="rm-detail-stat-value">
              {etaMinutes(station.distanceKm)}
            </div>
            <div className="rm-detail-stat-label">
              {t("rider.map.eta") || "ETA"}
            </div>
          </div>
        )}
      </div>

      <div className="rm-detail-actions">
        <button
          className="rm-btn rm-btn--primary"
          onClick={onNavigate}
          disabled={!canRoute}
        >
          <Navigation size={15} />
          <span>{t("rider.map.navigate") || "Navigate"}</span>
        </button>
        <button
          className="rm-btn rm-btn--ghost"
          onClick={() => onOpenExternal("google")}
        >
          {t("rider.map.openInGoogle") || "Google"}
        </button>
        <button
          className="rm-btn rm-btn--ghost"
          onClick={() => onOpenExternal("apple")}
        >
          {t("rider.map.openInApple") || "Apple"}
        </button>
        <button
          className="rm-btn rm-btn--ghost"
          onClick={() => onOpenExternal("waze")}
        >
          {t("rider.map.openInWaze") || "Waze"}
        </button>
      </div>
    </div>
  );
}

// ---------- helpers ----------
function batteryStatus(n: number): "available" | "low" | "empty" {
  if (n === 0) return "empty";
  if (n <= 2) return "low";
  return "available";
}

function etaMinutes(km: number): string {
  // Rough urban riding estimate: ~25 km/h average.
  const mins = Math.max(1, Math.round((km / 25) * 60));
  return `${mins} min`;
}

function StatusBadge({
  batteries,
  t,
}: {
  batteries: number;
  t: (key: string, vars?: any) => string | null | undefined;
}) {
  const status = batteryStatus(batteries);
  return (
    <div className={`rm-status rm-status--${status}`}>
      <span className="rm-status-num">{batteries}</span>
      <span className="rm-status-label">
        {status === "empty"
          ? t("rider.map.empty") || "Empty"
          : status === "low"
            ? t("rider.map.low") || "Low"
            : t("rider.map.available") || "Available"}
      </span>
    </div>
  );
}
