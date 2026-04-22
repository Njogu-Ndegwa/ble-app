"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RiderStation } from '../types';

interface Bridge {
  registerHandler: (name: string, handler: (data: string, cb: (r: any) => void) => void) => void;
  callHandler: (name: string, data: any, cb: (r: string) => void) => void;
}

interface UseRiderStationsParams {
  bridge: Bridge | null;
  subscriptionCode: string | undefined;
  enabled: boolean;
}

/**
 * Fetches nearby swap stations for the active subscription:
 * - Publishes an MQTT request to `call/uxi/service/plan/:plan/get_assets`
 * - Subscribes to the matching `rtrn/...` topic to receive fleet IDs
 * - Queries the fleet micro-service via GraphQL to get station coordinates
 *
 * Exposes `stations`, `isLoading`, `error`, and `refetch`.
 */
export function useRiderStations({ bridge, subscriptionCode, enabled }: UseRiderStationsParams) {
  const [stations, setStations] = useState<RiderStation[]>([]);
  const [fleetIds, setFleetIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastFleetKeyRef = useRef<string | null>(null);
  const lastPlanRef = useRef<string | null>(null);

  // ---- MQTT: request fleet IDs for this plan ----
  useEffect(() => {
    if (!enabled || !subscriptionCode || !bridge) return;
    if (typeof window === 'undefined' || !window.WebViewJavascriptBridge) return;

    // Only re-subscribe when the plan actually changes
    if (lastPlanRef.current === subscriptionCode && fleetIds.length > 0) {
      setIsLoading(false);
      return;
    }
    lastPlanRef.current = subscriptionCode;

    setIsLoading(true);
    setError(null);

    const requestTopic = `call/uxi/service/plan/${subscriptionCode}/get_assets`;
    const responseTopic = `rtrn/abs/service/plan/${subscriptionCode}/get_assets`;
    const correlationId = `asset-discovery-${Date.now()}`;
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const payload = {
      topic: requestTopic,
      qos: 0,
      content: {
        timestamp,
        plan_id: subscriptionCode,
        correlation_id: correlationId,
        actor: { type: 'customer', id: 'CUST-RIDER-001' },
        data: { action: 'GET_REQUIRED_ASSET_IDS', search_radius: 10 },
      },
    };

    // Register handler for MQTT arrivals
    bridge.registerHandler('mqttMsgArrivedCallBack', (data: string, cb: (r: any) => void) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed?.topic !== responseTopic) {
          cb({ success: true });
          return;
        }
        const msg =
          typeof parsed.message === 'string' ? JSON.parse(parsed.message) : parsed.message;
        const ids: string[] | undefined = msg?.data?.metadata?.fleet_ids?.swap_station_fleet;
        if (Array.isArray(ids) && ids.length > 0) {
          setFleetIds(ids);
        } else {
          setFleetIds([]);
          setStations([]);
          setIsLoading(false);
        }
        cb({ success: true });
      } catch (err) {
        console.error('[useRiderStations] MQTT parse error:', err);
        cb({ success: false });
      }
    });

    // Subscribe then publish
    const wvb = window.WebViewJavascriptBridge!;
    wvb.callHandler('mqttSubTopic', { topic: responseTopic, qos: 0 }, (subResp) => {
      try {
        const r = typeof subResp === 'string' ? JSON.parse(subResp) : subResp;
        if (r?.respCode !== '200') {
          setError('MQTT subscribe failed');
          setIsLoading(false);
          return;
        }
        wvb.callHandler('mqttPublishMsg', JSON.stringify(payload), () => {
          /* fire-and-forget; response comes via mqttMsgArrivedCallBack */
        });
      } catch (err) {
        setError('MQTT subscribe failed');
        setIsLoading(false);
      }
    });

    const cleanup = () => {
      // Reset handler to a no-op — the bridge keeps the last handler per name.
      bridge.registerHandler('mqttMsgArrivedCallBack', () => {});
    };
    cleanupRef.current = cleanup;
    return cleanup;
  }, [bridge, subscriptionCode, enabled, fleetIds.length]);

  // ---- GraphQL: fetch station details once fleetIds are known ----
  useEffect(() => {
    if (!enabled || fleetIds.length === 0) return;

    const normalized = [...fleetIds].sort().join('|');
    if (lastFleetKeyRef.current === normalized && stations.length > 0) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const authToken = localStorage.getItem('authToken_rider');
        if (!authToken) {
          setError('missing-auth');
          setIsLoading(false);
          return;
        }

        const query = `
          query GetFleetAvatars($fleetIds: [String!]!) {
            getFleetAvatarsSummary(fleetIds: $fleetIds) {
              fleets {
                fleetId
                items {
                  oemItemID
                  opid
                  updatedAt
                  coordinates { slat slon }
                  Charge_slot { cnum btid chst rsoc reca pckv pckc }
                }
              }
              missingFleetIds
            }
          }
        `;
        const res = await fetch('https://thing-microservice-prod.omnivoltaic.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', access_token: authToken },
          body: JSON.stringify({ query, variables: { fleetIds } }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const fleets = json?.data?.getFleetAvatarsSummary?.fleets;
        if (!Array.isArray(fleets)) {
          if (!cancelled) setStations([]);
          return;
        }
        const parsed: RiderStation[] = [];
        fleets.forEach((fleet: any) => {
          const items = fleet.items || [];
          items.forEach((item: any, idx: number) => {
            const c = item?.coordinates;
            if (!c || typeof c.slat !== 'number' || typeof c.slon !== 'number') return;
            const slots = item.Charge_slot || [];
            const available = slots.filter(
              (s: any) =>
                s?.chst === 0 && s?.btid && String(s.btid).trim() !== '' && s?.rsoc === 100,
            ).length;
            const opid = item.opid || item.oemItemID || '';
            const stationId =
              Math.abs(
                parseInt(fleet.fleetId.slice(-8), 36) +
                  (opid ? parseInt(String(opid).slice(-4), 36) : 0) +
                  idx,
              ) % 100000;
            parsed.push({
              id: stationId,
              name: opid ? `Station ${opid}` : `Swap Station ${idx + 1}`,
              address: `${c.slat.toFixed(4)}, ${c.slon.toFixed(4)}`,
              distance: 'N/A',
              batteries: available,
              batteriesTotal: slots.length || undefined,
              waitTime: '~5 min',
              lat: c.slat,
              lng: c.slon,
              fleetId: fleet.fleetId,
            });
          });
        });
        if (!cancelled) {
          setStations(parsed);
          lastFleetKeyRef.current = normalized;
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[useRiderStations] fetch error:', err);
          setError(err?.message || 'Failed to load stations');
          setStations([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fleetIds, enabled, stations.length]);

  const refetch = useCallback(() => {
    lastFleetKeyRef.current = null;
    lastPlanRef.current = null;
    setFleetIds([]);
    setStations([]);
  }, []);

  return { stations, isLoading, error, refetch };
}
