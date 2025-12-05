'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';

// Define the WebViewJavascriptBridge type as per your app
interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}

// MQTT Configuration interface
interface MqttConfig {
  username: string;
  password: string;
  clientId: string;
  hostname: string;
  port: number;
  protocol?: string;
  clean?: boolean;
  connectTimeout?: number;
  reconnectPeriod?: number;
}

interface BridgeContextProps {
  bridge: WebViewJavascriptBridge | null;
  setBridge: React.Dispatch<React.SetStateAction<WebViewJavascriptBridge | null>>;
  isMqttConnected: boolean;
  isBridgeReady: boolean;
}

// Create a context for the Bridge
const BridgeContext = createContext<BridgeContextProps | undefined>(undefined);

// Custom hook to use the Bridge context
export const useBridge = (): BridgeContextProps => {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error("useBridge must be used within a BridgeProvider");
  }
  return context;
};

// BridgeProvider component
interface BridgeProviderProps {
  children: ReactNode;
}

export const BridgeProvider: React.FC<BridgeProviderProps> = ({ children }) => {
  const [bridge, setBridge] = useState<WebViewJavascriptBridge | null>(null);
  const [isBridgeReady, setIsBridgeReady] = useState<boolean>(false);
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const mqttInitializedRef = useRef<boolean>(false);
  const bridgeInitializedRef = useRef<boolean>(false);

  // Initialize Bridge - Step 1: Get the bridge object
  useEffect(() => {
    console.info('=== Bridge Provider: Looking for WebViewJavascriptBridge ===');
    
    const setupBridge = (b: WebViewJavascriptBridge) => {
      if (bridgeInitializedRef.current) {
        console.info('Bridge already initialized, skipping');
        return;
      }
      
      console.info('=== Bridge Found, Initializing... ===');
      bridgeInitializedRef.current = true;
      
      // CRITICAL: Call bridge.init() before using any other methods
      b.init((message: any, responseCallback: (response: any) => void) => {
        console.info('Bridge default handler received message:', message);
        responseCallback({ success: true });
      });
      
      console.info('=== Bridge Initialized Successfully ===');
      setBridge(b);
      setIsBridgeReady(true);
    };

    const ready = () => {
      if (window.WebViewJavascriptBridge) {
        console.info('WebViewJavascriptBridge is available on window');
        setupBridge(window.WebViewJavascriptBridge);
      }
    };

    if (window.WebViewJavascriptBridge) {
      console.info('WebViewJavascriptBridge already exists on window');
      ready();
    } else {
      console.info('Waiting for WebViewJavascriptBridgeReady event...');
      document.addEventListener('WebViewJavascriptBridgeReady', ready, false);
    }

    return () => {
      document.removeEventListener('WebViewJavascriptBridgeReady', ready);
    };
  }, []);

  // Initialize MQTT connection when bridge is FULLY ready (after init() is called)
  useEffect(() => {
    if (!bridge || !isBridgeReady || mqttInitializedRef.current) {
      if (!bridge) {
        console.info('MQTT: Waiting for bridge...');
      } else if (!isBridgeReady) {
        console.info('MQTT: Bridge exists but not yet initialized...');
      }
      return;
    }

    console.info('=== Bridge is Ready, Initializing MQTT Connection ===');
    mqttInitializedRef.current = true;

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeoutId: NodeJS.Timeout | null = null;
    let callbackReceivedRef = false; // Track if callback was received
    let callbackTimeoutId: NodeJS.Timeout | null = null;

    // Helper function to check if a respCode indicates success
    const isSuccessRespCode = (code: string | number | undefined): boolean => {
      if (code === undefined || code === null) return false;
      const codeStr = String(code);
      return codeStr === '200' || codeStr === '0'; // '0' can also indicate success in some systems
    };

    // Helper function to check if a respCode indicates failure
    const isFailureRespCode = (code: string | number | undefined): boolean => {
      if (code === undefined || code === null) return false;
      const codeStr = String(code);
      // Any non-success code is a failure
      return codeStr !== '200' && codeStr !== '0' && codeStr !== '';
    };

    // Helper function to attempt retry
    const attemptRetry = (reason: string) => {
      if (retryCount < maxRetries) {
        retryCount++;
        console.info(`MQTT connection failed (${reason}), retrying (${retryCount}/${maxRetries})...`);
        retryTimeoutId = setTimeout(() => {
          connectToMqtt();
        }, 2000 * retryCount); // Exponential backoff: 2s, 4s, 6s
      } else {
        console.error(`MQTT connection failed after maximum retries (${reason})`);
      }
    };

    // Register the MQTT connection callback handler
    bridge.registerHandler(
      'connectMqttCallBack',
      (data: string, responseCallback: (response: any) => void) => {
        callbackReceivedRef = true; // Mark that we received the callback
        
        // Clear callback timeout since we received the callback
        if (callbackTimeoutId) {
          clearTimeout(callbackTimeoutId);
          callbackTimeoutId = null;
        }

        try {
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          console.info('=== Global MQTT Connection Callback ===');
          console.info('Connection Callback Data:', JSON.stringify(parsedData, null, 2));

          // Handle nested data structure - the actual response may be inside a 'data' field as a string
          let actualData = parsedData;
          if (parsedData?.data && typeof parsedData.data === 'string') {
            try {
              actualData = JSON.parse(parsedData.data);
              console.info('Parsed nested data:', JSON.stringify(actualData, null, 2));
            } catch {
              // If nested data parsing fails, use the original
              actualData = parsedData;
            }
          }

          // Check if connection was successful - use explicit success indicators only
          // DO NOT use fallback conditions that assume success when no error field exists
          const isConnected =
            parsedData?.connected === true ||
            parsedData?.status === 'connected' ||
            isSuccessRespCode(parsedData?.respCode) ||
            actualData?.connected === true ||
            actualData?.status === 'connected' ||
            isSuccessRespCode(actualData?.respCode) ||
            actualData?.respData === true;

          // Check for explicit failure indicators
          const isExplicitFailure = 
            isFailureRespCode(actualData?.respCode) ||
            isFailureRespCode(parsedData?.respCode) ||
            actualData?.respData === false ||
            parsedData?.respData === false ||
            actualData?.connected === false ||
            parsedData?.connected === false ||
            actualData?.status === 'disconnected' ||
            parsedData?.status === 'disconnected' ||
            actualData?.error !== undefined ||
            parsedData?.error !== undefined ||
            (typeof actualData?.respDesc === 'string' && 
              (actualData.respDesc.toLowerCase().includes('failed') ||
               actualData.respDesc.toLowerCase().includes('error') ||
               actualData.respDesc.toLowerCase().includes('refused') ||
               actualData.respDesc.toLowerCase().includes('timeout') ||
               actualData.respDesc.toLowerCase().includes('not connected')));

          if (isConnected && !isExplicitFailure) {
            console.info('Global MQTT connection confirmed as connected');
            setIsMqttConnected(true);
            retryCount = 0; // Reset retry count on success
          } else {
            console.warn('Global MQTT connection callback indicates not connected:', parsedData);
            console.warn('respCode:', actualData?.respCode, 'respDesc:', actualData?.respDesc);
            console.warn('isConnected:', isConnected, 'isExplicitFailure:', isExplicitFailure);
            setIsMqttConnected(false);
            
            // Auto-retry on failure
            attemptRetry('callback indicated failure');
          }
          responseCallback('Received MQTT Connection Callback');
        } catch (err) {
          console.error('Error parsing MQTT connection callback:', err);
          // On parse error, don't assume success - treat as failure and retry
          setIsMqttConnected(false);
          attemptRetry('callback parse error');
          responseCallback('Received MQTT Connection Callback with error');
        }
      }
    );

    // Generate unique client ID to avoid conflicts when multiple devices connect
    const generateClientId = () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      return `oves-app-${timestamp}-${random}`;
    };

    const connectToMqtt = () => {
      callbackReceivedRef = false; // Reset callback tracking for this attempt
      
      // MQTT configuration with your credentials
      const mqttConfig: MqttConfig = {
        username: 'Admin',
        password: '7xzUV@MT',
        clientId: generateClientId(),
        hostname: 'mqtt.omnivoltaic.com',
        port: 1883,
        protocol: 'mqtt',
        clean: true,
        connectTimeout: 40000,
        reconnectPeriod: 1000,
      };

      console.info('=== Initiating Global MQTT Connection ===');
      console.info('MQTT Config:', { ...mqttConfig, password: '***' });

      // Set a timeout in case the callback is never called
      // This ensures we retry even if the native bridge fails silently
      callbackTimeoutId = setTimeout(() => {
        if (!callbackReceivedRef) {
          console.warn('MQTT callback timeout - no response received from native bridge');
          setIsMqttConnected(false);
          attemptRetry('callback timeout');
        }
      }, 10000); // 10 second timeout for callback

      // Connect to MQTT
      bridge.callHandler('connectMqtt', mqttConfig, (resp: string) => {
        try {
          const p = typeof resp === 'string' ? JSON.parse(resp) : resp;
          console.info('=== Global MQTT Connect Response ===');
          console.info('Connect Response:', JSON.stringify(p, null, 2));

          // Handle nested data structure
          let actualResp = p;
          if (p?.responseData && typeof p.responseData === 'string') {
            try {
              actualResp = JSON.parse(p.responseData);
              console.info('Parsed nested responseData:', JSON.stringify(actualResp, null, 2));
            } catch {
              actualResp = p;
            }
          }

          // Check for immediate errors in the connect response
          const hasError = p.error || actualResp.error;
          const hasFailureCode = isFailureRespCode(p?.respCode) || isFailureRespCode(actualResp?.respCode);
          
          if (hasError || hasFailureCode) {
            const errorMsg = p.error?.message || p.error || actualResp.error?.message || actualResp.error || 
                            p.respDesc || actualResp.respDesc || 'Unknown error';
            console.error('Global MQTT connection error:', errorMsg);
            setIsMqttConnected(false);
            
            // Clear callback timeout since we know it failed
            if (callbackTimeoutId) {
              clearTimeout(callbackTimeoutId);
              callbackTimeoutId = null;
            }
            
            // Retry on immediate error
            attemptRetry(`immediate error: ${errorMsg}`);
          } else if (isSuccessRespCode(p?.respCode) || isSuccessRespCode(actualResp?.respCode) || 
                     p.success === true || actualResp.respData === true) {
            console.info('Global MQTT connection initiated successfully');
            // Connection state will be confirmed by connectMqttCallBack
          } else {
            console.warn('Global MQTT connection response is ambiguous:', p);
            // Don't retry here - wait for the callback or callback timeout
          }
        } catch (err) {
          console.error('Error parsing MQTT response:', err);
          // Don't retry here on parse error - wait for callback or callback timeout
        }
      });
    };

    // Initial connection attempt (small delay to ensure callback handler is registered first)
    setTimeout(() => {
      console.info('=== Starting MQTT Connection (after 500ms delay) ===');
      connectToMqtt();
    }, 500);

    // Cleanup function
    return () => {
      console.info('Cleaning up global MQTT connection handlers');
      mqttInitializedRef.current = false;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      if (callbackTimeoutId) {
        clearTimeout(callbackTimeoutId);
      }
    };
  }, [bridge, isBridgeReady]);

  return (
    <BridgeContext.Provider value={{ bridge, setBridge, isMqttConnected, isBridgeReady }}>
      {children}
    </BridgeContext.Provider>
  );
};
