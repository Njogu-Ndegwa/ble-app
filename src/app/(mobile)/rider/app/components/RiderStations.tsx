"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Navigation,
  Zap,
  X,
  Crosshair,
  MapPin,
  CornerUpRight,
  AlertCircle,
  RefreshCw,
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
import RiderDirections from "./RiderDirections";

// Leaflet/react-leaflet are client-only and read `window` at module load, so
// the map must be dynamically imported with SSR disabled.
const RiderMap = dynamic(() => import("../map/RiderMap"), { ssr: false });
import {
  googleMapsUrl,
  appleMapsUrl,
  wazeUrl,
  openExternalMap,
} from "../map/deepLinks";

interface RiderStationsProps {
  stations: RiderStation[];
  isLoading: boolean;
  initialSelectedStationId?: number | null;
  onStationDeselected?: () => void;
  /** Error code from the parent stations pipeline; truthy = fetch failed. */
  stationsError?: string | null;
  /** Re-run the stations fetch pipeline. */
  onRetryStations?: () => void;
}

type View = "map" | "directions";

/**
 * Rider "Stations" screen. Two sub-views:
 *
 *  1. `map`        — edge-to-edge map plus floating chrome only:
 *                    - route banner (when a destination is active)
 *                    - mini pin-detail card (when a station pin is tapped)
 *                    - right-side FAB column (clear + "Where to?")
 *                    No bottom sheet, no station list: the whole viewport is
 *                    the map, which keeps context visible while routing.
 *
 *  2. `directions` — full-screen destination picker (`RiderDirections`).
 *                    Opens when the rider taps the "Where to?" FAB. Lets
 *                    them pick/search a station and returns to `map` with
 *                    a persistent route drawn to the chosen station.
 *
 * Selection ≠ navigation. Selecting a pin previews its details; the rider
 * must explicitly choose a destination (from the directions page or the
 * mini pin-detail card's Navigate button) to start routing.
 */
