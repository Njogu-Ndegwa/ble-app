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
  CornerUpRight,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useI18n } from "@/i18n";
import {
  useGeolocation,
  haversineKm,
  formatDistance,
  type GeoStatus,
} from "../hooks/useGeolocation";
import type { GeoLocation, RiderStation } from "../types";
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
  const { location, status: geoStatus, requestLocation } = useGeolocation();

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
      // "Within 5 km" only makes sense once geolocation has resolved; without
      // a user location every station has `distanceKm === null` and the chip
      // would produce a silent empty state. The chip itself is disabled in
      // that case (see JSX below) but we still guard here defensively.
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

  const routeTarget = routeTargetId != null
    ? withDistance.find((s) => s.id === routeTargetId) ?? null
    : null;

  // Map markers should honor the active filter — otherwise tapping
  // "Available" / "Within 5 km" appears to do nothing because every pin is
  // still on the map. We always keep the currently-selected station visible
  // even when it doesn't match the filter, so opening its details never
  // makes the pin vanish from the map beneath the sheet.
  const mapStations = useMemo(() => {
    const inFilter = new Set(filteredStations.map((s) => s.id));
    const extras: RiderStation[] = [];
    if (selected && !inFilter.has(selected.id)) extras.push(selected);
    if (routeTarget && !inFilter.has(routeTarget.id) && routeTarget.id !== selected?.id) {
      extras.push(routeTarget);
    }
    return extras.length ? [...filteredStations, ...extras] : filteredStations;
  }, [filteredStations, selected, routeTarget]);

  const carouselRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selecting a station no longer clears an active route — once the rider has
  // picked a destination we keep showing the route until they explicitly end
  // it from the destination banner. This mirrors the Google/Apple-maps model
  // where "selection" and "active navigation" are two independent things.
  const handleSelect = useCallback(
    (id: number | null) => {
      setSelectedId(id);
      if (id == null) {
        onStationDeselected?.();
        setSnap("peek");
      } else {
        setSnap("peek");
      }
    },
    [onStationDeselected],
  );

  const clearRoute = useCallback(() => {
    setRouteTargetId(null);
  }, []);

  const focusSearch = useCallback(() => {
    // Mirrors Google Maps' "Where to?" entry point: tapping the directions
    // affordance jumps to the destination input so the rider can type/search
    // a place to go. We also raise the sheet to `half` so suggestions are
    // visible beneath the search bar.
    if (snap === "peek") setSnap("half");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [snap]);

  // Keep the active carousel card scrolled into view when selection changes.
  useEffect(() => {
    if (selectedId == null || !carouselRef.current) return;
    const el = carouselRef.current.querySelector<HTMLElement>(
      `[data-station-id="${selectedId}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  // Pick the right user-facing message based on *why* we don't have a fix yet:
  // still acquiring → "Getting your location…"; denied → ask them to enable;
  // unavailable/error → generic "not available". This is what the user sees
  // when they tap Navigate/Locate-me before a first fix has arrived.
  const geoErrorMessage = useCallback(
    (status: GeoStatus) => {
      if (status === 'denied') {
        return (
          t('rider.locationDenied') ||
          t('rider.locationRequired') ||
          'Location permission denied. Please enable location services.'
        );
      }
      if (status === 'unavailable') {
        return (
          t('rider.locationUnavailable') ||
          t('rider.locationRequired') ||
          'Location is not available in this browser.'
        );
      }
      if (status === 'locating' || status === 'idle') {
        return t('rider.locationLoading') || 'Getting your location…';
      }
      return t('rider.locationRequired') || 'Location is not available';
    },
    [t],
  );

  // Common gate for actions that need the user's position: if we already
  // have a fix, run immediately; otherwise kick off a one-shot request so
  // the action succeeds as soon as the browser hands back coordinates.
  const withUserLocation = useCallback(
    async (run: (loc: GeoLocation) => void) => {
      if (location) {
        run(location);
        return;
      }
      if (geoStatus === 'denied' || geoStatus === 'unavailable') {
        toast.error(geoErrorMessage(geoStatus));
        return;
      }
      const loadingToast = toast.loading(
        t('rider.locationLoading') || 'Getting your location…',
      );
      try {
        const loc = await requestLocation();
        toast.dismiss(loadingToast);
        run(loc);
      } catch {
        toast.dismiss(loadingToast);
        toast.error(geoErrorMessage(geoStatus));
      }
    },
    [location, geoStatus, requestLocation, geoErrorMessage, t],
  );

  const handleNavigateInApp = (station: RiderStation) => {
    void withUserLocation(() => {
      setRouteTargetId(station.id);
      setSnap('peek');
    });
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
          stations={mapStations}
          userLocation={location}
          selectedStationId={selectedId}
          onSelectStation={handleSelect}
          routeTargetId={routeTargetId}
        />

        {/* Top chrome: active-route banner, search bar, filter pills.
            Search input and pills reuse the same design-system styling as the
            Customers/Products `ListScreen` so the rider map feels consistent
            with the rest of the app. */}
        <div className="rm-chrome-top">
          {routeTarget && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg-secondary shadow-lg">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand)' }}>
                <Navigation size={15} color="#0f172a" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-text-muted leading-tight">
                  {t("rider.stations.routingTo") || "Routing to"}
                </div>
                <div className="text-sm font-semibold text-text-primary truncate">
                  {routeTarget.name}
                </div>
              </div>
              <button
                onClick={clearRoute}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
                aria-label={t("rider.stations.endRoute") || "End route"}
                title={t("rider.stations.endRoute") || "End route"}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="relative shadow-lg rounded-xl">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={16} className="text-text-muted" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rider.stations.whereTo") || "Where to?"}
              aria-label={t("rider.stations.whereTo") || "Where to?"}
              onFocus={() => {
                if (snap === "peek") setSnap("half");
              }}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5"
                aria-label={t("common.clear") || "Clear"}
              >
                <X size={14} className="text-text-muted hover:text-text-primary" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar" role="tablist">
            <button
              role="tab"
              aria-selected={filter === "all"}
              onClick={() => setFilter("all")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === "all"
                  ? "border-transparent text-text-inverse"
                  : "border-border bg-bg-tertiary text-text-secondary"
              }`}
              style={filter === "all" ? { backgroundColor: "var(--color-brand)" } : undefined}
            >
              {t("rider.all") || "All"}
            </button>
            <button
              role="tab"
              aria-selected={filter === "available"}
              onClick={() => setFilter("available")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === "available"
                  ? "border-transparent text-text-inverse"
                  : "border-border bg-bg-tertiary text-text-secondary"
              }`}
              style={filter === "available" ? { backgroundColor: "var(--color-brand)" } : undefined}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: filter === "available" ? "#0f172a" : "#10b981" }}
              />
              {t("rider.map.available") || "Available"}
            </button>
            <button
              role="tab"
              aria-selected={filter === "nearby"}
              aria-disabled={geoStatus === "denied" || geoStatus === "unavailable"}
              disabled={geoStatus === "denied" || geoStatus === "unavailable"}
              onClick={() => {
                void withUserLocation(() => setFilter("nearby"));
              }}
              title={!location ? geoErrorMessage(geoStatus) : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === "nearby"
                  ? "border-transparent text-text-inverse"
                  : "border-border bg-bg-tertiary text-text-secondary"
              } ${
                geoStatus === "denied" || geoStatus === "unavailable"
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              style={filter === "nearby" ? { backgroundColor: "var(--color-brand)" } : undefined}
            >
              <Crosshair size={11} />
              {t("rider.map.within5km") || "Within 5 km"}
            </button>
          </div>
        </div>

        {/* Right-side FAB stack.
            Primary FAB is the Google-Maps-style "Where to?" directions entry —
            it focuses the destination input so the rider can pick where they
            want to go, instead of the old "locate me" crosshair (which just
            re-centered the map and didn't help them pick a destination). */}
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
            onClick={focusSearch}
            aria-label={t("rider.stations.whereTo") || "Where to?"}
            title={t("rider.stations.whereTo") || "Where to?"}
          >
            <CornerUpRight size={18} />
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
                canRoute={
                  geoStatus !== "denied" && geoStatus !== "unavailable"
                }
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
                canRoute={
                  geoStatus !== "denied" && geoStatus !== "unavailable"
                }
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
