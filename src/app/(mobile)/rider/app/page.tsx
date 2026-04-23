"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useBridge } from '@/app/context/bridgeContext';
import { absApolloClient } from '@/lib/apollo-client';
import { IDENTIFY_CUSTOMER, parseIdentifyCustomerMetadata, type IdentifyCustomerInput } from '@/lib/graphql/mutations';
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
  TopUpModal,
} from './components';
import { SelectSheet, type SelectSheetItem } from '@/components/ui';
import AccountDetailsModal from './components/AccountDetailsModal';
import type { ActivityItem, Station } from './components';
import Login from './components/Login';

const ACTIVE_SUBSCRIPTION_CODE_STORAGE_KEY = 'activeSubscriptionCode_rider';

const API_BASE = "https://crm-omnivoltaic.odoo.com/api";
const API_KEY = "abs_connector_secret_key_2024";
const RIDER_IDENTIFICATION_CACHE_KEY = 'riderIdentificationCacheV1';
const IDENTIFICATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const LOAD_FAILSAFE_TIMEOUT_MS = 15000;

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
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
  totalSwaps: number;
  paymentState?: string;
  balance: number;
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
  const { t, locale, setLocale } = useI18n();
  const { bridge } = useBridge();
  const stationsSubscriptionRef = useRef<(() => void) | null>(null);
  const lastStationsFleetKeyRef = useRef<string | null>(null);
  const [fleetIds, setFleetIds] = useState<string[]>([]);
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  
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
  const [showAccountDetailsModal, setShowAccountDetailsModal] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  
  // Data state
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('XOF');
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
    model: 'E-Trike 3X',
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

  // Track if we've started prefetching
  const prefetchStartedRef = useRef(false);
  
  // Check authentication on mount - if credentials exist, auto-login and go directly to home
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken_rider');
      const storedCustomerData = localStorage.getItem('customerData_rider');
      
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
            console.warn('[PERF] ðŸš€ AUTO-LOGIN - Starting data load');

            fetchDashboardData(token);
            fetchSubscriptionData(customerData.partner_id, token);
          }
        } catch (e) {
          console.error('Error parsing stored customer data:', e);
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set loading states immediately when user logs in
  useEffect(() => {
    if (isLoggedIn) {
      // Set loading states immediately when logged in, before any data is fetched
      if (!isBikeDataResolved) {
        setIsLoadingBike(true);
      }
      setIsLoadingStations(true);
    }
  }, [isLoggedIn, isBikeDataResolved]);

  // Fetch dashboard data from API
  const fetchDashboardData = async (token: string) => {
    const startTime = performance.now();
    console.info('[PERF] ðŸ“Š Dashboard API - Starting...');
    try {
      const response = await fetch(`${API_BASE}/customer/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });

      const elapsed = Math.round(performance.now() - startTime);
      console.info(`[PERF] ðŸ“Š Dashboard API - Response received in ${elapsed}ms (Status: ${response.status})`);

      if (response.ok) {
        const data = await response.json();
        const totalElapsed = Math.round(performance.now() - startTime);
        console.info(`[PERF] ðŸ“Š Dashboard API - Parsed in ${totalElapsed}ms`);
        
        if (data.summary) {
          setBalance(data.summary.total_paid || 0);
        }
        
        // Don't use activity_history from dashboard - use GraphQL instead
        // Activity data will be fetched from GraphQL when subscription is loaded
      }
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      console.error(`[PERF] ðŸ“Š Dashboard API - Error after ${elapsed}ms:`, error);
    }
  };

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

  const hydrateIdentificationCache = (subscriptionCode: string): boolean => {
    const cached = getIdentificationCache(subscriptionCode);
    if (!cached) return false;

    setBalance(cached.balance);
    setCurrency(cached.currency);
    setBike((prev) => ({
      ...prev,
      vehicleId: cached.vehicleId,
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
      const billingCurrency = common_terms?.billingCurrency || service_plan_data?.currency || 'XOF';

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
      setCurrency(billingCurrency);

      // Update bike state with real data
      setBike((prev) => {
        const updated = {
          ...prev,
          vehicleId,
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
        totalSwaps: Math.floor(totalSwaps || 0),
        paymentState: paymentState || undefined,
        balance: energyValue,
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
              const date = new Date(action.createdAt);
              const formattedDate = date.toISOString().split('T')[0];
              const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
              });

              // Track the latest service action
              if (!latestServiceAction || new Date(action.createdAt) > new Date(latestServiceAction.createdAt)) {
                latestServiceAction = action;
              }

              let title = '';
              let subtitle = '';
              
              if (action.serviceType?.includes('swap')) {
                title = t('rider.batterySwap') || 'Battery Swap';
                subtitle = t('rider.batterySwapTransaction') || 'Battery swap transaction';
              } else if (action.serviceType?.includes('electricity')) {
                title = t('rider.electricityUsage') || 'Electricity Usage';
                subtitle = `${action.serviceAmount || 0} kWh`;
              } else {
                title = t('rider.batterySwap') || 'Battery Swap';
                subtitle = action.serviceType || '';
              }

              mappedActivities.push({
                id: action.serviceActionId || `service-${Date.now()}`,
                type: 'swap', // All serviceActions are swaps
                title: title,
                subtitle: subtitle,
                amount: Math.abs(action.serviceAmount || 0),
                currency: currency,
                isPositive: false,
                time: timeStr,
                date: formattedDate,
              });
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
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          'Authorization': `Bearer ${token}`,
        },
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

          // Update bike payment state with subscription status
          setBike(prev => ({
            ...prev,
            paymentState: active.status === 'active' ? 'active' : active.status,
          }));

          // Fetch activity data and bike data IN PARALLEL (not sequential)
          if (active.subscription_code) {
            const subscriptionCode = active.subscription_code;
            console.log('[PERF] ðŸš€ Starting PARALLEL fetch: Activity + IdentifyCustomer');
            const usedCache = hydrateIdentificationCache(subscriptionCode);
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

  // Fetch stations via MQTT - using direct bridge calls like serviceplan1
  // Now also supports prefetching: triggers when prefetch started OR when logged in
  useEffect(() => {
    // Allow MQTT to start if either: logged in, OR prefetch has started (welcome screen visible)
    const canFetch = isLoggedIn || prefetchStartedRef.current;
    const hasFleetIds = fleetIds.length > 0;
    
    if (!canFetch || !subscription?.subscription_code || !customer) {
      if (canFetch) {
        console.warn('[PERF] ðŸ“¡ MQTT - Waiting for dependencies:', {
          hasSubscription: !!subscription?.subscription_code,
          hasCustomer: !!customer,
          isPrefetch: prefetchStartedRef.current && !isLoggedIn,
        });
      }
      return;
    }
    // Fleet IDs already resolved, avoid re-subscribing and re-entering loading state.
    if (hasFleetIds) {
      if (isLoggedIn) {
        setIsLoadingStations(false);
      }
      return;
    }
    if (!bridge || typeof window === 'undefined' || !window.WebViewJavascriptBridge) {
      console.warn('[PERF] ðŸ“¡ MQTT - Bridge NOT ready:', {
        bridge: !!bridge,
        webViewBridge: typeof window !== 'undefined' && !!window.WebViewJavascriptBridge,
      });
      if (isLoggedIn) {
        setIsLoadingStations(false);
      }
      return;
    }

    // Only set loading state if user is logged in (not during prefetch - don't show loading on welcome screen)
    if (isLoggedIn) {
      setIsLoadingStations(true);
    }

    const planId = subscription.subscription_code;
    const requestTopic = `call/uxi/service/plan/${planId}/get_assets`;
    const responseTopic = `rtrn/abs/service/plan/${planId}/get_assets`;

    const totalElapsed = dataLoadStartRef.current > 0 ? Math.round(performance.now() - dataLoadStartRef.current) : 0;
    console.warn(`[PERF] ðŸ“¡ MQTT - Starting at ${totalElapsed}ms from data load start`);
    console.info('[STATIONS MQTT] Setting up MQTT request for plan:', planId);
    const mqttStartTime = performance.now();
    console.info('[PERF] ðŸ“¡ MQTT Fleet IDs Request - Starting...');

    // Failsafe timeout: if MQTT never responds with fleet IDs, stop the loader
    // so the user isn't stuck watching a spinner forever.
    let fleetIdsReceived = false;
    const mqttFailsafeTimer = window.setTimeout(() => {
      if (fleetIdsReceived) return;
      const waited = Math.round(performance.now() - mqttStartTime);
      console.warn(`[PERF] â±ï¸ MQTT Fleet IDs - timeout after ${waited}ms, no response received. Stopping stations loader.`);
      setIsLoadingStations(false);
      setStations([]);
      setStationsError('mqtt-timeout');
    }, LOAD_FAILSAFE_TIMEOUT_MS);

    // Generate unique correlation ID
    const correlationId = `asset-discovery-${Date.now()}`;
    
    // Format timestamp without milliseconds
    const now = new Date();
    const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    const content = {
      timestamp: timestamp,
      plan_id: planId,
      correlation_id: correlationId,
      actor: {
        type: "customer",
        id: "CUST-RIDER-001"
      },
      data: {
        action: "GET_REQUIRED_ASSET_IDS",
        search_radius: 10
      }
    };

    const dataToPublish = {
      topic: requestTopic,
      qos: 0,
      content,
    };

    // Helper function to register handlers (same pattern as serviceplan1)
    const reg = (name: string, handler: any) => {
      bridge.registerHandler(name, handler);
      return () => bridge.registerHandler(name, () => {});
    };

    // Register MQTT response handler FIRST (before subscribing/publishing)
    console.info('[STATIONS MQTT] Registering mqttMsgArrivedCallBack handler');
    const offResponseHandler = reg(
      "mqttMsgArrivedCallBack",
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedData = JSON.parse(data);
          console.info('========================================');
          console.info('[STATIONS MQTT] Received MQTT arrived callback data:', parsedData);

          const message = parsedData;
          const topic = message.topic;
          const rawMessageContent = message.message;

          console.info('[STATIONS MQTT] Topic:', topic);
          console.info('[STATIONS MQTT] Expected topic:', responseTopic);
          console.info('[STATIONS MQTT] Topic match:', topic === responseTopic);

          if (topic === responseTopic) {
            console.info('[STATIONS MQTT] âœ… Response received from rtrn topic!');
            console.info('[STATIONS MQTT] Full message:', JSON.stringify(message, null, 2));
            
            let responseData;
            try {
              responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
            } catch (parseErr) {
              console.error('[STATIONS MQTT] Error parsing message content:', parseErr);
              responseData = rawMessageContent;
            }

            console.info('[STATIONS MQTT] Parsed response data:', JSON.stringify(responseData, null, 2));

            // Extract fleet IDs from response
            const fleetIdsData = responseData?.data?.metadata?.fleet_ids;
            const swapStationFleetIds = fleetIdsData?.swap_station_fleet;

            if (swapStationFleetIds && Array.isArray(swapStationFleetIds) && swapStationFleetIds.length > 0) {
              const mqttElapsed = Math.round(performance.now() - mqttStartTime);
              console.info(`[PERF] ðŸ“¡ MQTT Fleet IDs - Response received in ${mqttElapsed}ms`);
              console.info('[STATIONS MQTT] âœ… Found swap station fleet IDs:', swapStationFleetIds);
              fleetIdsReceived = true;
              window.clearTimeout(mqttFailsafeTimer);
              setStationsError(null);
              setFleetIds(swapStationFleetIds);
            } else {
              console.warn('[STATIONS MQTT] No swap_station_fleet IDs found in response');
              console.warn('[STATIONS MQTT] Response structure:', {
                hasData: !!responseData?.data,
                hasMetadata: !!responseData?.data?.metadata,
                hasFleetIds: !!responseData?.data?.metadata?.fleet_ids,
                fleetIds: responseData?.data?.metadata?.fleet_ids,
                fullResponse: responseData,
              });
              fleetIdsReceived = true;
              window.clearTimeout(mqttFailsafeTimer);
              setIsLoadingStations(false);
              setStations([]);
              setStationsError('mqtt-empty');
            }
            responseCallback({ success: true });
          } else {
            console.info('[STATIONS MQTT] Topic mismatch, ignoring. Expected:', responseTopic, 'Got:', topic);
            responseCallback({ success: true });
          }
        } catch (err) {
          console.error('[STATIONS MQTT] Error parsing MQTT arrived callback:', err);
          responseCallback({ success: false, error: err });
        }
        console.info('========================================');
      }
    );

    // Subscribe to response topic using mqttSubTopic (same as serviceplan1)
    console.info('[STATIONS MQTT] Subscribing to response topic:', responseTopic);
    if (!window.WebViewJavascriptBridge) {
      console.error('[STATIONS MQTT] WebViewJavascriptBridge not available');
      return;
    }
    
    window.WebViewJavascriptBridge.callHandler(
      "mqttSubTopic",
      { topic: responseTopic, qos: 0 },
      (subscribeResponse) => {
        console.info('[STATIONS MQTT] Subscribe response:', subscribeResponse);
        try {
          const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
          if (subResp.respCode === "200") {
            console.info('[STATIONS MQTT] âœ… Subscribed to response topic successfully');
            
            // Publish request AFTER subscription is confirmed
            console.info('[STATIONS MQTT] Publishing request:', JSON.stringify(dataToPublish, null, 2));
            if (window.WebViewJavascriptBridge) {
              window.WebViewJavascriptBridge.callHandler(
                "mqttPublishMsg",
                JSON.stringify(dataToPublish),
                (publishResponse) => {
                  console.info('[STATIONS MQTT] Publish response:', publishResponse);
                  try {
                    const pubResp = typeof publishResponse === 'string' ? JSON.parse(publishResponse) : publishResponse;
                    if (pubResp.respCode === "200") {
                      console.info('[STATIONS MQTT] âœ… Successfully published request');
                    } else {
                      console.error('[STATIONS MQTT] Publish failed:', pubResp.respDesc || pubResp.error);
                    }
                  } catch (err) {
                    console.error('[STATIONS MQTT] Error parsing publish response:', err);
                  }
                }
              );
            }
          } else {
            console.error('[STATIONS MQTT] Subscribe failed:', subResp.respDesc || subResp.error);
          }
        } catch (err) {
          console.error('[STATIONS MQTT] Error parsing subscribe response:', err);
        }
      }
    );

    // Store cleanup function
    stationsSubscriptionRef.current = offResponseHandler;

    // Cleanup on unmount or when dependencies change
    return () => {
      window.clearTimeout(mqttFailsafeTimer);
      if (stationsSubscriptionRef.current) {
        stationsSubscriptionRef.current();
        stationsSubscriptionRef.current = null;
      }
    };
  }, [isLoggedIn, subscription?.subscription_code, customer, bridge, fleetIds.length]);

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
            // Only count batteries with rsoc = 100
            const availableBatteries = chargeSlots.filter((slot: any) => 
              slot.chst === 0 && 
              slot.btid && 
              slot.btid.trim() !== '' &&
              slot.rsoc === 100
            ).length;

            const opid = stationData.opid || stationData.oemItemID || '';
            const stationId = Math.abs(
              parseInt(fleetId.substring(fleetId.length - 8), 36) + 
              (opid ? parseInt(opid.substring(opid.length - 4), 36) : 0) + 
              index
            ) % 100000;

            allStations.push({
              id: stationId,
              name: opid ? `Station ${opid}` : `Swap Station ${index + 1}`,
              address: `${coordinates.slat.toFixed(4)}, ${coordinates.slon.toFixed(4)}`,
              distance: 'N/A',
              batteries: availableBatteries,
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
          lastStationsFleetKeyRef.current = fleetKey;
          setStationsError(null);
        } else {
          console.warn('[STATIONS] No stations found in GraphQL response');
          setStations([]);
          lastStationsFleetKeyRef.current = null;
          setStationsError('graphql-empty');
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
  }, [fleetIds, stations.length]);

  // Set stations to empty if no subscription
  useEffect(() => {
    if (isLoggedIn && !subscription?.subscription_code) {
      console.warn('[STATIONS] No subscription code available, setting stations to empty');
      setIsLoadingStations(false);
      setStations([]);
    }
  }, [isLoggedIn, subscription?.subscription_code]);

  // Lock body overflow
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  };

  const handleBackToRoles = () => {
    router.push('/');
  };

  const handleLoginSuccess = (customerData: Customer) => {
    dataLoadStartRef.current = performance.now();
    console.warn('[PERF] â±ï¸ LOGIN START - Beginning data load sequence');
    
    setCustomer(customerData);
    setIsBikeDataResolved(false);
    // Set loading states immediately before fetching data
    setIsLoadingBike(true);
    setIsLoadingStations(true);
    setIsLoggedIn(true);
    const token = localStorage.getItem('authToken_rider');
    if (token) {
      console.warn('[PERF] ðŸš€ Starting parallel fetch: Dashboard + Subscriptions');
      console.warn('[PERF] Bridge status:', { 
        bridgeAvailable: !!bridge, 
        webViewBridgeAvailable: typeof window !== 'undefined' && !!window.WebViewJavascriptBridge 
      });
      
      // Fire both fetches - don't await, let them update state independently
      fetchDashboardData(token);
      
      // Fetch subscription data if partner_id is available
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
    try {
      localStorage.setItem(ACTIVE_SUBSCRIPTION_CODE_STORAGE_KEY, sub.subscription_code);
    } catch {}
    setFleetIds([]);
    lastStationsFleetKeyRef.current = null;
    setStations([]);
    setIsLoadingStations(true);
    setStationsError(null);
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
  }, []);

  const planSheetItems: SelectSheetItem<string>[] = useMemo(
    () =>
      subscriptions.map((s) => {
        const price = s.price_at_signup ?? 0;
        const priceLabel =
          price > 0
            ? `${s.currency || ''} ${price.toLocaleString()}`.trim()
            : '';
        const validUntil = s.next_cycle_date
          ? new Date(s.next_cycle_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '';
        const description = [priceLabel, validUntil ? `${t('rider.validUntil') || 'Valid until'} ${validUntil}` : '']
          .filter(Boolean)
          .join(' · ');
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
          description: description || undefined,
          badges,
          searchText: `${s.product_name} ${s.subscription_code} ${s.status}`,
        };
      }),
    [subscriptions, t],
  );

  const handleLogout = () => {
    // Clear all credentials from localStorage on logout
    localStorage.removeItem('authToken_rider');
    localStorage.removeItem('customerData_rider');
    localStorage.removeItem('userPhone');
    setIsLoggedIn(false);
    setCustomer(null);
    setCurrentScreen('home');
    toast.success(t('common.logoutSuccess') || 'Logged out successfully');
  };

  const handleTopUp = () => {
    setShowTopUpModal(true);
  };

  const handleConfirmTopUp = async (amount: number, transactionId: string, paymentMethod: string) => {
    try {
      const token = localStorage.getItem('authToken_rider');
      if (!token) throw new Error('Not authenticated');
      
      // TODO: Call actual API endpoint for top-up
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setBalance(prev => prev + amount);
      
      const newActivity: ActivityItem = {
        id: Date.now().toString(),
        type: 'topup',
        title: t('rider.balanceTopUp') || 'Balance Top-up',
        subtitle: paymentMethod === 'mtn' ? t('rider.mtnMobileMoney') : paymentMethod === 'flooz' ? t('rider.flooz') : t('rider.bankTransfer'),
        amount: amount,
        currency: currency,
        isPositive: true,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        date: new Date().toISOString().split('T')[0],
      };
      setActivities(prev => [newActivity, ...prev]);
      toast.success(t('rider.topUpSuccess') || 'Top-up successful');
    } catch (error: any) {
      console.error('Top-up error:', error);
      toast.error(error.message || t('rider.topUpFailed') || 'Top-up failed');
      throw error;
    }
  };

  const handleNavigateToStation = (station: Station) => {
    if (station.lat && station.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`, '_blank');
    } else {
      toast.success(t('rider.navigationStarted') || 'Navigation started');
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


  // Login screen
  if (!isLoggedIn) {
    return (
      <>
        <Toaster position="top-center" />
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Main app
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
                onClick={handleBackToRoles}
                aria-label={t('attendant.changeRole') || 'Change Role'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="flow-header-logo">
                <Image src="/assets/Logo-Oves.png" alt="Omnivoltaic" width={100} height={28} style={{ objectFit: 'contain' }} priority />
              </div>
            </div>
            <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="flow-header-lang"
                onClick={openSelectSubscription}
                aria-label={t('rider.switchPlan') || 'Switch plan'}
                title={t('rider.switchPlan') || 'Switch plan'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <path d="M4 7h16M4 12h10M4 17h16" />
                  <path d="M17 9l3 3-3 3" />
                </svg>
                <span className="flow-header-lang-label">{t('rider.switchPlan') || 'Plan'}</span>
              </button>
              <ThemeToggle />
              <button className="flow-header-lang" onClick={toggleLocale} aria-label={t('role.switchLanguage') || 'Switch Language'}>
                <Globe size={14} />
                <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </header>

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
              currency={currency}
              bike={{
                ...bike,
                paymentState: subscription?.status === 'active' ? 'active' : subscription?.status || bike.paymentState,
              }}
              nearbyStations={stations.map(s => ({
                id: s.id,
                name: s.name,
                distance: s.distance,
                batteries: s.batteries,
                lat: s.lat,
                lng: s.lng,
              }))}
              isLoadingStations={isLoadingStations}
              isLoadingBike={isLoadingBike}
              stationsError={stationsError}
              hasSubscription={!!subscription?.subscription_code}
              onRefreshStations={refetchStations}
              onFindStation={() => setCurrentScreen('stations')}
              onShowQRCode={() => setShowQRModal(true)}
              onSelectStation={handleSelectStation}
              onViewAllStations={() => setCurrentScreen('stations')}
            />
          )}
          
          {currentScreen === 'activity' && (
            <RiderActivity activities={activities} />
          )}
          
          {currentScreen === 'stations' && (
            <RiderStations
              stations={stations}
              isLoading={isLoadingStations}
              initialSelectedStationId={selectedStationId}
              onStationDeselected={() => setSelectedStationId(null)}
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
                  amount: a.amount,
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
                toast.success(t('rider.plans.selected', { name: plan.name }) || `Selected ${plan.name}`);
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
                name: customer?.name || 'James Mwangi',
                initials: customer?.name ? customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'JM',
                phone: customer?.phone || '+228 91 234 567',
                balance: balance,
                currency: currency,
                swapsThisMonth: bike.totalSwaps || 18,
                planName: subscription?.product_name || '7-Day Lux Plan',
                planValidity: subscription?.next_cycle_date 
                  ? new Date(subscription.next_cycle_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Dec 9, 2025',
                paymentState: subscription?.status === 'active' ? 'active' : subscription?.status || 'active',
                vehicleInfo: bike.vehicleId || 'REG-2024-KE',
                paymentMethod: 'MTN Mobile Money',
              }}
              bikeImageUrl="/assets/E-3-one.png"
              onAccountDetails={() => setShowAccountDetailsModal(true)}
              onVehicle={() => toast.success(t('rider.vehicleDetailsSoon') || 'Vehicle details coming soon')}
              onPlanDetails={openSelectSubscription}
              onPaymentMethods={() => toast.success(t('rider.paymentMethodsSoon') || 'Payment methods coming soon')}
              onSupport={() => setCurrentScreen('tickets')}
              onLogout={handleLogout}
              onSwitchSubscription={openSelectSubscription}
              onTransactions={() => setCurrentScreen('transactions')}
              onPlans={() => setCurrentScreen('plans')}
              onTickets={() => setCurrentScreen('tickets')}
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

      {/* Top-Up Modal */}
      <TopUpModal
        isOpen={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        currency={currency}
        onConfirmTopUp={handleConfirmTopUp}
      />

      {/* Account Details Modal */}
      <AccountDetailsModal
        isOpen={showAccountDetailsModal}
        onClose={() => setShowAccountDetailsModal(false)}
        onPasswordChanged={handleLogout}
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
    </>
  );
};

export default RiderApp;

