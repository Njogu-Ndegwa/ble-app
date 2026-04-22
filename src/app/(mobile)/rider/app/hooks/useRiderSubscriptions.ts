"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RiderSubscription } from '../types';

const API_BASE = 'https://crm-omnivoltaic.odoo.com/api';
const API_KEY = 'abs_connector_secret_key_2024';
const ACTIVE_CODE_STORAGE_KEY = 'activeSubscriptionCode_rider';

/**
 * Fetches the rider's subscriptions and tracks the currently active one.
 *
 * The "active" subscription is persisted to localStorage (same key the old
 * serviceplan1 shell used) so users don't lose their selection while we ship
 * the new flow.
 *
 * Selection rule when no saved code: first `active` subscription, else first.
 */
export function useRiderSubscriptions(partnerId: number | undefined, token: string | null) {
  const [subscriptions, setSubscriptions] = useState<RiderSubscription[]>([]);
  const [activeCode, setActiveCodeState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  const setActiveCode = useCallback((code: string | null) => {
    setActiveCodeState(code);
    try {
      if (code) localStorage.setItem(ACTIVE_CODE_STORAGE_KEY, code);
      else localStorage.removeItem(ACTIVE_CODE_STORAGE_KEY);
    } catch (err) {
      console.warn('[useRiderSubscriptions] Failed to persist active code:', err);
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    if (!partnerId || !token) return;

    const key = `${partnerId}:${token.slice(0, 8)}`;
    if (lastFetchKeyRef.current === key && subscriptions.length > 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/customers/${partnerId}/subscriptions?page=1&limit=20`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': API_KEY,
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !Array.isArray(data.subscriptions)) {
        setSubscriptions([]);
        return;
      }
      const list: RiderSubscription[] = data.subscriptions;
      setSubscriptions(list);
      lastFetchKeyRef.current = key;

      const saved = (() => {
        try {
          return localStorage.getItem(ACTIVE_CODE_STORAGE_KEY);
        } catch {
          return null;
        }
      })();
      const preferred =
        (saved && list.find((s) => s.subscription_code === saved)) ||
        list.find((s) => s.status === 'active') ||
        list[0] ||
        null;
      setActiveCode(preferred?.subscription_code ?? null);
    } catch (err: any) {
      console.error('[useRiderSubscriptions] fetch error:', err);
      setError(err?.message || 'Failed to load subscriptions');
    } finally {
      setIsLoading(false);
    }
  }, [partnerId, token, subscriptions.length, setActiveCode]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const activeSubscription =
    subscriptions.find((s) => s.subscription_code === activeCode) || null;

  const switchSubscription = useCallback(
    (code: string) => {
      const match = subscriptions.find((s) => s.subscription_code === code);
      if (!match) return;
      setActiveCode(code);
    },
    [subscriptions, setActiveCode],
  );

  return {
    subscriptions,
    activeSubscription,
    activeCode,
    isLoading,
    error,
    refetch: fetchSubscriptions,
    switchSubscription,
    setActiveCode,
  };
}
