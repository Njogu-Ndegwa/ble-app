"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Average consumption used to turn remaining energy into an estimated range.
 * 40 Wh/km is a conservative figure for a loaded e-motorcycle; tune per
 * vehicle model once real consumption telemetry is available.
 */
export const WH_PER_KM = 40;

export interface RiderBatteryStatus {
  /** State of charge 0-100, from the battery's own report. */
  socPercent: number | null;
  /** Remaining energy in kWh. */
  energyKwh: number | null;
  /** Estimated range in km (energy ÷ WH_PER_KM). */
  rangeKm: number | null;
  /** ISO timestamp of the reading (battery lastSync, or when a slot saw it). */
  updatedAt: string | null;
  /** 'cloud' = battery's own avatar; 'station' = last station-slot sighting. */
  source: 'cloud' | 'station';
}

export function estimateRangeKm(energyKwh: number | null): number | null {
  if (energyKwh == null || !Number.isFinite(energyKwh) || energyKwh <= 0) return null;
  return Math.round((energyKwh * 1000) / WH_PER_KM);
}

const THING_GRAPHQL = 'https://thing-microservice-prod.omnivoltaic.com/graphql';
const POLL_MS = 90_000;

// Public query (no auth) added for the Rider app — returns energy fields only.
const BATTERY_STATUS_QUERY = `
  query GetBatteryEnergyStatus($oemItemId: String!) {
    getBatteryEnergyStatus(oemItemId: $oemItemId) {
      oemItemID
      rsoc
      rcap
      fccp
      pckv
      remainingEnergyWh
      lastSync
    }
  }
`;

interface UseRiderBatteryParams {
  /** The rider's assigned battery (bike.currentBatteryId). */
  batteryId?: string;
  enabled: boolean;
}

/**
 * Live charge state of the rider's own battery from its cloud avatar
 * (thing micro-service). Batteries publish over their built-in GSM link, so
 * this works mid-ride — but only for batteries registered as Items in the
 * thing micro-service. Unregistered batteries resolve to `notFound`; callers
 * should fall back to the last station-slot sighting (RiderApp keeps one).
 */
export function useRiderBattery({ batteryId, enabled }: UseRiderBatteryParams) {
  const [status, setStatus] = useState<RiderBatteryStatus | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lastIdRef = useRef<string | null>(null);

  const fetchStatus = useCallback(async (id: string, cancelled: () => boolean) => {
    setIsLoading(true);
    try {
      const res = await fetch(THING_GRAPHQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: BATTERY_STATUS_QUERY,
          variables: { oemItemId: id },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (cancelled()) return;

      const data = json?.data?.getBatteryEnergyStatus;
      if (data) {
        const soc =
          typeof data.rsoc === 'number' && data.rsoc >= 0 && data.rsoc <= 100
            ? data.rsoc
            : null;
        const energyKwh =
          typeof data.remainingEnergyWh === 'number' && data.remainingEnergyWh >= 0
            ? Math.round(data.remainingEnergyWh / 10) / 100
            : null;
        setStatus({
          socPercent: soc,
          energyKwh,
          rangeKm: estimateRangeKm(energyKwh),
          updatedAt: typeof data.lastSync === 'string' ? data.lastSync : null,
          source: 'cloud',
        });
        setNotFound(false);
        return;
      }

      const firstError: string = json?.errors?.[0]?.message || '';
      if (/not found/i.test(firstError)) {
        // Battery isn't registered as an Item in the thing micro-service yet —
        // expected for much of the fleet; the station-slot fallback covers it.
        setNotFound(true);
        setStatus(null);
      }
      // Other errors: keep the last good reading rather than blanking the UI.
    } catch (err) {
      console.warn('[useRiderBattery] fetch failed:', err);
    } finally {
      if (!cancelled()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !batteryId) return;

    // Reset when the assigned battery changes (e.g. after a swap).
    if (lastIdRef.current !== batteryId) {
      lastIdRef.current = batteryId;
      setStatus(null);
      setNotFound(false);
    }

    let cancelled = false;
    const isCancelled = () => cancelled;

    fetchStatus(batteryId, isCancelled);
    const timer = window.setInterval(() => fetchStatus(batteryId, isCancelled), POLL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchStatus(batteryId, isCancelled);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, batteryId, fetchStatus]);

  return { status, notFound, isLoading };
}
