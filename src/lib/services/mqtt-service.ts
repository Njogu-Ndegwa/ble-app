/**
 * MQTT Service
 * 
 * Provides a clean abstraction over the WebView bridge MQTT operations.
 * All MQTT publish/subscribe operations should go through this service.
 * 
 * Usage:
 * ```typescript
 * import { MqttService } from '@/lib/services';
 * 
 * // In a component with bridge access:
 * const mqttService = new MqttService(bridge);
 * 
 * // Subscribe to a topic
 * mqttService.subscribe('abs/response/customer/+', (message) => {
 *   console.log('Received:', message);
 * });
 * 
 * // Publish a message
 * await mqttService.publish('abs/request/customer', { action: 'lookup', code: '123' });
 * ```
 */

import { MQTT } from '../constants';

// ============================================================================
// Types
// ============================================================================

export interface WebViewBridge {
  init: (callback: (message: unknown, responseCallback: (response: unknown) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: unknown) => void) => void) => void;
  callHandler: (handlerName: string, data: unknown, callback: (responseData: string) => void) => void;
}

export interface MqttMessage {
  topic: string;
  payload: unknown;
  timestamp?: number;
}

export interface MqttPublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

export interface MqttSubscribeOptions {
  qos?: 0 | 1 | 2;
}

export type MqttMessageHandler = (message: MqttMessage) => void;

export interface MqttPublishResponse {
  success: boolean;
  error?: string;
  respCode?: string;
  respDesc?: string;
}

export interface MqttSubscribeResponse {
  success: boolean;
  error?: string;
  topic?: string;
}

// ============================================================================
// MQTT Service Class
// ============================================================================

export class MqttService {
  private bridge: WebViewBridge | null;
  private handlers: Map<string, MqttMessageHandler[]> = new Map();
  private isInitialized: boolean = false;

  constructor(bridge: WebViewBridge | null) {
    this.bridge = bridge;
  }

  /**
   * Update the bridge reference (e.g., when bridge becomes available)
   */
  setBridge(bridge: WebViewBridge | null): void {
    this.bridge = bridge;
  }

  /**
   * Check if the service is ready to use
   */
  isReady(): boolean {
    return this.bridge !== null;
  }

