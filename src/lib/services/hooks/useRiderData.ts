/**
 * useRiderData Hook
 * 
 * Custom React hook for fetching and managing rider data including:
 * - Swap stations with real-time availability
 * - Service and payment activity records
 * - Asset discovery via MQTT
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMqtt } from './useMqtt';
import {
  getFleetAvatars,
  getServicePlanActions,
  transformFleetToStations,
  transformActionsToActivity,
  buildAssetDiscoveryTopic,
  buildAssetDiscoveryResponseTopic,
  createAssetDiscoveryPayload,
  extractFleetIds,
  type SwapStation,
  type ActivityRecord,
  type AssetDiscoveryResponse,
} from '../rider-api';

// ============================================================================
// Types
// ============================================================================

export interface RiderDataState {
  // Station data
  stations: SwapStation[];
  stationsLoading: boolean;
  stationsError: string | null;
  
  // Activity data
  activities: ActivityRecord[];
  activitiesLoading: boolean;
  activitiesError: string | null;
  
  // General state
  isInitialized: boolean;
  lastFetchTime: Date | null;
}

export interface UseRiderDataReturn extends RiderDataState {
  // Actions
  fetchStations: (planId: string, customerId: string, location?: { lat: number; lng: number }) => Promise<void>;
  fetchActivities: (servicePlanId: string, currency?: string) => Promise<void>;
  refreshAll: (planId: string, customerId: string, servicePlanId?: string, currency?: string, location?: { lat: number; lng: number }) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useRiderData(): UseRiderDataReturn {
  const { publish, subscribe, isReady: mqttReady } = useMqtt();
  
  // State
  const [stations, setStations] = useState<SwapStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState<string | null>(null);
  
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  
  // Refs for async operations
  const pendingAssetDiscovery = useRef<{
    resolve: (value: string[]) => void;
    reject: (reason: Error) => void;
    timeoutId: NodeJS.Timeout;
  } | null>(null);

  // Default/fallback fleet IDs for when MQTT is not available
  const defaultFleetIds = [
    'fleet:cabinets:basic',
    'fleet:batteries:48v30ah',
  ];

  /**
   * Fetch swap stations via MQTT asset discovery + GraphQL
   */
  const fetchStations = useCallback(async (
    planId: string,
    customerId: string,
    location?: { lat: number; lng: number }
  ) => {
    setStationsLoading(true);
    setStationsError(null);

    try {
      let fleetIds: string[] = [];

      // Try MQTT asset discovery if available
      if (mqttReady) {
        console.info('[useRiderData] Attempting MQTT asset discovery');
        
        const requestTopic = buildAssetDiscoveryTopic(planId);
        const responseTopic = buildAssetDiscoveryResponseTopic(planId);
        const payload = createAssetDiscoveryPayload(planId, customerId, location);

        // Create a promise for the MQTT response
        const fleetIdsPromise = new Promise<string[]>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            console.warn('[useRiderData] MQTT asset discovery timed out, using defaults');
            pendingAssetDiscovery.current = null;
            resolve(defaultFleetIds);
          }, 15000);

          pendingAssetDiscovery.current = { resolve, reject, timeoutId };
        });

        // Subscribe to response topic
        subscribe(responseTopic, (message) => {
          console.info('[useRiderData] Received asset discovery response');
          try {
            const response = message.payload as AssetDiscoveryResponse;
            if (response.data?.success) {
              const ids = extractFleetIds(response);
              console.info('[useRiderData] Extracted fleet IDs:', ids);
              
              if (pendingAssetDiscovery.current) {
                clearTimeout(pendingAssetDiscovery.current.timeoutId);
                pendingAssetDiscovery.current.resolve(ids.length > 0 ? ids : defaultFleetIds);
                pendingAssetDiscovery.current = null;
              }
            }
          } catch (err) {
            console.error('[useRiderData] Error processing asset discovery response:', err);
          }
        });

        // Publish the request
        await publish(requestTopic, payload);

        // Wait for response
        fleetIds = await fleetIdsPromise;
      } else {
        console.info('[useRiderData] MQTT not ready, using default fleet IDs');
        fleetIds = defaultFleetIds;
      }

      // Fetch fleet avatars from GraphQL
      console.info('[useRiderData] Fetching fleet avatars for:', fleetIds);
      const result = await getFleetAvatars(fleetIds);

      if (result.success && result.data) {
        const transformedStations = transformFleetToStations(result.data, location);
        console.info('[useRiderData] Transformed stations:', transformedStations.length);
        setStations(transformedStations);
        setLastFetchTime(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch station data');
      }
    } catch (error: any) {
      console.error('[useRiderData] Error fetching stations:', error);
      setStationsError(error.message || 'Failed to load stations');
      
      // Set mock data as fallback for demo purposes
      setStations(getMockStations(location));
    } finally {
      setStationsLoading(false);
      setIsInitialized(true);
    }
  }, [mqttReady, publish, subscribe]);

  /**
   * Fetch service and payment activity records
   */
  const fetchActivities = useCallback(async (
    servicePlanId: string,
    currency: string = 'XOF'
  ) => {
    setActivitiesLoading(true);
    setActivitiesError(null);

    try {
      console.info('[useRiderData] Fetching activities for plan:', servicePlanId);
      const result = await getServicePlanActions(servicePlanId);

      if (result.success && result.data) {
        const transformedActivities = transformActionsToActivity(result.data, currency);
        console.info('[useRiderData] Transformed activities:', transformedActivities.length);
        setActivities(transformedActivities);
      } else {
        throw new Error(result.error || 'Failed to fetch activity data');
      }
    } catch (error: any) {
      console.error('[useRiderData] Error fetching activities:', error);
      setActivitiesError(error.message || 'Failed to load activities');
      
      // Set mock data as fallback for demo purposes
      setActivities(getMockActivities(currency));
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  /**
   * Refresh all rider data
   */
  const refreshAll = useCallback(async (
    planId: string,
    customerId: string,
    servicePlanId?: string,
    currency?: string,
    location?: { lat: number; lng: number }
  ) => {
    await Promise.all([
      fetchStations(planId, customerId, location),
      servicePlanId ? fetchActivities(servicePlanId, currency) : Promise.resolve(),
    ]);
  }, [fetchStations, fetchActivities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingAssetDiscovery.current) {
        clearTimeout(pendingAssetDiscovery.current.timeoutId);
        pendingAssetDiscovery.current = null;
      }
    };
  }, []);

  return {
    stations,
    stationsLoading,
    stationsError,
    activities,
    activitiesLoading,
    activitiesError,
    isInitialized,
    lastFetchTime,
    fetchStations,
    fetchActivities,
    refreshAll,
  };
}

