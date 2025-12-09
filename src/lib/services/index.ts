/**
 * Services Layer
 * 
 * This module provides service abstractions for external communications:
 * - MQTT messaging
 * - API clients
 * - BLE operations
 * 
 * Usage:
 * ```typescript
 * // Service classes
 * import { MqttService } from '@/lib/services';
 * 
 * // React hooks
 * import { useMqtt, useSubscription, useRiderData } from '@/lib/services/hooks';
 * 
 * // Rider API
 * import { getFleetAvatars, getServicePlanActions } from '@/lib/services';
 * ```
 */

// MQTT Service
export { MqttService, getMqttService } from './mqtt-service';
export type {
  WebViewBridge,
  MqttMessage,
  MqttPublishOptions,
  MqttSubscribeOptions,
  MqttMessageHandler,
  MqttPublishResponse,
  MqttSubscribeResponse,
} from './mqtt-service';

// Rider API Service
export {
  getFleetAvatars,
  getServicePlanActions,
  transformFleetToStations,
  transformActionsToActivity,
  buildAssetDiscoveryTopic,
  buildAssetDiscoveryResponseTopic,
  createAssetDiscoveryPayload,
  extractFleetIds,
} from './rider-api';
export type {
  SwapStation,
  ActivityRecord,
  FleetData,
  FleetItem,
  ChargeSlot,
  ServicePlanActionsData,
  PaymentAction,
  ServiceAction,
  AssetDiscoveryRequest,
  AssetDiscoveryResponse,
} from './rider-api';

// Re-export hooks
export * from './hooks';
