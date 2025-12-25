/**
 * useMqtt - React hook for MQTT operations
 * 
 * Provides a clean interface for subscribing to topics and publishing messages
 * within React components.
 * 
 * Features:
 * - Automatic re-subscription when MQTT reconnects after disconnection
 * - Connection state tracking
 * - Manual reconnection trigger
 * 
 * Usage:
 * ```typescript
 * import { useMqtt } from '@/lib/services/hooks';
 * 
 * function MyComponent() {
 *   const { publish, subscribe, isReady, isConnected, reconnectionState, reconnect } = useMqtt();
 *   
 *   useEffect(() => {
 *     if (!isReady || !isConnected) return;
 *     
 *     const unsubscribe = subscribe('abs/response/+', (message) => {
 *       console.log('Received:', message);
 *     });
 *     
 *     return unsubscribe;
 *   }, [isReady, isConnected, subscribe]);
 *   
 *   const handleSend = async () => {
 *     if (!isConnected) {
 *       toast.error('MQTT not connected');
 *       return;
 *     }
 *     await publish('abs/request/customer', { action: 'lookup' });
 *   };
 *   
 *   // Show reconnecting UI
 *   if (reconnectionState.isReconnecting) {
 *     return <div>Reconnecting... Attempt {reconnectionState.attemptCount}</div>;
 *   }
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useBridge } from '@/app/context/bridgeContext';
import { 
  MqttService, 
  MqttMessage, 
  MqttMessageHandler, 
  MqttPublishOptions,
  MqttSubscribeOptions,
} from '../mqtt-service';

// Reconnection state exposed from bridge context
export interface MqttReconnectionState {
  isReconnecting: boolean;
  attemptCount: number;
  lastError?: string;
  nextRetryIn?: number;
}

// Subscription info for re-subscription on reconnect
interface SubscriptionInfo {
  topic: string;
  handler: MqttMessageHandler;
  options?: MqttSubscribeOptions;
}

export interface UseMqttReturn {
  /**
   * Whether the MQTT service is ready to use (bridge initialized)
   */
  isReady: boolean;

  /**
   * Whether MQTT is currently connected
   */
  isConnected: boolean;

  /**
   * Current reconnection state (for UI feedback)
   */
  reconnectionState: MqttReconnectionState;

  /**
   * Manually trigger MQTT reconnection
   */
  reconnect: () => void;

  /**
   * Subscribe to an MQTT topic
   * Returns an unsubscribe function
   * Note: Subscriptions are automatically restored after reconnection
   */
  subscribe: (
    topic: string,
    handler: MqttMessageHandler,
    options?: MqttSubscribeOptions
  ) => () => void;

  /**
   * Publish a message to an MQTT topic
   */
  publish: (
    topic: string,
    payload: unknown,
    options?: MqttPublishOptions
  ) => Promise<boolean>;

  /**
   * Publish and wait for a response
   */
  publishAndWait: <T = unknown>(
    publishTopic: string,
    payload: unknown,
    responseTopic: string,
    timeoutMs?: number
  ) => Promise<{ success: boolean; data?: T; error?: string }>;
}

