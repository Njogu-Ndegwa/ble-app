'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { BatteryData, BleDevice, BleScanState, convertRssiToDistance } from '../types';

// BLE operation constants
const BLE_CONNECTION_TIMEOUT = 15000; // 15 seconds
const BLE_DATA_READ_TIMEOUT = 20000; // 20 seconds
const BLE_GLOBAL_TIMEOUT = 90000; // 90 seconds - last resort
const MAX_BLE_RETRIES = 3;

interface UseBleScanner {
  /** Current BLE scan state */
  bleScanState: BleScanState;
  /** List of detected BLE devices */
  detectedDevices: BleDevice[];
  /** Start BLE scanning for nearby devices */
  startBleScan: () => void;
  /** Stop BLE scanning */
  stopBleScan: () => void;
  /** Connect to a BLE device by MAC address */
  connectToDevice: (macAddress: string) => void;
  /** Cancel ongoing BLE operation */
  cancelOperation: () => void;
  /** Process a scanned battery QR code */
  processBatteryQrCode: (qrData: string, onSuccess: (battery: BatteryData) => void) => void;
  /** Reset the scanner state */
  resetState: () => void;
  /** Whether BLE handlers are ready */
  isReady: boolean;
}

interface WebViewJavascriptBridge {
  init: (callback: (message: any, responseCallback: (response: any) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: any) => void) => void) => void;
  callHandler: (handlerName: string, data: any, callback: (responseData: string) => void) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

const initialBleScanState: BleScanState = {
  isScanning: false,
  isConnecting: false,
  isReadingEnergy: false,
  connectedDevice: null,
  detectedDevices: [],
  connectionProgress: 0,
  error: null,
  connectionFailed: false,
  requiresBluetoothReset: false,
};

/**
 * useBleScanner - Custom hook for BLE battery scanning operations
 * 
 * Encapsulates all BLE scanning, connection, and data reading logic
 * that was previously duplicated across Attendant and Sales flows.
 * 
 * @example
 * const {
 *   bleScanState,
 *   startBleScan,
 *   processBatteryQrCode,
 *   cancelOperation,
 * } = useBleScanner();
 */
