'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the WebViewJavascriptBridge type as per your app
interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}

interface BridgeContextProps {
  bridge: WebViewJavascriptBridge | null;
  setBridge: React.Dispatch<React.SetStateAction<WebViewJavascriptBridge | null>>;
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

  return <BridgeContext.Provider value={{ bridge, setBridge }}>{children}</BridgeContext.Provider>;
};