export function useMqtt(): UseMqttReturn {
  const { bridge, isBridgeReady, isMqttConnected, mqttReconnectionState, reconnectMqtt } = useBridge();
  const mqttServiceRef = useRef<MqttService | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  
  // Store subscription info for re-subscription on reconnect
  const subscriptionInfoRef = useRef<Map<string, SubscriptionInfo>>(new Map());
  
  // Track previous connection state for detecting reconnection
  const wasConnectedRef = useRef<boolean>(false);

  // Initialize MQTT service when bridge is ready
  useEffect(() => {
    if (bridge && isBridgeReady) {
      if (!mqttServiceRef.current) {
        mqttServiceRef.current = new MqttService(bridge);
        mqttServiceRef.current.initializeMessageHandler();
      } else {
        mqttServiceRef.current.setBridge(bridge);
      }
    }
  }, [bridge, isBridgeReady]);

  // Re-subscribe to all topics when MQTT reconnects
  useEffect(() => {
    // Detect reconnection: was disconnected, now connected
    if (wasConnectedRef.current === false && isMqttConnected === true) {
      // Re-subscribe to all stored subscriptions
      subscriptionInfoRef.current.forEach((info, topic) => {
        mqttServiceRef.current?.subscribe(topic, info.handler, info.options);
      });
    }
    
    // Update previous state
    wasConnectedRef.current = isMqttConnected;
  }, [isMqttConnected]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    // Copy refs inside effect for cleanup
    const mqttService = mqttServiceRef.current;
    const subscriptions = subscriptionsRef.current;
    
    return () => {
      if (mqttService) {
        subscriptions.forEach((topic) => {
          mqttService.unsubscribe(topic);
        });
        mqttService.clearAllHandlers();
      }
      // Clear subscription info on unmount
      subscriptionInfoRef.current.clear();
    };
  }, []);

  const subscribe = useCallback(
    (
      topic: string,
      handler: MqttMessageHandler,
      options?: MqttSubscribeOptions
    ): (() => void) => {
      // Store subscription info for re-subscription on reconnect
      subscriptionInfoRef.current.set(topic, { topic, handler, options });
      subscriptionsRef.current.add(topic);
      
      // Only actually subscribe if service is ready and connected
      if (mqttServiceRef.current && isMqttConnected) {
        mqttServiceRef.current.subscribe(topic, handler, options);
      } else {
        console.warn(`MQTT: Service not ready or not connected, subscription to ${topic} deferred until reconnection`);
      }

      // Return unsubscribe function
      return () => {
        subscriptionInfoRef.current.delete(topic);
        subscriptionsRef.current.delete(topic);
        mqttServiceRef.current?.removeHandlers(topic);
        mqttServiceRef.current?.unsubscribe(topic);
      };
    },
    [isMqttConnected]
  );

  const publish = useCallback(
    async (
      topic: string,
      payload: unknown,
      options?: MqttPublishOptions
    ): Promise<boolean> => {
      if (!mqttServiceRef.current) {
        console.error('MQTT: Service not ready for publish');
        return false;
      }
      
      if (!isMqttConnected) {
        console.error('MQTT: Not connected, cannot publish');
        return false;
      }

      const result = await mqttServiceRef.current.publish(topic, payload, options);
      return result.success;
    },
    [isMqttConnected]
  );

  const publishAndWait = useCallback(
    async <T = unknown>(
      publishTopic: string,
      payload: unknown,
      responseTopic: string,
      timeoutMs?: number
    ): Promise<{ success: boolean; data?: T; error?: string }> => {
      if (!mqttServiceRef.current) {
        return { success: false, error: 'MQTT service not ready' };
      }
      
      if (!isMqttConnected) {
        return { success: false, error: 'MQTT is currently not connected' };
      }

      return mqttServiceRef.current.publishAndWait<T>(
        publishTopic,
        payload,
        responseTopic,
        timeoutMs
      );
    },
    [isMqttConnected]
  );

  return useMemo(
    () => ({
      isReady: bridge !== null && isBridgeReady,
      isConnected: isMqttConnected,
      reconnectionState: mqttReconnectionState,
      reconnect: reconnectMqtt,
      subscribe,
      publish,
      publishAndWait,
    }),
    [bridge, isBridgeReady, isMqttConnected, mqttReconnectionState, reconnectMqtt, subscribe, publish, publishAndWait]
  );
}

/**
 * useSubscription - Simplified hook for subscribing to a single topic
 * 
 * Usage:
 * ```typescript
 * const { lastMessage, messages } = useSubscription('abs/response/customer/+');
 * ```
 */
export interface UseSubscriptionReturn {
  lastMessage: MqttMessage | null;
  messages: MqttMessage[];
  clearMessages: () => void;
}

export function useSubscription(
  topic: string,
  options?: MqttSubscribeOptions & { maxMessages?: number }
): UseSubscriptionReturn {
  const { subscribe, isReady } = useMqtt();
  const messagesRef = useRef<MqttMessage[]>([]);
  const lastMessageRef = useRef<MqttMessage | null>(null);
  const maxMessages = options?.maxMessages ?? 100;

  useEffect(() => {
    if (!isReady) return;

    const unsubscribe = subscribe(
      topic,
      (message) => {
        lastMessageRef.current = message;
        messagesRef.current = [
          message,
          ...messagesRef.current.slice(0, maxMessages - 1),
        ];
      },
      options
    );

    return unsubscribe;
  }, [topic, isReady, subscribe, maxMessages, options]);

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    lastMessageRef.current = null;
  }, []);

  return {
    lastMessage: lastMessageRef.current,
    messages: messagesRef.current,
    clearMessages,
  };
}
