"use client";

import React, { useMemo } from "react";
import { Zap, BatteryCharging, ChevronRight, MapPin } from "lucide-react";
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
  /** Footer "view all on map" → full Stations screen. */
  onViewAll?: () => void;
  /**
   * Cap the number of cards rendered on the home screen. With a large network
   * (hundreds of stations) we never want an endless list under the map — show
   * the best few and push the rest to the full map (which clusters). The cap
   * is applied AFTER sorting, so it's always the most relevant stations.
   */
  maxItems?: number;
}

type Availability = "available" | "low" | "empty";

const AVAIL_COLOR: Record<Availability, string> = {
  // Same palette as the map markers so the two views agree.
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

/** Sort rank: available (2) → low (1) → empty (0). Higher sorts first. */
function tierRank(batteries: number): number {
  if (batteries === 0) return 0;
  if (batteries <= 2) return 1;
  return 2;
}

const DEFAULT_MAX_ITEMS = 6;

/**
 * Station list for the Rider home screen — sits beneath the map preview
 * (hybrid map-on-top + cards-below). Stations with charged batteries are
 * surfaced first (then nearest within a tier), each card leads with the
 * ready-battery count, and the list is capped so a large network degrades to
 * "best few + view all" instead of an infinite scroll.
 */
export default function StationCards({
  stations,
  userLocation,
  onSelectStation,
  onViewAll,
  maxItems = DEFAULT_MAX_ITEMS,
}: StationCardsProps) {
  const { t } = useI18n();

  // Available-first, then nearest. Distance is the in-tier tiebreaker so a
  // close empty station never outranks an available one further away.
  const ordered = useMemo(() => {
    const withDistance = stations.map((s) => {
      const km =
        userLocation && s.lat != null && s.lng != null
          ? haversineKm(userLocation, { lat: s.lat, lng: s.lng })
          : null;
      return { station: s, km };
    });
    withDistance.sort((a, b) => {
      const tier = tierRank(b.station.batteries) - tierRank(a.station.batteries);
      if (tier !== 0) return tier; // available first
      if (a.km == null && b.km == null) return 0;
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km; // nearest first within a tier
    });
    return withDistance;
  }, [stations, userLocation]);

  if (stations.length === 0) return null;

  const visible = ordered.slice(0, maxItems);
  const hidden = ordered.length - visible.length;

  return (
    <div className="rh-stn-list">
      {visible.map(({ station, km }) => (
        <StationCard
          key={station.id}
          station={station}
          distanceKm={km}
          onSelect={() => onSelectStation(station.id)}
          t={t}
        />
      ))}

      {onViewAll && (hidden > 0 || stations.length > 0) && (
        <button type="button" onClick={onViewAll} className="rh-stn-all">
          <MapPin size={14} />
          <span>
            {hidden > 0
              ? t("rider.stationCard.viewAllMore", { count: stations.length }) ||
                `View all ${stations.length} on map`
              : t("rider.stationCard.viewAll") || "View all on map"}
          </span>
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
      className="rh-stn-card"
      style={
        {
          "--c": color,
          "--cbg": `${color}1f`,
        } as React.CSSProperties
      }
    >
      {/* Battery gauge — the hero. Count of swap-ready batteries, colored by
          availability so a glance tells the rider where to go. */}
      <span className="rh-stn-gauge" aria-hidden="true">
        <Zap size={14} className="rh-stn-gauge__icon" />
        <span className="rh-stn-gauge__num">{station.batteries}</span>
      </span>

      <span className="rh-stn-body">
        <span className="rh-stn-name">{station.name}</span>

        <span className="rh-stn-meta">
          <span className="rh-stn-avail">{availLabel}</span>
          {site && (
            <>
              <span className="rh-stn-sep">·</span>
              <span
                className="rh-stn-open"
                style={openState ? { color: openStateColor(openState) } : undefined}
              >
                {openState ? openStateLabel(openState, t) : `${site.open}–${site.close}`}
              </span>
            </>
          )}
          {distanceKm != null && (
            <>
              <span className="rh-stn-sep">·</span>
              <span className="rh-stn-dist">{formatDistance(distanceKm)}</span>
            </>
          )}
        </span>

        <span className="rh-stn-sub">
          {station.rcuSn && <span className="rh-stn-sn">{station.rcuSn}</span>}
          {charging > 0 && (
            <span className="rh-stn-charging">
              <BatteryCharging size={12} />
              {t("rider.stationCard.chargingCount", { count: charging }) ||
                `${charging} charging`}
            </span>
          )}
        </span>
      </span>

      <ChevronRight size={18} className="rh-stn-chev" aria-hidden="true" />
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