export default function RiderStations({
  stations,
  isLoading,
  initialSelectedStationId,
  onStationDeselected,
  stationsError = null,
  onRetryStations,
}: RiderStationsProps) {
  const { t } = useI18n();
  const { location, status: geoStatus, requestLocation } = useGeolocation();

  // Debug: log what the component received so the overlay state is traceable.
  if (typeof window !== 'undefined') {
    const overlay = isLoading
      ? 'loading'
      : stationsError && stations.length === 0
      ? 'error'
      : stations.length === 0
      ? 'empty'
      : 'map-ready';
    console.info('[STATIONS] 🗺 RiderStations render', {
      overlay,
      stationsCount: stations.length,
      isLoading,
      stationsError,
      geoStatus,
      hasLocation: !!location,
    });
  }

  const [view, setView] = useState<View>("map");
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedStationId ?? null,
  );
  const [routeTargetId, setRouteTargetId] = useState<number | null>(null);

  // If the parent hands us an initial station (e.g. rider tapped a nearby
  // card on the home screen), select it so the mini detail card is visible.
  useEffect(() => {
    if (initialSelectedStationId != null) {
      setSelectedId(initialSelectedStationId);
    }
  }, [initialSelectedStationId]);

  const withDistance = useMemo(() => {
    return stations.map((s) => {
      if (!location || s.lat == null || s.lng == null) {
        return { ...s, distanceKm: null as number | null };
      }
      return {
        ...s,
        distanceKm: haversineKm(location, { lat: s.lat, lng: s.lng }),
      };
    });
  }, [stations, location]);

  const selected = selectedId != null
    ? withDistance.find((s) => s.id === selectedId) ?? null
    : null;
  const routeTarget = routeTargetId != null
    ? withDistance.find((s) => s.id === routeTargetId) ?? null
    : null;

  // The map only ever shows this filtered set; we keep the currently-selected
  // station and the active destination pinned here so a pin never disappears
  // mid-interaction.
  const mapStations = useMemo(() => {
    return withDistance;
  }, [withDistance]);

  const handleSelect = useCallback(
    (id: number | null) => {
      setSelectedId(id);
      if (id == null) onStationDeselected?.();
    },
    [onStationDeselected],
  );

  const clearRoute = useCallback(() => {
    setRouteTargetId(null);
  }, []);

  // Common gate for actions that need the user's position.
  const withUserLocation = useCallback(
    async (run: (loc: GeoLocation) => void) => {
      if (location) {
        run(location);
        return;
      }
      if (geoStatus === "denied" || geoStatus === "unavailable") {
        toast.error(geoErrorMessage(geoStatus, t));
        return;
      }
      const loadingToast = toast.loading(
        t("rider.locationLoading") || "Getting your location…",
      );
      try {
        const loc = await requestLocation();
        toast.dismiss(loadingToast);
        run(loc);
      } catch {
        toast.dismiss(loadingToast);
        toast.error(geoErrorMessage(geoStatus, t));
      }
    },
    [location, geoStatus, requestLocation, t],
  );

  const handleStartRoute = useCallback(
    (station: RiderStation) => {
      void withUserLocation(() => {
        setRouteTargetId(station.id);
        setSelectedId(station.id);
      });
    },
    [withUserLocation],
  );

  const handlePickDestination = useCallback(
    (station: RiderStation) => {
      setView("map");
      handleStartRoute(station);
    },
    [handleStartRoute],
  );

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

  // Directions sub-view renders edge-to-edge; no map behind it.
  if (view === "directions") {
    return (
      <div
        className="rider-screen active rm-screen"
        style={{ padding: 0, position: "relative", height: "100%" }}
      >
        <RiderDirections
          stations={stations}
          isLoading={isLoading}
          activeDestinationId={routeTargetId}
          onClose={() => setView("map")}
          onPick={handlePickDestination}
          onClearDestination={() => {
            clearRoute();
            setView("map");
          }}
        />
      </div>
    );
  }

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

        {/* Top chrome = active-route banner only (if any). When idle, the
            map is completely unobstructed up top — search/filter pills
            have moved to the Directions page per product feedback. */}
        {routeTarget && (
          <div className="rm-chrome-top">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg-secondary shadow-lg">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--color-brand)" }}
              >
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
                onClick={() => setView("directions")}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
                aria-label={t("rider.directions.change") || "Change"}
              >
                {t("rider.directions.change") || "Change"}
              </button>
              <button
                onClick={clearRoute}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
                aria-label={t("rider.stations.endRoute") || "End route"}
                title={t("rider.stations.endRoute") || "End route"}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Right-side FAB column.
            Primary = "Where to?" (opens the directions picker). The old
            "locate me" crosshair was removed — the rider's live position
            is already shown on the map via the animated chevron marker. */}
        <div
          className="rm-fab-stack"
          style={{ bottom: selected ? 180 : 24 }}
        >
          {selected && !routeTarget && (
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
            onClick={() => setView("directions")}
            aria-label={t("rider.stations.whereTo") || "Where to?"}
            title={t("rider.stations.whereTo") || "Where to?"}
          >
            <CornerUpRight size={18} />
          </button>
        </div>

        {/* Bottom peek card — only when a station pin is tapped. Compact,
            non-blocking, with actions to start routing or open externally.
            Replaces the old draggable bottom sheet entirely. */}
        {selected && (
          <StationPeekCard
            station={selected}
            isActiveDestination={selected.id === routeTargetId}
            onClose={() => handleSelect(null)}
            onNavigate={() => handleStartRoute(selected)}
            onOpenExternal={(app) => handleOpenExternal(app, selected)}
            canRoute={geoStatus !== "denied" && geoStatus !== "unavailable"}
            t={t}
          />
        )}

        {/* Stations still loading? Show a small top-center toast-like pill. */}
        {isLoading && (
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[460] flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-bg-secondary shadow-lg text-xs text-text-secondary">
            <div
              className="loading-spinner"
              style={{ width: 12, height: 12, borderWidth: 2 }}
            />
            <span>
              {t("rider.directions.loadingStations") || "Loading stations…"}
            </span>
          </div>
        )}

        {/* Fetch failed? Surface an error card centered on the map so the
            rider knows the map is blank because of a load failure, not an
            empty area. Retry button re-runs the full pipeline. */}
        {!isLoading && stationsError && stations.length === 0 && (
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 z-[460] rounded-2xl border border-border bg-bg-secondary shadow-2xl p-5 max-w-sm mx-auto">
            <div className="flex flex-col items-center text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: "rgba(239, 68, 68, 0.12)" }}
              >
                <AlertCircle size={22} color="#ef4444" />
              </div>
              <p className="text-sm font-semibold text-text-primary mb-1">
                {t("rider.stations.loadError") ||
                  "Couldn't load stations"}
              </p>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                {t("rider.stations.loadErrorHint") ||
                  "Check your connection and try again."}
              </p>
              {onRetryStations && (
                <button
                  type="button"
                  onClick={onRetryStations}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold"
                  style={{
                    backgroundColor: "var(--color-brand)",
                    color: "#0f172a",
                  }}
                >
                  <RefreshCw size={14} />
                  <span>{t("rider.directions.retry") || "Retry"}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Finished loading but no stations returned and no error: the rider
            genuinely has no stations yet. Show a minimal pill so the empty
            map isn't ambiguous. */}
        {!isLoading && !stationsError && stations.length === 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[460] flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-bg-secondary shadow-lg text-xs text-text-secondary">
            <MapPin size={12} />
            <span>
              {t("rider.noStationsFound") || "No stations found"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- bottom peek card for a tapped pin ----------
interface StationPeekCardProps {
  station: RiderStation & { distanceKm: number | null };
  isActiveDestination: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onOpenExternal: (app: "google" | "apple" | "waze") => void;
  canRoute: boolean;
  t: (key: string, vars?: any) => string | null | undefined;
}

function StationPeekCard({
  station,
  isActiveDestination,
  onClose,
  onNavigate,
  onOpenExternal,
  canRoute,
  t,
}: StationPeekCardProps) {
  const status: "available" | "low" | "empty" =
    station.batteries === 0
      ? "empty"
      : station.batteries <= 2
        ? "low"
        : "available";
  const statusLabel =
    status === "empty"
      ? t("rider.map.empty") || "Empty"
      : status === "low"
        ? t("rider.map.low") || "Low"
        : t("rider.map.available") || "Available";
  const statusColor =
    status === "available"
      ? "#10b981"
      : status === "low"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div
      className="absolute left-3 right-3 bottom-3 z-[455] rounded-2xl border border-border bg-bg-secondary shadow-2xl p-3"
      style={{ animation: "fadeIn 180ms ease-out" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${statusColor}26`,
            color: statusColor,
          }}
        >
          <Zap size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[15px] font-semibold text-text-primary truncate">
              {station.name}
            </div>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
              style={{
                backgroundColor: `${statusColor}26`,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-text-secondary flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Zap size={11} />
              <span className="font-semibold text-text-primary">
                {station.batteries}
              </span>
            </span>
            {station.distanceKm != null && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Crosshair size={11} />
                  {formatDistance(station.distanceKm)}
                </span>
                <span className="opacity-40">·</span>
                <span>{etaMinutes(station.distanceKm)}</span>
              </>
            )}
          </div>
          {station.address && (
            <div className="mt-1 text-[11px] text-text-muted flex items-center gap-1 truncate">
              <MapPin size={10} />
              <span className="truncate">{station.address}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center border border-border bg-bg-tertiary text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
          aria-label={t("common.close") || "Close"}
        >
          <X size={13} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onNavigate}
          disabled={!canRoute}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{
            backgroundColor: "var(--color-brand)",
            color: "#0f172a",
          }}
        >
          <Navigation size={14} />
          <span>
            {isActiveDestination
              ? t("rider.directions.routingHere") || "Routing here"
              : t("rider.map.navigate") || "Navigate"}
          </span>
        </button>
        <button
          onClick={() => onOpenExternal("google")}
          className="h-9 px-3 rounded-xl text-xs font-medium border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          {t("rider.map.openInGoogle") || "Google"}
        </button>
      </div>
    </div>
  );
}

// ---------- helpers ----------
function etaMinutes(km: number): string {
  // Rough urban riding estimate: ~25 km/h average.
  const mins = Math.max(1, Math.round((km / 25) * 60));
  return `${mins} min`;
}

function geoErrorMessage(
  status: GeoStatus,
  t: (key: string, vars?: any) => string | null | undefined,
): string {
  if (status === "denied") {
    return (
      t("rider.locationDenied") ||
      "Location permission denied. Please enable location services."
    );
  }
  if (status === "unavailable") {
    return (
      t("rider.locationUnavailable") ||
      "Location is not available in this browser."
    );
  }
  if (status === "locating" || status === "idle") {
    return t("rider.locationLoading") || "Getting your location…";
  }
  return t("rider.locationRequired") || "Location is not available";
}
