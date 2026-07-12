"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Zap,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Lock,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useGeolocation } from "../hooks/useGeolocation";
import type { RiderStation } from "../types";
import type { RiderBatteryStatus } from "../hooks/useRiderBattery";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import StationCards from "./StationCards";

// Google Maps is client-only; load dynamically to avoid SSR errors and reuse
// the same component used by the full-screen Stations screen.
const RiderMap = dynamic(() => import("../map/RiderMap"), { ssr: false });

interface Station {
  id: number;
  name: string;
  rcuSn?: string;
  distance: string;
  batteries: number;
  charging?: number;
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
  /** Remaining energy in kWh — shown as the headline value of the balance row. */
  energyKwh?: number;
  currency?: string;
  /** Active subscription code (e.g. SUB-XXXX). Shown in the bike card so the
   *  rider always knows which plan the displayed data belongs to. */
  subscriptionCode?: string | null;
  bike: BikeInfo;
  nearbyStations: Station[];
  isLoadingStations?: boolean;
  isLoadingBike?: boolean;
  /** Charge state of the rider's own battery (cloud avatar or last slot
   *  sighting); null when neither source has ever reported it. */
  batteryStatus?: RiderBatteryStatus | null;
  /** Opaque error code from the page-level stations pipeline; truthy = fetch failed. */
  stationsError?: string | null;
  /** Whether the rider actually has an active subscription; drives the empty-state copy. */
  hasSubscription?: boolean;
  /** Trigger a manual re-run of the MQTT → GraphQL stations fetch. */
  onRefreshStations?: () => void;
  onShowQRCode: () => void;
  onShowEnergyTopUp?: () => void;
  onSelectStation: (stationId: number) => void;
  onViewAllStations: () => void;
}

