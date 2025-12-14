/**
 * Services Layer
 * 
 * This module provides service abstractions for external communications:
 * - MQTT messaging
 * - API clients
 * - BLE operations
 * - Payment & Service completion
 * 
 * Usage:
 * ```typescript
 * // Service classes
 * import { MqttService } from '@/lib/services';
 * 
 * // React hooks
 * import { useMqtt, useSubscription, usePaymentAndService } from '@/lib/services/hooks';
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

// Session Management Service
export {
  generateSessionId,
  getCurrentActor,
  createSessionData,
  updateSessionProgress,
  updateRecoverySummary,
  markSessionCompleted,
  saveSessionToBackend,
  loadSessionFromBackend,
  getAvailableSessions,
  canResumeSession,
  isSessionCompleted,
  getTimeElapsed,
  getStepName,
  getSessionMode,
} from './session-service';
export type {
  SessionMode,
  SessionModeInfo,
} from './session-service';

// Re-export hooks
export * from './hooks';
