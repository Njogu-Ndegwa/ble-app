'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { connBleByMacAddress, initServiceBleData } from '@/app/utils';

// ============================================
// TYPES
// ============================================

export interface BatteryData {
  id: string;
  shortId: string;
  chargeLevel: number;
  energy: number;
  macAddress?: string;
}

export interface BleDevice {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
}

export interface BleScanState {
  isScanning: boolean;
  isConnecting: boolean;
  isReadingEnergy: boolean;
  connectedDevice: string | null;
  detectedDevices: BleDevice[];
  connectionProgress: number;
  error: string | null;
  connectionFailed: boolean;
  requiresBluetoothReset: boolean;
}

export interface BleConnectionOptions {
  /** Called when battery data is successfully read */
  onBatteryRead?: (battery: BatteryData, scanType: string) => void;
  /** Called on connection error */
  onError?: (error: string, requiresReset: boolean) => void;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const BLE_CONNECTION_TIMEOUT = 15000; // 15 seconds for connection
const BLE_DATA_READ_TIMEOUT = 20000; // 20 seconds for data reading
const BLE_GLOBAL_TIMEOUT = 90000; // 90 seconds - last resort
const MAX_BLE_RETRIES = 3;
const MAX_DEVICE_MATCH_RETRIES = 4;
const DEVICE_MATCH_RETRY_DELAYS = [2000, 3000, 4000, 5000];
const MAX_DTA_REFRESH_RETRIES = 2;
const DTA_REFRESH_DELAY = 1500;

const INITIAL_BLE_STATE: BleScanState = {
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

// ============================================
// BRIDGE TYPE
// ============================================

interface WebViewJavascriptBridge {
  init: (callback: (message: unknown, responseCallback: (response: unknown) => void) => void) => void;
  registerHandler: (handlerName: string, handler: (data: string, responseCallback: (response: unknown) => void) => void) => void;
  callHandler: (handlerName: string, data: unknown, callback: (responseData: string) => void) => void;
}

declare global {
  interface Window {
    WebViewJavascriptBridge?: WebViewJavascriptBridge;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert RSSI to human-readable distance format
 */
function convertRssiToDistance(rssi: number): string {
  const txPower = -59;
  const n = 2;
  const distance = Math.pow(10, (txPower - rssi) / (10 * n));
  return `${rssi}db ~ ${distance.toFixed(0)}m`;
}

/**
 * Extract energy data from DTA service response
 * rcap = Remaining Capacity in mAh
 * fccp = Full Charge Capacity in mAh
 * pckv = Pack Voltage in mV
 * Energy (Wh) = Capacity (mAh) × Voltage (mV) / 1,000,000
 */
function extractEnergyFromDta(serviceData: any): { energy: number; fullCapacity: number; chargePercent: number } | null {
  if (!serviceData || !Array.isArray(serviceData.characteristicList)) {
    return null;
  }

  const getCharValue = (name: string) => {
    const char = serviceData.characteristicList.find(
      (c: any) => c.name?.toLowerCase() === name.toLowerCase()
    );
    return char?.realVal ?? null;
  };

  const rcapRaw = getCharValue('rcap');
  const fccpRaw = getCharValue('fccp');
  const pckvRaw = getCharValue('pckv');
  const rsocRaw = getCharValue('rsoc');

  const rcap = rcapRaw !== null ? parseFloat(rcapRaw) : NaN;
  const fccp = fccpRaw !== null ? parseFloat(fccpRaw) : NaN;
  const pckv = pckvRaw !== null ? parseFloat(pckvRaw) : NaN;
  const rsoc = rsocRaw !== null ? parseFloat(rsocRaw) : NaN;

  if (!Number.isFinite(rcap) || !Number.isFinite(pckv)) {
    return null;
  }

  // Energy (Wh) = Capacity (mAh) × Voltage (mV) / 1,000,000
  const energy = (rcap * pckv) / 1_000_000;
  const fullCapacity = Number.isFinite(fccp) ? (fccp * pckv) / 1_000_000 : 0;

  if (!Number.isFinite(energy)) {
    return null;
  }

  // Calculate charge percentage
  let chargePercent: number;
  if (Number.isFinite(fccp) && fccp > 0) {
    chargePercent = Math.round((rcap / fccp) * 100);
  } else if (Number.isFinite(rsoc)) {
    chargePercent = Math.round(rsoc);
  } else {
    chargePercent = 0;
  }

  chargePercent = Math.max(0, Math.min(100, chargePercent));

  return {
    energy: Math.round(energy * 100) / 100,
    fullCapacity: Math.round(fullCapacity * 100) / 100,
    chargePercent,
  };
}

/**
 * Parse battery ID from QR code data (handles JSON and plain string)
 */
function parseBatteryIdFromQr(qrData: string): string {
  try {
    const parsed = JSON.parse(qrData);
    return parsed.battery_id || parsed.sno || parsed.serial_number || parsed.id || qrData;
  } catch {
    return qrData;
  }
}

// ============================================
// MAIN HOOK
// ============================================

/**
 * useBleConnection - Unified BLE scan-to-bind hook
 * 
 * Centralizes ALL BLE operations for battery scanning:
 * 1. Device discovery (scanning for nearby BLE devices)
 * 2. Device matching (by last 6 chars of battery ID)
 * 3. Connection with retry logic
 * 4. DTA service data reading
 * 5. Energy calculation
 * 
 * @example
 * const {
 *   bleScanState,
 *   startScan,
 *   stopScan,
 *   scanAndBindBattery,
 *   cancelOperation,
 *   resetState,
 *   isReady,
 * } = useBleConnection({
 *   onBatteryRead: (battery, scanType) => {
 *     if (scanType === 'old_battery') setOldBattery(battery);
 *     else setNewBattery(battery);
 *   },
 *   onError: (error, requiresReset) => {
 *     toast.error(error);
 *   },
 * });
 */
export function useBleConnection(options: BleConnectionOptions = {}) {
  const { onBatteryRead, onError, debug = false } = options;

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.info('[BLE]', ...args);
  }, [debug]);

  // ============================================
  // STATE
  // ============================================

  const [bleScanState, setBleScanState] = useState<BleScanState>(INITIAL_BLE_STATE);
  const [isReady, setIsReady] = useState(false);

  // ============================================
  // REFS
  // ============================================

  // Timeout refs
  const bleOperationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bleGlobalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Retry refs
  const bleRetryCountRef = useRef(0);
  const dtaRefreshRetryCountRef = useRef(0);
  const isConnectionSuccessfulRef = useRef(false);

  // Device tracking refs
  const detectedBleDevicesRef = useRef<BleDevice[]>([]);
  const pendingBatteryQrCodeRef = useRef<string | null>(null);
  const pendingBatteryIdRef = useRef<string | null>(null);
  const pendingScanTypeRef = useRef<string | null>(null);
  const pendingConnectionMacRef = useRef<string | null>(null);

  // Callback refs (to avoid stale closures)
  const onBatteryReadRef = useRef(onBatteryRead);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onBatteryReadRef.current = onBatteryRead;
    onErrorRef.current = onError;
  }, [onBatteryRead, onError]);

