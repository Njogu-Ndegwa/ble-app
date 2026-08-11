'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { BleDevice, BleScanState } from './types';

// ============================================
// CONSTANTS
// ============================================

const INITIAL_SCAN_STATE: BleScanState = {
  isScanning: false,
  detectedDevices: [],
  error: null,
};

// ============================================
// HELPERS
// ============================================

/**
 * Convert RSSI to human-readable distance format
 */
export function convertRssiToDistance(rssi: number): string {
  const txPower = -59;
  const n = 2;
  const distance = Math.pow(10, (txPower - rssi) / (10 * n));
  return `${rssi}db ~ ${distance.toFixed(0)}m`;
}

// ============================================
// OPTIONS
// ============================================

export interface UseBleDeviceScannerOptions {
  /** Filter devices by name pattern (e.g., 'OVES') */
  nameFilter?: string;
  /** Auto-start scanning when ready */
  autoStart?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /**
   * Called synchronously for every advertisement that passes the filter.
   * Lets a caller react the instant its target appears instead of polling the
   * device list on a timer.
   */
  onDeviceFound?: (device: BleDevice) => void;
}

// ============================================
// HOOK
// ============================================

/**
 * useBleDeviceScanner - Hook for discovering nearby BLE devices
 * 
 * This hook handles BLE device discovery/scanning only.
 * It can be used independently for device management pages,
 * or composed with other hooks for scan-to-bind workflows.
 * 
 * @example
 * const { 
 *   scanState, 
 *   devices, 
 *   startScan, 
 *   stopScan,
 *   findDeviceByName,
 * } = useBleDeviceScanner({ nameFilter: 'OVES' });
 */