export function useBleScanner(): UseBleScanner {
  const [bleScanState, setBleScanState] = useState<BleScanState>(initialBleScanState);
  const [isReady, setIsReady] = useState(false);
  
  // Refs for timeout management
  const bleOperationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bleGlobalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bleRetryCountRef = useRef<number>(0);
  const isConnectionSuccessfulRef = useRef<boolean>(false);
  
  // Refs for BLE scanning
  const detectedBleDevicesRef = useRef<BleDevice[]>([]);
  const pendingBatteryQrCodeRef = useRef<string | null>(null);
  const pendingConnectionMacRef = useRef<string | null>(null);
  const onSuccessCallbackRef = useRef<((battery: BatteryData) => void) | null>(null);

  // Clear operation timeout
  const clearBleOperationTimeout = useCallback(() => {
    if (bleOperationTimeoutRef.current) {
      clearTimeout(bleOperationTimeoutRef.current);
      bleOperationTimeoutRef.current = null;
    }
  }, []);

  // Clear global timeout
  const clearBleGlobalTimeout = useCallback(() => {
    if (bleGlobalTimeoutRef.current) {
      clearTimeout(bleGlobalTimeoutRef.current);
      bleGlobalTimeoutRef.current = null;
    }
  }, []);

  // Start BLE scan
  const startBleScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) {
      console.error('WebViewJavascriptBridge not available for BLE scan');
      return;
    }

    window.WebViewJavascriptBridge.callHandler(
      'startBleScan',
      '',
      (responseData: string) => {
        console.info('BLE scan started:', responseData);
      }
    );
    
    setBleScanState(prev => ({
      ...prev,
      isScanning: true,
      error: null,
    }));
  }, []);

  // Stop BLE scan
  const stopBleScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) return;

    window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
    setBleScanState(prev => ({
      ...prev,
      isScanning: false,
    }));
  }, []);

  // Connection attempt ref for retry logic
  const attemptConnectionRef = useRef<((macAddress: string) => void) | null>(null);

  // Connect to device
  const connectToDevice = useCallback((macAddress: string) => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bluetooth bridge not available');
      return;
    }

    clearBleOperationTimeout();
    pendingConnectionMacRef.current = macAddress;
    bleRetryCountRef.current = 0;
    isConnectionSuccessfulRef.current = false;

    // Set connecting state
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      isReadingEnergy: false,
      error: null,
      connectionFailed: false,
      requiresBluetoothReset: false,
      connectionProgress: 10,
    }));

    // Connection timeout - inline handler to avoid circular deps
    bleOperationTimeoutRef.current = setTimeout(() => {
      if (!isConnectionSuccessfulRef.current) {
        if (bleRetryCountRef.current < MAX_BLE_RETRIES) {
          bleRetryCountRef.current++;
          console.info(`BLE connection timeout, retrying (${bleRetryCountRef.current}/${MAX_BLE_RETRIES})`);
          // Use ref to call self for retry
          attemptConnectionRef.current?.(macAddress);
        } else {
          setBleScanState(prev => ({
            ...prev,
            isConnecting: false,
            isReadingEnergy: false,
            connectionFailed: true,
            error: 'Connection timeout - please try again',
          }));
        }
      }
    }, BLE_CONNECTION_TIMEOUT);

    // Global timeout - inline handler
    bleGlobalTimeoutRef.current = setTimeout(() => {
      setBleScanState(prev => {
        if (prev.isConnecting || prev.isReadingEnergy) {
          return {
            ...prev,
            isConnecting: false,
            isReadingEnergy: false,
            connectionFailed: true,
            requiresBluetoothReset: true,
            error: 'Bluetooth operation timed out. Please toggle Bluetooth off and on, then try again.',
          };
        }
        return prev;
      });
    }, BLE_GLOBAL_TIMEOUT);

    // Store connected MAC
    sessionStorage.setItem('connectedDeviceMac', macAddress);

    // Attempt connection
    window.WebViewJavascriptBridge.callHandler(
      'connBleByMacAddress',
      macAddress,
      (responseData: string) => {
        console.info('BLE connection response:', responseData);
      }
    );
  }, [clearBleOperationTimeout]);

  // Store connect function in ref for retry logic
  attemptConnectionRef.current = connectToDevice;

  // Reset state
  const resetState = useCallback(() => {
    setBleScanState(initialBleScanState);
    detectedBleDevicesRef.current = [];
    pendingBatteryQrCodeRef.current = null;
    pendingConnectionMacRef.current = null;
    onSuccessCallbackRef.current = null;
    bleRetryCountRef.current = 0;
    isConnectionSuccessfulRef.current = false;
  }, []);

  // Cancel operation
  const cancelOperation = useCallback(() => {
    // Don't allow cancel if already connected and reading
    if (isConnectionSuccessfulRef.current) {
      toast('Please wait while reading battery data...', { icon: '⏳' });
      return;
    }

    clearBleOperationTimeout();
    clearBleGlobalTimeout();

    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
      
      const connectedMac = sessionStorage.getItem('connectedDeviceMac');
      if (connectedMac) {
        window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
        sessionStorage.removeItem('connectedDeviceMac');
      }
    }

    resetState();
  }, [clearBleOperationTimeout, clearBleGlobalTimeout, resetState]);

  // Process battery QR code
  const processBatteryQrCode = useCallback((
    qrData: string,
    onSuccess: (battery: BatteryData) => void
  ) => {
    try {
      const parsed = JSON.parse(qrData);
      const macAddress = parsed.mac_address;
      
      if (!macAddress) {
        toast.error('Invalid battery QR code');
        return;
      }

      pendingBatteryQrCodeRef.current = qrData;
      onSuccessCallbackRef.current = onSuccess;

      // Check if device is already in detected list
      const existingDevice = detectedBleDevicesRef.current.find(
        d => d.macAddress.toLowerCase() === macAddress.toLowerCase()
      );

      if (existingDevice) {
        connectToDevice(macAddress);
      } else {
        // Start scan to find the device
        startBleScan();
        
        // Wait for device to appear
        const checkInterval = setInterval(() => {
          const device = detectedBleDevicesRef.current.find(
            d => d.macAddress.toLowerCase() === macAddress.toLowerCase()
          );
          if (device) {
            clearInterval(checkInterval);
            connectToDevice(macAddress);
          }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!pendingConnectionMacRef.current) {
            toast.error('Battery not found nearby');
            stopBleScan();
          }
        }, 10000);
      }
    } catch (error) {
      toast.error('Failed to parse battery QR code');
    }
  }, [connectToDevice, startBleScan, stopBleScan]);

  // Register BLE handlers on mount
  useEffect(() => {
    const setupBleHandlers = () => {
      if (!window.WebViewJavascriptBridge) {
        setTimeout(setupBleHandlers, 500);
        return;
      }

      // Handle BLE scan results
      window.WebViewJavascriptBridge.registerHandler(
        'bleScanCallback',
        (data: string) => {
          try {
            const result = JSON.parse(data);
            if (result.respCode === '200' && result.respData) {
              const devices = result.respData as any[];
              const formattedDevices: BleDevice[] = devices.map(d => ({
                macAddress: d.macAddress,
                name: d.name || 'Unknown',
                rssi: convertRssiToDistance(d.rssi),
                rawRssi: d.rssi,
              }));
              
              // Merge with existing devices
              formattedDevices.forEach(newDevice => {
                const existingIndex = detectedBleDevicesRef.current.findIndex(
                  d => d.macAddress === newDevice.macAddress
                );
                if (existingIndex >= 0) {
                  detectedBleDevicesRef.current[existingIndex] = newDevice;
                } else {
                  detectedBleDevicesRef.current.push(newDevice);
                }
              });

              setBleScanState(prev => ({
                ...prev,
                detectedDevices: [...detectedBleDevicesRef.current],
              }));
            }
          } catch (error) {
            console.error('Error parsing BLE scan result:', error);
          }
        }
      );

      // Handle BLE connection result
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnCallback',
        (data: string) => {
          try {
            const result = JSON.parse(data);
            if (result.respCode === '200') {
              isConnectionSuccessfulRef.current = true;
              clearBleOperationTimeout();
              
              setBleScanState(prev => ({
                ...prev,
                isConnecting: false,
                isReadingEnergy: true,
                connectionProgress: 50,
                connectedDevice: pendingConnectionMacRef.current,
              }));

              // Initialize BLE data service
              if (window.WebViewJavascriptBridge) {
                window.WebViewJavascriptBridge.callHandler(
                  'initServiceBleData',
                  '',
                  () => {}
                );
              }
            } else {
              handleConnectionError(result.respMsg || 'Connection failed');
            }
          } catch (error) {
            handleConnectionError('Invalid connection response');
          }
        }
      );

      // Handle BLE data result (battery energy)
      window.WebViewJavascriptBridge.registerHandler(
        'bleDataCallback',
        (data: string) => {
          try {
            const result = JSON.parse(data);
            if (result.respCode === '200' && result.respData) {
              const batteryInfo = result.respData;
              
              // Extract battery ID from QR data
              let shortId = 'Unknown';
              if (pendingBatteryQrCodeRef.current) {
                const parsed = JSON.parse(pendingBatteryQrCodeRef.current);
                shortId = parsed.short_id || parsed.id || 'Unknown';
              }

              const batteryData: BatteryData = {
                id: shortId,
                shortId,
                chargeLevel: batteryInfo.rsoc || Math.round((batteryInfo.rcap / batteryInfo.fccp) * 100) || 0,
                energy: (batteryInfo.rcap * batteryInfo.pckv) / 1000000 || 0,
                macAddress: pendingConnectionMacRef.current || undefined,
              };

              clearBleOperationTimeout();
              clearBleGlobalTimeout();

              // Call success callback
              if (onSuccessCallbackRef.current) {
                onSuccessCallbackRef.current(batteryData);
              }

              // Reset state after success
              setBleScanState(prev => ({
                ...prev,
                isReadingEnergy: false,
                connectionProgress: 100,
              }));

              // Disconnect
              if (window.WebViewJavascriptBridge && pendingConnectionMacRef.current) {
                window.WebViewJavascriptBridge.callHandler(
                  'disconnectBle',
                  pendingConnectionMacRef.current,
                  () => {}
                );
              }
            }
          } catch (error) {
            console.error('Error parsing BLE data:', error);
          }
        }
      );

      setIsReady(true);
    };

    const handleConnectionError = (message: string) => {
      const requiresReset = message.includes('not connected') || message.includes('Bluetooth');
      
      setBleScanState(prev => ({
        ...prev,
        isConnecting: false,
        isReadingEnergy: false,
        connectionFailed: true,
        requiresBluetoothReset: requiresReset,
        error: message,
      }));
    };

    setupBleHandlers();

    return () => {
      clearBleOperationTimeout();
      clearBleGlobalTimeout();
    };
  }, [clearBleOperationTimeout, clearBleGlobalTimeout]);

  return {
    bleScanState,
    detectedDevices: detectedBleDevicesRef.current,
    startBleScan,
    stopBleScan,
    connectToDevice,
    cancelOperation,
    processBatteryQrCode,
    resetState,
    isReady,
  };
}

export default useBleScanner;