const RiderHome: React.FC<RiderHomeProps> = ({
  userName,
  balance,
  energyKwh = 0,
  currency = "",
  subscriptionCode,
  bike,
  nearbyStations,
  isLoadingStations = false,
  isLoadingBike = false,
  batteryStatus = null,
  stationsError = null,
  hasSubscription = true,
  onRefreshStations,
  onShowQRCode,
  onShowEnergyTopUp,
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

  const energyDisplay = energyKwh.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });

  // "Updated 5 min ago" stamp for the battery reading. Telemetry arrives over
  // the battery's GSM link, so honesty about age matters more than the number
  // itself — a stale 90% is worse than a fresh 40%.
  const formatBatteryAge = (iso: string | null): string | null => {
    if (!iso) return null;
    const ageMs = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 0) return null;
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 1) return t("rider.battJustNow") || "just now";
    if (mins < 60) return `${mins} ${t("rider.battMinAgo") || "min ago"}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t("rider.battHrAgo") || "hr ago"}`;
    return `${Math.floor(hours / 24)} ${t("rider.battDaysAgo") || "d ago"}`;
  };
  const battAge = batteryStatus ? formatBatteryAge(batteryStatus.updatedAt) : null;
  const battSoc = batteryStatus?.socPercent ?? null;
  const battLevel = battSoc == null ? "ok" : battSoc < 20 ? "low" : battSoc < 50 ? "mid" : "ok";
  const energyAriaLabel = isLoadingBike
    ? t("common.loading") || "Loading"
    : `${t("rider.energyRemaining") || "Energy remaining"} ${energyKwh.toLocaleString(
        undefined,
        { maximumFractionDigits: 2 },
      )} kWh`;
  const gaugeStateClass = !hasSubscription
    ? "rh-gauge--locked"
    : isLoadingBike
      ? "rh-gauge--loading"
      : energyKwh === 0
        ? "rh-gauge--empty"
        : "";

  return (
    <div className="rider-screen active rh-screen">
      {/* Greeting */}
      <header
        className="rh-greeting rh-anim-in"
        style={{ ["--rh-delay" as string]: "0ms" } as React.CSSProperties}
      >
        <p className="rh-greeting__hello">{getGreeting()}</p>
        <h1 className="rh-greeting__name">{userName}</h1>
      </header>

      {/* HERO — state-of-charge gauge + primary actions */}
      <section
        className="rh-hero rh-anim-in"
        style={{ ["--rh-delay" as string]: "100ms" } as React.CSSProperties}
        aria-busy={isLoadingBike}
      >
        <div
          className={`rh-gauge ${gaugeStateClass}`.trim()}
          role="img"
          aria-label={
            !hasSubscription
              ? t("rider.noSubscription") || "No active subscription"
              : energyAriaLabel
          }
        >
          <svg className="rh-gauge__svg" viewBox="0 0 200 200" aria-hidden="true">
            <circle
              className="rh-gauge__track"
              cx="100"
              cy="100"
              r="86"
              pathLength={100}
            />
            {hasSubscription && (
              <circle
                className="rh-gauge__ring"
                cx="100"
                cy="100"
                r="86"
                pathLength={100}
              />
            )}
          </svg>
          <div className="rh-gauge__inner">
            {!hasSubscription ? (
              <>
                <Lock className="rh-gauge__lock" size={22} aria-hidden="true" />
                <span className="rh-gauge__sub">
                  {t("rider.pickPlanShort") || "Pick a plan to ride"}
                </span>
              </>
            ) : isLoadingBike ? (
              <span className="rider-skeleton rh-gauge__skeleton" />
            ) : (
              <>
                <span className="rh-gauge__value">{energyDisplay}</span>
                <span className="rh-gauge__unit">kWh</span>
                <span className="rh-gauge__sub">
                  ≈ {currency ? `${currency} ` : ""}
                  {balance.toLocaleString()}
                </span>
                {energyKwh === 0 && (
                  <span className="rh-gauge__caption">
                    {t("rider.topUpToRide") || "Top up to ride"}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="rh-hero__cta">
          {onShowEnergyTopUp && (
            <button
              type="button"
              className="rh-cta rh-cta--primary"
              onClick={onShowEnergyTopUp}
            >
              <Zap size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>{t("rider.topUp") || "Top Up"}</span>
            </button>
          )}
          <button
            type="button"
            className="rh-cta rh-cta--ghost"
            onClick={onShowQRCode}
          >
            <svg
              className="rh-cta__icon"
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
            <span>{t("rider.myQrCode") || "My QR"}</span>
          </button>
        </div>
      </section>

      {/* BIKE strip — demoted metadata. Hidden when there's no subscription. */}
      {hasSubscription && (
        <section
          className="rh-bike rh-anim-in"
          style={{ ["--rh-delay" as string]: "250ms" } as React.CSSProperties}
        >
          <div className="rh-bike__head">
            <div className="rh-bike__img">
              <Image
                src={bike.imageUrl || "/assets/E-3-one.png"}
                alt={bike.model}
                width={56}
                height={40}
                style={{ objectFit: "contain" }}
              />
            </div>
            <div className="rh-bike__title">
              <p className="rh-bike__model">{bike.model}</p>
              <p className="rh-bike__sub">
                {isLoadingBike
                  ? "—"
                  : subscriptionCode ||
                    (t("common.notAssigned") || "Not assigned")}
              </p>
            </div>
            <span
              className={`rh-bike__pill rh-bike__pill--${getPaymentStateClass(
                bike.paymentState,
              )}`}
            >
              {getPaymentStateLabel(bike.paymentState)}
            </span>
          </div>
          <dl className="rh-bike__grid">
            <div className="rh-bike__cell">
              <dt>{t("rider.vehicleId") || "Vehicle"}</dt>
              <dd>
                {isLoadingBike ? (
                  <span className="rider-skeleton rider-skeleton-value" />
                ) : (
                  bike.vehicleId || "—"
                )}
              </dd>
            </div>
            <div className="rh-bike__cell">
              <dt>{t("rider.batteryId") || "Battery"}</dt>
              <dd>
                {isLoadingBike ? (
                  <span className="rider-skeleton rider-skeleton-value" />
                ) : (
                  bike.currentBatteryId || "—"
                )}
              </dd>
            </div>
            <div className="rh-bike__cell">
              <dt>{t("rider.totalSwaps") || "Swaps"}</dt>
              <dd>
                {isLoadingBike ? (
                  <span className="rider-skeleton rider-skeleton-value rider-skeleton-value-sm" />
                ) : (
                  bike.totalSwaps
                )}
              </dd>
            </div>
            <div className="rh-bike__cell">
              <dt>{t("rider.lastSwap") || "Last swap"}</dt>
              <dd>
                {isLoadingBike ? (
                  <span className="rider-skeleton rider-skeleton-value" />
                ) : (
                  bike.lastSwap || "—"
                )}
              </dd>
            </div>
          </dl>

          {/* Battery charge — rendered only once some source (cloud avatar or
              station slot) has actually reported this battery. Follows the
              NIU/Gogoro convention: charge shown ON a battery glyph, with
              percentage, energy and estimated range beside it. */}
          {battSoc != null && (
            <div
              className="rh-batt"
              role="group"
              aria-label={`${t("rider.batteryCharge") || "Battery charge"} ${battSoc}%`}
            >
              <div className="rh-batt__row">
                <span className="rh-batt__icon" data-level={battLevel} aria-hidden="true">
                  <span
                    className="rh-batt__icon-fill"
                    style={{ width: `${Math.max(6, Math.min(100, battSoc))}%` }}
                  />
                </span>
                <span className="rh-batt__pct" data-level={battLevel}>
                  {battSoc}%
                </span>
                {batteryStatus?.energyKwh != null && (
                  <span className="rh-batt__stat">
                    {batteryStatus.energyKwh.toFixed(2)} kWh
                  </span>
                )}
                {batteryStatus?.rangeKm != null && (
                  <span className="rh-batt__stat">
                    ≈ {batteryStatus.rangeKm} km
                  </span>
                )}
                <span className="rh-batt__meta">
                  {batteryStatus?.source === "station"
                    ? `${t("rider.battAtLastDock") || "at last dock"}${battAge ? ` · ${battAge}` : ""}`
                    : battAge || ""}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* STATIONS — wrapper adds entrance animation; inner markup preserved */}
      <section
        className="rh-stations rh-anim-in"
        style={{ ["--rh-delay" as string]: "450ms" } as React.CSSProperties}
      >
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

      {showLoadingSkeleton ? (
        /* Stations are still being fetched — show a map-shaped skeleton so
           the rider understands data is still arriving rather than seeing
           an empty map. Capped at `LOAD_TIMEOUT_MS` (see useEffect above)
           so a wedged MQTT pipeline can't pin us here forever. */
        <div className="rider-stations-skeleton">
          <div className="rider-skeleton rider-skeleton-map" />
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

          {/* Station cards — proximity-sorted list beneath the map (hybrid
              map-on-top + cards-below pattern). Each card leads with the
              availability-colored ready-battery count, then charging count,
              distance, and an open/closed badge from the hard-coded hours.
              Tapping a card opens the full Stations map on that station. */}
          {nearbyStations.length > 0 && (
            <StationCards
              stations={nearbyStations}
              userLocation={userLocation}
              onSelectStation={onSelectStation}
              onViewAll={onViewAllStations}
            />
          )}

          {!hasSubscription && nearbyStations.length === 0 ? (
            /* Without an active subscription the rider can't use stations,
               but we still show the map (user location or half-world view)
               so the empty state isn't tied to a hard-coded city. */
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
          ) : nearbyStations.length === 0 && stationsError ? (
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
                  className="rh-mini-cta"
                  style={{ flexShrink: 0 }}
                >
                  <RefreshCw size={12} />
                  <span>{t("rider.directions.retry") || "Retry"}</span>
                </button>
              )}
            </div>
          ) : null}
          {/* When stations resolve successfully (or are simply empty), the
              map itself carries all per-station info — the bolt-pill markers
              encode battery count + availability color, and the in-map
              "no stations" badge above explains an empty result. The legacy
              station carousel was retired so the map can breathe. Tapping
              anywhere on the preview hands the rider off to the full
              Stations screen for names, distances, and navigation. */}
        </div>
      )}
      </section>
    </div>
  );
};

export default RiderHome;