export function useBleDeviceScanner(options: UseBleDeviceScannerOptions = {}) {
  const { nameFilter = 'OVES', autoStart = false, debug = false, onDeviceFound } = options;

  // Kept in a ref so the bridge handler always sees the latest callback without
  // being re-registered (re-registering mid-scan drops advertisements).
  const onDeviceFoundRef = useRef(onDeviceFound);
  useEffect(() => {
    onDeviceFoundRef.current = onDeviceFound;
  }, [onDeviceFound]);

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.info('[BLE Scanner]', ...args);
  }, [debug]);

  // ============================================
  // STATE
  // ============================================

  const [scanState, setScanState] = useState<BleScanState>(INITIAL_SCAN_STATE);
  const [isReady, setIsReady] = useState(false);

  // Device storage ref (for immediate access without re-renders)
  const detectedDevicesRef = useRef<BleDevice[]>([]);

  // ============================================
  // CORE OPERATIONS
  // ============================================

  /**
   * Start BLE scanning
   */
  const startScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) {
      log('Bridge not available');
      setScanState(prev => ({ ...prev, error: 'Bluetooth not available' }));
      return false;
    }

    log('Starting BLE scan');

    // Dead-bridge watchdog. The native side ACKs startBleScan within a few
    // milliseconds; when the ACK never arrives, the JS->native channel itself
    // is gone (its signalling iframe was removed during hydration), and every
    // BLE call from this page will silently hang forever. The user-visible
    // symptom is an eternally-empty device list that only an app restart
    // "fixes". A reload rebuilds the bridge, so do that for the user - once:
    // the sessionStorage stamp stops a broken page from reload-looping.
    let acked = false;
    const watchdog = setTimeout(() => {
      if (acked) return;
      log('startBleScan never ACKed - bridge is dead');
      try {
        const last = Number(sessionStorage.getItem('bleBridgeReloadAt') || 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem('bleBridgeReloadAt', String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // fall through to the error state below
      }
      setScanState(prev => ({ ...prev, isScanning: false, error: 'Bluetooth not available' }));
    }, 3000);
    window.WebViewJavascriptBridge.callHandler('startBleScan', '', () => {
      acked = true;
      clearTimeout(watchdog);
    });

    setScanState(prev => ({
      ...prev,
      isScanning: true,
      error: null,
    }));

    return true;
  }, [log]);

  /**
   * Stop BLE scanning
   */
  const stopScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) return;

    log('Stopping BLE scan');
    window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
    
    setScanState(prev => ({
      ...prev,
      isScanning: false,
    }));
  }, [log]);

  /**
   * Clear all detected devices
   */
  const clearDevices = useCallback(() => {
    detectedDevicesRef.current = [];
    setScanState(prev => ({
      ...prev,
      detectedDevices: [],
    }));
  }, []);

  /**
   * Find device by last N characters of name
   */
  const findDeviceByNameSuffix = useCallback((suffix: string, chars: number = 6): BleDevice | undefined => {
    const normalizedSuffix = suffix.slice(-chars).toLowerCase();
    return detectedDevicesRef.current.find(device => {
      const deviceSuffix = (device.name || '').toLowerCase().slice(-chars);
      return deviceSuffix === normalizedSuffix;
    });
  }, []);

  /**
   * Find device by MAC address
   */
  const findDeviceByMac = useCallback((macAddress: string): BleDevice | undefined => {
    const normalizedMac = macAddress.toUpperCase();
    return detectedDevicesRef.current.find(
      device => device.macAddress.toUpperCase() === normalizedMac
    );
  }, []);

  /**
   * Get all detected devices (current snapshot)
   */
  const getDevices = useCallback((): BleDevice[] => {
    return [...detectedDevicesRef.current];
  }, []);

  // ============================================
  // BRIDGE HANDLER SETUP
  // ============================================

  // Use a ref to store the current nameFilter so the handler always has latest value
  const nameFilterRef = useRef(nameFilter);
  useEffect(() => {
    nameFilterRef.current = nameFilter;
  }, [nameFilter]);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;
    
    const setupHandler = () => {
      if (isCleanedUp) return;
      
      if (!window.WebViewJavascriptBridge) {
        log('Bridge not available yet, retrying in 500ms...');
        retryTimeout = setTimeout(setupHandler, 500);
        return;
      }

      // Always register the handler - this replaces any existing handler
      // We need to re-register whenever this effect runs to capture the latest
      // nameFilter value in the handler's closure
      log('Setting up BLE scanner handler (nameFilter:', nameFilterRef.current, ')');

      // NOTE: bridge.init() is already called in bridgeContext.tsx
      // Do NOT call init() again here as it causes the app to hang

      // Device discovery handler
      window.WebViewJavascriptBridge.registerHandler(
        'findBleDeviceCallBack',
        (data: string, resp: (r: unknown) => void) => {
          try {
            const d = JSON.parse(data);
            const macAddress = d.macAddress || d.mac;
            const deviceName = d.name || '';
            const rssi = Number(d.rssi) || -100;
            
            // Log all incoming devices for debugging (only when debug is enabled)
            if (debug) {
              console.info('[BLE Scanner] Device callback received:', {
                name: deviceName,
                mac: macAddress,
                rssi,
                currentFilter: nameFilterRef.current,
              });
            }
            
            if (!macAddress) {
              log('Skipping device: no MAC address');
              resp({ received: true });
              return;
            }
            
            // Apply name filter if specified (use ref to get latest value)
            const currentFilter = nameFilterRef.current;
            if (currentFilter && !deviceName.includes(currentFilter)) {
              // Device doesn't match filter - skip silently
              resp({ received: true });
              return;
            }
            
            log('Device matched filter:', deviceName, macAddress);
            
            const normalizedMac = macAddress.toUpperCase();
            const device: BleDevice = {
              macAddress: normalizedMac,
              name: deviceName,
              rssi: convertRssiToDistance(rssi),
              rawRssi: rssi,
            };
            
            // Update or add device
            const existingIndex = detectedDevicesRef.current.findIndex(
              p => p.macAddress.toUpperCase() === normalizedMac
            );
            
            if (existingIndex >= 0) {
              detectedDevicesRef.current[existingIndex] = device;
            } else {
              log('New device added:', deviceName, '- Total devices:', detectedDevicesRef.current.length + 1);
              detectedDevicesRef.current.push(device);
            }
            
            // Sort by signal strength (strongest first)
            detectedDevicesRef.current.sort((a, b) => b.rawRssi - a.rawRssi);
            
            // Notify listeners before the state update so a caller waiting for
            // this specific device can act on the same tick rather than waiting
            // for React to commit and a poll to come round.
            try {
              onDeviceFoundRef.current?.(device);
            } catch (err) {
              log('onDeviceFound listener threw:', err);
            }

            // Update state
            setScanState(prev => ({
              ...prev,
              detectedDevices: [...detectedDevicesRef.current],
            }));

            resp({ success: true });
          } catch (err) {
            log('Error parsing device data:', err, 'Raw data:', data);
            resp({ success: false });
          }
        }
      );

      log('BLE scanner handler registered successfully');
      setIsReady(true);

      // Auto-start if requested
      if (autoStart) {
        setTimeout(() => {
          if (window.WebViewJavascriptBridge && !isCleanedUp) {
            log('Auto-starting BLE scan');
            window.WebViewJavascriptBridge.callHandler('startBleScan', '', () => {});
            setScanState(prev => ({ ...prev, isScanning: true }));
          }
        }, 100);
      }
    };

    setupHandler();

    return () => {
      isCleanedUp = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      // Stop scanning on cleanup
      if (window.WebViewJavascriptBridge) {
        window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
      }
      log('BLE scanner cleanup complete');
    };
  }, [autoStart, log, debug]);

  // ============================================
  // RETURN
  // ============================================

  return {
    /** Current scan state */
    scanState,
    /** Shortcut to detected devices */
    devices: scanState.detectedDevices,
    /** Whether scanner is ready */
    isReady,
    /** Start BLE scanning */
    startScan,
    /** Stop BLE scanning */
    stopScan,
    /** Clear all detected devices */
    clearDevices,
    /** Find device by last N chars of name */
    findDeviceByNameSuffix,
    /** Find device by MAC address */
    findDeviceByMac,
    /** Get current devices snapshot */
    getDevices,
  };
}

export default useBleDeviceScanner;
