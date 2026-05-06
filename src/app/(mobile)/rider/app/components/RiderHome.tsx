"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Zap,
  Navigation,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { toast } from "react-hot-toast";
import { useGeolocation, haversineKm, formatDistance } from "../hooks/useGeolocation";
import type { RiderStation } from "../types";
import { googleMapsUrl, openExternalMap } from "../map/deepLinks";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Google Maps is client-only; load dynamically to avoid SSR errors and reuse
// the same component used by the full-screen Stations screen.
const RiderMap = dynamic(() => import("../map/RiderMap"), { ssr: false });

interface Station {
  id: number;
  name: string;
  distance: string;
  batteries: number;
  lat?: number;
  lng?: number;
}

interface BikeInfo {
  model: string;
  vehicleId: string | null;
  totalSwaps: number;
  lastSwap: string | null;
  paymentState: "PAID" | "RENEWAL_DUE" | "OVERDUE" | "PENDING" | string;
  currentBatteryId?: string;
  imageUrl?: string;
}

interface RiderHomeProps {
  userName: string;
  balance: number;
  currency?: string;
  bike: BikeInfo;
  nearbyStations: Station[];
  isLoadingStations?: boolean;
  isLoadingBike?: boolean;
  /** Opaque error code from the page-level stations pipeline; truthy = fetch failed. */
  stationsError?: string | null;
  /** Whether the rider actually has an active subscription; drives the empty-state copy. */
  hasSubscription?: boolean;
  /** Trigger a manual re-run of the MQTT → GraphQL stations fetch. */
  onRefreshStations?: () => void;
  onFindStation: () => void;
  onShowQRCode: () => void;
  onSelectStation: (stationId: number) => void;
  onViewAllStations: () => void;
}

