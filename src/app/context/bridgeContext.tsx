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

    // Register the MQTT connection callback handler
    bridge.registerHandler(
      'connectMqttCallBack',
      (data: string, responseCallback: (response: any) => void) => {
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

          // Check if connection was successful - check both outer and inner data
          const isConnected =
            parsedData?.connected === true ||
            parsedData?.status === 'connected' ||
            parsedData?.respCode === '200' ||
            actualData?.connected === true ||
            actualData?.status === 'connected' ||
            actualData?.respCode === '200' ||
            actualData?.respData === true ||
            (actualData && !actualData.error && !parsedData.error);

          // Check for explicit failure
          const isExplicitFailure = 
            actualData?.respCode === '11' ||
            actualData?.respData === false ||
            actualData?.respDesc?.toLowerCase().includes('failed');

          if (isConnected && !isExplicitFailure) {
            console.info('Global MQTT connection confirmed as connected');
            setIsMqttConnected(true);
            retryCount = 0; // Reset retry count on success
          } else {
            console.warn('Global MQTT connection callback indicates not connected:', parsedData);
            console.warn('respCode:', actualData?.respCode, 'respDesc:', actualData?.respDesc);
            setIsMqttConnected(false);
            
            // Auto-retry on failure
            if (retryCount < maxRetries) {
              retryCount++;
              console.info(`MQTT connection failed, retrying (${retryCount}/${maxRetries})...`);
              retryTimeoutId = setTimeout(() => {
                connectToMqtt();
              }, 2000 * retryCount); // Exponential backoff: 2s, 4s, 6s
            } else {
              console.error('MQTT connection failed after maximum retries');
            }
          }
          responseCallback('Received MQTT Connection Callback');
        } catch (err) {
          console.error('Error parsing MQTT connection callback:', err);
          // If we can't parse it, assume connection might be OK but log the error
          console.warn('Assuming MQTT connection is OK despite parse error');
          setIsMqttConnected(true);
          responseCallback('Received MQTT Connection Callback');
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

          if (p.error || actualResp.error) {
            const errorMsg = p.error?.message || p.error || actualResp.error?.message || actualResp.error;
            console.error('Global MQTT connection error:', errorMsg);
            setIsMqttConnected(false);
          } else if (p.respCode === '200' || actualResp.respCode === '200' || p.success === true || actualResp.respData === true) {
            console.info('Global MQTT connection initiated successfully');
            // Connection state will be confirmed by connectMqttCallBack
          } else {
            console.warn('Global MQTT connection response indicates potential issue:', p);
          }
        } catch (err) {
          console.error('Error parsing MQTT response:', err);
          // Don't set connection to false on parse error, wait for callback
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
    };
  }, [bridge, isBridgeReady]);

  return (
    <BridgeContext.Provider value={{ bridge, setBridge, isMqttConnected, isBridgeReady }}>
      {children}
    </BridgeContext.Provider>
  );
};
