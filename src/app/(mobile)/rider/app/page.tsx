"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import { Fingerprint } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useBridge } from '@/app/context/bridgeContext';
import { absApolloClient } from '@/lib/apollo-client';
import { buildOdooHeaders } from '@/lib/odoo-api';
import {
  IDENTIFY_CUSTOMER,
  parseIdentifyCustomerMetadata,
  SERVICE_TOPUP,
  GET_REQUIRED_ASSET_IDS,
  parseGetRequiredAssetIdsFleetIds,
  type IdentifyCustomerInput,
  type ServiceTopupInput,
  type ServiceTopupResponse,
  type GetRequiredAssetIdsInput,
  type GetRequiredAssetIdsResponse,
} from '@/lib/graphql/mutations';
import { round } from '@/lib/utils';
import { getStationDisplayName, stationNumericId } from '@/lib/station-names';
import { getOdooEmployeeToken, getStoredServiceAccounts, getActiveSAApplets } from '@/lib/ov-auth';
import {
  RiderNav,
  RiderHome,
  RiderActivity,
  RiderStations,
  RiderProfile,
  RiderPlans,
  RiderTransactions,
  RiderTickets,
  QRCodeModal,
  EnergyTopUpModal,
} from './components';
import type { EnergyTopUpSubmitArgs, EnergyTopUpResult } from './components';
import { SelectSheet, type SelectSheetItem } from '@/components/ui';
import type { ActivityItem, Station } from './components';
import Login from './components/Login';
import { googleMapsUrl, openExternalMap } from './map/deepLinks';
import { groupServiceActions } from './hooks/useRiderActivity';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AppHeader from '@/components/AppHeader';

/**
 * Mount the Google Maps JS provider exactly once for the entire logged-in
 * rider flow. Both `RiderHome` (map preview) and `RiderStations` (full map)
 * render their own `<RiderMap>` instances, but they all share this single
 * provider. Without this hoisting, switching tabs would unmount and remount
 * the provider and the map would sometimes come back blank on the second
 * mount. Dynamically imported + `ssr: false` matches how `RiderMap` itself
 * is loaded elsewhere, so the heavy library still only ships on the client
 * and only after the rider page has mounted.
 */
const RiderMapProvider = dynamic(
  () => import('./map/RiderMap').then((m) => m.RiderMapProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-transparent" style={{ borderTopColor: 'var(--accent)' }} />
      </div>
    ),
  },
);

const ACTIVE_SUBSCRIPTION_CODE_STORAGE_KEY = 'activeSubscriptionCode_rider';

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";
const RIDER_IDENTIFICATION_CACHE_KEY = 'riderIdentificationCacheV1';
const IDENTIFICATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
// Stations + activity caches: short TTL so a stale list never lingers more
// than a couple of minutes, but long enough that re-entering the home screen
// after a quick detour paints instantly.
const RIDER_STATIONS_CACHE_KEY = 'riderStationsCacheV1';
const RIDER_ACTIVITY_CACHE_KEY = 'riderActivityCacheV1';
const STATIONS_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const ACTIVITY_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const LOAD_FAILSAFE_TIMEOUT_MS = 15000;

interface ServiceAccount {
  sa_id: number;
  sa_name: string;
  applets: any[];
  role: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
  service_accounts?: ServiceAccount[];
}

interface BikeInfo {
  model: string;
  vehicleId: string | null;
  totalSwaps: number;
  lastSwap: string | null;
  paymentState: 'PAID' | 'RENEWAL_DUE' | 'OVERDUE' | 'PENDING' | 'active' | 'inactive' | string;
  currentBatteryId?: string;
  imageUrl?: string;
}

interface Subscription {
  id: number;
  subscription_code: string;
  status: string;
  product_id: number;
  product_name: string;
  plan_product_id?: number;
  plan_product_name?: string;
  package_product_id?: number;
  // The physical product name (e.g. "Test Bike", "E-Trike 3X"). Prefer this
  // over `product_name` (which is the energy plan) when displaying what the
  // rider physically owns.
  package_product_name?: string;
  start_date: string;
  next_cycle_date: string;
  price_at_signup: number;
  currency: string;
  cycle_interval: number;
  cycle_unit: string;
}

interface IdentificationCache {
  subscriptionCode: string;
  vehicleId: string | null;
  currentBatteryId?: string;
  totalSwaps: number;
  paymentState?: string;
  balance: number;
  energyKwh: number;
  currency: string;
  cachedAt: number;
}

interface WebViewJavascriptBridge {
  init: (
    callback: (message: any, responseCallback: (response: any) => void) => void
  ) => void;
  registerHandler: (
    handlerName: string,
    handler: (data: string, responseCallback: (response: any) => void) => void
  ) => void;
  callHandler: (
    handlerName: string,
    data: any,
    callback: (responseData: string) => void
  ) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const RiderApp: React.FC = () => {
  const router = useRouter();
  const { t } = useI18n();
  const { bridge } = useBridge();
  const lastStationsFleetKeyRef = useRef<string | null>(null);
  const [fleetIds, setFleetIds] = useState<string[]>([]);
  // Monotonically-incrementing nonce that user-driven retries bump to force
  // the MQTT + GraphQL effects to re-run even when their other dependencies
  // haven't changed (e.g. fleetIds is still []). Without this, pressing
  // "Retry" after a timeout did nothing because no dep in the effect
  // actually changed, so the effect never re-ran. The bug manifested as
  // "Retry does nothing, but backgrounding + foregrounding the app works",
  // because visibilitychange was the only other thing that flipped state.
  const [stationsRetryNonce, setStationsRetryNonce] = useState(0);
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showFoundCustomer, setShowFoundCustomer] = useState(false);
  
  // UI state
  const [currentScreen, setCurrentScreen] = useState<
    | 'home'
    | 'stations'
    | 'activity'
    | 'profile'
    | 'transactions'
    | 'plans'
    | 'tickets'
  >('home');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  
  // Data state
  const [balance, setBalance] = useState(0);
  const [energyKwh, setEnergyKwh] = useState(0);
  const [currency, setCurrency] = useState('');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  // Set whenever any step of the map fetch fails (MQTT timeout, empty fleet,
  // GraphQL error). Cleared on every successful load. Drives the retry/refresh
  // affordance in `RiderHome`.
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [isLoadingBike, setIsLoadingBike] = useState(false);
  const [isBikeDataResolved, setIsBikeDataResolved] = useState(false);
  const [bike, setBike] = useState<BikeInfo>({
    // Empty until the subscription resolves; we then fill from
    // `package_product_name`. Never hardcode a real product name here —
    // it leaks into the UI before data arrives.
    model: '',
    vehicleId: null,
    totalSwaps: 0,
    lastSwap: null,
    paymentState: 'PAID',
    currentBatteryId: undefined,
  });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [showFingerprintPrompt, setShowFingerprintPrompt] = useState(false);
  const [isFingerprintEnabled, setIsFingerprintEnabled] = useState(false);
  const [isEnablingFingerprint, setIsEnablingFingerprint] = useState(false);
  const isEnablingFingerprintRef = useRef(false); // Ref for callback to access current state

