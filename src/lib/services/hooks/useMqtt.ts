/**
 * useMqtt - React hook for MQTT operations
 * 
 * Provides a clean interface for subscribing to topics and publishing messages
 * within React components.
 * 
 * Usage:
 * ```typescript
 * import { useMqtt } from '@/lib/services/hooks';
 * 
 * function MyComponent() {
 *   const { publish, subscribe, isReady } = useMqtt();
 *   
 *   useEffect(() => {
 *     if (!isReady) return;
 *     
 *     const unsubscribe = subscribe('abs/response/+', (message) => {
 *       console.log('Received:', message);
 *     });
 *     
 *     return unsubscribe;
 *   }, [isReady, subscribe]);
 *   
 *   const handleSend = async () => {
 *     await publish('abs/request/customer', { action: 'lookup' });
 *   };
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

export interface UseMqttReturn {
  /**
   * Whether the MQTT service is ready to use
   */
  isReady: boolean;

  /**
   * Whether MQTT is connected
   */
  isConnected: boolean;

  /**
   * Subscribe to an MQTT topic
   * Returns an unsubscribe function
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
  const { bridge, isBridgeReady, isMqttConnected } = useBridge();
  const mqttServiceRef = useRef<MqttService | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());

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
    };
  }, []);

  const subscribe = useCallback(
    (
      topic: string,
      handler: MqttMessageHandler,
      options?: MqttSubscribeOptions
    ): (() => void) => {
      if (!mqttServiceRef.current) {
        console.warn('MQTT: Service not ready, subscription deferred');
        return () => {};
      }

      mqttServiceRef.current.subscribe(topic, handler, options);
      subscriptionsRef.current.add(topic);

      // Return unsubscribe function
      return () => {
        mqttServiceRef.current?.removeHandlers(topic);
        mqttServiceRef.current?.unsubscribe(topic);
        subscriptionsRef.current.delete(topic);
      };
    },
    []
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

      const result = await mqttServiceRef.current.publish(topic, payload, options);
      return result.success;
    },
    []
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

      return mqttServiceRef.current.publishAndWait<T>(
        publishTopic,
        payload,
        responseTopic,
        timeoutMs
      );
    },
    []
  );

  return useMemo(
    () => ({
      isReady: bridge !== null && isBridgeReady,
      isConnected: isMqttConnected,
      subscribe,
      publish,
      publishAndWait,
    }),
    [bridge, isBridgeReady, isMqttConnected, subscribe, publish, publishAndWait]
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
