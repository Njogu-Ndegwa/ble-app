'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { initServiceBleData } from '@/app/utils';
import type { BleServiceState, DtaServiceData } from './types';

// ============================================
// CONSTANTS
// ============================================

const SERVICE_READ_TIMEOUT = 20000; // 20 seconds
const MAX_REFRESH_RETRIES = 2;
const REFRESH_DELAY = 1500;

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
  const refreshRetryRef = useRef(0);
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
    refreshRetryRef.current = 0;
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
      
      toast.error('Could not read device data. Please try again.');
      onErrorRef.current?.('Service read timeout');
    }, SERVICE_READ_TIMEOUT);

    // Request service data
    initServiceBleData(
      { serviceName, macAddress },
      () => log('Service request sent')
    );

    return true;
  }, [clearReadTimeout, log]);

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
    refreshRetryRef.current = 0;
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
    refreshRetryRef.current = 0;
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
          try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            
            // Check for error response
            const respCode = parsedData?.respCode || parsedData?.responseData?.respCode;
            const respDesc = parsedData?.respDesc || parsedData?.responseData?.respDesc || '';
            
            if (respCode && respCode !== '200' && respCode !== 200) {
              log('Service returned error:', { respCode, respDesc });
              
              const isDisconnected = typeof respDesc === 'string' && (
                respDesc.toLowerCase().includes('bluetooth device not connected') ||
                respDesc.toLowerCase().includes('device not connected') ||
                respDesc.toLowerCase().includes('not connected')
              );
              
              // Check for MAC address mismatch error (respCode 7)
              const isMacMismatch = respCode === '7' || respCode === 7 || (
                typeof respDesc === 'string' && (
                  respDesc.toLowerCase().includes('macaddress is not match') ||
                  respDesc.toLowerCase().includes('mac address is not match') ||
                  respDesc.toLowerCase().includes('macaddress not match')
                )
              );
              
              if (isDisconnected || isMacMismatch) {
                clearReadTimeout();
                toast.dismiss('service-refresh');
                
                // Force disconnect from ALL known MACs to clear native layer state
                const connectedMac = sessionStorage.getItem('connectedDeviceMac');
                const pendingMac = sessionStorage.getItem('pendingBleMac');
                
                if (window.WebViewJavascriptBridge) {
                  if (connectedMac) {
                    log('Force disconnecting from connectedMac:', connectedMac);
                    window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
                  }
                  if (pendingMac && pendingMac !== connectedMac) {
                    log('Force disconnecting from pendingMac:', pendingMac);
                    window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingMac, () => {});
                  }
                  // Also disconnect from pendingMacRef if different from stored values
                  if (pendingMacRef.current && 
                      pendingMacRef.current !== connectedMac && 
                      pendingMacRef.current !== pendingMac) {
                    log('Force disconnecting from pendingMacRef:', pendingMacRef.current);
                    window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingMacRef.current, () => {});
                  }
                }
                
                // Clear sessionStorage
                sessionStorage.removeItem('connectedDeviceMac');
                sessionStorage.removeItem('pendingBleMac');
                
                // CRITICAL: Reset pending refs to allow fresh retry
                refreshRetryRef.current = 0;
                pendingServiceRef.current = null;
                pendingMacRef.current = null;
                
                const errorMessage = isMacMismatch 
                  ? 'Bluetooth connection stuck. Please turn Bluetooth OFF then ON.'
                  : 'Bluetooth connection lost';
                
                setServiceState(prev => ({
                  ...prev,
                  isReading: false,
                  error: errorMessage,
                }));
                
                toast.error('Please turn Bluetooth OFF then ON and try again.');
                onErrorRef.current?.(errorMessage);
                resp({ success: false, error: respDesc });
                return;
              }
            }
            
            // Get service name from response
            const serviceName = parsedData?.serviceNameEnum || pendingServiceRef.current || 'unknown';
            
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
            refreshRetryRef.current = 0;
            pendingServiceRef.current = null;
            pendingMacRef.current = null;
            
            resp(parsedData);
          } catch (err) {
            log('Error parsing service data:', err);
            clearReadTimeout();
            toast.dismiss('service-refresh');
            
            // CRITICAL: Reset pending refs to allow fresh retry
            refreshRetryRef.current = 0;
            pendingServiceRef.current = null;
            pendingMacRef.current = null;
            
            setServiceState(prev => ({
              ...prev,
              isReading: false,
              error: 'Failed to parse service data',
            }));
            
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
          log('Service read failed:', data);
          
          clearReadTimeout();
          toast.dismiss('service-refresh');
          
          let errorMessage = 'Failed to read service data';
          let requiresReset = false;
          
          const checkForDisconnect = (str: string) => {
            return str.toLowerCase().includes('bluetooth device not connected') ||
                   str.toLowerCase().includes('device not connected') ||
                   str.toLowerCase().includes('not connected');
          };
          
          const checkForMacMismatch = (str: string) => {
            return str.toLowerCase().includes('macaddress is not match') ||
                   str.toLowerCase().includes('mac address is not match') ||
                   str.toLowerCase().includes('macaddress not match');
          };
          
          try {
            const parsed = JSON.parse(data);
            const respDesc = parsed?.responseData?.respDesc || parsed?.respDesc || '';
            const respCode = parsed?.responseData?.respCode || parsed?.respCode || '';
            
            if (checkForDisconnect(String(respDesc))) {
              errorMessage = 'Bluetooth connection lost';
              requiresReset = true;
            } else if (checkForMacMismatch(String(respDesc)) || respCode === '7') {
              errorMessage = 'Bluetooth connection stuck. Please turn Bluetooth OFF then ON.';
              requiresReset = true;
            }
          } catch {
            if (checkForDisconnect(data)) {
              errorMessage = 'Bluetooth connection lost';
              requiresReset = true;
            } else if (checkForMacMismatch(data)) {
              errorMessage = 'Bluetooth connection stuck. Please turn Bluetooth OFF then ON.';
              requiresReset = true;
            }
          }
          
          // Force disconnect from ALL known MACs to clear native layer state
          const connectedMac = sessionStorage.getItem('connectedDeviceMac');
          const pendingStoredMac = sessionStorage.getItem('pendingBleMac');
          
          if (window.WebViewJavascriptBridge) {
            if (connectedMac) {
              log('Force disconnecting from connectedMac:', connectedMac);
              window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
            }
            if (pendingStoredMac && pendingStoredMac !== connectedMac) {
              log('Force disconnecting from pendingMac:', pendingStoredMac);
              window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingStoredMac, () => {});
            }
            if (pendingMacRef.current && pendingMacRef.current !== connectedMac && pendingMacRef.current !== pendingStoredMac) {
              log('Force disconnecting from pendingMacRef:', pendingMacRef.current);
              window.WebViewJavascriptBridge.callHandler('disconnectBle', pendingMacRef.current, () => {});
            }
          }
          
          // Clear sessionStorage
          sessionStorage.removeItem('connectedDeviceMac');
          sessionStorage.removeItem('pendingBleMac');
          
          setServiceState(prev => ({
            ...prev,
            isReading: false,
            error: errorMessage,
          }));
          
          refreshRetryRef.current = 0;
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