  // Check if fingerprint is enabled on mount and when showFoundCustomer changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = localStorage.getItem('fingerprintEnabled_rider') === 'true';
      setIsFingerprintEnabled(enabled);
    }
  }, [showFoundCustomer]);

  // Handle browser back button
  const currentScreenRef = useRef(currentScreen);
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const handlePopState = () => {
      if (currentScreenRef.current !== 'home') {
        setCurrentScreen('home');
      } else {
        router.push('/');
      }
    };

    if (currentScreen !== 'home') {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentScreen, isLoggedIn, router]);

  // Detect direct rider login (single SA with only rider applet) so we can hide
  // the back button — there is no upstream page to return to.
  const isDirectRider = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const accounts = getStoredServiceAccounts();
    const applets = getActiveSAApplets();
    return accounts.length === 1 && applets.length === 1 && applets[0] === 'rider';
  }, []);

  // Custom back handler that mirrors the popstate logic to avoid race conditions
  // between AppHeader's router.back() and the rider's internal screen stack.
  const handleHeaderBack = useCallback(() => {
    if (currentScreenRef.current !== 'home') {
      setCurrentScreen('home');
    } else {
      router.push('/');
    }
  }, [router]);

  // Track if we've started prefetching
  const prefetchStartedRef = useRef(false);
  
  // Check authentication on mount or after logout - show found customer screen if credentials exist
  useEffect(() => {
    // Only run when not logged in (on mount or after logout)
    if (isLoggedIn) return;

    // Safety: always clear the loading state within 5 seconds even if checkAuth hangs
    const fallbackTimer = setTimeout(() => setIsCheckingAuth(false), 5000);
    
    const checkAuth = async () => {
      let showLoginPage = false;
      let prevSessionCrashed = false;

      // Guard all storage reads — some WebViews throw on localStorage access
      try {
        showLoginPage = localStorage.getItem('showLoginPage_rider') === 'true';
        prevSessionCrashed = localStorage.getItem('riderAppCrashed') === 'true';
        if (prevSessionCrashed) localStorage.removeItem('riderAppCrashed');
        if (showLoginPage) localStorage.removeItem('showLoginPage_rider');
      } catch { /* ignore storage errors */ }

      // If user just logged out (showLoginPage flag), or the app crashed last session,
      // show the login page even if credentials exist
      if (showLoginPage || prevSessionCrashed) {
        setIsCheckingAuth(false);
        return;
      }

      // 1. Try unified session first (main-page login)
      try {
        const unifiedToken = getOdooEmployeeToken();
        const rawUser = localStorage.getItem('ov-employee-data');
        if (unifiedToken && rawUser) {
          const user = JSON.parse(rawUser);
          const rawSAs = localStorage.getItem('ov-service-accounts');
          const sArr = rawSAs ? JSON.parse(rawSAs) : [];
          const serviceAccounts = sArr.map((sa: any) => ({
            sa_id: sa.id ?? sa.sa_id,
            sa_name: sa.name ?? sa.sa_name,
            role: sa.my_role ?? sa.role,
            applets: sa.applets || [],
          }));

          const customerData: Customer = {
            id: user.id || 0,
            name: user.name || '',
            email: user.email || '',
            phone: localStorage.getItem('userPhone') || '',
            partner_id: user.partner_id,
            service_accounts: serviceAccounts,
          };

          // Bridge to rider legacy keys so existing code works
          localStorage.setItem('authToken_rider', unifiedToken);
          localStorage.setItem('customerData_rider', JSON.stringify(customerData));

          setCustomer(customerData);
          setIsBikeDataResolved(false);
          setIsLoadingBike(true);
          setIsLoadingStations(true);
          setIsLoggedIn(true);

          if (!prefetchStartedRef.current && customerData.partner_id) {
            prefetchStartedRef.current = true;
            dataLoadStartRef.current = performance.now();
            console.warn('[PERF] 🚀 AUTO-LOGIN (unified) - Starting data load');

            fetchSubscriptionData(customerData.partner_id, unifiedToken);
          }
          setIsCheckingAuth(false);
          return;
        }
      } catch (e) {
        console.error('Error checking unified session:', e);
      }

      // 2. Fallback to legacy rider keys
      let token: string | null = null;
      let storedCustomerData: string | null = null;
      try {
        token = localStorage.getItem('authToken_rider');
        storedCustomerData = localStorage.getItem('customerData_rider');
      } catch { /* ignore */ }

      if (token && storedCustomerData) {
        try {
          const customerData = JSON.parse(storedCustomerData);
          setCustomer(customerData);

          // Auto-login: skip the welcome screen and go directly into the app
          setIsBikeDataResolved(false);
          setIsLoadingBike(true);
          setIsLoadingStations(true);
          setIsLoggedIn(true);

          // Start loading data immediately
          if (!prefetchStartedRef.current && customerData.partner_id) {
            prefetchStartedRef.current = true;
            dataLoadStartRef.current = performance.now();
            console.warn('[PERF] 🚀 AUTO-LOGIN (legacy) - Starting data load');

            fetchSubscriptionData(customerData.partner_id, token);
          }
        } catch (e) {
          console.error('Error parsing stored customer data:', e);
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth().catch(() => setIsCheckingAuth(false));

    return () => clearTimeout(fallbackTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Set loading states immediately when user logs in.
  // IMPORTANT: only depend on [isLoggedIn]. If isBikeDataResolved is in the
  // deps, the effect re-fires when bike data resolves and sets
  // isLoadingStations=true again — but the MQTT/GraphQL effects that clear it
  // don't re-run, so stations get stuck loading forever.
  useEffect(() => {
    if (isLoggedIn) {
      if (!isBikeDataResolved) {
        setIsLoadingBike(true);
      }
      setIsLoadingStations(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Global emergency failsafe: if any loader is stuck for >20 s, force it off.
  // This is a last-resort guard against edge cases where an async effect hangs
  // or a race condition leaves a spinner running forever.
  useEffect(() => {
    if (!isLoggedIn) return;
    const stuckTimer = window.setTimeout(() => {
      if (isLoadingBike || isLoadingStations) {
        console.warn('[RIDER] Emergency failsafe triggered — forcing loaders off');
        setIsLoadingBike(false);
        setIsLoadingStations(false);
      }
    }, 20000);
    return () => window.clearTimeout(stuckTimer);
  }, [isLoggedIn, isLoadingBike, isLoadingStations]);

  // Check if we should show fingerprint prompt after login
  useEffect(() => {
    if (isLoggedIn && typeof window !== 'undefined') {
      const shouldShowPrompt = localStorage.getItem('showFingerprintPrompt_rider') === 'true';
      const fingerprintPref = localStorage.getItem('fingerprintEnabled_rider');
      console.info('[FINGERPRINT] Checking prompt:', { 
        isLoggedIn, 
        shouldShowPrompt, 
        fingerprintPref,
        showFingerprintPromptFlag: localStorage.getItem('showFingerprintPrompt_rider')
      });
      if (shouldShowPrompt) {
        // Clear the flag and show the prompt after a short delay
        localStorage.removeItem('showFingerprintPrompt_rider');
        console.info('[FINGERPRINT] Showing fingerprint enable prompt...');
        setTimeout(() => {
          setShowFingerprintPrompt(true);
        }, 1000); // Show after 1 second to let the UI settle
      }
    }
  }, [isLoggedIn]);

  // Fetch customer identification data to get vehicle ID and total swaps
  const getIdentificationCache = (subscriptionCode: string): IdentificationCache | null => {
    try {
      const rawCache = localStorage.getItem(RIDER_IDENTIFICATION_CACHE_KEY);
      if (!rawCache) return null;

      const parsed: IdentificationCache = JSON.parse(rawCache);
      const isStale = Date.now() - parsed.cachedAt > IDENTIFICATION_CACHE_MAX_AGE_MS;
      if (isStale || parsed.subscriptionCode !== subscriptionCode) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const setIdentificationCache = (cache: IdentificationCache) => {
    try {
      localStorage.setItem(RIDER_IDENTIFICATION_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('[RIDER] Failed to persist identification cache:', error);
    }
  };

  // Stations + activity caches mirror the identification pattern above. They
  // let the home screen paint stations & activity instantly on re-entry, with
  // a silent background refresh once the network resolves. Keys are scoped by
  // subscription_code so switching plans never serves stale data from the
  // previous plan.
  const getStationsCache = (subscriptionCode: string): { stations: Station[] } | null => {
    try {
      const raw = localStorage.getItem(RIDER_STATIONS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        subscriptionCode: string;
        stations: Station[];
        cachedAt: number;
      };
      const isStale = Date.now() - parsed.cachedAt > STATIONS_CACHE_MAX_AGE_MS;
      if (isStale || parsed.subscriptionCode !== subscriptionCode) return null;
      return { stations: parsed.stations };
    } catch {
      return null;
    }
  };

  const setStationsCache = (subscriptionCode: string, stationsToCache: Station[]) => {
    try {
      localStorage.setItem(
        RIDER_STATIONS_CACHE_KEY,
        JSON.stringify({ subscriptionCode, stations: stationsToCache, cachedAt: Date.now() }),
      );
    } catch (error) {
      console.warn('[RIDER] Failed to persist stations cache:', error);
    }
  };

  const hydrateStationsCache = (subscriptionCode: string): boolean => {
    const cached = getStationsCache(subscriptionCode);
    if (!cached || cached.stations.length === 0) return false;
    setStations(cached.stations);
    setIsLoadingStations(false);
    setStationsError(null);
    console.info('[PERF] âš¡ Hydrated rider stations from local cache');
    return true;
  };

  const getActivityCache = (subscriptionCode: string): { activities: ActivityItem[] } | null => {
    try {
      const raw = localStorage.getItem(RIDER_ACTIVITY_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        subscriptionCode: string;
        activities: ActivityItem[];
        cachedAt: number;
      };
      const isStale = Date.now() - parsed.cachedAt > ACTIVITY_CACHE_MAX_AGE_MS;
      if (isStale || parsed.subscriptionCode !== subscriptionCode) return null;
      return { activities: parsed.activities };
    } catch {
      return null;
    }
  };

  const setActivityCache = (subscriptionCode: string, activityToCache: ActivityItem[]) => {
    try {
      localStorage.setItem(
        RIDER_ACTIVITY_CACHE_KEY,
        JSON.stringify({ subscriptionCode, activities: activityToCache, cachedAt: Date.now() }),
      );
    } catch (error) {
      console.warn('[RIDER] Failed to persist activity cache:', error);
    }
  };

  const hydrateActivityCache = (subscriptionCode: string): boolean => {
    const cached = getActivityCache(subscriptionCode);
    if (!cached || cached.activities.length === 0) return false;
    setActivities(cached.activities);
    console.info('[PERF] âš¡ Hydrated rider activity from local cache');
    return true;
  };

  const hydrateIdentificationCache = (subscriptionCode: string): boolean => {
    const cached = getIdentificationCache(subscriptionCode);
    if (!cached) return false;

    setBalance(cached.balance);
    setEnergyKwh(cached.energyKwh || 0);
    setCurrency(cached.currency);
    setBike((prev) => ({
      ...prev,
      vehicleId: cached.vehicleId,
      currentBatteryId: cached.currentBatteryId,
      totalSwaps: Math.floor(cached.totalSwaps || 0),
      paymentState: cached.paymentState || prev.paymentState,
    }));
    setIsBikeDataResolved(true);
    setIsLoadingBike(false);
    console.info('[PERF] âš¡ Hydrated rider identification from local cache');
    return true;
  };

  const fetchCustomerIdentificationData = async (planId: string, options?: { keepLoading?: boolean }) => {
    const keepLoading = options?.keepLoading ?? false;
    const startTime = performance.now();
    const loadingFailSafeTimer = window.setTimeout(() => {
      if (!keepLoading) {
        console.warn('[PERF] â±ï¸ IdentifyCustomer timeout guard triggered, stopping bike loader');
        setIsLoadingBike(false);
      }
    }, LOAD_FAILSAFE_TIMEOUT_MS);
    console.info('[PERF] ðŸ†” IdentifyCustomer GraphQL - Starting...');
    try {
      // Generate unique correlation ID
      const correlationId = `rider-app-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const input: IdentifyCustomerInput = {
        plan_id: planId,
        correlation_id: correlationId,
        qr_code_data: `RIDER_APP_${planId}`, // Placeholder value for rider app
        attendant_station: 'STATION_001', // Default station
      };

      console.info('[RIDER] Fetching customer identification data for plan:', planId);

      const result = await absApolloClient.mutate<{ identifyCustomer: any }>({
        mutation: IDENTIFY_CUSTOMER,
        variables: { input },
      });
      
      const elapsed = Math.round(performance.now() - startTime);
      console.info(`[PERF] ðŸ†” IdentifyCustomer GraphQL - Response received in ${elapsed}ms`);

      if (result.errors && result.errors.length > 0) {
        console.error('[RIDER] GraphQL errors:', result.errors);
        return;
      }

      if (!result.data?.identifyCustomer) {
        console.warn('[RIDER] No response from identifyCustomer mutation');
        return;
      }

      const response = result.data.identifyCustomer;
      console.info('[RIDER] ðŸ” RAW identifyCustomer response:', JSON.stringify(response, null, 2));
      
      if (!response.customer_identified) {
        console.warn('[RIDER] Customer not identified');
        return;
      }

      // Parse metadata
      const metadata = parseIdentifyCustomerMetadata(response.metadata);
      console.info('[RIDER] ðŸ” Parsed metadata:', JSON.stringify(metadata, null, 2));
      
      if (!metadata || !metadata.service_plan_data) {
        console.warn('[RIDER] Invalid metadata or missing service_plan_data');
        return;
      }

      const { service_plan_data, service_bundle, common_terms } = metadata;
      const { serviceStates, paymentState } = service_plan_data;
      console.info('[RIDER] ðŸ” serviceStates:', JSON.stringify(serviceStates, null, 2));

      if (!serviceStates || !Array.isArray(serviceStates)) {
        console.warn('[RIDER] serviceStates is missing or not an array');
        return;
      }

      // Extract vehicle ID from service-asset-assignment-access-001
      const assetAssignmentService = serviceStates.find(
        (service: any) => service.service_id === 'service-asset-assignment-access-001'
      );
      const vehicleId = assetAssignmentService?.current_asset || null;

      // Extract the battery the rider currently holds from service-battery-fleet-*
      // (same `current_asset` convention as the asset-assignment service above).
      const batteryFleetService = serviceStates.find(
        (service: any) => service.service_id?.includes('service-battery-fleet')
      );
      const currentBatteryId = batteryFleetService?.current_asset || undefined;

      // Extract total swaps from service-swap-count-togo-001
      // Fallback: search for any service with "swap-count" in the service_id
      let swapCountService = serviceStates.find(
        (service: any) => service.service_id === 'service-swap-count-togo-001'
      );
      
      if (!swapCountService) {
        // Fallback: find any service with "swap-count" in the ID
        swapCountService = serviceStates.find(
          (service: any) => service.service_id?.toLowerCase().includes('swap-count')
        );
      }
      
      const totalSwaps = swapCountService?.used || 0;

      // Extract energy service to calculate account balance (like attendant flow)
      // Find energy service - check for both "service-energy" and "service-electricity" patterns
      const energyServiceState = serviceStates.find(
        (service: any) => service.service_id?.includes('service-energy') || service.service_id?.includes('service-electricity')
      );

      // Get unit price from service_bundle (enriched service definition)
      const energyServiceDef = service_bundle?.services?.find(
        (svc: any) => svc.serviceId === energyServiceState?.service_id
      );
      const energyUnitPrice = energyServiceDef?.usageUnitPrice || 0;

      // Calculate energy remaining and monetary value (same formula as attendant)
      const energyQuota = energyServiceState?.quota || 0;
      const energyUsed = energyServiceState?.used || 0;
      const energyRemaining = Math.round((energyQuota - energyUsed) * 100) / 100; // Round to 2dp
      const energyValue = Math.round(energyRemaining * energyUnitPrice); // Monetary value

      // Get currency from common_terms (source of truth) or fallback
      const billingCurrency = common_terms?.billingCurrency || service_plan_data?.currency || '';

      // Log account balance calculation details
      console.warn('[RIDER] ðŸ’° ACCOUNT BALANCE CALCULATION:', {
        energyServiceId: energyServiceState?.service_id || 'NOT FOUND',
        energyQuota,
        energyUsed,
        energyRemaining: `${energyRemaining} kWh`,
        energyUnitPrice: `${energyUnitPrice} per kWh`,
        accountBalance: `${billingCurrency} ${energyValue}`,
        formula: `${energyRemaining} kWh Ã— ${energyUnitPrice} = ${energyValue}`,
      });

      console.info('[RIDER] Extracted data:', { 
        vehicleId, 
        totalSwaps, 
        paymentState,
        energyRemaining,
        energyValue,
        energyUnitPrice,
        billingCurrency,
        assetAssignmentServiceFound: !!assetAssignmentService,
        assetAssignmentService: assetAssignmentService,
        swapCountServiceFound: !!swapCountService,
        swapCountServiceId: swapCountService?.service_id,
        energyServiceFound: !!energyServiceState,
        energyServiceId: energyServiceState?.service_id,
        allServiceStates: serviceStates.map((s: any) => ({ service_id: s.service_id, current_asset: s.current_asset }))
      });

      // Update balance with real energy value data
      setBalance(energyValue);
      setEnergyKwh(energyRemaining);
      setCurrency(billingCurrency);

      // Update bike state with real data
      setBike((prev) => {
        const updated = {
          ...prev,
          vehicleId,
          currentBatteryId,
          totalSwaps: Math.floor(totalSwaps), // Ensure it's an integer
          paymentState: paymentState || prev.paymentState,
        };
        const totalElapsed = dataLoadStartRef.current > 0 ? Math.round(performance.now() - dataLoadStartRef.current) : 'N/A';
        console.warn(`[PERF] ðŸï¸ BIKE DATA READY - Total time from login: ${totalElapsed}ms`, updated);
        return updated;
      });

      setIdentificationCache({
        subscriptionCode: planId,
        vehicleId,
        currentBatteryId,
        totalSwaps: Math.floor(totalSwaps || 0),
        paymentState: paymentState || undefined,
        balance: energyValue,
        energyKwh: energyRemaining,
        currency: billingCurrency,
        cachedAt: Date.now(),
      });

    } catch (error) {
      console.error('[RIDER] Error fetching customer identification data:', error);
    } finally {
      window.clearTimeout(loadingFailSafeTimer);
      setIsBikeDataResolved(true);
      const totalElapsed = dataLoadStartRef.current > 0 ? Math.round(performance.now() - dataLoadStartRef.current) : 'N/A';
      console.warn(`[PERF] âœ… BIKE LOADING COMPLETE - Setting isLoadingBike=false after ${totalElapsed}ms from data load start`);
      if (!keepLoading) {
        setIsLoadingBike(false);
      }
    }
  };

  // Fetch activity data from GraphQL
  const fetchActivityData = async (subscriptionCode: string) => {
    const startTime = performance.now();
    console.info('[PERF] ðŸ“ ServicePlanActions GraphQL - Starting...');
    try {
      const graphqlEndpoint = 'https://abs-platform-dev.omnivoltaic.com/graphql';
      
      const query = `
        query {
          servicePlanActions(servicePlanId: "${subscriptionCode}", limit: 20) {
            servicePlanId
            paymentAccountId
            serviceAccountId
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

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const elapsed = Math.round(performance.now() - startTime);
      console.info(`[PERF] ðŸ“ ServicePlanActions GraphQL - Response received in ${elapsed}ms (Status: ${response.status})`);

      if (response.ok) {
        const result = await response.json();
        const totalElapsed = Math.round(performance.now() - startTime);
        console.info(`[PERF] ðŸ“ ServicePlanActions GraphQL - Parsed in ${totalElapsed}ms`);
        console.info('[RIDER] ðŸ” RAW servicePlanActions response:', JSON.stringify(result.data, null, 2));
        
        if (result.data?.servicePlanActions) {
          const { paymentActions, serviceActions } = result.data.servicePlanActions;
          const mappedActivities: ActivityItem[] = [];

          // Map paymentActions to "payment" type
          if (paymentActions && Array.isArray(paymentActions)) {
            paymentActions.forEach((action: any) => {
              const date = new Date(action.createdAt);
              const formattedDate = date.toISOString().split('T')[0];
              const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
              });

              let title = '';
              let isPositive = false;
              
              if (action.paymentType === 'DEPOSIT' || action.paymentType === 'TOPUP') {
                title = t('rider.balanceTopUp') || 'Balance Top-up';
                isPositive = true;
              } else if (action.paymentType === 'SUBSCRIPTION_PAYMENT') {
                title = t('rider.subscriptionPayment') || 'Subscription Payment';
                isPositive = false;
              } else {
                title = t('common.payment') || 'Payment';
                isPositive = action.paymentType === 'DEPOSIT' || action.paymentType === 'TOPUP';
              }

              mappedActivities.push({
                id: action.paymentActionId || `payment-${Date.now()}`,
                type: 'payment',
                title: title,
                subtitle: action.paymentType || '',
                amount: Math.abs(action.paymentAmount || 0),
                currency: currency,
                isPositive: isPositive,
                time: timeStr,
                date: formattedDate,
              });
            });
          }

          // Map serviceActions to "swap" type (all service actions are swaps)
          if (serviceActions && Array.isArray(serviceActions)) {
            // Find the most recent service action for last swap
            let latestServiceAction: any = null;

            serviceActions.forEach((action: any) => {
              if (!latestServiceAction || new Date(action.createdAt) > new Date(latestServiceAction.createdAt)) {
                latestServiceAction = action;
              }
            });

            // Group electricity + swap actions that occur within 2 min of each other
            // so a single battery swap renders as one unified row.
            const serviceGroups = groupServiceActions(serviceActions);

            serviceGroups.forEach((group) => {
              const hasElec = group.some((g: any) =>
                String(g.serviceType || '').includes('electricity')
              );
              const hasSwap = group.some(
                (g: any) => !String(g.serviceType || '').includes('electricity')
              );

              const date = new Date(group[0].createdAt);
              const formattedDate = date.toISOString().split('T')[0];
              const timeStr = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });

              if (hasElec && hasSwap && group.length === 2) {
                // Unified battery swap row — show energy, no price.
                const elecAction = group.find((g: any) =>
                  String(g.serviceType || '').includes('electricity')
                )!;
                mappedActivities.push({
                  id: elecAction.serviceActionId || `swap-${Date.now()}`,
                  type: 'swap',
                  title: t('rider.batterySwap') || 'Battery Swap',
                  subtitle: t('rider.batterySwapTransaction') || 'Battery swap transaction',
                  energy: `${elecAction.serviceAmount || 0} kWh`,
                  isPositive: false,
                  time: timeStr,
                  date: formattedDate,
                });
              } else {
                // Fallback: render each action individually.
                group.forEach((action: any) => {
                  const isElec = String(action.serviceType || '').includes('electricity');
                  mappedActivities.push({
                    id: action.serviceActionId || `service-${Date.now()}`,
                    type: 'swap',
                    title: isElec
                      ? t('rider.electricityUsage') || 'Electricity Usage'
                      : t('rider.batterySwap') || 'Battery Swap',
                    subtitle: isElec
                      ? `${action.serviceAmount || 0} kWh`
                      : t('rider.batterySwapTransaction') || 'Battery swap transaction',
                    isPositive: false,
                    time: timeStr,
                    date: formattedDate,
                  });
                });
              }
            });

            // Update last swap in bike state if we found any service actions
            if (latestServiceAction) {
              const lastSwapDate = new Date(latestServiceAction.createdAt);
              const now = new Date();
              const diffMs = now.getTime() - lastSwapDate.getTime();
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

              let lastSwapText: string;
              if (diffHours < 1) {
                lastSwapText = t('rider.justNow') || 'Just now';
              } else if (diffHours < 24) {
                lastSwapText = t('rider.hoursAgo', { count: diffHours });
              } else if (diffDays === 1) {
                lastSwapText = t('rider.yesterday') || 'Yesterday';
              } else if (diffDays < 7) {
                lastSwapText = t('rider.daysAgo', { count: diffDays });
              } else {
                lastSwapText = lastSwapDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }

              setBike((prev) => ({
                ...prev,
                lastSwap: lastSwapText,
              }));
            }
          }

          // Sort by date (newest first)
          mappedActivities.sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.time).getTime();
            const dateB = new Date(b.date + 'T' + b.time).getTime();
            return dateB - dateA;
          });

          setActivities(mappedActivities);
          setActivityCache(subscriptionCode, mappedActivities);
          console.log('Activity data fetched from GraphQL:', mappedActivities.length, 'activities');
        } else {
          console.log('No activity data in GraphQL response');
          setActivities([]);
        }
      } else {
        console.error('GraphQL response not OK:', response.status);
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activity data:', error);
      setActivities([]);
    }
  };

  // Track when data loading started (for overall timing)
  const dataLoadStartRef = useRef<number>(0);
  
  // Fetch subscription data using partner_id 
  const fetchSubscriptionData = async (partnerId: number, token: string) => {
    if (dataLoadStartRef.current === 0) {
      dataLoadStartRef.current = performance.now();
    }
    const startTime = performance.now();
    console.warn('[PERF] ðŸ“¦ Subscriptions API - Starting...');
    setSubscriptionsLoading(true);
    setSubscriptionsError(null);
    const loadingFailSafeTimer = window.setTimeout(() => {
      console.warn('[PERF] â±ï¸ Subscription timeout guard triggered, stopping loaders');
      setIsLoadingBike(false);
      setIsLoadingStations(false);
      setSubscriptionsLoading(false);
    }, LOAD_FAILSAFE_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/customers/${partnerId}/subscriptions?page=1&limit=20`, {
        method: 'GET',
        // Rider context — no SA scope.
        headers: buildOdooHeaders(token, null),
      });

      const elapsed = Math.round(performance.now() - startTime);
      console.info(`[PERF] ðŸ“¦ Subscriptions API - Response received in ${elapsed}ms (Status: ${response.status})`);

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.subscriptions && data.subscriptions.length > 0) {
          console.info('=== Subscription Data ===');
          console.info('All subscriptions:', JSON.stringify(data.subscriptions, null, 2));

          setSubscriptions(data.subscriptions);

          // Restore persisted active subscription if still in list
          let activeSubscription: Subscription | null = null;
          try {
            const stored = localStorage.getItem(ACTIVE_SUBSCRIPTION_CODE_STORAGE_KEY);
            if (stored) {
              activeSubscription =
                data.subscriptions.find(
                  (s: Subscription) => s.subscription_code === stored,
                ) || null;
            }
          } catch {}

          if (!activeSubscription) {
            activeSubscription =
              data.subscriptions.find((sub: Subscription) => sub.status === 'active') ||
              data.subscriptions[0] ||
              null;
          }

          if (!activeSubscription) {
            console.warn('No subscriptions available to activate');
            setSubscription(null);
            setIsBikeDataResolved(true);
            setIsLoadingBike(false);
            setIsLoadingStations(false);
            return;
          }

          const active = activeSubscription as Subscription;

          try {
            localStorage.setItem(
              ACTIVE_SUBSCRIPTION_CODE_STORAGE_KEY,
              active.subscription_code,
            );
          } catch {}
          const subElapsed = Math.round(performance.now() - startTime);
          console.warn(`[PERF] ðŸ“¦ Subscription found in ${subElapsed}ms - Now starting identity + activity fetches`);
          console.info('Selected subscription:', {
            subscription_code: active.subscription_code,
            product_name: active.product_name,
            status: active.status,
            full_data: active
          });
          setSubscription(active);

          // Update bike payment state and physical product name from the
          // subscription. `package_product_name` is the physical bike the
          // rider owns; `product_name` is the energy plan, so we only fall
          // back to it (or the initial value) if the package name is absent.
          setBike(prev => ({
            ...prev,
            model: active.package_product_name || active.product_name || prev.model,
            paymentState: active.status === 'active' ? 'active' : active.status,
          }));

          // Fetch activity data and bike data IN PARALLEL (not sequential)
          if (active.subscription_code) {
            const subscriptionCode = active.subscription_code;
            console.log('[PERF] ðŸš€ Starting PARALLEL fetch: Activity + IdentifyCustomer');
            const usedCache = hydrateIdentificationCache(subscriptionCode);
            // Hydrate stations + activity from local caches so the home screen
            // paints synchronously on re-entry. Background fetches below still
            // run and overwrite with fresh data; cached-but-empty results are
            // ignored so we never trap the user in a stale empty state.
            hydrateStationsCache(subscriptionCode);
            hydrateActivityCache(subscriptionCode);
            if (!usedCache) {
              setIsBikeDataResolved(false);
              setIsLoadingBike(true);
            }
            
            // Run both fetches in parallel - each updates its own state independently
            // This way bike data shows as soon as it's ready, without waiting for activity
            Promise.all([
              fetchActivityData(subscriptionCode),
              fetchCustomerIdentificationData(subscriptionCode, { keepLoading: usedCache }),
            ]).then(() => {
              console.log('[PERF] âœ… Both Activity and IdentifyCustomer completed');
            }).catch((err) => {
              console.error('[PERF] Error in parallel fetch:', err);
            });
          } else {
            console.warn('No subscription_code found in subscription data');
            setIsBikeDataResolved(true);
            setIsLoadingBike(false);
          }
        } else {
          console.warn('No subscriptions found in response');
          setSubscription(null);
          setIsBikeDataResolved(true);
          setIsLoadingBike(false);
          setIsLoadingStations(false);
        }
      } else {
        console.warn('[PERF] Subscriptions API returned non-OK status, stopping loaders');
        setSubscription(null);
        setIsBikeDataResolved(true);
        setIsLoadingBike(false);
        setIsLoadingStations(false);
        setSubscriptionsError(
          t('rider.selectSubscription.error') || 'Failed to load subscriptions',
        );
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      setSubscription(null);
      setIsBikeDataResolved(true);
      setIsLoadingBike(false);
      setIsLoadingStations(false);
      setSubscriptionsError(
        t('rider.selectSubscription.error') || 'Failed to load subscriptions',
      );
    } finally {
      window.clearTimeout(loadingFailSafeTimer);
      setSubscriptionsLoading(false);
    }
  };

  // Fetch fleet IDs for this subscription via the ABS `getRequiredAssetIds`
  // GraphQL query. This replaces the previous MQTT round-trip (which used
  // `call/uxi/service/plan/{planId}/get_assets`), eliminating an entire class
  // of intermittency: bridge-not-ready races, MQTT-connection drops,
  // subscribe-then-publish ordering, single-global-handler collisions, and
  // silent "publish-into-the-void" failures. The handler on the backend is
  // identical to the one the MQTT call routed to, so the response shape is
  // guaranteed to match.
  useEffect(() => {
    // Allow fetch to start if either: logged in, OR prefetch has started
    // (welcome screen visible).
    const canFetch = isLoggedIn || prefetchStartedRef.current;
    const hasFleetIds = fleetIds.length > 0;

    if (!canFetch || !subscription?.subscription_code || !customer) {
      if (canFetch) {
        console.warn('[PERF] Stations - Waiting for dependencies:', {
          hasSubscription: !!subscription?.subscription_code,
          hasCustomer: !!customer,
          isPrefetch: prefetchStartedRef.current && !isLoggedIn,
        });
      }
      return;
    }
    // Fleet IDs already resolved, avoid re-fetching and re-entering loading state.
    if (hasFleetIds) {
      if (isLoggedIn) {
        setIsLoadingStations(false);
      }
      return;
    }

    if (isLoggedIn) {
      setIsLoadingStations(true);
    }

    const planId = subscription.subscription_code;
    const correlationId = `asset-discovery-${Date.now()}`;
    const startedAt = performance.now();
    const totalElapsed = dataLoadStartRef.current > 0 ? Math.round(performance.now() - dataLoadStartRef.current) : 0;
    console.warn(`[PERF] Stations - Fetching fleet IDs at ${totalElapsed}ms from data load start`);
    console.info('[STATIONS] getRequiredAssetIds query - plan:', planId);

    let cancelled = false;
    const input: GetRequiredAssetIdsInput = {
      plan_id: planId,
      correlation_id: correlationId,
      search_radius: 10,
    };

    absApolloClient
      .query<{ getRequiredAssetIds: GetRequiredAssetIdsResponse }>({
        query: GET_REQUIRED_ASSET_IDS,
        variables: { input },
        // Always go to network. A stale Apollo cache can't be allowed to
        // serve old fleet IDs after a plan switch or re-login.
        fetchPolicy: 'network-only',
      })
      .then((result) => {
        if (cancelled) return;

        if (result.errors && result.errors.length > 0) {
          console.error('[STATIONS] getRequiredAssetIds GraphQL errors:', result.errors);
          setIsLoadingStations(false);
          setStations([]);
          setStationsError('graphql-errors');
          return;
        }

        const payload = result.data?.getRequiredAssetIds;
        if (!payload) {
          console.warn('[STATIONS] getRequiredAssetIds returned no data');
          setIsLoadingStations(false);
          setStations([]);
          setStationsError('graphql-empty');
          return;
        }

        const elapsed = Math.round(performance.now() - startedAt);
        console.info(`[PERF] Stations - Fleet IDs resolved in ${elapsed}ms`);

        const { swap_station_fleet } = parseGetRequiredAssetIdsFleetIds(payload.fleet_ids);

        if (swap_station_fleet.length > 0) {
          console.info('[STATIONS] swap_station_fleet ids:', swap_station_fleet);
          setStationsError(null);
          setFleetIds(swap_station_fleet);
        } else {
          // Empty fleet list is a legitimate "no stations assigned to this
          // plan" state, not a failure — show the no-stations badge, don't
          // surface a retry card.
          console.warn('[STATIONS] No swap_station_fleet ids returned for plan', planId, 'signals:', payload.signals);
          setIsLoadingStations(false);
          setStations([]);
          setStationsError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[STATIONS] getRequiredAssetIds request failed:', err);
        setIsLoadingStations(false);
        setStations([]);
        setStationsError('graphql-network');
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, subscription?.subscription_code, customer, fleetIds.length, stationsRetryNonce]);

  // Fetch stations from GraphQL when fleet IDs are available from MQTT response
  useEffect(() => {
    if (!fleetIds || fleetIds.length === 0) {
      console.info('[STATIONS] Waiting for fleet IDs from MQTT response...');
      return;
    }

    const normalizedFleetIds = [...fleetIds].sort();
    const fleetKey = normalizedFleetIds.join('|');
    if (lastStationsFleetKeyRef.current === fleetKey && stations.length > 0) {
      setIsLoadingStations(false);
      return;
    }

    // Set loading state immediately when we know we're about to fetch
    setIsLoadingStations(true);

    const fetchStationsFromGraphQL = async () => {
      const startTime = performance.now();
      const loadingFailSafeTimer = window.setTimeout(() => {
        console.warn('[PERF] â±ï¸ Stations timeout guard triggered, stopping stations loader');
        setIsLoadingStations(false);
      }, LOAD_FAILSAFE_TIMEOUT_MS);
      console.info('[PERF] ðŸ“ Stations GraphQL (getFleetAvatarsSummary) - Starting...');
      try {
        const authToken = localStorage.getItem('authToken_rider');
        if (!authToken) {
          console.warn('[STATIONS] No authToken_rider found in localStorage');
          setIsLoadingStations(false);
          return;
        }

        const graphqlEndpoint = 'https://thing-microservice-prod.omnivoltaic.com/graphql';
        
        const query = `
          query GetFleetAvatars($fleetIds: [String!]!) {
            getFleetAvatarsSummary(fleetIds: $fleetIds) {
              fleets {
                fleetId
                items {
                  oemItemID
                  opid
                  updatedAt
                  coordinates {
                    slat
                    slon
                  }
                  Charge_slot {
                    cnum
                    btid
                    chst
                    rsoc
                    reca
                    pckv
                    pckc
                  }
                }
              }
              missingFleetIds
            }
          }
        `;

        console.info('[STATIONS] Fetching stations from GraphQL for fleet IDs:', fleetIds);

        const response = await fetch(graphqlEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': authToken,
          },
          body: JSON.stringify({
            query,
            variables: {
              fleetIds: fleetIds,
            },
          }),
        });

        const elapsed = Math.round(performance.now() - startTime);
        console.info(`[PERF] ðŸ“ Stations GraphQL - Response received in ${elapsed}ms (Status: ${response.status})`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[STATIONS] GraphQL request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          setIsLoadingStations(false);
          setStations([]);
          setStationsError('graphql-http');
          return;
        }

        const result = await response.json();

        if (result.errors) {
          console.error('[STATIONS] GraphQL errors:', result.errors);
          setStations([]);
          setIsLoadingStations(false);
          setStationsError('graphql-errors');
          return;
        }

        const data = result.data?.getFleetAvatarsSummary;
        console.info('[STATIONS] GraphQL response received:', data);

        if (!data || !data.fleets || !Array.isArray(data.fleets)) {
          console.warn('[STATIONS] Invalid response structure from GraphQL API');
          setStations([]);
          setIsLoadingStations(false);
          setStationsError('graphql-shape');
          return;
        }

        // Process all fleet responses
        const allStations: Station[] = [];

        data.fleets.forEach((fleet: any) => {
          const fleetId = fleet.fleetId;
          const items = fleet.items || [];

          items.forEach((stationData: any, index: number) => {
            const coordinates = stationData.coordinates;
            if (!coordinates || typeof coordinates.slat !== 'number' || typeof coordinates.slon !== 'number') {
              return;
            }

            const chargeSlots = stationData.Charge_slot || [];
            // Fully-charged, swap-ready batteries (rsoc = 100, not charging).
            const availableBatteries = chargeSlots.filter((slot: any) =>
              slot.chst === 0 &&
              slot.btid &&
              slot.btid.trim() !== '' &&
              slot.rsoc === 100
            ).length;
            // Batteries currently charging (chst = 1) — shown alongside the
            // ready count so riders can tell a station will replenish soon.
            const chargingBatteries = chargeSlots.filter((slot: any) =>
              slot.chst === 1 &&
              slot.btid &&
              slot.btid.trim() !== ''
            ).length;

            const opid = stationData.opid || stationData.oemItemID || '';
            // Stable, collision-free id derived from fleetId + RCU SN. The old
            // arithmetic hash collided (see stationNumericId docs), which made
            // tapping one station resolve to another.
            const stationId = stationNumericId(fleetId, opid, index);

            allStations.push({
              id: stationId,
              // Friendly site name from the RCU-SN map; falls back to the raw
              // serial when a station isn't mapped yet (see station-names.ts).
              name: getStationDisplayName(
                opid,
                opid ? `Station ${opid}` : `Swap Station ${index + 1}`,
              ),
              rcuSn: opid || undefined,
              address: `${coordinates.slat.toFixed(4)}, ${coordinates.slon.toFixed(4)}`,
              distance: 'N/A',
              batteries: availableBatteries,
              charging: chargingBatteries,
              waitTime: '~5 min',
              lat: coordinates.slat,
              lng: coordinates.slon,
            });
          });
        });

        if (allStations.length > 0) {
          const totalElapsed = dataLoadStartRef.current > 0 ? Math.round(performance.now() - dataLoadStartRef.current) : 'N/A';
          console.warn(`[PERF] ðŸ“ STATIONS READY - ${allStations.length} stations loaded in ${totalElapsed}ms from data load start`);
          setStations(allStations);
          if (subscription?.subscription_code) {
            setStationsCache(subscription.subscription_code, allStations);
          }
          lastStationsFleetKeyRef.current = fleetKey;
          setStationsError(null);
        } else {
          console.warn('[STATIONS] No stations found in GraphQL response');
          setStations([]);
          lastStationsFleetKeyRef.current = null;
          // GraphQL responded correctly but nothing matched the fleet IDs —
          // treat as an empty-but-valid state, not a load error.
          setStationsError(null);
        }
        setIsLoadingStations(false);
      } catch (error) {
        console.error('[STATIONS] Error fetching stations from GraphQL:', error);
        setIsLoadingStations(false);
        setStations([]);
        lastStationsFleetKeyRef.current = null;
        setStationsError('graphql-network');
      } finally {
        window.clearTimeout(loadingFailSafeTimer);
      }
    };

    fetchStationsFromGraphQL();
  }, [fleetIds, stations.length, stationsRetryNonce]);

  // Set stations to empty if no subscription
  useEffect(() => {
    if (isLoggedIn && !subscription?.subscription_code) {
      console.warn('[STATIONS] No subscription code available, setting stations to empty');
      setIsLoadingStations(false);
      setStations([]);
      // Not an error — clear any stale retry state carried over from a
      // previous subscription that failed to load.
      setStationsError(null);
    }
  }, [isLoggedIn, subscription?.subscription_code]);

  // Check fingerprint availability (credentials + preference)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem('authToken_rider');
    const customerData = localStorage.getItem('customerData_rider');
    const fingerprintEnabled = localStorage.getItem('fingerprintEnabled_rider') === 'true';
    const hasCredentials = !!(token && customerData);
    // Only enable if both credentials exist AND user has enabled fingerprint
    if (hasCredentials && fingerprintEnabled) {
      // Fingerprint is available
      console.info('[FINGERPRINT] Fingerprint login available for this user');
    }
  }, []);

  // Register fingerprint callback handler - for both login (welcome screen) and enrollment
  useEffect(() => {
    if (!bridge) return;
    // Register when: on welcome screen with customer, OR when logged in (for enrollment)
    if (!((customer && showFoundCustomer) || isLoggedIn)) return;

    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, () => {});
    };

    // Register fingerprint verification callback
    const offFingerprint = reg("fingerprintVerificationCallBack", (data: any, resp: any) => {
      try {
        console.info('[FINGERPRINT] ===== CALLBACK RECEIVED =====');
        console.info('[FINGERPRINT] Raw data:', data);
        console.info('[FINGERPRINT] isEnablingFingerprint:', isEnablingFingerprintRef.current);
        
        // Parse response - handle different formats
        let parsed: any;
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
        } else {
          parsed = data;
        }
        
        // Check for failure indicators FIRST
        const isFailure = 
          parsed?.success === false ||
          parsed?.error === true ||
          parsed?.failed === true ||
          parsed?.status === 'failed' ||
          parsed?.status === 'error' ||
          parsed?.result === 'failed' ||
          parsed === false ||
          parsed === 'false' ||
          (typeof parsed === 'string' && (
            parsed.toLowerCase() === 'failed' ||
            parsed.toLowerCase() === 'false' ||
            parsed.toLowerCase().includes('fail') ||
            parsed.toLowerCase().includes('error') ||
            parsed.toLowerCase().includes("don't match") ||
            parsed.toLowerCase().includes('not match') ||
            parsed.toLowerCase().includes('mismatch')
          )) ||
          (parsed && typeof parsed === 'object' && (parsed.error || parsed.failed || parsed.message?.toLowerCase().includes('fail')));
        
        // Only check for success if it's NOT a failure
        const success = !isFailure && (
          parsed?.success === true || 
          parsed?.respData === true || 
          parsed === true ||
          parsed?.status === 'success' ||
          parsed?.result === 'success' ||
          parsed?.verified === true ||
          (typeof parsed === 'string' && (
            parsed.toLowerCase() === 'success' || 
            parsed.toLowerCase() === 'true' ||
            parsed.toLowerCase() === 'verified'
          ))
        );
        
        console.info('[FINGERPRINT] Success:', success, 'isFailure:', isFailure);
        
        // Check if this is for enrollment or login
        if (isEnablingFingerprintRef.current) {
          // ENROLLMENT MODE
          setIsEnablingFingerprint(false);
          isEnablingFingerprintRef.current = false;
          
          if (success && !isFailure) {
            // Fingerprint verified successfully during enrollment
            console.info('[FINGERPRINT] ✓ Enrollment verification successful');
            localStorage.setItem('fingerprintEnabled_rider', 'true');
            setIsFingerprintEnabled(true);
            setShowFingerprintPrompt(false);
            toast.success(t('auth.fingerprintEnabled') || 'Fingerprint login enabled');
          } else {
            console.warn('[FINGERPRINT] ✗ Enrollment verification failed');
            toast.error(t('auth.fingerprintFailed') || 'Fingerprint verification failed. Please try again.');
          }
        } else if (success && !isFailure && customer) {
          // LOGIN MODE - Fingerprint verified, proceed with login
          console.info('[FINGERPRINT] ✓ Login verification successful');
          const token = localStorage.getItem('authToken_rider');
          if (token) {
            setIsLoadingBike(true);
            setIsLoadingStations(true);
            setIsLoggedIn(true);
            if (customer.partner_id) {
              fetchSubscriptionData(customer.partner_id, token).catch((err) => {
                console.error('[FINGERPRINT] Error during login:', err);
                toast.error(t("auth.loginFailed") || "Login failed. Please try again.");
                setIsLoggedIn(false);
              });
            }
          } else {
            toast.error(t("auth.noCredentials") || "No saved credentials found.");
          }
        } else if (!isEnablingFingerprintRef.current) {
          // LOGIN MODE - Failed
          console.warn('[FINGERPRINT] ✗ Login verification failed');
          if (parsed && (
            (typeof parsed === 'object' && (parsed.error || parsed.failed)) ||
            (typeof parsed === 'string' && parsed.toLowerCase().includes('fail'))
          )) {
            toast.error(t("auth.fingerprintFailed") || "Fingerprint verification failed");
          }
        }
      } catch (err) {
        console.error("[FINGERPRINT] Error processing fingerprint data:", err);
        setIsEnablingFingerprint(false);
        isEnablingFingerprintRef.current = false;
        toast.error(t("auth.fingerprintError") || "Error processing fingerprint verification");
      }
      resp(data);
    });

    console.info('[FINGERPRINT] Callback handler registered');
    
    return () => {
      offFingerprint();
    };
  }, [bridge, customer, showFoundCustomer, isLoggedIn, t]);

  // Lock body overflow
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleLoginSuccess = (customerData: Customer) => {
    // Clear any previous crash flag so the next session can auto-login normally
    try { localStorage.removeItem('riderAppCrashed'); } catch { /* ignore */ }

    dataLoadStartRef.current = performance.now();
    console.warn('[PERF] â±ï¸ LOGIN START - Beginning data load sequence');

    // Defensive: if we came from the login form, auth check might still be true
    setIsCheckingAuth(false);
    setCustomer(customerData);
    setIsBikeDataResolved(false);
    // Set loading states immediately before fetching data
    setIsLoadingBike(true);
    setIsLoadingStations(true);
    setIsLoggedIn(true);
    const token = localStorage.getItem('authToken_rider');
    if (token) {
      console.warn('[PERF] ðŸš€ Starting fetch: Subscriptions');
      console.warn('[PERF] Bridge status:', {
        bridgeAvailable: !!bridge,
        webViewBridgeAvailable: typeof window !== 'undefined' && !!window.WebViewJavascriptBridge
      });

      // Fetch subscription data if partner_id is available. Balance and energy
      // come from the IdentifyCustomer mutation downstream of this call — the
      // legacy /customer/dashboard fetch was a duplicate source that briefly
      // flashed an incorrect value before being overwritten.
      if (customerData.partner_id) {
        fetchSubscriptionData(customerData.partner_id, token).then(() => {
          const elapsed = Math.round(performance.now() - dataLoadStartRef.current);
          console.warn(`[PERF] â±ï¸ Subscription chain complete in ${elapsed}ms (includes identity + activity)`);
        });
      } else {
        console.warn('[PERF] âš ï¸ No partner_id available - cannot fetch subscription');
      }
    } else {
      console.warn('[PERF] âš ï¸ No auth token - cannot fetch data');
    }
  };

  const openSelectSubscription = () => {
    setShowPlanSheet(true);
  };

  const handleSelectSubscription = (sub: Subscription) => {
    setShowPlanSheet(false);
    if (sub.subscription_code === subscription?.subscription_code) {
      return;
    }
    setSubscription(sub);
    // Full reset for the new plan: wipe every per-asset field so nothing from
    // the previous plan lingers while fresh data loads. `vehicleId`, battery,
    // swaps and `lastSwap` are all re-populated by the identification + activity
    // fetches kicked off below; `model` is the only field sourced from the
    // subscription itself, so set it from the new sub (package name, then plan
    // name) — never keep the old name.
    setBike((prev) => ({
      ...prev,
      model: sub.package_product_name || sub.product_name || '',
      vehicleId: null,
      currentBatteryId: undefined,
      totalSwaps: 0,
      lastSwap: null,
      paymentState: sub.status === 'active' ? 'active' : sub.status,
    }));
    try {
      localStorage.setItem(ACTIVE_SUBSCRIPTION_CODE_STORAGE_KEY, sub.subscription_code);
    } catch {}
    // Stations: reset the fleet pipeline so the driving effects re-run and
    // refetch (network-only) for the new plan.
    setFleetIds([]);
    lastStationsFleetKeyRef.current = null;
    setStations([]);
    setIsLoadingStations(true);
    setStationsError(null);
    // Activity: clear immediately so a stale feed from the old plan can't show
    // on the Activity tab before the refetch lands.
    setActivities([]);
    setIsBikeDataResolved(false);
    setIsLoadingBike(true);
    fetchActivityData(sub.subscription_code);
    fetchCustomerIdentificationData(sub.subscription_code);
    toast.success(t('rider.switchedPlan') || 'Plan switched');
  };

  /**
   * Re-run the full stations pipeline (MQTT fleet discovery → GraphQL fetch).
   *
   * Implemented by resetting the memo keys so the two driving effects fire
   * again. Used by the "Retry" button on the rider home when the map fails
   * to load on first attempt — the main reason fetch ever fails is the MQTT
   * failsafe timeout (bridge slow to respond), which a simple retry usually
   * resolves.
   */
  const refetchStations = React.useCallback(() => {
    console.info('[STATIONS] Manual retry requested');
    setStationsError(null);
    setIsLoadingStations(true);
    lastStationsFleetKeyRef.current = null;
    setFleetIds([]);
    setStations([]);
    // Bump the nonce so the MQTT + GraphQL effects re-run even if their
    // other inputs didn't change (e.g. fleetIds is already []). Without
    // this, hitting Retry after an MQTT timeout produced a spinner that
    // ran forever because the effect's deps were identical.
    setStationsRetryNonce((n) => n + 1);
  }, []);

  // Auto-retry stations on foreground. The WebView's MQTT bridge sometimes
  // drops its connection while the app is backgrounded, which manifested
  // as "Retry on the stations page does nothing, but leaving and coming
  // back fixes it" — leaving/returning was effectively the only signal
  // that caused the bridge to reconnect. By watching `visibilitychange`
  // here we turn that accidental recovery into an explicit one: if the
  // previous attempt failed, re-run the whole pipeline as soon as the tab
  // comes back to the foreground.
  useEffect(() => {
    if (!isLoggedIn) return;
    if (typeof document === 'undefined') return;

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!stationsError) return;
      console.info('[STATIONS] Foregrounded after error — auto-retrying');
      refetchStations();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isLoggedIn, stationsError, refetchStations]);

  // Derive "Swaps This Month" from the activity feed so the profile reflects
  // real data instead of a plan-lifetime counter. Falls back to 0 when the
  // activity list hasn't loaded yet.
  const swapsThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return activities.filter((a) => {
      if (a.type !== 'swap') return false;
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
  }, [activities]);

  const planSheetItems: SelectSheetItem<string>[] = useMemo(
    () =>
      subscriptions.map((s) => {
        const price = s.price_at_signup ?? 0;
        // Currency comes from the company billing data (identifyCustomer metadata),
        // not from the individual subscription record which may be stale or missing.
        const priceLabel =
          price > 0
            ? `${currency} ${price.toLocaleString()}`.trim()
            : '';
        const badges: { label: string; variant: 'success' | 'warning' | 'neutral' }[] = [
          {
            label: s.status,
            variant:
              s.status === 'active'
                ? 'success'
                : s.status === 'pending'
                  ? 'warning'
                  : 'neutral',
          },
          { label: s.subscription_code, variant: 'neutral' },
        ];
        return {
          value: s.subscription_code,
          label: s.product_name,
          description: priceLabel || undefined,
          badges,
          searchText: `${s.product_name} ${s.subscription_code} ${s.status}`,
        };
      }),
    [subscriptions, currency, t],
  );

  const handleLogout = () => {
    // Clear session state but KEEP credentials for fingerprint login
    setIsLoggedIn(false);
    setCustomer(null);
    setShowFoundCustomer(false); // Force login page instead of welcome back
    setCurrentScreen('home');
    // Keep credentials and fingerprint preference for fingerprint login
    // Only clear the phone number (user can re-enter if needed)
    localStorage.removeItem('userPhone');
    // Set flag to show login page instead of welcome back on next check
    localStorage.setItem('showLoginPage_rider', 'true');
    toast.success(t('common.logoutSuccess') || 'Logged out successfully');
  };


  // Rider energy top-up via service plan. Calls the dedicated `serviceTopup`
  // mutation, which records the payment and credits quota in one shot — no
  // swap-shaped side-effects. Bundle pricing (e.g. "120 kWh for 1 CFA") is
  // honoured by sending `unit_price = paymentAmount / declaredKwh`; ABS's
  // inverse arithmetic (`additional_quota = payment_amount / unit_price`)
  // then lands on the declared kWh after its 4-dp rounding. Requires the ABS
  // service layer to honour client-supplied `unit_price` (see topup.md).
  const handleEnergyTopUp = useCallback(
    async (args: EnergyTopUpSubmitArgs): Promise<EnergyTopUpResult> => {
      const planId = subscription?.subscription_code;
      if (!planId) {
        return { success: false, error: 'No active subscription' };
      }
      const serviceId = args.energyConfig?.serviceId;
      const declaredKwh = args.energyConfig?.initialQuota ?? 0;
      if (!serviceId || declaredKwh <= 0) {
        return { success: false, error: 'Top-up plan is missing a declared quota' };
      }

      // Money → 2 dp (matches swap-payment.ts conventions).
      // unit_price stays at full double precision; rounding it here would
      // diverge from ABS's inverse division. See discussion in topup.md.
      const paymentAmount = round(args.totalPaid, 2);
      const unitPrice = paymentAmount / declaredKwh;

      // Pre-flight: confirm the round-trip lands on declaredKwh within ABS's
      // 4-dp rounding window. If precision would drift, refuse to send so the
      // customer never gets credited the wrong kWh.
      const previewKwh = Math.round((paymentAmount / unitPrice) * 10000) / 10000;
      if (Math.abs(previewKwh - declaredKwh) > 0.0001) {
        console.error('[RIDER] top-up precision check failed', {
          paymentAmount, declaredKwh, unitPrice, previewKwh,
        });
        return { success: false, error: 'Top-up math precision check failed' };
      }

      const input: ServiceTopupInput = {
        plan_id: planId,
        service_id: serviceId,
        payment_amount: paymentAmount,
        unit_price: unitPrice,
        // The Odoo receipt is a stable per-payment identifier. Sending it as
        // both keys lets agent-layer dedupe (correlation_id) and service-
        // layer dedupe (payment_reference → PaymentAction id) both protect
        // against double-credits on retries.
        payment_reference: args.transactionId,
        correlation_id: args.transactionId,
      };

      // Dump the exact ABS request to the console so it can be replayed in the
      // GraphQL Playground. Logged as a block: mutation body, then variables JSON.
      console.groupCollapsed('[RIDER] ABS top-up request (paste into GraphQL Playground)');
      console.log(
`mutation ServiceTopup($input: ServiceTopupInput!) {
  serviceTopup(input: $input) {
    service_id
    additional_quota
    quota_before
    quota_after
    quota_calculation
    signals
    metadata
  }
}`,
      );
      console.log('Variables:\n' + JSON.stringify({ input }, null, 2));
      console.groupEnd();

      try {
        const result = await absApolloClient.mutate<{
          serviceTopup: ServiceTopupResponse;
        }>({
          mutation: SERVICE_TOPUP,
          variables: { input },
        });

        if (result.errors && result.errors.length > 0) {
          return { success: false, error: result.errors[0].message };
        }
        const resp = result.data?.serviceTopup;
        if (!resp) {
          return { success: false, error: 'No response from server' };
        }
        // Success when the agent confirms the quota update OR when it short-
        // circuits as an idempotent replay (the original credit is still in
        // place — confirmed against bss-agent-v2.ts:1850-1900 dedupe path).
        const okSignals = ['SERVICE_QUOTA_UPDATED', 'IDEMPOTENT_OPERATION_DETECTED'];
        const isOk = resp.signals?.some((s) => okSignals.includes(s));
        if (!isOk) {
          const reason = typeof resp.metadata === 'object'
            ? (resp.metadata as Record<string, unknown>)?.reason
            : undefined;
          return { success: false, error: (reason as string) || 'Top-up rejected' };
        }

        if (subscription?.subscription_code) {
          fetchCustomerIdentificationData(subscription.subscription_code);
        }
        return { success: true };
      } catch (err: any) {
        console.error('[RIDER] energy top-up failed', err);
        return { success: false, error: err?.message || 'Top-up failed' };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscription?.subscription_code, customer?.partner_id],
  );

  const handleNavigateToStation = (station: Station) => {
    if (station.lat && station.lng) {
      openExternalMap(
        googleMapsUrl({ lat: station.lat, lng: station.lng }, station.name),
        (msg) => toast.error(msg),
      );
    } else {
      toast.error(t('rider.stationLocationMissing') || 'Station location is missing.');
    }
  };

  const handleSelectStation = (stationId: number) => {
    setSelectedStationId(stationId);
    setCurrentScreen('stations');
  };

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="rider-container">
        <div className="rider-bg-gradient" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Found customer screen - show before login if credentials exist
  if (!isLoggedIn && showFoundCustomer && customer) {
    const initials = customer.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    return (
      <>
        <Toaster position="top-center" />
        <div className="rider-container">
          <div className="rider-bg-gradient" />
          
          {/* Header */}
          <header className="flow-header">
            <div className="flow-header-inner">
              <div className="flow-header-left">
                <button 
                  className="flow-header-back" 
                  onClick={() => {
                    if (isLoggedIn) {
                      // If logged in and not on home, go to home
                      if (currentScreen !== 'home') {
                        setCurrentScreen('home');
                      }
                      // If already on home, do nothing (stay on home)
                    } else if (showFoundCustomer) {
                      router.push('/');
                    } else {
                      router.push('/');
                    }
                  }} 
                  aria-label={t('common.back') || 'Back'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="rider-main" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="rider-screen active" style={{ width: '100%', maxWidth: '100%' }}>
              {/* Large Profile Icon */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                border: '2px solid rgba(255, 255, 255, 0.2)'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'white',
                textAlign: 'center',
                marginBottom: '8px'
              }}>
                {t('rider.loginTitle') || 'Rider Login'}
              </h2>

              {/* Welcome Message */}
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                marginBottom: '32px'
              }}>
                {t('rider.welcomeBack') || 'Welcome back!'}
              </p>

              {/* Account Card */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    marginBottom: '4px',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'white'
                  }}>
                    {customer.name}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: '400', 
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    {t('role.rider') || 'Rider'}
                  </div>
                </div>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: 'white',
                  padding: '4px 10px',
                  background: 'var(--success)',
                  borderRadius: 'var(--radius-md)',
                  flexShrink: 0
                }}>
                  {t('common.active') || 'Active'}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <button
                  onClick={() => {
                    const token = localStorage.getItem('authToken_rider');
                    if (token && customer) {
                      // Check if data was already prefetched
                      const wasPrefetched = prefetchStartedRef.current;
                      const prefetchElapsed = dataLoadStartRef.current > 0 
                        ? Math.round(performance.now() - dataLoadStartRef.current) 
                        : 0;
                      
                      console.warn(`[PERF] ⏱️ CONTINUE clicked - Prefetched: ${wasPrefetched}, Time since prefetch: ${prefetchElapsed}ms`);
                      
                      // Set loading states - if prefetch already completed, these will show briefly then clear
                      // If prefetch still in progress, show loading until it completes
                      if (!bike.vehicleId) {
                        setIsLoadingBike(true);
                      }
                      if (stations.length === 0) {
                        setIsLoadingStations(true);
                      }
                      setIsLoggedIn(true);
                      
                      // Only fetch if prefetch wasn't started
                      if (!wasPrefetched) {
                        dataLoadStartRef.current = performance.now();
                        console.warn('[PERF] 🚀 Starting fetch: Subscriptions (no prefetch)');
                        if (customer.partner_id) {
                          fetchSubscriptionData(customer.partner_id, token);
                        }
                      } else {
                        console.warn('[PERF] ✅ Data was prefetched - skipping redundant API calls');
                      }
                    }
                  }}
                  style={{ 
                    width: '100%',
                    padding: '14px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  {t('common.continue') || 'Continue'}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>

                {/* Fingerprint Login Button - only show if fingerprint is enabled */}
                {isFingerprintEnabled && bridge && (
                  <button
                    onClick={() => {
                      // Trigger native fingerprint verification
                      console.info('[FINGERPRINT] Triggering fingerprint verification from welcome screen');
                      bridge.callHandler(
                        'fingerprintVerification',
                        '',
                        (responseData: any) => {
                          console.info('[FINGERPRINT] Verification initiated:', responseData);
                        }
                      );
                    }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--accent)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }}
                  >
                    <Fingerprint size={18} />
                    {t('common.useFingerprint') || 'Use Fingerprint'}
                  </button>
                )}
                
                <button
                  onClick={() => {
                    localStorage.removeItem('authToken_rider');
                    localStorage.removeItem('customerData_rider');
                    localStorage.removeItem('userPhone');
                    localStorage.removeItem('fingerprintEnabled_rider'); // Also clear fingerprint preference
                    setShowFoundCustomer(false);
                    setCustomer(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                >
                  {t('rider.switchAccount') || 'Switch Account'}
                </button>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  // Login screen — wrapped in its own ErrorBoundary so a crash in the login
  // form shows a visible recovery prompt rather than propagating to the root.
  if (!isLoggedIn) {
    return (
      <ErrorBoundary
        fallback={
          <div style={{
            position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '24px',
            background: '#0a0f0f', gap: '12px', zIndex: 9999,
          }}>
            <p style={{ color: '#94b8b8', fontSize: '14px', textAlign: 'center', maxWidth: '280px', margin: 0 }}>
              Unable to load login screen. Please reload the app.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 24px', background: '#00e5e5', color: '#0a0f0f', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Reload App
            </button>
          </div>
        }
      >
        <Toaster position="top-center" />
        <Login onLoginSuccess={handleLoginSuccess} />
      </ErrorBoundary>
    );
  }

  // Main app
  return (
    <ErrorBoundary
      onCriticalError={() => {
        try { localStorage.setItem('riderAppCrashed', 'true'); } catch { /* ignore */ }
      }}
    >
    <RiderMapProvider>
      <Toaster position="top-center" />

      <div className="rider-container">
        <div className="rider-bg-gradient" />
        <AppHeader showBack={!isDirectRider} onBack={handleHeaderBack} />
        {/* Main Content */}
        <main
          className={`rider-main${
            currentScreen === 'stations' ? ' rider-main--full' : ''
          }`}
        >
          {currentScreen === 'home' && (
            <RiderHome
              userName={customer?.name || t('common.guest')}
              balance={balance}
              energyKwh={energyKwh}
              currency={currency}
              subscriptionCode={subscription?.subscription_code ?? null}
              bike={{
                ...bike,
                // Derive the vehicle name straight from the active subscription
                // so it can never lag behind a plan switch. `package_product_name`
                // is the physical bike; fall back to the plan's `product_name`
                // (never the previously-cached `bike.model`, which was the
                // stale-vehicle-name bug) so the strip always reflects the plan
                // that is currently selected.
                model: subscription?.package_product_name || subscription?.product_name || bike.model,
                paymentState: subscription?.status === 'active' ? 'active' : subscription?.status || bike.paymentState,
              }}
              nearbyStations={stations.map(s => ({
                id: s.id,
                name: s.name,
                rcuSn: s.rcuSn,
                distance: s.distance,
                batteries: s.batteries,
                charging: s.charging,
                lat: s.lat,
                lng: s.lng,
              }))}
              isLoadingStations={isLoadingStations}
              isLoadingBike={isLoadingBike}
              stationsError={stationsError}
              hasSubscription={!!subscription?.subscription_code}
              onRefreshStations={refetchStations}
              onShowQRCode={() => setShowQRModal(true)}
              onShowEnergyTopUp={() => setShowTopUpModal(true)}
              onSelectStation={handleSelectStation}
              onViewAllStations={() => setCurrentScreen('stations')}
            />
          )}
          
          {currentScreen === 'activity' && (
            <RiderActivity activities={activities} currency={currency} />
          )}
          
          {currentScreen === 'stations' && (
            <RiderStations
              stations={stations}
              isLoading={isLoadingStations}
              initialSelectedStationId={selectedStationId}
              onStationDeselected={() => setSelectedStationId(null)}
              stationsError={stationsError}
              onRetryStations={refetchStations}
            />
          )}

          {currentScreen === 'transactions' && (
            <RiderTransactions
              partnerId={customer?.partner_id}
              token={localStorage.getItem('authToken_rider')}
              defaultCurrency={currency}
              seedTransactions={activities
                .filter((a) => a.type === 'payment' || a.type === 'topup')
                .map((a) => ({
                  id: a.id,
                  reference: a.subtitle,
                  planName: a.title,
                  amount: a.amount ?? 0,
                  currency: a.currency,
                  date: `${a.date} ${a.time}`,
                  status: a.isPositive ? 'completed' : 'completed',
                }))}
            />
          )}

          {currentScreen === 'plans' && (
            <RiderPlans
              token={typeof window !== 'undefined' ? localStorage.getItem('authToken_rider') : null}
              onSelectPlan={(plan) => {
                // Show the canonical plan name in the toast. `name` is a
                // translatable Odoo field; `templateId` is stable.
                const planName = plan.templateId || plan.name;
                toast.success(t('rider.plans.selected', { name: planName }) || `Selected ${planName}`);
              }}
              defaultCurrency={currency}
            />
          )}

          {currentScreen === 'tickets' && (
            <RiderTickets
              partnerId={customer?.partner_id ?? null}
              customer={customer}
              activeSubscriptionId={subscription?.id ?? null}
            />
          )}

          
          {currentScreen === 'profile' && (
            <RiderProfile
              profile={{
                name: customer?.name || t('common.guest') || 'Guest',
                initials: customer?.name
                  ? customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  : '--',
                phone: customer?.phone || '',
                balance: balance,
                energyKwh: energyKwh,
                currency: currency,
                swapsThisMonth: swapsThisMonth,
                planName: subscription?.product_name || '',
                planValidity: subscription?.next_cycle_date
                  ? new Date(subscription.next_cycle_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '',
                paymentState: subscription?.status === 'active' ? 'active' : subscription?.status || 'active',
              }}
              bikeImageUrl="/assets/E-3-one.png"
              onAccountDetails={() => toast.success(t('rider.accountDetailsSoon') || 'Account details coming soon')}
              onVehicle={() => toast.success(t('rider.vehicleDetailsSoon') || 'Vehicle details coming soon')}
              onPlanDetails={openSelectSubscription}
              onPaymentMethods={() => toast.success(t('rider.paymentMethodsSoon') || 'Payment methods coming soon')}
              onSupport={() => setCurrentScreen('tickets')}
              onLogout={handleLogout}
              isFingerprintEnabled={isFingerprintEnabled}
              onToggleFingerprint={() => {
                if (isFingerprintEnabled) {
                  localStorage.setItem('fingerprintEnabled_rider', 'false');
                  setIsFingerprintEnabled(false);
                  toast.success(t('auth.fingerprintDisabled') || 'Fingerprint login disabled');
                } else {
                  if (bridge) {
                    setIsEnablingFingerprint(true);
                    isEnablingFingerprintRef.current = true;
                    bridge.callHandler(
                      'fingerprintVerification',
                      '',
                      (responseData: any) => {
                        console.info('[FINGERPRINT] Settings toggle - verification initiated:', responseData);
                      }
                    );
                  } else {
                    toast.error(t('common.bridgeNotInitialized') || 'Bridge not initialized');
                  }
                }
              }}
              onSwitchSubscription={openSelectSubscription}
              subscriptionCode={subscription?.subscription_code}
              subscriptionStatus={subscription?.status}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <RiderNav
          currentScreen={
            (['home', 'stations', 'activity', 'profile'] as const).includes(
              currentScreen as any,
            )
              ? (currentScreen as 'home' | 'stations' | 'activity' | 'profile')
              : 'profile'
          }
          onNavigate={(s) => setCurrentScreen(s)}
        />
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        customerId={customer?.id?.toString()}
        subscriptionCode={subscription?.subscription_code}
      />

      {/* Energy Top-Up Modal */}
      <EnergyTopUpModal
        isOpen={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        currency={currency}
        token={typeof window !== 'undefined' ? localStorage.getItem('authToken_rider') : null}
        subscriptionCode={subscription?.subscription_code || null}
        // Pass the rider's current package so the modal narrows the plan
        // list to services that apply to it — same mapping Sales / Activator
        // step 3 use to filter their plan picker.
        packageName={subscription?.product_name || null}
        onSubmit={handleEnergyTopUp}
      />


      {/* Plan switcher — bottom-sheet picker, no full-screen navigation */}
      <SelectSheet
        isOpen={showPlanSheet}
        onClose={() => setShowPlanSheet(false)}
        title={t('rider.selectSubscription.title') || 'Switch plan'}
        subtitle={
          customer?.name
            ? (t('rider.selectSubscription.welcome') || 'Welcome, {name}').replace(
                '{name}',
                customer.name,
              )
            : t('rider.selectSubscription.subtitle') || undefined
        }
        items={planSheetItems}
        activeValue={subscription?.subscription_code || null}
        loading={subscriptionsLoading}
        error={subscriptionsError}
        onRetry={() => {
          if (customer?.partner_id) {
            const token = localStorage.getItem('authToken_rider');
            if (token) fetchSubscriptionData(customer.partner_id, token);
          }
        }}
        emptyText={
          t('rider.selectSubscription.emptyDesc') ||
          "You don't have any active subscriptions."
        }
        searchable={subscriptions.length > 6}
        onSelect={(item) => {
          const full = subscriptions.find(
            (s) => s.subscription_code === item.value,
          );
          if (full) handleSelectSubscription(full);
        }}
      />

      {/* Fingerprint Enable Prompt Modal */}
      {showFingerprintPrompt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => {
            localStorage.setItem('fingerprintEnabled_rider', 'false');
            setShowFingerprintPrompt(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '340px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Fingerprint size={32} color="white" />
              </div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                {t('auth.enableFingerprintTitle') || 'Enable Fingerprint Login?'}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                }}
              >
                {t('auth.enableFingerprintDescription') || 'Enable this later in settings.'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  if (!bridge) {
                    toast.error(t('common.bridgeNotInitialized') || 'Bridge not initialized');
                    return;
                  }
                  setIsEnablingFingerprint(true);
                  isEnablingFingerprintRef.current = true;
                  bridge.callHandler(
                    'fingerprintVerification',
                    '',
                    (responseData: any) => {
                      console.info('[FINGERPRINT] Enrollment verification initiated:', responseData);
                    }
                  );
                }}
                disabled={isEnablingFingerprint}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isEnablingFingerprint ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isEnablingFingerprint ? 0.7 : 1,
                }}
              >
                {isEnablingFingerprint ? (
                  <>
                    <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }}></div>
                    {t('common.verifying') || 'Verifying...'}
                  </>
                ) : (
                  <>
                    <Fingerprint size={18} />
                    {t('auth.enableFingerprint') || 'Enable Fingerprint'}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('fingerprintEnabled_rider', 'false');
                  setShowFingerprintPrompt(false);
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  color: 'var(--text-secondary)',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                {t('auth.fingerprintCanEnableLater') || 'Maybe Later'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RiderMapProvider>
    </ErrorBoundary>
  );
};

export default RiderApp;

