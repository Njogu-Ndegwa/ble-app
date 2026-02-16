'use client';

import React, { useState, useEffect, useCallback, ReactNode } from 'react';

interface BluetoothGuardProps {
  children: ReactNode;
  onBluetoothError?: (error: string) => void;
}

interface BluetoothState {
  isChecking: boolean;
  isAvailable: boolean | null;
  isEnabled: boolean | null;
  error: string | null;
}

/**
 * BluetoothGuard - Checks Bluetooth availability and state before rendering children.
 * Shows helpful UI when Bluetooth is off or unavailable.
 * 
 * This prevents crashes from Bluetooth operations when BT is disabled.
 */
export function BluetoothGuard({ children, onBluetoothError }: BluetoothGuardProps) {
  const [state, setState] = useState<BluetoothState>({
    isChecking: true,
    isAvailable: null,
    isEnabled: null,
    error: null,
  });
  const [dismissed, setDismissed] = useState(false);

  const checkBluetoothState = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      // Check if WebViewJavascriptBridge is available
      if (!window.WebViewJavascriptBridge) {
        // Running in browser without native bridge
        setState({
          isChecking: false,
          isAvailable: false,
          isEnabled: null,
          error: 'Native bridge not available',
        });
        return;
      }

      // Try to check Bluetooth state via native bridge
      // The native app should expose a method to check BT state
      const checkBtState = () => new Promise<{ available: boolean; enabled: boolean }>((resolve) => {
        // Set a timeout in case the bridge doesn't respond
        const timeoutId = setTimeout(() => {
          // Assume Bluetooth is available but we can't determine state
          resolve({ available: true, enabled: true });
        }, 2000);

        try {
          window.WebViewJavascriptBridge?.callHandler(
            'checkBluetoothState',
            {},
            (responseData: string) => {
              clearTimeout(timeoutId);
              try {
                const data = typeof responseData === 'string' 
                  ? JSON.parse(responseData) 
                  : responseData;
                resolve({
                  available: data?.available !== false,
                  enabled: data?.enabled !== false,
                });
              } catch {
                // If parsing fails, assume BT is available
                resolve({ available: true, enabled: true });
              }
            }
          );
        } catch {
          clearTimeout(timeoutId);
          // If the call fails, assume BT is available
          resolve({ available: true, enabled: true });
        }
      });

      const btState = await checkBtState();
      
      setState({
        isChecking: false,
        isAvailable: btState.available,
        isEnabled: btState.enabled,
        error: null,
      });

      if (!btState.enabled && onBluetoothError) {
        onBluetoothError('Bluetooth is disabled');
      }
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      // On error, assume BT is available to not block the user
      setState({
        isChecking: false,
        isAvailable: true,
        isEnabled: true,
        error: null,
      });
    }
  }, [onBluetoothError]);

  useEffect(() => {
    checkBluetoothState();
  }, [checkBluetoothState]);

  const handleOpenSettings = () => {
    // Try to open Bluetooth settings via native bridge
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler(
        'openBluetoothSettings',
        {},
        () => {}
      );
    }
  };

  const handleRetry = () => {
    checkBluetoothState();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Still checking - show nothing (quick check)
  if (state.isChecking) {
    return <>{children}</>;
  }

  // If user dismissed the warning, let them proceed
  if (dismissed) {
    return <>{children}</>;
  }

  // If Bluetooth is disabled, show warning
  if (state.isEnabled === false) {
    return (
      <>
        {/* Overlay warning */}
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-bg-secondary rounded-2xl p-6 max-w-sm w-full border border-border-subtle">
            {/* Bluetooth Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-blue-400" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
              Bluetooth is Off
            </h2>

            {/* Description */}
            <p className="text-text-secondary text-sm text-center mb-6">
              Bluetooth is required to connect to batteries and read their energy levels. 
              Please turn on Bluetooth to continue.
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOpenSettings}
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Open Bluetooth Settings
              </button>
              
              <button
                onClick={handleRetry}
                className="w-full py-3 px-4 bg-bg-tertiary hover:bg-bg-elevated text-text-primary font-medium rounded-xl transition-colors"
              >
                Check Again
              </button>

              <button
                onClick={handleDismiss}
                className="w-full py-2 px-4 text-text-muted hover:text-text-secondary text-sm transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>

        {/* Render children behind the overlay (dimmed) */}
        <div className="opacity-30 pointer-events-none">
          {children}
        </div>
      </>
    );
  }

  // Bluetooth is available and enabled
  return <>{children}</>;
}

/**
 * Hook to check Bluetooth state and get a function to verify before operations
 */
export function useBluetoothCheck() {
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState<boolean | null>(null);

  const checkBluetooth = useCallback(async (): Promise<boolean> => {
    if (!window.WebViewJavascriptBridge) {
      // No bridge, assume we can't use BLE
      return false;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        // Timeout - assume BT is OK to not block user
        setIsBluetoothEnabled(true);
        resolve(true);
      }, 2000);

      try {
        if (window.WebViewJavascriptBridge) {
          window.WebViewJavascriptBridge.callHandler(
            'checkBluetoothState',
            {},
            (responseData: string) => {
              clearTimeout(timeoutId);
              try {
                const data = typeof responseData === 'string'
                  ? JSON.parse(responseData)
                  : responseData;
                const enabled = data?.enabled !== false;
                setIsBluetoothEnabled(enabled);
                resolve(enabled);
              } catch {
                setIsBluetoothEnabled(true);
                resolve(true);
              }
            }
          );
        } else {
          clearTimeout(timeoutId);
          setIsBluetoothEnabled(false);
          resolve(false);
        }
      } catch {
        clearTimeout(timeoutId);
        setIsBluetoothEnabled(true);
        resolve(true);
      }
    });
  }, []);

  return { isBluetoothEnabled, checkBluetooth };
}

export default BluetoothGuard;