  // Bridge initialization ref
  const bridgeInitRef = useRef(false);

  // ============================================
  // TIMEOUT HELPERS
  // ============================================

  const clearOperationTimeout = useCallback(() => {
    if (bleOperationTimeoutRef.current) {
      clearTimeout(bleOperationTimeoutRef.current);
      bleOperationTimeoutRef.current = null;
    }
  }, []);

  const clearGlobalTimeout = useCallback(() => {
    if (bleGlobalTimeoutRef.current) {
      clearTimeout(bleGlobalTimeoutRef.current);
      bleGlobalTimeoutRef.current = null;
    }
  }, []);

  const clearAllTimeouts = useCallback(() => {
    clearOperationTimeout();
    clearGlobalTimeout();
  }, [clearOperationTimeout, clearGlobalTimeout]);

  // ============================================
  // BLE OPERATIONS
  // ============================================

  /**
   * Start BLE scanning for nearby devices
   */
  const startScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) {
      console.error('WebViewJavascriptBridge not available');
      return;
    }

    log('Starting BLE scan');
    window.WebViewJavascriptBridge.callHandler('startBleScan', '', () => {});
    
    setBleScanState(prev => ({
      ...prev,
      isScanning: true,
      error: null,
    }));
  }, [log]);

  /**
   * Stop BLE scanning
   */
  const stopScan = useCallback(() => {
    if (!window.WebViewJavascriptBridge) return;

    log('Stopping BLE scan');
    window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
    
    setBleScanState(prev => ({
      ...prev,
      isScanning: false,
    }));
  }, [log]);

  /**
   * Connect to a BLE device by MAC address
   */
  const connectToDevice = useCallback((macAddress: string) => {
    if (!window.WebViewJavascriptBridge) {
      toast.error('Bluetooth bridge not available');
      return;
    }

    log('Connecting to device:', macAddress);
    clearOperationTimeout();
    
    isConnectionSuccessfulRef.current = false;
    bleRetryCountRef.current = 0;
    pendingConnectionMacRef.current = macAddress;
    
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: 10,
      error: null,
      connectionFailed: false,
      requiresBluetoothReset: false,
    }));

    connBleByMacAddress(macAddress, () => {
      log('Connection initiated to:', macAddress);
    });
  }, [clearOperationTimeout, log]);

  /**
   * Match QR code to detected BLE device and connect
   * Uses exponential backoff retry strategy
   */
  const matchAndConnect = useCallback((batteryId: string, retryAttempt = 0) => {
    const last6 = batteryId.slice(-6).toLowerCase();
    const devices = detectedBleDevicesRef.current;
    
    log(`Matching attempt ${retryAttempt + 1}/${MAX_DEVICE_MATCH_RETRIES + 1}`, {
      batteryId,
      last6,
      deviceCount: devices.length,
    });

    // Start global timeout on first attempt
    if (retryAttempt === 0) {
      clearGlobalTimeout();
      bleGlobalTimeoutRef.current = setTimeout(() => {
        log('Global timeout reached (90s)');
        clearOperationTimeout();
        
        if (window.WebViewJavascriptBridge) {
          window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
        }
        
        setBleScanState(prev => ({
          ...prev,
          isConnecting: false,
          isReadingEnergy: false,
          connectionProgress: 0,
          error: 'Connection timed out',
          connectionFailed: true,
          requiresBluetoothReset: true,
        }));
        
        isConnectionSuccessfulRef.current = false;
        toast.error('Connection timed out. Please toggle Bluetooth and try again.');
        onErrorRef.current?.('Connection timed out', true);
      }, BLE_GLOBAL_TIMEOUT);
    }

    // Show connecting progress
    const progressPercent = Math.min(5 + (retryAttempt * 15), 60);
    setBleScanState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: progressPercent,
      error: null,
    }));

    // Find matching device by last 6 chars
    const matchedDevice = devices.find(device => {
      const deviceLast6 = (device.name || '').toLowerCase().slice(-6);
      return deviceLast6 === last6;
    });

    if (matchedDevice) {
      log('Device matched:', matchedDevice.name);
      stopScan();
      bleRetryCountRef.current = 0;
      connectToDevice(matchedDevice.macAddress);
      return true;
    } else {
      log('No match found, devices:', devices.map(d => d.name));
      
      if (retryAttempt < MAX_DEVICE_MATCH_RETRIES) {
        const delay = DEVICE_MATCH_RETRY_DELAYS[retryAttempt] || 5000;
        log(`Retrying in ${delay}ms`);
        
        setBleScanState(prev => ({
          ...prev,
          connectionProgress: progressPercent + 5,
        }));
        
        setTimeout(() => {
          matchAndConnect(batteryId, retryAttempt + 1);
        }, delay);
        
        return false;
      } else {
        // All retries exhausted
        log('All match retries exhausted');
        clearGlobalTimeout();
        
        setBleScanState(prev => ({
          ...prev,
          isConnecting: false,
          isScanning: false,
          connectionProgress: 0,
          error: 'Battery not found',
        }));
        
        stopScan();
        pendingBatteryQrCodeRef.current = null;
        pendingBatteryIdRef.current = null;
        pendingScanTypeRef.current = null;
        
        toast.error('Battery not found nearby. Please ensure the battery is powered on and close.');
        onErrorRef.current?.('Battery not found', false);
        return false;
      }
    }
  }, [stopScan, connectToDevice, clearGlobalTimeout, clearOperationTimeout, log]);

  /**
   * Main entry point: Scan a battery QR and bind via BLE
   * 
   * @param qrData - The raw QR code data (JSON or plain string)
   * @param scanType - Identifier for the scan type (e.g., 'old_battery', 'new_battery')
   */
  const scanAndBindBattery = useCallback((qrData: string, scanType: string) => {
    log('scanAndBindBattery called', { qrData, scanType });
    
    const batteryId = parseBatteryIdFromQr(qrData);
    
    if (!batteryId) {
      toast.error('Invalid battery QR - no ID found');
      return;
    }

    // Store pending info
    pendingBatteryQrCodeRef.current = qrData;
    pendingBatteryIdRef.current = batteryId;
    pendingScanTypeRef.current = scanType;
    
    log('Battery ID extracted:', batteryId);

    // If not already scanning, start
    if (!bleScanState.isScanning) {
      startScan();
      // Wait for devices to appear before matching
      setTimeout(() => {
        matchAndConnect(batteryId);
      }, 1000);
    } else {
      // Already scanning, try to match immediately
      matchAndConnect(batteryId);
    }
  }, [bleScanState.isScanning, startScan, matchAndConnect, log]);

  /**
   * Cancel ongoing BLE operation
   * NOTE: Blocked when already connected and reading data
   */
  const cancelOperation = useCallback(() => {
    if (isConnectionSuccessfulRef.current) {
      toast('Please wait while reading battery data...', { icon: '⏳' });
      return;
    }

    log('Cancelling BLE operation');
    clearAllTimeouts();
    
    if (window.WebViewJavascriptBridge) {
      window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
      
      const connectedMac = sessionStorage.getItem('connectedDeviceMac');
      if (connectedMac) {
        window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
        sessionStorage.removeItem('connectedDeviceMac');
      }
    }
    
    setBleScanState(INITIAL_BLE_STATE);
    detectedBleDevicesRef.current = [];
    pendingBatteryQrCodeRef.current = null;
    pendingBatteryIdRef.current = null;
    pendingScanTypeRef.current = null;
    pendingConnectionMacRef.current = null;
    bleRetryCountRef.current = 0;
    dtaRefreshRetryCountRef.current = 0;
    isConnectionSuccessfulRef.current = false;
  }, [clearAllTimeouts, log]);

  /**
   * Reset state for a new operation
   */
  const resetState = useCallback(() => {
    log('Resetting BLE state');
    cancelOperation();
  }, [cancelOperation, log]);

  /**
   * Get list of currently detected devices
   */
  const getDetectedDevices = useCallback(() => {
    return detectedBleDevicesRef.current;
  }, []);

  // ============================================
  // BRIDGE HANDLER SETUP
  // ============================================

  useEffect(() => {
    const setupBridgeHandlers = () => {
      if (!window.WebViewJavascriptBridge) {
        setTimeout(setupBridgeHandlers, 500);
        return;
      }

      if (bridgeInitRef.current) return;
      bridgeInitRef.current = true;

      log('Setting up BLE bridge handlers');

      // Wrap init in try-catch (BridgeContext may have already called it)
      try {
        window.WebViewJavascriptBridge.init((_m, r) => r('js success!'));
      } catch {
        // Already initialized
      }

      // ============================================
      // DEVICE DISCOVERY HANDLER
      // ============================================
      window.WebViewJavascriptBridge.registerHandler(
        'findBleDeviceCallBack',
        (data: string, resp: (r: unknown) => void) => {
          try {
            const d = JSON.parse(data);
            
            if (!d.macAddress || !d.name || !d.name.includes('OVES')) {
              resp({ received: true });
              return;
            }
            
            const raw = Number(d.rssi) || -100;
            const device: BleDevice = {
              macAddress: d.macAddress.toUpperCase(),
              name: d.name,
              rssi: convertRssiToDistance(raw),
              rawRssi: raw,
            };
            
            // Update or add device
            const existingIndex = detectedBleDevicesRef.current.findIndex(
              p => p.macAddress.toUpperCase() === device.macAddress
            );
            
            if (existingIndex >= 0) {
              detectedBleDevicesRef.current[existingIndex] = device;
            } else {
              detectedBleDevicesRef.current.push(device);
            }
            
            // Sort by signal strength
            detectedBleDevicesRef.current.sort((a, b) => b.rawRssi - a.rawRssi);
            
            setBleScanState(prev => ({
              ...prev,
              detectedDevices: [...detectedBleDevicesRef.current],
            }));
            
            resp({ success: true });
          } catch {
            resp({ success: false });
          }
        }
      );

      // ============================================
      // CONNECTION SUCCESS HANDLER
      // ============================================
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectSuccessCallBack',
        (macAddress: string, resp: (r: unknown) => void) => {
          log('Connection successful:', macAddress);
          sessionStorage.setItem('connectedDeviceMac', macAddress);
          
          // CRITICAL: Mark connection as successful immediately
          isConnectionSuccessfulRef.current = true;
          
          clearOperationTimeout();
          bleRetryCountRef.current = 0;
          pendingConnectionMacRef.current = null;
          
          setBleScanState(prev => ({
            ...prev,
            isConnecting: false,
            isReadingEnergy: true,
            connectedDevice: macAddress,
            connectionProgress: 100,
            error: null,
            connectionFailed: false,
            requiresBluetoothReset: false,
          }));
          
          // Set data reading timeout
          bleOperationTimeoutRef.current = setTimeout(() => {
            log('Data reading timeout');
            
            setBleScanState(prev => ({
              ...prev,
              isReadingEnergy: false,
              error: 'Data reading timed out',
            }));
            
            if (window.WebViewJavascriptBridge) {
              window.WebViewJavascriptBridge.callHandler('disconnectBle', macAddress, () => {});
            }
            
            toast.error('Could not read battery data. Please try scanning again.');
            pendingBatteryQrCodeRef.current = null;
            pendingBatteryIdRef.current = null;
            pendingScanTypeRef.current = null;
            isConnectionSuccessfulRef.current = false;
            onErrorRef.current?.('Data reading timeout', false);
          }, BLE_DATA_READ_TIMEOUT);
          
          // Request DTA service data
          log('Requesting DTA service data');
          initServiceBleData(
            { serviceName: 'DTA', macAddress },
            () => log('DTA service requested')
          );
          
          resp(macAddress);
        }
      );

      // ============================================
      // CONNECTION FAILURE HANDLER
      // ============================================
      window.WebViewJavascriptBridge.registerHandler(
        'bleConnectFailCallBack',
        (data: string, resp: (r: unknown) => void) => {
          log('Connection failed:', data);
          
          clearOperationTimeout();
          
          // Ignore if already connected
          if (isConnectionSuccessfulRef.current) {
            log('Ignoring late failure callback - already connected');
            resp(data);
            return;
          }
          
          const pendingMac = pendingConnectionMacRef.current;
          
          // Retry if possible
          if (bleRetryCountRef.current < MAX_BLE_RETRIES && pendingMac) {
            bleRetryCountRef.current += 1;
            log(`Retrying connection (${bleRetryCountRef.current}/${MAX_BLE_RETRIES})`);
            
            setBleScanState(prev => ({
              ...prev,
              connectionProgress: 10,
              error: null,
              connectionFailed: false,
            }));
            
            setTimeout(() => {
              if (isConnectionSuccessfulRef.current) {
                log('Connection succeeded during retry delay');
                return;
              }
              connBleByMacAddress(pendingMac, () => {});
            }, 1000 * bleRetryCountRef.current);
            
            resp(data);
            return;
          }
          
          // All retries exhausted
          log('Connection failed after all retries');
          bleRetryCountRef.current = 0;
          isConnectionSuccessfulRef.current = false;
          pendingConnectionMacRef.current = null;
          clearGlobalTimeout();
          
          setBleScanState(prev => ({
            ...prev,
            isConnecting: false,
            isReadingEnergy: false,
            connectionProgress: 0,
            error: 'Connection failed. Please try again.',
            connectionFailed: true,
            requiresBluetoothReset: false,
          }));
          
          toast.error('Battery connection failed. Please try again.');
          pendingBatteryQrCodeRef.current = null;
          pendingBatteryIdRef.current = null;
          pendingScanTypeRef.current = null;
          onErrorRef.current?.('Connection failed', false);
          
          resp(data);
        }
      );

      // ============================================
      // SERVICE DATA PROGRESS HANDLER
      // ============================================
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataOnProgressCallBack',
        (data: string, resp: (r: unknown) => void) => {
          try {
            const p = JSON.parse(data);
            const progress = Math.round((p.progress / p.total) * 100);
            
            setBleScanState(prev => ({
              ...prev,
              connectionProgress: progress,
            }));
          } catch {
            // Ignore parse errors
          }
          resp({ received: true });
        }
      );

      // ============================================
      // SERVICE DATA COMPLETE HANDLER
      // ============================================
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataOnCompleteCallBack',
        (data: string, resp: (r: unknown) => void) => {
          try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            
            // Check for error response
            const respCode = parsedData?.respCode || parsedData?.responseData?.respCode;
            const respDesc = parsedData?.respDesc || parsedData?.responseData?.respDesc || '';
            
            if (respCode && respCode !== '200' && respCode !== 200) {
              log('DTA service error:', { respCode, respDesc });
              
              const isDisconnected = typeof respDesc === 'string' && (
                respDesc.toLowerCase().includes('bluetooth device not connected') ||
                respDesc.toLowerCase().includes('device not connected') ||
                respDesc.toLowerCase().includes('not connected')
              );
              
              if (isDisconnected) {
                clearGlobalTimeout();
                clearOperationTimeout();
                
                setBleScanState(prev => ({
                  ...prev,
                  isReadingEnergy: false,
                  error: 'Bluetooth connection lost',
                  connectionFailed: true,
                  requiresBluetoothReset: true,
                }));
                
                dtaRefreshRetryCountRef.current = 0;
                isConnectionSuccessfulRef.current = false;
                pendingBatteryQrCodeRef.current = null;
                pendingBatteryIdRef.current = null;
                pendingScanTypeRef.current = null;
                
                toast.error('Please turn Bluetooth OFF then ON and try again.');
                onErrorRef.current?.('Bluetooth connection lost', true);
                resp({ success: false, error: respDesc });
                return;
              }
            }
            
            // Only process DTA_SERVICE responses
            if (parsedData?.serviceNameEnum === 'DTA_SERVICE') {
              log('DTA service data received');
              
              clearOperationTimeout();
              
              const energyData = extractEnergyFromDta(parsedData);
              const batteryId = pendingBatteryIdRef.current;
              const scanType = pendingScanTypeRef.current;
              const connectedMac = sessionStorage.getItem('connectedDeviceMac');
              
              // Disconnect helper
              const disconnect = () => {
                if (window.WebViewJavascriptBridge && connectedMac) {
                  window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
                }
                setBleScanState(prev => ({
                  ...prev,
                  isReadingEnergy: false,
                  connectedDevice: null,
                }));
              };
              
              if (energyData !== null && batteryId) {
                // Success!
                log('Energy extracted:', energyData);
                disconnect();
                
                const battery: BatteryData = {
                  id: batteryId,
                  shortId: String(batteryId),
                  chargeLevel: energyData.chargePercent,
                  energy: energyData.energy,
                  macAddress: connectedMac || undefined,
                };
                
                clearGlobalTimeout();
                dtaRefreshRetryCountRef.current = 0;
                
                setBleScanState(prev => ({
                  ...prev,
                  isReadingEnergy: false,
                  connectionProgress: 0,
                  connectedDevice: null,
                }));
                
                isConnectionSuccessfulRef.current = false;
                pendingBatteryQrCodeRef.current = null;
                pendingBatteryIdRef.current = null;
                pendingScanTypeRef.current = null;
                
                toast.success(`Battery scanned: ${(energyData.energy / 1000).toFixed(3)} kWh (${energyData.chargePercent}%)`);
                onBatteryReadRef.current?.(battery, scanType || 'unknown');
              } else if (!batteryId) {
                // No battery ID
                log('No battery ID found');
                disconnect();
                dtaRefreshRetryCountRef.current = 0;
                isConnectionSuccessfulRef.current = false;
                pendingBatteryQrCodeRef.current = null;
                pendingBatteryIdRef.current = null;
                pendingScanTypeRef.current = null;
                toast.error('Could not identify battery. Please try again.');
                onErrorRef.current?.('Battery ID not found', false);
              } else if (dtaRefreshRetryCountRef.current < MAX_DTA_REFRESH_RETRIES && connectedMac) {
                // Retry DTA refresh
                dtaRefreshRetryCountRef.current += 1;
                log(`DTA data incomplete, refreshing (${dtaRefreshRetryCountRef.current}/${MAX_DTA_REFRESH_RETRIES})`);
                
                toast.loading('Reading battery energy...', { id: 'dta-refresh' });
                
                setBleScanState(prev => ({
                  ...prev,
                  isReadingEnergy: true,
                  connectionProgress: 50 + (dtaRefreshRetryCountRef.current * 15),
                }));
                
                setTimeout(() => {
                  initServiceBleData(
                    { serviceName: 'DTA', macAddress: connectedMac },
                    () => log('DTA refresh requested')
                  );
                }, DTA_REFRESH_DELAY);
              } else {
                // DTA refresh failed
                log('DTA refresh failed after retries');
                toast.dismiss('dta-refresh');
                disconnect();
                dtaRefreshRetryCountRef.current = 0;
                isConnectionSuccessfulRef.current = false;
                pendingBatteryQrCodeRef.current = null;
                pendingBatteryIdRef.current = null;
                pendingScanTypeRef.current = null;
                
                setBleScanState(prev => ({
                  ...prev,
                  error: 'Could not read energy values',
                }));
                
                toast.error('Could not read battery energy values. Please try again.');
                onErrorRef.current?.('Energy read failed', false);
              }
            }
            
            resp(parsedData);
          } catch (err) {
            log('Error parsing service data:', err);
            dtaRefreshRetryCountRef.current = 0;
            isConnectionSuccessfulRef.current = false;
            toast.dismiss('dta-refresh');
            toast.error('Failed to read battery energy data.');
            onErrorRef.current?.('Parse error', false);
            resp({ success: false, error: String(err) });
          }
        }
      );

      // ============================================
      // SERVICE DATA FAILURE HANDLER
      // ============================================
      window.WebViewJavascriptBridge.registerHandler(
        'bleInitServiceDataFailureCallBack',
        (data: string, resp: (r: unknown) => void) => {
          log('DTA service failure:', data);
          
          let errorMessage = 'Failed to read energy data';
          let requiresReset = false;
          
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
              requiresReset = true;
            }
          } catch {
            if (checkForDisconnect(data)) {
              errorMessage = 'Bluetooth connection lost';
              requiresReset = true;
            }
          }
          
          clearGlobalTimeout();
          clearOperationTimeout();
          
          setBleScanState(prev => ({
            ...prev,
            isReadingEnergy: false,
            error: errorMessage,
            connectionFailed: true,
            requiresBluetoothReset: requiresReset,
          }));
          
          dtaRefreshRetryCountRef.current = 0;
          isConnectionSuccessfulRef.current = false;
          pendingBatteryQrCodeRef.current = null;
          pendingBatteryIdRef.current = null;
          pendingScanTypeRef.current = null;
          
          if (requiresReset) {
            toast.error('Please turn Bluetooth OFF then ON and try again.');
          } else {
            toast.error('Unable to read battery energy. Please try again.');
          }
          onErrorRef.current?.(errorMessage, requiresReset);
          
          resp({ received: true });
        }
      );

      log('BLE handlers registered');
      setIsReady(true);
    };

    setupBridgeHandlers();

    return () => {
      clearAllTimeouts();
      if (window.WebViewJavascriptBridge) {
        window.WebViewJavascriptBridge.callHandler('stopBleScan', '', () => {});
        const connectedMac = sessionStorage.getItem('connectedDeviceMac');
        if (connectedMac) {
          window.WebViewJavascriptBridge.callHandler('disconnectBle', connectedMac, () => {});
        }
      }
    };
  }, [clearAllTimeouts, clearOperationTimeout, clearGlobalTimeout, log]);

  // ============================================
  // RETURN
  // ============================================

  return {
    /** Current BLE scan state */
    bleScanState,
    /** Whether BLE handlers are ready */
    isReady,
    /** Start BLE scanning for nearby devices */
    startScan,
    /** Stop BLE scanning */
    stopScan,
    /** Main entry point: scan battery QR and bind via BLE */
    scanAndBindBattery,
    /** Cancel ongoing BLE operation */
    cancelOperation,
    /** Reset state for a new operation */
    resetState,
    /** Get list of currently detected devices */
    getDetectedDevices,
  };
}

export default useBleConnection;
