"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Search,
  X,
  Crosshair,
  MapPin,
  Navigation2,
  Zap,
  Flag,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/i18n";
import {
  useGeolocation,
  haversineKm,
  formatDistance,
  type GeoStatus,
} from "../hooks/useGeolocation";
import type { RiderStation } from "../types";

type FilterKey = "all" | "available" | "nearby";

interface RiderDirectionsProps {
  stations: RiderStation[];
  isLoading: boolean;
  /** Currently active destination (so the list can mark it). */
  activeDestinationId: number | null;
  /** Cancel — go back to map without changing the destination. */
  onClose: () => void;
  /** Commit a station as the new destination. */
  onPick: (station: RiderStation) => void;
  /** Clear the current destination (if any) and go back. */
  onClearDestination: () => void;
}

/**
 * Full-screen "Where to?" picker modeled after Google Maps' directions screen.
 *
 * Shows the rider's current location as a fixed "From" and lets them search
 * / browse stations as the "To" using the shared list-card design system
 * (same rows as Customers / Products, just specialized for stations).
 *
 * Intentionally a pure destination picker — it doesn't render the map or
 * draw routes. Once the rider taps a station, `onPick` fires and the parent
 * (`RiderStations`) closes this page and shows the route on the map.
 */
export default function RiderDirections({
  stations,
  isLoading,
  activeDestinationId,
  onClose,
  onPick,
  onClearDestination,
}: RiderDirectionsProps) {
  const { t } = useI18n();
  const { location, status: geoStatus } = useGeolocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the destination input on mount so the rider can start typing
  // immediately (same UX as tapping Google Maps' "Where to?").
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, []);

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

  const filtered = useMemo(() => {
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

  const fromLabel = fromFieldLabel(geoStatus, t);
  const nearbyDisabled = geoStatus === "denied" || geoStatus === "unavailable";

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header: back + title + (optional) end-route.
          Matches SalesCustomers / ProductsList header spacing exactly. */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label={t("common.back") || "Back"}
        >
          <ArrowLeft size={20} className="text-text-primary" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary flex-1 truncate">
          {t("rider.directions.title") || "Directions"}
        </h2>
        {activeDestinationId != null && (
          <button
            onClick={onClearDestination}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            {t("rider.stations.endRoute") || "End route"}
          </button>
        )}
      </div>

      {/* From / To card — two stacked rows joined by a thin connector.
          From is read-only (we don't support picking a custom origin yet;
          the live GPS fix is the only supported "from"). To is a search
          input wired to the station list below. */}
      <div className="px-4 pt-1 pb-3">
        <div className="rounded-xl border border-border bg-bg-tertiary overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
              <Navigation2
                size={14}
                className={location ? "text-text-primary" : "text-text-muted"}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-text-muted leading-tight">
                {t("rider.directions.from") || "From"}
              </div>
              <div
                className={`text-sm leading-tight truncate ${
                  location
                    ? "text-text-primary font-medium"
                    : "text-text-muted"
                }`}
              >
                {fromLabel}
              </div>
            </div>
          </div>

          <div className="border-t border-border flex items-center gap-3 px-3 py-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              <Flag size={14} color="#0f172a" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-text-muted leading-tight">
                {t("rider.directions.to") || "To"}
              </div>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    t("rider.directions.toPlaceholder") ||
                    "Choose a station"
                  }
                  className="w-full bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted py-0.5 pr-6"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-0 flex items-center"
                    aria-label={t("common.clear") || "Clear"}
                  >
                    <X size={14} className="text-text-muted" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter pills — same chip pattern as ProductsList.filterChips. */}
      <div className="px-4 pb-2">
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          role="tablist"
          style={{ scrollbarWidth: "none" }}
        >
          <ChipButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            {t("rider.all") || "All"}
          </ChipButton>
          <ChipButton
            active={filter === "available"}
            onClick={() => setFilter("available")}
            leading={
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: filter === "available" ? "#0f172a" : "#10b981",
                }}
              />
            }
          >
            {t("rider.map.available") || "Available"}
          </ChipButton>
          <ChipButton
            active={filter === "nearby"}
            disabled={nearbyDisabled}
            onClick={() => {
              if (!nearbyDisabled) setFilter("nearby");
            }}
            leading={<Crosshair size={11} />}
          >
            {t("rider.map.within5km") || "Within 5 km"}
          </ChipButton>
        </div>
      </div>

      {/* Suggestions list — one list-card per station, generously spaced. */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {isLoading ? (
          <div className="flex flex-col gap-2 mt-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-bg-tertiary p-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-border/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-border/50 rounded" />
                    <div className="h-3 w-48 bg-border/50 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
              <MapPin size={26} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary mb-1">
              {search.trim()
                ? t("rider.stations.empty") ||
                  "No stations match your filters"
                : t("rider.noStationsAvailable") || "No stations available"}
            </p>
            <p className="text-xs text-text-muted">
              {search.trim()
                ? t("sales.tryDifferentSearch") || "Try a different search term"
                : t("rider.directions.tryBroaderFilter") ||
                  "Try changing the filters above"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.length > 0 && (
              <p className="text-xs text-text-muted mt-1 mb-1">
                {filtered.length}{" "}
                {filtered.length === 1
                  ? t("rider.stations.stationSingular") || "station"
                  : t("rider.stations.stationPlural") || "stations"}
              </p>
            )}
            {filtered.map((station) => (
              <StationRow
                key={station.id}
                station={station}
                active={station.id === activeDestinationId}
                onClick={() => onPick(station)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- chip ----------
function ChipButton({
  active,
  disabled,
  onClick,
  leading,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  leading?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? "border-transparent text-text-inverse"
          : "border-border bg-bg-tertiary text-text-secondary"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      style={active ? { backgroundColor: "var(--color-brand)" } : undefined}
    >
      {leading}
      {children}
    </button>
  );
}

// ---------- station row ----------
function StationRow({
  station,
  active,
  onClick,
  t,
}: {
  station: RiderStation & { distanceKm: number | null };
  active: boolean;
  onClick: () => void;
  t: (key: string, vars?: any) => string | null | undefined;
}) {
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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`list-card w-full text-left ${
        active ? "ring-2 ring-primary/60" : ""
      }`}
      style={
        active
          ? {
              borderColor: "var(--color-brand)",
              boxShadow: "0 0 0 2px rgba(0, 229, 229, 0.25)",
            }
          : undefined
      }
    >
      <div className="list-card-body list-card-body--with-avatar">
        <div
          className={`list-card-avatar`}
          style={{
            backgroundColor:
              status === "available"
                ? "rgba(16, 185, 129, 0.15)"
                : status === "low"
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
            color:
              status === "available"
                ? "#10b981"
                : status === "low"
                  ? "#f59e0b"
                  : "#ef4444",
          }}
        >
          <Zap size={18} />
        </div>
        <div className="list-card-content">
          <div className="list-card-primary">{station.name}</div>
          <div className="list-card-secondary">
            <Zap size={11} />
            <span className="list-card-meta-bold">
              {station.batteries}{" "}
              {t("rider.map.availableBatteries") || "Available"}
            </span>
          </div>
          <div className="list-card-meta">
            {station.address && (
              <>
                <MapPin size={10} />
                <span className="truncate">{station.address}</span>
              </>
            )}
            {station.distanceKm != null && (
              <>
                {station.address && <span className="list-card-dot">·</span>}
                <Crosshair size={10} />
                {/* Haversine + pace-based estimate: labelled so riders
                    don't confuse it with the Routes-API-backed number
                    shown on the active navigation chrome. */}
                <span>{formatDistance(station.distanceKm)}</span>
                <span className="list-card-dot">·</span>
                <span>{etaMinutes(station.distanceKm)} (est.)</span>
              </>
            )}
          </div>
        </div>
        <div className="list-card-actions">
          <span
            className="list-card-badge"
            style={{
              backgroundColor:
                status === "available"
                  ? "rgba(16, 185, 129, 0.15)"
                  : status === "low"
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
              color:
                status === "available"
                  ? "#10b981"
                  : status === "low"
                    ? "#f59e0b"
                    : "#ef4444",
              border: "none",
            }}
          >
            {statusLabel}
          </span>
          <ChevronRight size={16} className="text-text-muted" />
        </div>
      </div>
    </button>
  );
}

// ---------- helpers ----------
function etaMinutes(km: number): string {
  const mins = Math.max(1, Math.round((km / 25) * 60));
  return `${mins} min`;
}

function fromFieldLabel(
  status: GeoStatus,
  t: (key: string, vars?: any) => string | null | undefined,
): string {
  if (status === "denied") {
    return (
      t("rider.locationDenied") || "Location permission denied"
    );
  }
  if (status === "unavailable") {
    return t("rider.locationUnavailable") || "Location not available";
  }
  if (status === "locating" || status === "idle") {
    return t("rider.locationLoading") || "Getting your location…";
  }
  return t("rider.directions.yourLocation") || "Your current location";
}
