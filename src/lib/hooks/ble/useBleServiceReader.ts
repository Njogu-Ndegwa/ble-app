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
  const bridgeInitRef = useRef(false);

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
   * Shortcut to read DTA service (common for batteries)
   */
  const readDtaService = useCallback((macAddress: string) => {
    return readService('DTA', macAddress);
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
    const setupHandlers = () => {
      if (!window.WebViewJavascriptBridge) {
        setTimeout(setupHandlers, 500);
        return;
      }

      if (bridgeInitRef.current) return;
      bridgeInitRef.current = true;

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
              
              if (isDisconnected) {
                clearReadTimeout();
                toast.dismiss('service-refresh');
                
                setServiceState(prev => ({
                  ...prev,
                  isReading: false,
                  error: 'Bluetooth connection lost',
                }));
                
                toast.error('Please turn Bluetooth OFF then ON and try again.');
                onErrorRef.current?.('Bluetooth connection lost');
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
          
          const checkForDisconnect = (str: string) => {
            return str.toLowerCase().includes('bluetooth device not connected') ||
                   str.toLowerCase().includes('device not connected') ||
                   str.toLowerCase().includes('not connected');
          };
          
          try {
            const parsed = JSON.parse(data);
            const respDesc = parsed?.responseData?.respDesc || parsed?.respDesc || '';
            if (checkForDisconnect(String(respDesc))) {
              errorMessage = 'Bluetooth connection lost';
            }
          } catch {
            if (checkForDisconnect(data)) {
              errorMessage = 'Bluetooth connection lost';
            }
          }
          
          setServiceState(prev => ({
            ...prev,
            isReading: false,
            error: errorMessage,
          }));
          
          refreshRetryRef.current = 0;
          pendingServiceRef.current = null;
          pendingMacRef.current = null;
          
          if (errorMessage.includes('connection lost')) {
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
      clearReadTimeout();
      toast.dismiss('service-refresh');
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
    /** Read DTA service (shortcut) */
    readDtaService,
    /** Cancel ongoing read */
    cancelRead,
    /** Reset state */
    resetState,
  };
}

export default useBleServiceReader;
