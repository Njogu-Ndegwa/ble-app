/**
 * Rider API Service
 * 
 * Provides API calls for the rider workflow:
 * - Fleet avatars (swap station locations and battery availability)
 * - Service plan actions (service & payment records)
 * - Asset ID discovery via MQTT
 */

// ============================================================================
// Types
// ============================================================================

// Fleet Avatar Types (from GraphQL endpoint)
export interface ChargeSlot {
  cnum: number;       // Slot number
  btid: string;       // Battery ID
  chst: number;       // Charge status
  rsoc: number;       // Remaining state of charge (%)
  reca: number;       // Remaining capacity
  pckv: number;       // Pack voltage (mV)
  pckc: number;       // Pack current (mA)
}

export interface FleetItem {
  oemItemID: string;
  opid: string;
  updatedAt: string;
  coordinates: {
    slat: number;   // Station latitude
    slon: number;   // Station longitude
  } | null;
  Charge_slot: ChargeSlot[] | null;
}

export interface FleetData {
  fleetId: string;
  items: FleetItem[];
}

export interface FleetAvatarsResponse {
  data: {
    getFleetAvatarsSummary: {
      fleets: FleetData[];
      missingFleetIds: string[];
    };
  };
  errors?: Array<{ message: string }>;
}

// Service Plan Actions Types (from GraphQL endpoint)
export interface PaymentAction {
  paymentActionId: string;
  paymentType: string;
  paymentAmount: number;
  createdAt: string;
}

export interface ServiceAction {
  serviceActionId: string;
  serviceType: string;
  serviceAmount: number;
  createdAt: string;
}

export interface ServicePlanActionsData {
  servicePlanId: string;
  paymentAccountId: string;
  serviceAccountId: string;
  paymentActions: PaymentAction[];
  serviceActions: ServiceAction[];
}

export interface ServicePlanActionsResponse {
  data: {
    servicePlanActions: ServicePlanActionsData;
  };
  errors?: Array<{ message: string }>;
}

// Asset Discovery Types (from MQTT endpoint)
export interface AssetDiscoveryRequest {
  timestamp: string;
  plan_id: string;
  correlation_id: string;
  actor: {
    type: 'customer' | 'rider';
    id: string;
  };
  data: {
    action: 'GET_REQUIRED_ASSET_IDS';
    rider_location?: {
      lat: number;
      lng: number;
    };
    search_radius?: number;
  };
}

export interface FleetDependencies {
  [fleetId: string]: string[];
}

export interface AssetDiscoveryMetadata {
  required_fleet_types: string[];
  fleet_ids: {
    swap_station_fleet?: string[];
    battery_fleet_standard?: string[];
    [key: string]: string[] | undefined;
  };
  location_context: {
    rider_location: {
      lat: number;
      lng: number;
    };
    search_radius: number;
    location_based_filtering: string;
  };
  fleet_dependencies: FleetDependencies;
}

export interface AssetDiscoveryResponse {
  timestamp: string;
  plan_id: string;
  correlation_id: string;
  actor: {
    type: string;
    id: string;
  };
  data: {
    plan_id: string;
    success: boolean;
    signals: string[];
    metadata: AssetDiscoveryMetadata;
    timestamp: string;
  };
}

// Transformed Station Data for UI
export interface SwapStation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance?: string;
  totalSlots: number;
  availableBatteries: number;
  chargingBatteries: number;
  waitTime: string;
  lastUpdated: string;
  batteries: {
    id: string;
    soc: number;
    status: string;
  }[];
}

// ============================================================================
// Configuration
// ============================================================================

const GRAPHQL_ENDPOINT = 'https://thing-microservice-prod.omnivoltaic.com/graphql';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 */
function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Estimate wait time based on available batteries
 */
function estimateWaitTime(availableBatteries: number): string {
  if (availableBatteries >= 10) return '~1 min';
  if (availableBatteries >= 5) return '~2 min';
  if (availableBatteries >= 2) return '~3 min';
  if (availableBatteries >= 1) return '~5 min';
  return '~10 min';
}

/**
 * Generate a friendly station name from fleet/item ID
 */
