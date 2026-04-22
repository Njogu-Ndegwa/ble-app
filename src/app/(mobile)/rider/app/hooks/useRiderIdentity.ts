"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { absApolloClient } from '@/lib/apollo-client';
import {
  IDENTIFY_CUSTOMER,
  parseIdentifyCustomerMetadata,
  type IdentifyCustomerInput,
} from '@/lib/graphql/mutations';
import type { RiderBikeInfo } from '../types';

const CACHE_KEY = 'riderIdentificationCacheV1';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface IdentityCache {
  subscriptionCode: string;
  vehicleId: string | null;
  totalSwaps: number;
  paymentState?: string;
  balance: number;
  currency: string;
  cachedAt: number;
}

interface UseRiderIdentityResult {
  bike: RiderBikeInfo;
  balance: number;
  currency: string;
  isLoading: boolean;
  refetch: () => void;
  setBike: React.Dispatch<React.SetStateAction<RiderBikeInfo>>;
}

const initialBike: RiderBikeInfo = {
  model: 'E-Trike 3X',
  vehicleId: null,
  totalSwaps: 0,
  lastSwap: null,
  paymentState: 'PAID',
};

function readCache(code: string): IdentityCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: IdentityCache = JSON.parse(raw);
    if (parsed.subscriptionCode !== code) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cache: IdentityCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('[useRiderIdentity] cache write failed:', err);
  }
}

/**
 * Fetches the `identifyCustomer` GraphQL mutation and derives the
 * rider's vehicle ID, total swap count, payment state, and energy-based
 * account balance.
 *
 * Cached for 5 minutes in localStorage to make Home load instantly on
 * subsequent opens.
 */
export function useRiderIdentity(subscriptionCode: string | undefined): UseRiderIdentityResult {
  const [bike, setBike] = useState<RiderBikeInfo>(initialBike);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('XOF');
  const [isLoading, setIsLoading] = useState(false);
  const lastCodeRef = useRef<string | null>(null);

  const fetchIdentity = useCallback(async () => {
    if (!subscriptionCode) return;
    if (lastCodeRef.current === subscriptionCode) return;
    lastCodeRef.current = subscriptionCode;

    const cached = readCache(subscriptionCode);
    if (cached) {
      setBalance(cached.balance);
      setCurrency(cached.currency);
      setBike((prev) => ({
        ...prev,
        vehicleId: cached.vehicleId,
        totalSwaps: Math.floor(cached.totalSwaps || 0),
        paymentState: cached.paymentState || prev.paymentState,
      }));
    }

    setIsLoading(true);
    try {
      const correlationId = `rider-app-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const input: IdentifyCustomerInput = {
        plan_id: subscriptionCode,
        correlation_id: correlationId,
        qr_code_data: `RIDER_APP_${subscriptionCode}`,
        attendant_station: 'STATION_001',
      };
      const result = await absApolloClient.mutate<{ identifyCustomer: any }>({
        mutation: IDENTIFY_CUSTOMER,
        variables: { input },
      });
      const resp = result.data?.identifyCustomer;
      if (!resp?.customer_identified) return;

      const metadata = parseIdentifyCustomerMetadata(resp.metadata);
      if (!metadata?.service_plan_data) return;

      const { service_plan_data, service_bundle, common_terms } = metadata;
      const states = service_plan_data.serviceStates || [];

      const assetService = states.find(
        (s: any) => s.service_id === 'service-asset-assignment-access-001',
      );
      const vehicleId = assetService?.current_asset || null;

      let swapService = states.find((s: any) => s.service_id === 'service-swap-count-togo-001');
      if (!swapService) {
        swapService = states.find((s: any) =>
          String(s.service_id || '').toLowerCase().includes('swap-count'),
        );
      }
      const totalSwaps = swapService?.used || 0;

      const energyState = states.find(
        (s: any) =>
          s.service_id?.includes('service-energy') ||
          s.service_id?.includes('service-electricity'),
      );
      const energyDef = service_bundle?.services?.find(
        (svc: any) => svc.serviceId === energyState?.service_id,
      );
      const unitPrice = energyDef?.usageUnitPrice || 0;
      const quota = energyState?.quota || 0;
      const used = energyState?.used || 0;
      const remaining = Math.round((quota - used) * 100) / 100;
      const value = Math.round(remaining * unitPrice);

      const billingCurrency =
        common_terms?.billingCurrency || service_plan_data?.currency || 'XOF';

      setBalance(value);
      setCurrency(billingCurrency);
      setBike((prev) => ({
        ...prev,
        vehicleId,
        totalSwaps: Math.floor(totalSwaps),
        paymentState: service_plan_data.paymentState || prev.paymentState,
      }));

      writeCache({
        subscriptionCode,
        vehicleId,
        totalSwaps: Math.floor(totalSwaps),
        paymentState: service_plan_data.paymentState,
        balance: value,
        currency: billingCurrency,
        cachedAt: Date.now(),
      });
    } catch (err) {
      console.error('[useRiderIdentity] error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [subscriptionCode]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const refetch = useCallback(() => {
    lastCodeRef.current = null;
    fetchIdentity();
  }, [fetchIdentity]);

  return { bike, balance, currency, isLoading, refetch, setBike };
}
