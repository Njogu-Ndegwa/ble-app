'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { connBleByMacAddress } from '@/app/utils';
import type { BleConnectionState } from './types';

// ============================================
// CONSTANTS
// ============================================

const BLE_CONNECTION_TIMEOUT = 15000; // 15 seconds
const BLE_GLOBAL_TIMEOUT = 60000; // 60 seconds - last resort
const MAX_RETRIES = 3;

const INITIAL_CONNECTION_STATE: BleConnectionState = {
  isConnecting: false,
  isConnected: false,
  connectedDevice: null,
  connectionProgress: 0,
  error: null,
  connectionFailed: false,
  requiresBluetoothReset: false,
};

// ============================================
// OPTIONS
// ============================================

export interface UseBleDeviceConnectionOptions {
  /** Called when connection succeeds */
  onConnected?: (macAddress: string) => void;
  /** Called when connection fails */
  onConnectionFailed?: (error: string, requiresReset: boolean) => void;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// HOOK
// ============================================

/**
 * useBleDeviceConnection - Hook for managing BLE device connections
 * 
 * Handles connecting to BLE devices with retry logic and timeout management.
 * Can be used independently for device management, or composed with other hooks.
 * 
 * @example
 * const {
 *   connectionState,
 *   connect,
 *   disconnect,
 *   cancelConnection,
 * } = useBleDeviceConnection({
 *   onConnected: (mac) => console.log('Connected to', mac),
 * });
 */
export function useBleDeviceConnection(options: UseBleDeviceConnectionOptions = {}) {
  const { onConnected, onConnectionFailed, debug = false } = options;

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.info('[BLE Connection]', ...args);
  }, [debug]);

  // ============================================
  // STATE
  // ============================================

  const [connectionState, setConnectionState] = useState<BleConnectionState>(INITIAL_CONNECTION_STATE);
  const [isReady, setIsReady] = useState(false);

  // ============================================
  // REFS
  // ============================================

  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const globalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isConnectedRef = useRef(false);
  const pendingMacRef = useRef<string | null>(null);

  // Callback refs
  const onConnectedRef = useRef(onConnected);
  const onConnectionFailedRef = useRef(onConnectionFailed);

  useEffect(() => {
    onConnectedRef.current = onConnected;
    onConnectionFailedRef.current = onConnectionFailed;
  }, [onConnected, onConnectionFailed]);

  // ============================================
  // TIMEOUT HELPERS
  // ============================================

  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  const clearGlobalTimeout = useCallback(() => {
    if (globalTimeoutRef.current) {
      clearTimeout(globalTimeoutRef.current);
      globalTimeoutRef.current = null;
    }
  }, []);

  const clearAllTimeouts = useCallback(() => {
    clearConnectionTimeout();
    clearGlobalTimeout();
  }, [clearConnectionTimeout, clearGlobalTimeout]);

  // ============================================
  // CORE OPERATIONS
  // ============================================

  /**
   * Connect to a BLE device
   */
  const connect = useCallback((macAddress: string) => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bluetooth not available');
      return false;
    }

    log('Connecting to:', macAddress);
    
    clearAllTimeouts();
    isConnectedRef.current = false;
    retryCountRef.current = 0;
    pendingMacRef.current = macAddress;
    
    // Store for later retrieval
    sessionStorage.setItem('pendingBleMac', macAddress);
    
    setConnectionState({
      isConnecting: true,
      isConnected: false,
      connectedDevice: null,
      connectionProgress: 0, // Don't show fake progress - wait for real progress from bridge
      error: null,
      connectionFailed: false,
      requiresBluetoothReset: false,
    });

    // Set global timeout (last resort)
    globalTimeoutRef.current = setTimeout(() => {
      log('Global timeout reached');
      clearConnectionTimeout();
      
      setConnectionState(prev => ({
        ...prev,
        isConnecting: false,
        connectionFailed: true,
        requiresBluetoothReset: true,
        error: 'Connection timed out',
      }));
      
      isConnectedRef.current = false;
      pendingMacRef.current = null;
      toast.error('Connection timed out. Please toggle Bluetooth and try again.');
      onConnectionFailedRef.current?.('Connection timed out', true);
    }, BLE_GLOBAL_TIMEOUT);

    // Initiate connection
    connBleByMacAddress(macAddress, () => {
      log('Connection initiated');
    });

    return true;
  }, [clearAllTimeouts, clearConnectionTimeout, log]);

  /**
   * Disconnect from current device
   */
  const disconnect = useCallback((macAddress?: string) => {
    const mac = macAddress || connectionState.connectedDevice || sessionStorage.getItem('connectedDeviceMac');
    
    if (!mac || !window.WebViewJavascriptBridge) return;

    log('Disconnecting from:', mac);
    window.WebViewJavascriptBridge.callHandler('disconnectBle', mac, () => {});
    sessionStorage.removeItem('connectedDeviceMac');
    
    isConnectedRef.current = false;
    setConnectionState(INITIAL_CONNECTION_STATE);
  }, [connectionState.connectedDevice, log]);

  /**
   * Cancel ongoing connection attempt
   */
  const cancelConnection = useCallback(() => {
    if (isConnectedRef.current) {
      log('Cannot cancel - already connected');
      toast('Please wait while operation completes...', { icon: '⏳' });
      return false;
    }

    log('Cancelling connection');
    clearAllTimeouts();
    
    if (window.WebViewJavascriptBridge && pendingMacRef.current) {
      window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingMacRef.current, () => {});
    }
    
    retryCountRef.current = 0;
    isConnectedRef.current = false;
    pendingMacRef.current = null;
    
    setConnectionState(INITIAL_CONNECTION_STATE);
    return true;
  }, [clearAllTimeouts, log]);

  /**
   * Reset connection state
   */
  const resetState = useCallback(() => {
    clearAllTimeouts();
    retryCountRef.current = 0;
    isConnectedRef.current = false;
    pendingMacRef.current = null;
    setConnectionState(INITIAL_CONNECTION_STATE);
  }, [clearAllTimeouts]);

  // ============================================
  // BRIDGE HANDLER SETUP
  // ============================================

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;
    
    const setupHandlers = () => {
      if (isCleanedUp) return;
      
      if (!window.WebViewJavascriptBridge) {
        log('Bridge not available yet, retrying in 500ms...');
        retryTimeout = setTimeout(setupHandlers, 500);
        return;
      }

      // Always register handlers - this replaces any existing handlers
      log('Setting up connection handlers');

      // NOTE: bridge.init() is already called in bridgeContext.tsx
      // Do NOT call init() again here as it causes the app to hang

      // Connection success handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectSuccessCallBack',
        (macAddress: string, resp: (r: unknown) => void) => {
          log('Connection successful:', macAddress);
          
          // Mark as connected immediately
          isConnectedRef.current = true;
          clearConnectionTimeout();
          clearGlobalTimeout();
          retryCountRef.current = 0;
          
          // Store connected device
          sessionStorage.setItem('connectedDeviceMac', macAddress);
          pendingMacRef.current = null;
          
          setConnectionState({
            isConnecting: false,
            isConnected: true,
            connectedDevice: macAddress,
            connectionProgress: 100,
            error: null,
            connectionFailed: false,
            requiresBluetoothReset: false,
          });
          
          onConnectedRef.current?.(macAddress);
          resp(macAddress);
        }
      );

      // Connection failure handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectFailCallBack',
        (data: string, resp: (r: unknown) => void) => {
          log('Connection failed:', data);
          
          clearConnectionTimeout();
          
          // Ignore if already connected
          if (isConnectedRef.current) {
            log('Ignoring late failure - already connected');
            resp(data);
            return;
          }
          
          const pendingMac = pendingMacRef.current;
          
          // Retry if possible
          if (retryCountRef.current < MAX_RETRIES && pendingMac) {
            retryCountRef.current += 1;
            log(`Retrying (${retryCountRef.current}/${MAX_RETRIES})`);
            
            setConnectionState(prev => ({
              ...prev,
              connectionProgress: 0, // Reset to 0, not fake 10%
              error: null,
            }));
            
            // Exponential backoff
            setTimeout(() => {
              if (isConnectedRef.current) return;
              connBleByMacAddress(pendingMac, () => {});
            }, 1000 * retryCountRef.current);
            
            resp(data);
            return;
          }
          
          // All retries exhausted
          log('Connection failed after all retries');
          clearGlobalTimeout();
          retryCountRef.current = 0;
          isConnectedRef.current = false;
          pendingMacRef.current = null;
          
          setConnectionState(prev => ({
            ...prev,
            isConnecting: false,
            connectionFailed: true,
            error: 'Connection failed. Please try again.',
          }));
          
          toast.error('Connection failed. Please try again.');
          onConnectionFailedRef.current?.('Connection failed', false);
          
          resp(data);
        }
      );

      log('Connection handlers registered');
      setIsReady(true);
    };

    setupHandlers();

    return () => {
      isCleanedUp = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      clearAllTimeouts();
      log('Connection handlers cleanup complete');
    };
  }, [clearAllTimeouts, clearConnectionTimeout, clearGlobalTimeout, log]);

  // ============================================
  // RETURN
  // ============================================

  return {
    /** Current connection state */
    connectionState,
    /** Whether connection handler is ready */
    isReady,
    /** Whether currently connected */
    isConnected: connectionState.isConnected,
    /** Connected device MAC address */
    connectedDevice: connectionState.connectedDevice,
    /** Connect to a device */
    connect,
    /** Disconnect from current device */
    disconnect,
    /** Cancel ongoing connection */
    cancelConnection,
    /** Reset connection state */
    resetState,
  };
}

export default useBleDeviceConnection;