function generateStationName(fleetId: string, opid: string): string {
  // Extract meaningful parts from the ID
  const parts = opid.split(/[-_]/);
  const lastPart = parts[parts.length - 1] || opid.slice(-4);
  return `Station ${lastPart.toUpperCase()}`;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch fleet avatars (station data) from GraphQL endpoint
 */
export async function getFleetAvatars(fleetIds: string[]): Promise<{
  success: boolean;
  data?: FleetData[];
  missingFleetIds?: string[];
  error?: string;
}> {
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

  try {
    console.info('[RiderAPI] Fetching fleet avatars for:', fleetIds);
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { fleetIds },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: FleetAvatarsResponse = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error('[RiderAPI] GraphQL errors:', result.errors);
      return {
        success: false,
        error: result.errors.map(e => e.message).join(', '),
      };
    }

    console.info('[RiderAPI] Fleet avatars received:', result.data?.getFleetAvatarsSummary?.fleets?.length, 'fleets');

    return {
      success: true,
      data: result.data?.getFleetAvatarsSummary?.fleets || [],
      missingFleetIds: result.data?.getFleetAvatarsSummary?.missingFleetIds || [],
    };
  } catch (error: any) {
    console.error('[RiderAPI] Failed to fetch fleet avatars:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch station data',
    };
  }
}

/**
 * Fetch service plan actions (service & payment records)
 */
export async function getServicePlanActions(
  servicePlanId: string,
  limit: number = 20
): Promise<{
  success: boolean;
  data?: ServicePlanActionsData;
  error?: string;
}> {
  const query = `
    query GetServicePlanActions($servicePlanId: String!, $limit: Int) {
      servicePlanActions(servicePlanId: $servicePlanId, limit: $limit) {
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

  try {
    console.info('[RiderAPI] Fetching service plan actions for:', servicePlanId);

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { servicePlanId, limit },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ServicePlanActionsResponse = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error('[RiderAPI] GraphQL errors:', result.errors);
      return {
        success: false,
        error: result.errors.map(e => e.message).join(', '),
      };
    }

    console.info('[RiderAPI] Service plan actions received');

    return {
      success: true,
      data: result.data?.servicePlanActions,
    };
  } catch (error: any) {
    console.error('[RiderAPI] Failed to fetch service plan actions:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch activity data',
    };
  }
}

/**
 * Transform fleet data into UI-friendly station format
 */
export function transformFleetToStations(
  fleets: FleetData[],
  userLocation?: { lat: number; lng: number }
): SwapStation[] {
  const stations: SwapStation[] = [];

  for (const fleet of fleets) {
    for (const item of fleet.items) {
      // Skip items without coordinates
      if (!item.coordinates) continue;

      const chargeSlots = item.Charge_slot || [];
      const availableBatteries = chargeSlots.filter(
        slot => slot.btid && slot.rsoc >= 80 && slot.chst === 0
      ).length;
      const chargingBatteries = chargeSlots.filter(
        slot => slot.btid && slot.chst > 0
      ).length;

      // Calculate distance if user location is provided
      let distance: string | undefined;
      if (userLocation) {
        const km = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          item.coordinates.slat,
          item.coordinates.slon
        );
        distance = formatDistance(km);
      }

      const station: SwapStation = {
        id: item.opid || item.oemItemID,
        name: generateStationName(fleet.fleetId, item.opid),
        address: `Fleet: ${fleet.fleetId}`,
        lat: item.coordinates.slat,
        lng: item.coordinates.slon,
        distance,
        totalSlots: chargeSlots.length,
        availableBatteries,
        chargingBatteries,
        waitTime: estimateWaitTime(availableBatteries),
        lastUpdated: item.updatedAt,
        batteries: chargeSlots
          .filter(slot => slot.btid)
          .map(slot => ({
            id: slot.btid,
            soc: slot.rsoc,
            status: slot.chst > 0 ? 'charging' : slot.rsoc >= 80 ? 'ready' : 'low',
          })),
      };

      stations.push(station);
    }
  }

  // Sort by distance if available
  if (userLocation) {
    stations.sort((a, b) => {
      const distA = parseFloat(a.distance?.replace(/[^\d.]/g, '') || '999');
      const distB = parseFloat(b.distance?.replace(/[^\d.]/g, '') || '999');
      return distA - distB;
    });
  }

  return stations;
}

/**
 * Transform service plan actions into UI-friendly activity format
 */
export interface ActivityRecord {
  id: string;
  type: 'swap' | 'payment' | 'topup' | 'service';
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  isPositive: boolean;
  time: string;
  date: string;
}

export function transformActionsToActivity(
  actions: ServicePlanActionsData,
  currency: string = 'XOF'
): ActivityRecord[] {
  const activities: ActivityRecord[] = [];

  // Transform payment actions
  for (const payment of actions.paymentActions || []) {
    const date = new Date(payment.createdAt);
    activities.push({
      id: payment.paymentActionId,
      type: payment.paymentType.toLowerCase().includes('topup') ? 'topup' : 'payment',
      title: formatPaymentType(payment.paymentType),
      subtitle: `Payment ID: ${payment.paymentActionId.slice(-8)}`,
      amount: payment.paymentAmount,
      currency,
      isPositive: payment.paymentType.toLowerCase().includes('topup') || 
                  payment.paymentType.toLowerCase().includes('credit'),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: date.toISOString().split('T')[0],
    });
  }

  // Transform service actions
  for (const service of actions.serviceActions || []) {
    const date = new Date(service.createdAt);
    activities.push({
      id: service.serviceActionId,
      type: service.serviceType.toLowerCase().includes('swap') ? 'swap' : 'service',
      title: formatServiceType(service.serviceType),
      subtitle: `Service ID: ${service.serviceActionId.slice(-8)}`,
      amount: service.serviceAmount,
      currency,
      isPositive: false,
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: date.toISOString().split('T')[0],
    });
  }

  // Sort by date (newest first)
  activities.sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time}`);
    const dateB = new Date(`${b.date} ${b.time}`);
    return dateB.getTime() - dateA.getTime();
  });

  return activities;
}

