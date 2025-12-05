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
 * import { useMqtt, useSubscription } from '@/lib/services/hooks';
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

// Re-export hooks
export * from './hooks';
