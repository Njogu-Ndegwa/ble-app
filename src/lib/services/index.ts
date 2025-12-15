/**
 * Services Layer
 * 
 * This module provides service abstractions for external communications:
 * - GraphQL mutations (customer identification, payment & service)
 * - MQTT messaging (legacy - being replaced by GraphQL)
 * - API clients
 * - BLE operations
 * - Payment & Service completion
 * 
 * Usage:
 * ```typescript
 * // GraphQL mutations
 * import { IDENTIFY_CUSTOMER, REPORT_PAYMENT_AND_SERVICE } from '@/lib/graphql';
 * 
 * // React hooks
 * import { usePaymentAndService } from '@/lib/services/hooks';
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

// Payment & Service Completion Service
export {
  publishPaymentAndService,
  buildPaymentAndServicePayload,
  getPaymentAndServiceTopics,
  parsePaymentAndServiceResponse,
  ERROR_SIGNALS,
  SUCCESS_SIGNALS,
} from './payment-service';
export type {
  ServiceBatteryData,
  ServiceSwapData,
  ServiceActor,
  PublishPaymentAndServiceParams,
  PaymentAndServiceResponse,
  PaymentAndServiceStatus,
} from './payment-service';

// Re-export hooks
export * from './hooks';
