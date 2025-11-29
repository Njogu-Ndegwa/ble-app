'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';

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
}

interface BridgeContextProps {
  bridge: WebViewJavascriptBridge | null;
  setBridge: React.Dispatch<React.SetStateAction<WebViewJavascriptBridge | null>>;
  isMqttConnected: boolean;
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
  const [isMqttConnected, setIsMqttConnected] = useState<boolean>(false);
  const mqttInitializedRef = useRef<boolean>(false);

  // Initialize Bridge
  useEffect(() => {
    const initializeBridge = () => {
      const ready = () => {
        if (window.WebViewJavascriptBridge) {
          setBridge(window.WebViewJavascriptBridge);
        }
      };

      if (window.WebViewJavascriptBridge) {
        ready();
      } else {
        document.addEventListener('WebViewJavascriptBridgeReady', ready, false);
      }

      return () => {
        document.removeEventListener('WebViewJavascriptBridgeReady', ready);
      };
    };

    initializeBridge();

    return () => {
      // Cleanup if necessary
    };
  }, []);

  // Initialize MQTT connection when bridge becomes available
  useEffect(() => {
    if (!bridge || mqttInitializedRef.current) {
      return;
    }

    console.info('=== Initializing Global MQTT Connection ===');
    mqttInitializedRef.current = true;

    // Register the MQTT connection callback handler
    bridge.registerHandler(
      'connectMqttCallBack',
      (data: string, responseCallback: (response: any) => void) => {
        try {
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          console.info('=== Global MQTT Connection Callback ===');
          console.info('Connection Callback Data:', JSON.stringify(parsedData, null, 2));

          // Check if connection was successful
          const isConnected =
            parsedData?.connected === true ||
            parsedData?.status === 'connected' ||
            parsedData?.respCode === '200' ||
            (parsedData && !parsedData.error);

          if (isConnected) {
            console.info('Global MQTT connection confirmed as connected');
            setIsMqttConnected(true);
          } else {
            console.warn('Global MQTT connection callback indicates not connected:', parsedData);
            setIsMqttConnected(false);
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

    // MQTT configuration with your credentials
    const mqttConfig: MqttConfig = {
      username: 'Admin',
      password: '7xzUV@MT',
      clientId: generateClientId(),
      hostname: 'mqtt.omnivoltaic.com',
      port: 1883,
    };

    console.info('=== Initiating Global MQTT Connection ===');
    console.info('MQTT Config:', { ...mqttConfig, password: '***' });

    // Connect to MQTT
    bridge.callHandler('connectMqtt', mqttConfig, (resp: string) => {
      try {
        const p = typeof resp === 'string' ? JSON.parse(resp) : resp;
        console.info('=== Global MQTT Connect Response ===');
        console.info('Connect Response:', JSON.stringify(p, null, 2));

        if (p.error) {
          console.error('Global MQTT connection error:', p.error.message || p.error);
          setIsMqttConnected(false);
        } else if (p.respCode === '200' || p.success === true) {
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

    // Cleanup function
    return () => {
      console.info('Cleaning up global MQTT connection handlers');
      mqttInitializedRef.current = false;
    };
  }, [bridge]);

  return (
    <BridgeContext.Provider value={{ bridge, setBridge, isMqttConnected }}>
      {children}
    </BridgeContext.Provider>
  );
};