/**
 * Format payment type for display
 */
function formatPaymentType(type: string): string {
  const typeMap: Record<string, string> = {
    'SUBSCRIPTION_PAYMENT': 'Subscription Payment',
    'TOPUP': 'Balance Top-up',
    'CREDIT': 'Credit Added',
    'SWAP_PAYMENT': 'Swap Payment',
    'PLAN_RENEWAL': 'Plan Renewal',
  };
  return typeMap[type.toUpperCase()] || type.replace(/_/g, ' ');
}

/**
 * Format service type for display
 */
function formatServiceType(type: string): string {
  const typeMap: Record<string, string> = {
    'BATTERY_SWAP': 'Battery Swap',
    'ENERGY_CONSUMPTION': 'Energy Consumption',
    'STATION_ACCESS': 'Station Access',
    'PLAN_ACTIVATION': 'Plan Activation',
  };
  return typeMap[type.toUpperCase()] || type.replace(/_/g, ' ');
}

// ============================================================================
// MQTT Topic Helpers
// ============================================================================

/**
 * Build MQTT topic for asset discovery request
 */
export function buildAssetDiscoveryTopic(planId: string): string {
  return `call/uxi/service/plan/${planId}/get_assets`;
}

/**
 * Build MQTT topic for asset discovery response
 */
export function buildAssetDiscoveryResponseTopic(planId: string): string {
  return `rtrn/abs/service/plan/${planId}/get_assets`;
}

/**
 * Create asset discovery request payload
 */
export function createAssetDiscoveryPayload(
  planId: string,
  customerId: string,
  location?: { lat: number; lng: number },
  searchRadius: number = 10
): AssetDiscoveryRequest {
  return {
    timestamp: new Date().toISOString(),
    plan_id: planId,
    correlation_id: `asset-discovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: {
      type: 'customer',
      id: customerId,
    },
    data: {
      action: 'GET_REQUIRED_ASSET_IDS',
      ...(location && {
        rider_location: location,
        search_radius: searchRadius,
      }),
    },
  };
}

/**
 * Extract fleet IDs from asset discovery response
 */
export function extractFleetIds(response: AssetDiscoveryResponse): string[] {
  const fleetIds: string[] = [];
  const metadata = response.data?.metadata;
  
  if (!metadata?.fleet_ids) return fleetIds;

  // Collect all fleet IDs from all fleet types
  for (const [, ids] of Object.entries(metadata.fleet_ids)) {
    if (Array.isArray(ids)) {
      fleetIds.push(...ids);
    }
  }

  return [...new Set(fleetIds)]; // Remove duplicates
}