const RiderHome: React.FC<RiderHomeProps> = ({
  userName,
  balance,
  currency = "",
  bike,
  nearbyStations,
  isLoadingStations = false,
  isLoadingBike = false,
  stationsError = null,
  hasSubscription = true,
  onRefreshStations,
  onFindStation,
  onShowQRCode,
  onSelectStation,
  onViewAllStations,
}) => {
  const { t } = useI18n();
  const { location: userLocation } = useGeolocation();

  /**
   * "Loading forever" safety net. The stations pipeline (MQTT → fleet IDs →
   * GraphQL) can get stuck if the MQTT bridge never responds. Rather than
   * pin the user on a spinner indefinitely, we give loading a hard ceiling:
   * after `LOAD_TIMEOUT_MS`, we treat the stations as "settled, empty" and
   * fall through to rendering the map with a "no stations found" indicator.
   * A real refresh resets the timer.
   */
  const LOAD_TIMEOUT_MS = 10_000;
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoadingStations || nearbyStations.length > 0) {
      setLoadTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setLoadTimedOut(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [isLoadingStations, nearbyStations.length]);

  /** True only while we're *genuinely* waiting for the first stations response.
   *  Timed-out loads collapse to "done, but empty" so the UI can render a map. */
  const showLoadingSkeleton =
    isLoadingStations && nearbyStations.length === 0 && !loadTimedOut;

  const stationsWithDistance = useMemo(() => {
    return nearbyStations.map((station) => {
      if (!userLocation || station.lat == null || station.lng == null) {
        return { ...station, calculatedDistance: null as string | null };
      }
      const km = haversineKm(userLocation, {
        lat: station.lat,
        lng: station.lng,
      });
      return { ...station, calculatedDistance: formatDistance(km) };
    });
  }, [nearbyStations, userLocation]);

  // Plot the *entire* list of nearby stations — same source of truth as the
  // full Stations screen so the two maps can never disagree. The underlying
  // `RiderMap` handles crowding via marker clustering.
  const mapStations: RiderStation[] = useMemo(
    () =>
      nearbyStations.map((s) => ({
        id: s.id,
        name: s.name,
        address: "",
        distance: s.distance,
        batteries: s.batteries,
        waitTime: "~5 min",
        lat: s.lat,
        lng: s.lng,
      })),
    [nearbyStations],
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("rider.goodMorning") || "Good morning,";
    if (hour < 17) return t("rider.goodAfternoon") || "Good afternoon,";
    return t("rider.goodEvening") || "Good evening,";
  };

  const getPaymentStateClass = (paymentState: string): string => {
    switch (paymentState) {
      case "PAID":
      case "active":
        return "active";
      case "RENEWAL_DUE":
        return "warning";
      case "OVERDUE":
      case "inactive":
        return "inactive";
      case "PENDING":
        return "pending";
      default:
        return "active";
    }
  };

  const getPaymentStateLabel = (paymentState: string): string => {
    switch (paymentState) {
      case "PAID":
      case "active":
        return t("common.active") || "Active";
      case "RENEWAL_DUE":
        return t("attendant.renewalDue") || "Renewal Due";
      case "OVERDUE":
      case "inactive":
        return t("attendant.overdue") || "Overdue";
      case "PENDING":
        return t("common.pending") || "Pending";
      default:
        return paymentState === "active"
          ? t("common.active") || "Active"
          : paymentState;
    }
  };

  const handleStationClick = (station: Station) => {
    onSelectStation(station.id);
  };

  const handleNavigate = (station: Station, e: React.MouseEvent) => {
    e.stopPropagation();
    if (station.lat == null || station.lng == null) {
      toast.error(
        t("rider.stationLocationMissing") || "Station location is missing.",
      );
      return;
    }
    openExternalMap(
      googleMapsUrl({ lat: station.lat, lng: station.lng }, station.name),
      (msg) => toast.error(msg),
    );
  };

  return (
    <div className="rider-screen active">
      {/* Dashboard Header */}
      <div className="rider-dashboard-header">
        <div className="rider-greeting">{getGreeting()}</div>
        <div className="rider-name">{userName}</div>
      </div>

      {/* My Bike Card (includes Account Balance) */}
      <div className="rider-bike-card">
        <div className="rider-bike-header">
          <div>
            <div className="rider-bike-label">
              {t("rider.myBike") || "My Bike"}
            </div>
          </div>
          <span
            className={`rider-bike-status ${getPaymentStateClass(
              bike.paymentState,
            )}`}
          >
            {getPaymentStateLabel(bike.paymentState)}
          </span>
        </div>
        <div className="rider-bike-content">
          <div className="rider-bike-image">
            <Image
              src={bike.imageUrl || "/assets/E-3-one.png"}
              alt={bike.model}
              width={140}
              height={100}
              style={{ objectFit: "contain" }}
            />
          </div>
          <div className="rider-bike-info">
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">
                {t("rider.vehicleId") || "Vehicle ID"}
              </span>
              {isLoadingBike ? (
                <span className="rider-skeleton rider-skeleton-value" />
              ) : (
                <span className="rider-bike-detail-value">
                  {bike.vehicleId || "N/A"}
                </span>
              )}
            </div>
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">
                {t("rider.lastSwap") || "Last Swap"}
              </span>
              {isLoadingBike ? (
                <span className="rider-skeleton rider-skeleton-value" />
              ) : (
                <span className="rider-bike-detail-value">
                  {bike.lastSwap || "N/A"}
                </span>
              )}
            </div>
            <div className="rider-bike-detail">
              <span className="rider-bike-detail-label">
                {t("rider.totalSwaps") || "Total Swaps"}
              </span>
              {isLoadingBike ? (
                <span className="rider-skeleton rider-skeleton-value rider-skeleton-value-sm" />
              ) : (
                <span className="rider-bike-detail-value">
                  {bike.totalSwaps}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Account Balance - integrated into the bike card */}
        <div className="rider-bike-balance">
          <div className="rider-bike-balance-label-row">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
            </svg>
            <span>{t("rider.accountBalance") || "Account Balance"}</span>
          </div>
          {isLoadingBike ? (
            <span className="rider-skeleton rider-skeleton-balance" />
          ) : (
            <div className="rider-bike-balance-value">
              <span className="rider-bike-balance-currency">{currency}</span>
              <span className="rider-bike-balance-amount">
                {balance.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions - compact action pills */}
      <div className="rider-quick-pills">
        <button
          type="button"
          className="rider-quick-pill"
          onClick={onFindStation}
        >
          <span className="rider-quick-pill-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="rider-quick-pill-label">
            {t("rider.findStation") || "Find Station"}
          </span>
          <svg
            className="rider-quick-pill-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button
          type="button"
          className="rider-quick-pill"
          onClick={onShowQRCode}
        >
          <span className="rider-quick-pill-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </span>
          <span className="rider-quick-pill-label">
            {t("rider.myQrCode") || "My QR Code"}
          </span>
          <svg
            className="rider-quick-pill-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Nearby Stations Section */}
      <div className="rider-section-header">
        <span className="rider-section-title">
          {t("rider.nearbyStations") || "Nearby Stations"}
        </span>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          {onRefreshStations && (
            <button
              type="button"
              onClick={onRefreshStations}
              disabled={isLoadingStations}
              aria-label={t("common.refresh") || "Refresh"}
              title={t("common.refresh") || "Refresh"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                cursor: isLoadingStations ? "not-allowed" : "pointer",
                opacity: isLoadingStations ? 0.5 : 1,
                transition: "all 0.15s ease",
              }}
            >
              <RefreshCw
                size={14}
                style={
                  isLoadingStations
                    ? { animation: "spin 1s linear infinite" }
                    : undefined
                }
              />
            </button>
          )}
        </div>
      </div>

      {!hasSubscription && nearbyStations.length === 0 ? (
        /* Hard stop: without an active subscription the rider can't use the
           app at all, so there's nothing useful to show on a map. Keep the
           old full-bleed "subscribe first" card here. */
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "24px 20px",
            textAlign: "center",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "var(--bg-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: "30px",
                height: "30px",
                color: "var(--text-muted)",
              }}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-muted)",
              lineHeight: "1.5",
              margin: 0,
            }}
          >
            {t("rider.noStationsDesc") ||
              "You need an active subscription to view available swap stations. Please subscribe to a plan to access stations."}
          </p>
        </div>
      ) : showLoadingSkeleton ? (
        /* Stations are legitimately still being fetched. Show a skeleton in
           place of BOTH the map and the carousel so the rider understands
           we're still gathering data, instead of staring at an empty map.
           Capped at `LOAD_TIMEOUT_MS` (see useEffect above) so a wedged
           MQTT pipeline can't pin us here forever. */
        <div className="rider-stations-skeleton">
          <div className="rider-skeleton rider-skeleton-map" />
          <div className="rider-stations-skeleton-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rider-skeleton-station">
                <div className="rider-skeleton rider-skeleton-station-icon" />
                <div className="rider-skeleton-station-body">
                  <div className="rider-skeleton rider-skeleton-station-name" />
                  <div className="rider-skeleton rider-skeleton-station-meta" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Stations have settled — either with data, without data (empty),
           with an error, or the load timed out. In all cases we render the
           actual map; the section below it clarifies what happened to the
           stations list specifically. */
        <div className="rm-home-stations">
          <div
            className="rm-home-map"
            aria-label={t("rider.viewMap") || "View Map"}
          >
            <ErrorBoundary fallback={
              <div className="rm-home-map-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <AlertCircle size={16} style={{ marginRight: 6 }} />
                <span>{t("rider.map.loadError") || "Map unavailable"}</span>
              </div>
            }>
              <RiderMap
                stations={mapStations}
                userLocation={userLocation}
                selectedStationId={null}
                onSelectStation={(id) => id != null && onSelectStation(id)}
                preview
                onPreviewClick={onViewAllStations}
              />
            </ErrorBoundary>
            <div className="rm-home-map-cta">
              <span>{t("rider.map.openFullMap") || "Open full map"}</span>
              <ChevronRight size={14} />
            </div>

            {/* In-map "no stations" badge — sits over the top of the preview
                so the rider immediately understands the map is empty *on
                purpose*, not because it's still loading. */}
            {nearbyStations.length === 0 && !stationsError && (
              <div className="rm-home-map-empty-badge">
                <AlertCircle size={14} />
                <span>
                  {t("rider.noStationsFoundShort") || "No stations found"}
                </span>
              </div>
            )}
          </div>

          {nearbyStations.length === 0 && stationsError ? (
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "16px 14px",
                textAlign: "center",
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
              role="alert"
            >
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: "0 0 2px",
                  }}
                >
                  {t("rider.stations.loadError") || "Couldn't load stations"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: 0,
                  }}
                >
                  {t("rider.stations.loadErrorHint") ||
                    "Check your connection and try again."}
                </p>
              </div>
              {onRefreshStations && (
                <button
                  type="button"
                  onClick={onRefreshStations}
                  className="rider-quick-pill"
                  style={{
                    display: "inline-flex",
                    width: "auto",
                    margin: 0,
                    padding: "6px 12px",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <RefreshCw size={12} />
                  <span className="rider-quick-pill-label">
                    {t("rider.directions.retry") || "Retry"}
                  </span>
                </button>
              )}
            </div>
          ) : nearbyStations.length === 0 ? (
            <div
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 16px",
                textAlign: "center",
                marginTop: "12px",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  lineHeight: "1.5",
                  margin: 0,
                }}
              >
                {t("rider.noStationsFound") ||
                  "No stations found. Please check your subscription configuration."}
              </p>
              {onRefreshStations && (
                <button
                  type="button"
                  onClick={onRefreshStations}
                  className="rider-quick-pill"
                  style={{
                    display: "inline-flex",
                    width: "auto",
                    margin: "10px auto 0",
                    padding: "6px 14px",
                    gap: 6,
                  }}
                >
                  <RefreshCw size={12} />
                  <span className="rider-quick-pill-label">
                    {t("common.refresh") || "Refresh"}
                  </span>
                </button>
              )}
            </div>
          ) : (
            /* Horizontal carousel — same card as full-screen peek */
            <div className="rm-carousel rm-carousel--home">
            {stationsWithDistance.slice(0, 6).map((station) => {
              const status =
                station.batteries === 0
                  ? "empty"
                  : station.batteries <= 2
                    ? "low"
                    : "available";
              return (
                <div
                  key={station.id}
                  className="rm-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleStationClick(station)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleStationClick(station);
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
                      {(station.calculatedDistance || station.distance) && (
                        <>
                          <span className="rm-card-dot" />
                          {/* Straight-line (haversine) distance + pace-based
                              ETA label. Real routing distance/ETA only
                              appears on the full stations screen once the
                              rider picks a destination, so we mark these as
                              estimates here to avoid raising expectations. */}
                          <span>
                            {station.calculatedDistance || station.distance}
                            {station.calculatedDistance ? " (est.)" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="rm-card-cta"
                    onClick={(e) => handleNavigate(station, e)}
                    aria-label={t("rider.map.navigate") || "Navigate"}
                  >
                    <Navigation size={16} />
                  </button>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RiderHome;