  /**
   * Initialize the MQTT message receiver handler
   * This should be called once when the component mounts
   */
  initializeMessageHandler(): void {
    if (!this.bridge || this.isInitialized) return;

    this.bridge.registerHandler(
      'mqttMessageReceived',
      (data: string, responseCallback: (response: unknown) => void) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          const message: MqttMessage = {
            topic: parsed.topic || '',
            payload: this.parsePayload(parsed.payload || parsed.message || parsed),
            timestamp: Date.now(),
          };

          // Dispatch to all matching handlers
          this.dispatchMessage(message);
          responseCallback({ success: true });
        } catch (error) {
          console.error('MQTT: Error processing received message:', error);
          responseCallback({ success: false, error: String(error) });
        }
      }
    );

    this.isInitialized = true;
  }

  /**
   * Subscribe to an MQTT topic
   * 
   * @param topic - The topic to subscribe to (can include wildcards: + for single level, # for multi level)
   * @param handler - Callback function when messages are received
   * @param options - Optional QoS settings
   */
  async subscribe(
    topic: string,
    handler: MqttMessageHandler,
    options: MqttSubscribeOptions = {}
  ): Promise<MqttSubscribeResponse> {
    if (!this.bridge) {
      console.error('MQTT: Bridge not available for subscribe');
      return { success: false, error: 'Bridge not available' };
    }

    // Register the handler
    const existingHandlers = this.handlers.get(topic) || [];
    existingHandlers.push(handler);
    this.handlers.set(topic, existingHandlers);

    return new Promise((resolve) => {
      const subscribeData = {
        topic,
        qos: options.qos ?? MQTT.defaultQos,
      };

      this.bridge!.callHandler(
        'mqttSubscribe',
        subscribeData,
        (response: string) => {
          try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            const success = parsed.respCode === '200' || parsed.success === true;
            
            if (!success) {
              console.error(`MQTT: Failed to subscribe to: ${topic}`, parsed);
            }

            resolve({
              success,
              topic,
              error: success ? undefined : parsed.error || parsed.respDesc,
            });
          } catch (error) {
            console.error('MQTT: Error parsing subscribe response:', error);
            resolve({ success: false, error: String(error) });
          }
        }
      );
    });
  }

  /**
   * Unsubscribe from an MQTT topic
   */
  async unsubscribe(topic: string): Promise<boolean> {
    if (!this.bridge) return false;

    // Remove handlers
    this.handlers.delete(topic);

    return new Promise((resolve) => {
      this.bridge!.callHandler(
        'mqttUnsubscribe',
        { topic },
        (response: string) => {
          try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            resolve(parsed.respCode === '200' || parsed.success === true);
          } catch {
            resolve(false);
          }
        }
      );
    });
  }

  /**
   * Publish a message to an MQTT topic
   * 
   * @param topic - The topic to publish to
   * @param payload - The message payload (will be JSON stringified)
   * @param options - Optional QoS and retain settings
   */
  async publish(
    topic: string,
    payload: unknown,
    options: MqttPublishOptions = {}
  ): Promise<MqttPublishResponse> {
    if (!this.bridge) {
      console.error('MQTT: Bridge not available for publish');
      return { success: false, error: 'Bridge not available' };
    }

    return new Promise((resolve) => {
      const publishData = {
        topic,
        message: typeof payload === 'string' ? payload : JSON.stringify(payload),
        qos: options.qos ?? MQTT.defaultQos,
        retain: options.retain ?? false,
      };

      this.bridge!.callHandler(
        'mqttPublishMsg',
        publishData,
        (response: string) => {
          try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;
            
            // Handle nested response structure
            let actualResponse = parsed;
            if (parsed?.data && typeof parsed.data === 'string') {
              try {
                actualResponse = JSON.parse(parsed.data);
              } catch {
                actualResponse = parsed;
              }
            }

            const success = 
              actualResponse.respCode === '200' || 
              actualResponse.success === true ||
              parsed.respCode === '200';

            if (!success) {
              console.error(`MQTT: Failed to publish to: ${topic}`, parsed);
            }

            resolve({
              success,
              error: success ? undefined : actualResponse.error || actualResponse.respDesc,
              respCode: actualResponse.respCode,
              respDesc: actualResponse.respDesc,
            });
          } catch (error) {
            console.error('MQTT: Error parsing publish response:', error);
            resolve({ success: false, error: String(error) });
          }
        }
      );
    });
  }

  /**
   * Publish and wait for a response on a specific topic
   * Useful for request/response patterns
   */
  async publishAndWait<T = unknown>(
    publishTopic: string,
    payload: unknown,
    responseTopic: string,
    timeoutMs: number = MQTT.timeout
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    if (!this.bridge) {
      return { success: false, error: 'Bridge not available' };
    }

    return new Promise(async (resolve) => {
      let resolved = false;

      // Handler for the response
      const responseHandler: MqttMessageHandler = (message) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        
        // Unsubscribe after receiving response
        this.unsubscribe(responseTopic);
        
        resolve({
          success: true,
          data: message.payload as T,
        });
      };

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        this.unsubscribe(responseTopic);
        resolve({ success: false, error: 'Request timed out' });
      }, timeoutMs);

      // Subscribe to response topic first
      await this.subscribe(responseTopic, responseHandler);

      // Then publish the request
      const publishResult = await this.publish(publishTopic, payload);
      
      if (!publishResult.success) {
        resolved = true;
        clearTimeout(timeoutId);
        this.unsubscribe(responseTopic);
        resolve({ success: false, error: publishResult.error || 'Publish failed' });
      }
    });
  }

  /**
   * Remove all handlers for a topic
   */
  removeHandlers(topic: string): void {
    this.handlers.delete(topic);
  }

  /**
   * Remove all handlers
   */
  clearAllHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Dispatch a received message to all matching handlers
   */
  private dispatchMessage(message: MqttMessage): void {
    this.handlers.forEach((handlers, pattern) => {
      if (this.topicMatches(pattern, message.topic)) {
        handlers.forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error('MQTT: Error in message handler:', error);
          }
        });
      }
    });
  }

  /**
   * Check if a topic matches a pattern (supports + and # wildcards)
   */
  private topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];

      // Multi-level wildcard matches everything after
      if (patternPart === '#') {
        return true;
      }

      // Single-level wildcard matches any single level
      if (patternPart === '+') {
        if (i >= topicParts.length) return false;
        continue;
      }

      // Exact match required
      if (patternPart !== topicParts[i]) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }

  /**
   * Parse message payload, handling various formats
   */
  private parsePayload(payload: unknown): unknown {
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch {
        return payload;
      }
    }
    return payload;
  }
}

// ============================================================================
// Singleton instance (optional - for simple use cases)
// ============================================================================

let defaultInstance: MqttService | null = null;

export function getMqttService(bridge?: WebViewBridge | null): MqttService {
  if (!defaultInstance) {
    defaultInstance = new MqttService(bridge || null);
  } else if (bridge) {
    defaultInstance.setBridge(bridge);
  }
  return defaultInstance;
}
