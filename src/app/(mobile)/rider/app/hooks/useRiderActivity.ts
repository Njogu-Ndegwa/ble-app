"use client";

import { useCallback, useEffect, useState } from 'react';
import type { RiderActivityItem } from '../types';

const GRAPHQL_ENDPOINT = 'https://abs-platform-dev.omnivoltaic.com/graphql';

interface UseRiderActivityParams {
  subscriptionCode: string | undefined;
  currency: string;
  enabled: boolean;
  /** Translated label for payment top-ups. */
  tTopUp?: string;
  /** Translated label for subscription payments. */
  tSubPayment?: string;
  /** Translated label for payment fallback. */
  tPayment?: string;
  /** Translated label for battery swap. */
  tBatterySwap?: string;
  /** Translated subtitle for battery swap. */
  tBatterySwapSubtitle?: string;
  /** Translated label for electricity usage. */
  tElectricity?: string;
}

/**
 * Loads the combined payment + service action feed for a subscription and
 * normalizes it into a single `RiderActivityItem[]` sorted by newest first.
 *
 * Exposes `lastSwapAt` so the Home screen can show "Last swap: 3h ago".
 */
export function useRiderActivity(params: UseRiderActivityParams) {
  const {
    subscriptionCode,
    currency,
    enabled,
    tTopUp = 'Balance Top-up',
    tSubPayment = 'Subscription Payment',
    tPayment = 'Payment',
    tBatterySwap = 'Battery Swap',
    tBatterySwapSubtitle = 'Battery swap transaction',
    tElectricity = 'Electricity Usage',
  } = params;

  const [activities, setActivities] = useState<RiderActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSwapAt, setLastSwapAt] = useState<Date | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!enabled || !subscriptionCode) {
      setActivities([]);
      setLastSwapAt(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const query = `
        query {
          servicePlanActions(servicePlanId: "${subscriptionCode}", limit: 20) {
            paymentActions {
              paymentActionId
              paymentType
              paymentAmount
              createdAt
            }
            serviceActions {
              serviceActionId
              serviceType
              serviceAmount
              createdAt
            }
          }
        }
      `;
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json?.data?.servicePlanActions;
      if (!data) {
        setActivities([]);
        setLastSwapAt(null);
        return;
      }

      const items: RiderActivityItem[] = [];
      let latestSwap: Date | null = null;

      (data.paymentActions || []).forEach((a: any) => {
        const d = new Date(a.createdAt);
        const dateStr = d.toISOString().split('T')[0];
        const timeStr = d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const isTopUp = a.paymentType === 'DEPOSIT' || a.paymentType === 'TOPUP';
        const isSub = a.paymentType === 'SUBSCRIPTION_PAYMENT';
        items.push({
          id: a.paymentActionId || `payment-${d.getTime()}`,
          type: 'payment',
          title: isTopUp ? tTopUp : isSub ? tSubPayment : tPayment,
          subtitle: a.paymentType || '',
          amount: Math.abs(a.paymentAmount || 0),
          currency,
          isPositive: isTopUp,
          time: timeStr,
          date: dateStr,
        });
      });

      // Group electricity + swap service actions that occur within 2 min of each
      // other so a single battery swap renders as one unified row.
      const serviceGroups = groupServiceActions(data.serviceActions || []);

      serviceGroups.forEach((group) => {
        const hasElec = group.some((g) =>
          String(g.serviceType || '').includes('electricity')
        );
        const hasSwap = group.some(
          (g) => !String(g.serviceType || '').includes('electricity')
        );

        const d = new Date(group[0].createdAt);
        if (!latestSwap || d > latestSwap) latestSwap = d;
        const dateStr = d.toISOString().split('T')[0];
        const timeStr = d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        if (hasElec && hasSwap && group.length === 2) {
          // Unified battery swap row — show energy, no price.
          const elecAction = group.find((g) =>
            String(g.serviceType || '').includes('electricity')
          )!;
          items.push({
            id: elecAction.serviceActionId || `swap-${d.getTime()}`,
            type: 'swap',
            title: tBatterySwap,
            subtitle: tBatterySwapSubtitle,
            energy: `${elecAction.serviceAmount || 0} kWh`,
            isPositive: false,
            time: timeStr,
            date: dateStr,
          });
        } else {
          // Fallback: render each action individually.
          group.forEach((a) => {
            const isElec = String(a.serviceType || '').includes('electricity');
            items.push({
              id: a.serviceActionId || `service-${d.getTime()}-${Math.random()}`,
              type: 'swap',
              title: isElec ? tElectricity : tBatterySwap,
              subtitle: isElec
                ? `${a.serviceAmount || 0} kWh`
                : tBatterySwapSubtitle,
              isPositive: false,
              time: timeStr,
              date: dateStr,
            });
          });
        }
      });

      items.sort((a, b) => {
        const ta = new Date(`${a.date}T${a.time}`).getTime();
        const tb = new Date(`${b.date}T${b.time}`).getTime();
        return tb - ta;
      });

      setActivities(items);
      setLastSwapAt(latestSwap);
    } catch (err: any) {
      console.error('[useRiderActivity] fetch error:', err);
      setError(err?.message || 'Failed to load activity');
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    enabled,
    subscriptionCode,
    currency,
    tTopUp,
    tSubPayment,
    tPayment,
    tBatterySwap,
    tBatterySwapSubtitle,
    tElectricity,
  ]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activities, isLoading, error, lastSwapAt, refetch: fetchActivity, setActivities };
}

/**
 * Group related service actions (electricity + swap) that happen within a
 * short time window so they can be rendered as a single battery swap event.
 */
export function groupServiceActions(actions: any[]): any[][] {
  const sorted = [...actions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const groups: any[][] = [];

  for (const action of sorted) {
    const actionTime = new Date(action.createdAt).getTime();
    const isElec = String(action.serviceType || '').includes('electricity');

    let added = false;
    for (const group of groups) {
      const groupTime = new Date(group[0].createdAt).getTime();
      const hasElec = group.some((g) =>
        String(g.serviceType || '').includes('electricity')
      );
      const hasSwap = group.some(
        (g) => !String(g.serviceType || '').includes('electricity')
      );

      if (Math.abs(actionTime - groupTime) <= 2 * 60 * 1000) {
        if ((isElec && !hasElec) || (!isElec && !hasSwap)) {
          group.push(action);
          added = true;
          break;
        }
      }
    }

    if (!added) {
      groups.push([action]);
    }
  }

  return groups;
}

/**
 * Helpers for formatting the "last swap" timestamp. Returns a localized
 * string using the provided translator function.
 */
export function formatLastSwap(
  date: Date | null,
  t: (k: string, vars?: Record<string, any>) => string,
): string | null {
  if (!date) return null;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffHours < 1) return t('rider.justNow') || 'Just now';
  if (diffHours < 24) return t('rider.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('rider.yesterday') || 'Yesterday';
  if (diffDays < 7) return t('rider.daysAgo', { count: diffDays });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
