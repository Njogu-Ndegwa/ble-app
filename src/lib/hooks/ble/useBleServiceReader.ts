'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { initServiceBleData } from '@/app/utils';
import type { BleServiceState } from './types';
import { parseBleResponse, forceDisconnectAll, getDebugMessage } from './bleErrors';

// ============================================
// CONSTANTS
// ============================================

const SERVICE_READ_TIMEOUT = 20000; // 20 seconds

const INITIAL_SERVICE_STATE: BleServiceState = {
  isReading: false,
  progress: 0,
  error: null,
};

// ============================================
// OPTIONS
// ============================================

export interface UseBleServiceReaderOptions {
  /** Called when service data is received */
  onServiceData?: (serviceName: string, data: unknown) => void;
  /** Called on read error */
  onError?: (error: string) => void;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// HOOK
// ============================================

/**
 * useBleServiceReader - Hook for reading BLE service data
 * 
 * Handles requesting and receiving BLE service data (like DTA for batteries).
 * Can be used after a device is connected to read specific services.
 * 
 * Uses centralized error handling from bleErrors.ts to systematically
 * handle all error responses from the native BLE layer.
 * 
 * @example
 * const {
 *   serviceState,
 *   readService,
 *   readDtaService,
 * } = useBleServiceReader({
 *   onServiceData: (name, data) => console.log(name, data),
 * });
 * 
 * // After connection:
 * readDtaService(macAddress);
 */
export function useBleServiceReader(options: UseBleServiceReaderOptions = {}) {
  const { onServiceData, onError, debug = false } = options;

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.info('[BLE Service]', ...args);
  }, [debug]);

  // ============================================
  // STATE
  // ============================================

  const [serviceState, setServiceState] = useState<BleServiceState>(INITIAL_SERVICE_STATE);
  const [isReady, setIsReady] = useState(false);
  const [lastServiceData, setLastServiceData] = useState<unknown>(null);

  // ============================================
  // REFS
  // ============================================

  const readTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingServiceRef = useRef<string | null>(null);
  const pendingMacRef = useRef<string | null>(null);

  // Callback refs
  const onServiceDataRef = useRef(onServiceData);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onServiceDataRef.current = onServiceData;
    onErrorRef.current = onError;
  }, [onServiceData, onError]);

  // ============================================
  // TIMEOUT HELPERS
  // ============================================

  const clearReadTimeout = useCallback(() => {
    if (readTimeoutRef.current) {
      clearTimeout(readTimeoutRef.current);
      readTimeoutRef.current = null;
    }
  }, []);

  // ============================================
  // ERROR HANDLING
  // ============================================

  /**
   * Handle BLE error response using centralized error handling
   * This is called from multiple places (sync callback, async handlers)
   */
  const handleBleError = useCallback((responseData: unknown, source: string) => {
    const result = parseBleResponse(responseData);
    
    if (result.success) {
      return false; // Not an error
    }
    
    const error = result.error!;
    log(`BLE error from ${source}:`, getDebugMessage(error));
    
    // Clear timeout and pending state
    clearReadTimeout();
    toast.dismiss('service-refresh');
    
    // Force disconnect if needed
    if (error.requiresBluetoothReset) {
      forceDisconnectAll(log);
    }
    
    // Also disconnect from current pending MAC
    if (pendingMacRef.current && window.WebViewJavascriptBridge) {
      log('Disconnecting from pending MAC:', pendingMacRef.current);
      window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingMacRef.current, () => {});
    }
    
    // Update state
    setServiceState(prev => ({
      ...prev,
      isReading: false,
      error: error.message,
    }));
    
    pendingServiceRef.current = null;
    pendingMacRef.current = null;
    
    // Show toast and notify callback
    if (error.requiresBluetoothReset) {
      toast.error('Please turn Bluetooth OFF then ON and try again.');
    } else {
      toast.error(error.message);
    }
    
    onErrorRef.current?.(error.message);
    
    return true; // Error was handled
  }, [clearReadTimeout, log]);

  // ============================================
  // CORE OPERATIONS
  // ============================================

  /**
   * Read a specific BLE service
   */
  const readService = useCallback((serviceName: string, macAddress: string) => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bluetooth not available');
      return false;
    }

    log('Reading service:', serviceName, 'from:', macAddress);
    
    clearReadTimeout();
    pendingServiceRef.current = serviceName;
    pendingMacRef.current = macAddress;
    
    setServiceState({
      isReading: true,
      progress: 0,
      error: null,
    });

    // Set timeout
    readTimeoutRef.current = setTimeout(() => {
      log('Service read timeout');
      
      setServiceState(prev => ({
        ...prev,
        isReading: false,
        error: 'Service read timed out',
      }));
      
      pendingServiceRef.current = null;
      pendingMacRef.current = null;
      
      toast.error('Could not read device data. Please try again.');
      onErrorRef.current?.('Service read timeout');
    }, SERVICE_READ_TIMEOUT);

    // Request service data
    // IMPORTANT: Handle synchronous error responses from native layer
    // The native layer may return errors directly in this callback,
    // rather than through the async bridge handlers
    initServiceBleData(
      { serviceName, macAddress },
      (responseData: string) => {
        log('Service request response:', responseData);
        
        // Use centralized error handling for synchronous responses
        if (responseData) {
          handleBleError(responseData, 'sync-callback');
        }
      }
    );

    return true;
  }, [clearReadTimeout, handleBleError, log]);

  /**
   * Shortcut to read DTA service (common for batteries - energy data)
   */
  const readDtaService = useCallback((macAddress: string) => {
    return readService('DTA', macAddress);
  }, [readService]);

  /**
   * Shortcut to read ATT service (for actual battery ID - opid/ppid)
   */
  const readAttService = useCallback((macAddress: string) => {
    return readService('ATT', macAddress);
  }, [readService]);

  /**
   * Cancel ongoing service read
   */
  const cancelRead = useCallback(() => {
    log('Cancelling service read');
    clearReadTimeout();
    pendingServiceRef.current = null;
    pendingMacRef.current = null;
    toast.dismiss('service-refresh');
    setServiceState(INITIAL_SERVICE_STATE);
  }, [clearReadTimeout, log]);

  /**
   * Reset state
   */
  const resetState = useCallback(() => {
    clearReadTimeout();
    pendingServiceRef.current = null;
    pendingMacRef.current = null;
    toast.dismiss('service-refresh');
    setServiceState(INITIAL_SERVICE_STATE);
    setLastServiceData(null);
  }, [clearReadTimeout]);

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
      log('Setting up service reader handlers');

      // NOTE: bridge.init() is already called in bridgeContext.tsx
      // Do NOT call init() again here as it causes the app to hang

      // Progress handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataOnProgressCallBack',
        (data: string, resp: (r: unknown) => void) => {
          try {
            const p = JSON.parse(data);
            const progress = Math.round((p.progress / p.total) * 100);
            
            setServiceState(prev => ({
              ...prev,
              progress,
            }));
          } catch {
            // Ignore parse errors
          }
          resp({ received: true });
        }
      );

      // Complete handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataOnCompleteCallBack',
        (data: string, resp: (r: unknown) => void) => {
          // Use centralized error handling
          const result = parseBleResponse(data);
          
          if (!result.success) {
            // Handle error using centralized handler
            const error = result.error!;
            log('Service returned error (complete callback):', getDebugMessage(error));
            
            clearReadTimeout();
            toast.dismiss('service-refresh');
            
            if (error.requiresBluetoothReset) {
              forceDisconnectAll(log);
            }
            
            setServiceState(prev => ({
              ...prev,
              isReading: false,
              error: error.message,
            }));
            
            pendingServiceRef.current = null;
            pendingMacRef.current = null;
            
            if (error.requiresBluetoothReset) {
              toast.error('Please turn Bluetooth OFF then ON and try again.');
            } else {
              toast.error(error.message);
            }
            
            onErrorRef.current?.(error.message);
            resp({ success: false, error: error.respDesc });
            return;
          }
          
          // Success case
          try {
            const parsedData = result.data as Record<string, unknown>;
            
            // Get service name from response
            const serviceName = (parsedData?.serviceNameEnum as string) || pendingServiceRef.current || 'unknown';
            
            log('Service data received:', serviceName);
            clearReadTimeout();
            
            setServiceState(prev => ({
              ...prev,
              isReading: false,
              progress: 100,
            }));
            
            setLastServiceData(parsedData);
            toast.dismiss('service-refresh');
            
            // Notify callback
            onServiceDataRef.current?.(serviceName, parsedData);
            
            // Reset pending refs
            pendingServiceRef.current = null;
            pendingMacRef.current = null;
            
            resp(parsedData);
          } catch (err) {
            log('Error processing service data:', err);
            clearReadTimeout();
            toast.dismiss('service-refresh');
            
            setServiceState(prev => ({
              ...prev,
              isReading: false,
              error: 'Failed to process service data',
            }));
            
            pendingServiceRef.current = null;
            pendingMacRef.current = null;
            
            toast.error('Failed to read device data.');
            onErrorRef.current?.('Parse error');
            resp({ success: false, error: String(err) });
          }
        }
      );

      // Failure handler
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataFailureCallBack',
        (data: string, resp: (r: unknown) => void) => {
          log('Service read failed (failure callback):', data);
          
          // Use centralized error handling
          const result = parseBleResponse(data);
          const error = result.error;
          
          clearReadTimeout();
          toast.dismiss('service-refresh');
          
          // Always force disconnect on failure callback
          forceDisconnectAll(log);
          
          // Also disconnect from pending MAC
          if (pendingMacRef.current && window.WebViewJavascriptBridge) {
            log('Disconnecting from pending MAC:', pendingMacRef.current);
            window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingMacRef.current, () => {});
          }
          
          const errorMessage = error?.message || 'Failed to read service data';
          const requiresReset = error?.requiresBluetoothReset ?? true; // Default to true for failure callback
          
          setServiceState(prev => ({
            ...prev,
            isReading: false,
            error: errorMessage,
          }));
          
          pendingServiceRef.current = null;
          pendingMacRef.current = null;
          
          if (requiresReset) {
            toast.error('Please turn Bluetooth OFF then ON and try again.');
          } else {
            toast.error('Unable to read device data. Please try again.');
          }
          
          onErrorRef.current?.(errorMessage);
          resp({ received: true });
        }
      );

      log('Service reader handlers registered');
      setIsReady(true);
    };

    setupHandlers();

    return () => {
      isCleanedUp = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      clearReadTimeout();
      toast.dismiss('service-refresh');
      log('Service reader cleanup complete');
    };
  }, [clearReadTimeout, log]);

  // ============================================
  // RETURN
  // ============================================

  return {
    /** Current service state */
    serviceState,
    /** Whether service reader is ready */
    isReady,
    /** Last received service data */
    lastServiceData,
    /** Read any service */
    readService,
    /** Read DTA service (shortcut) - for energy data */
    readDtaService,
    /** Read ATT service (shortcut) - for actual battery ID (opid/ppid) */
    readAttService,
    /** Cancel ongoing read */
    cancelRead,
    /** Reset state */
    resetState,
  };
}

export default useBleServiceReader;