// ============================================================================
// Mock Data (Fallback when APIs are unavailable)
// ============================================================================

function getMockStations(userLocation?: { lat: number; lng: number }): SwapStation[] {
  const baseLocation = userLocation || { lat: -1.2921, lng: 36.8219 };
  
  return [
    {
      id: 'station-001',
      name: 'Central Station',
      address: 'Downtown Commercial District',
      lat: baseLocation.lat + 0.005,
      lng: baseLocation.lng + 0.003,
      distance: '0.8 km',
      totalSlots: 8,
      availableBatteries: 5,
      chargingBatteries: 2,
      waitTime: '~2 min',
      lastUpdated: new Date().toISOString(),
      batteries: [
        { id: 'BAT-001', soc: 95, status: 'ready' },
        { id: 'BAT-002', soc: 88, status: 'ready' },
        { id: 'BAT-003', soc: 82, status: 'ready' },
      ],
    },
    {
      id: 'station-002',
      name: 'Market Station',
      address: 'Main Market Area',
      lat: baseLocation.lat - 0.008,
      lng: baseLocation.lng + 0.012,
      distance: '1.4 km',
      totalSlots: 6,
      availableBatteries: 2,
      chargingBatteries: 3,
      waitTime: '~5 min',
      lastUpdated: new Date().toISOString(),
      batteries: [
        { id: 'BAT-004', soc: 90, status: 'ready' },
        { id: 'BAT-005', soc: 85, status: 'ready' },
      ],
    },
    {
      id: 'station-003',
      name: 'Industrial Station',
      address: 'Industrial Zone North',
      lat: baseLocation.lat + 0.015,
      lng: baseLocation.lng - 0.007,
      distance: '2.1 km',
      totalSlots: 12,
      availableBatteries: 8,
      chargingBatteries: 2,
      waitTime: '~1 min',
      lastUpdated: new Date().toISOString(),
      batteries: [
        { id: 'BAT-006', soc: 98, status: 'ready' },
        { id: 'BAT-007', soc: 92, status: 'ready' },
        { id: 'BAT-008', soc: 87, status: 'ready' },
      ],
    },
    {
      id: 'station-004',
      name: 'South Station',
      address: 'Southern Business Park',
      lat: baseLocation.lat - 0.02,
      lng: baseLocation.lng - 0.01,
      distance: '3.2 km',
      totalSlots: 10,
      availableBatteries: 6,
      chargingBatteries: 3,
      waitTime: '~2 min',
      lastUpdated: new Date().toISOString(),
      batteries: [
        { id: 'BAT-009', soc: 94, status: 'ready' },
        { id: 'BAT-010', soc: 89, status: 'ready' },
      ],
    },
    {
      id: 'station-005',
      name: 'University Station',
      address: 'University Campus Gate',
      lat: baseLocation.lat + 0.025,
      lng: baseLocation.lng + 0.02,
      distance: '4.5 km',
      totalSlots: 8,
      availableBatteries: 4,
      chargingBatteries: 2,
      waitTime: '~3 min',
      lastUpdated: new Date().toISOString(),
      batteries: [
        { id: 'BAT-011', soc: 91, status: 'ready' },
        { id: 'BAT-012', soc: 86, status: 'ready' },
      ],
    },
  ];
}

function getMockActivities(currency: string = 'XOF'): ActivityRecord[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  return [
    {
      id: 'act-001',
      type: 'swap',
      title: 'Battery Swap',
      subtitle: 'Central Station',
      amount: 920,
      currency,
      isPositive: false,
      time: '14:32',
      date: now.toISOString().split('T')[0],
    },
    {
      id: 'act-002',
      type: 'topup',
      title: 'Balance Top-up',
      subtitle: 'Mobile Money - MTN',
      amount: 5000,
      currency,
      isPositive: true,
      time: '09:15',
      date: yesterday.toISOString().split('T')[0],
    },
    {
      id: 'act-003',
      type: 'swap',
      title: 'Battery Swap',
      subtitle: 'Market Station',
      amount: 1185,
      currency,
      isPositive: false,
      time: '16:48',
      date: yesterday.toISOString().split('T')[0],
    },
    {
      id: 'act-004',
      type: 'payment',
      title: 'Weekly Plan Renewal',
      subtitle: '7-Day Lux Plan',
      amount: 3760,
      currency,
      isPositive: false,
      time: '00:00',
      date: twoDaysAgo.toISOString().split('T')[0],
    },
    {
      id: 'act-005',
      type: 'swap',
      title: 'Battery Swap',
      subtitle: 'South Station',
      amount: 850,
      currency,
      isPositive: false,
      time: '11:22',
      date: twoDaysAgo.toISOString().split('T')[0],
    },
  ];
}

export default useRiderData;
