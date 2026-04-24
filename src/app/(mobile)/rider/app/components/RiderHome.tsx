"use client";

import React, { useMemo } from "react";
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
  currency = "XOF",
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

      {nearbyStations.length === 0 && isLoadingStations ? (
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
      ) : nearbyStations.length === 0 && stationsError ? (
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 18px",
            textAlign: "center",
            marginTop: "12px",
          }}
          role="alert"
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              margin: "0 auto 14px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertCircle size={24} color="#ef4444" />
          </div>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 4px",
            }}
          >
            {t("rider.stations.loadError") || "Couldn't load stations"}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              lineHeight: "1.5",
              margin: "0 0 14px",
            }}
          >
            {t("rider.stations.loadErrorHint") ||
              "Check your connection and try again."}
          </p>
          {onRefreshStations && (
            <button
              type="button"
              onClick={onRefreshStations}
              className="rider-quick-pill"
              style={{
                display: "inline-flex",
                width: "auto",
                margin: 0,
                padding: "8px 16px",
                gap: 8,
              }}
            >
              <RefreshCw size={14} />
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
            {hasSubscription
              ? t("rider.noStationsFound") ||
                "No stations found. Please check your subscription configuration."
              : t("rider.noStationsDesc") ||
                "You need an active subscription to view available swap stations. Please subscribe to a plan to access stations."}
          </p>
          {hasSubscription && onRefreshStations && (
            <button
              type="button"
              onClick={onRefreshStations}
              className="rider-quick-pill"
              style={{
                display: "inline-flex",
                width: "auto",
                margin: "14px auto 0",
                padding: "8px 16px",
                gap: 8,
              }}
            >
              <RefreshCw size={14} />
              <span className="rider-quick-pill-label">
                {t("common.refresh") || "Refresh"}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="rm-home-stations">
          {/* Map preview (Google Maps) */}
          <div
            className="rm-home-map"
            onClick={onViewAllStations}
            role="button"
            tabIndex={0}
            aria-label={t("rider.viewMap") || "View Map"}
          >
            <RiderMap
              stations={mapStations}
              userLocation={userLocation}
              selectedStationId={null}
              onSelectStation={(id) => id != null && onSelectStation(id)}
              preview
            />
            <div className="rm-home-map-cta">
              <span>{t("rider.map.openFullMap") || "Open full map"}</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Horizontal carousel — same card as full-screen peek */}
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
                          <span>{station.calculatedDistance || station.distance}</span>
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
        </div>
      )}
    </div>
  );
};

export default RiderHome;
