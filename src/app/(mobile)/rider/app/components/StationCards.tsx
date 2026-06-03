"use client";

import React, { useMemo } from "react";
import { Zap, BatteryCharging, MapPin, Clock, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { haversineKm, formatDistance } from "../hooks/useGeolocation";
import type { GeoLocation } from "../types";
import {
  getStationSite,
  getStationOpenState,
  type StationOpenState,
} from "@/lib/station-names";

/**
 * Minimal station shape the cards need. A subset of `RiderStation`; the home
 * screen passes its already-mapped `nearbyStations` straight through.
 */
export interface StationCardData {
  id: number;
  name: string;
  rcuSn?: string;
  /** Fully-charged, swap-ready batteries (the hero number). */
  batteries: number;
  /** Currently charging — shown alongside, visually distinct. */
  charging?: number;
  lat?: number;
  lng?: number;
}

interface StationCardsProps {
  stations: StationCardData[];
  userLocation: GeoLocation | null;
  /** Tapping a card hands off to the full Stations map with this id selected. */
  onSelectStation: (stationId: number) => void;
  /** "See all" / footer affordance → full Stations screen. */
  onViewAll?: () => void;
}

type Availability = "available" | "low" | "empty";

const AVAIL_COLOR: Record<Availability, string> = {
  // Same palette as the map markers (StationMarker.tsx) so the two views agree.
  available: "#10b981",
  low: "#f59e0b",
  empty: "#94a3b8",
};

/** Availability tier from the ready-battery count (matches the peek card). */
function availabilityOf(batteries: number): Availability {
  if (batteries === 0) return "empty";
  if (batteries <= 2) return "low";
  return "available";
}

/**
 * Proximity-sorted station cards for the Rider home screen.
 *
 * Sits beneath the map preview (hybrid map-on-top + cards-below pattern). Each
 * card leads with the availability-colored ready-battery count — the single
 * most load-bearing field for a swap rider — then the charging count, distance,
 * and an open/closed badge derived from the hard-coded site hours.
 */
export default function StationCards({
  stations,
  userLocation,
  onSelectStation,
  onViewAll,
}: StationCardsProps) {
  const { t } = useI18n();

  // Attach distance and sort closest-first. Stations without coordinates (or
  // before we have a GPS fix) sort to the end but still render.
  const ordered = useMemo(() => {
    const withDistance = stations.map((s) => {
      const km =
        userLocation && s.lat != null && s.lng != null
          ? haversineKm(userLocation, { lat: s.lat, lng: s.lng })
          : null;
      return { station: s, km };
    });
    withDistance.sort((a, b) => {
      if (a.km == null && b.km == null) return 0;
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
    return withDistance;
  }, [stations, userLocation]);

  if (stations.length === 0) return null;

  return (
    <div className="rh-station-cards" style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {ordered.map(({ station, km }) => (
        <StationCard
          key={station.id}
          station={station}
          distanceKm={km}
          onSelect={() => onSelectStation(station.id)}
          t={t}
        />
      ))}

      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="rh-station-cards__all"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            height: 40,
            borderRadius: "var(--radius-lg, 12px)",
            border: "1px solid var(--border)",
            background: "var(--bg-tertiary)",
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span>{t("rider.map.openFullMap") || "Open full map"}</span>
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

interface StationCardProps {
  station: StationCardData;
  distanceKm: number | null;
  onSelect: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function StationCard({ station, distanceKm, onSelect, t }: StationCardProps) {
  const avail = availabilityOf(station.batteries);
  const color = AVAIL_COLOR[avail];
  const charging = station.charging ?? 0;

  const site = getStationSite(station.rcuSn);
  const openState = getStationOpenState(site);

  const availLabel =
    avail === "empty"
      ? t("rider.map.empty") || "Empty"
      : avail === "low"
        ? t("rider.map.low") || "Low"
        : t("rider.map.available") || "Available";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="rh-station-card"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: 12,
        borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        cursor: "pointer",
      }}
    >
      {/* Availability-colored icon tile — instant read of station health. */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${color}26`,
          color,
        }}
      >
        <Zap size={18} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        {/* Name + availability badge */}
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {station.name}
          </span>
          <span
            style={{
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 6,
              backgroundColor: `${color}26`,
              color,
            }}
          >
            {availLabel}
          </span>
        </span>

        {/* RCU SN — secondary, monospace-ish small text */}
        {station.rcuSn && (
          <span
            style={{
              display: "block",
              marginTop: 2,
              fontSize: 11,
              color: "var(--text-muted)",
              letterSpacing: 0.2,
            }}
          >
            {station.rcuSn}
          </span>
        )}

        {/* Battery counts — ready (hero) + charging (distinct, muted/amber) */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          >
            <Zap size={13} color={color} />
            <span style={{ fontWeight: 700 }}>{station.batteries}</span>
            <span style={{ color: "var(--text-secondary)" }}>
              {t("rider.stationCard.ready") || "charged"}
            </span>
          </span>

          {charging > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              <BatteryCharging size={13} color="#f59e0b" />
              <span style={{ fontWeight: 600 }}>{charging}</span>
              <span>{t("rider.stationCard.charging") || "charging"}</span>
            </span>
          )}
        </span>

        {/* Distance + hours / open status */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 4,
            fontSize: 12,
            color: "var(--text-secondary)",
            flexWrap: "wrap",
          }}
        >
          {distanceKm != null && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} />
              {formatDistance(distanceKm)}
            </span>
          )}
          {site && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} />
              {site.open}–{site.close}
              {openState && (
                <span style={{ color: openStateColor(openState), fontWeight: 600 }}>
                  · {openStateLabel(openState, t)}
                </span>
              )}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function openStateColor(state: StationOpenState): string {
  if (state === "open") return "#10b981";
  if (state === "closes-soon") return "#f59e0b";
  return "#ef4444";
}

function openStateLabel(
  state: StationOpenState,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (state === "open") return t("rider.stationCard.open") || "Open";
  if (state === "closes-soon") return t("rider.stationCard.closesSoon") || "Closes soon";
  return t("rider.stationCard.closed") || "Closed";
}
