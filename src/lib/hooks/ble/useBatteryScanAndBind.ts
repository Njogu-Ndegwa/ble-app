'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import type { BatteryData, BleFullState, BleDevice } from './types';
import { useBleDeviceScanner } from './useBleDeviceScanner';
import { useBleDeviceConnection } from './useBleDeviceConnection';
import { useBleServiceReader } from './useBleServiceReader';
import { 
  extractEnergyFromDta, 
  createBatteryData, 
  parseBatteryIdFromQr,
} from './energyUtils';

// ============================================
// CONSTANTS
// ============================================

const DEVICE_MATCH_TIMEOUT = 20000; // 20 seconds to find matching device
const DEVICE_MATCH_RETRY_INTERVAL = 2000; // Check every 2 seconds
const MATCH_CHARS = 6; // Match by last 6 characters of battery ID

const INITIAL_STATE: BleFullState = {
  isScanning: false,
  detectedDevices: [],
  isConnecting: false,
  isConnected: false,
  connectedDevice: null,
  connectionProgress: 0,
  isReadingService: false,
  error: null,
  connectionFailed: false,
  requiresBluetoothReset: false,
};

// ============================================
// OPTIONS
// ============================================

export interface UseBatteryScanAndBindOptions {
  /** Called when battery data is successfully read */
  onBatteryRead?: (battery: BatteryData, scanType: string) => void;
  /** Called on any error */
  onError?: (error: string) => void;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-start scanning when ready */
  autoStartScan?: boolean;
}

// ============================================
// HOOK
// ============================================

/**
 * useBatteryScanAndBind - Complete battery scan-to-bind workflow
 * 
 * This is a high-level hook that composes:
 * 1. BLE Device Scanner - discovers nearby devices
 * 2. BLE Device Connection - connects to matched device
 * 3. BLE Service Reader - reads DTA service data
 * 4. Energy Calculation - extracts and calculates energy
 * 
 * Flow:
 * 1. User scans QR code → batteryId extracted
 * 2. System starts BLE scan (if not already scanning)
 * 3. System looks for device matching last 6 chars of batteryId
 * 4. When found, connects to that device
 * 5. After connection, reads DTA service
 * 6. Extracts energy data and calls onBatteryRead
 * 
 * @example
 * const {
 *   state,
 *   scanAndBind,
 *   cancel,
 *   reset,
 * } = useBatteryScanAndBind({
 *   onBatteryRead: (battery, type) => {
 *     if (type === 'old') setOldBattery(battery);
 *     else setNewBattery(battery);
 *   },
 * });
 * 
 * // From QR scanner callback:
 * scanAndBind(qrData, 'old');
 */
export function useBatteryScanAndBind(options: UseBatteryScanAndBindOptions = {}) {
  const { onBatteryRead, onError, debug = false, autoStartScan = false } = options;

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.info('[Battery Scan&Bind]', ...args);
  }, [debug]);

  // ============================================
  // COMPOSED HOOKS - Destructure stable functions/values to avoid infinite loops
  // IMPORTANT: Do NOT put scanner/connection/serviceReader objects in dependency arrays!
  // These are new object references on every render. Instead, use destructured functions.
  // ============================================

  const {
    scanState: scannerScanState,
    isReady: scannerIsReady,
    startScan: scannerStartScan,
    stopScan: scannerStopScan,
    clearDevices: scannerClearDevices,
    findDeviceByNameSuffix: scannerFindDeviceByNameSuffix,
    getDevices: scannerGetDevices,
  } = useBleDeviceScanner({ debug, autoStart: autoStartScan });

  const {
    connectionState,
    isReady: connectionIsReady,
    isConnected,
    connectedDevice,
    connect: connectionConnect,
    disconnect: connectionDisconnect,
    cancelConnection,
    resetState: connectionResetState,
  } = useBleDeviceConnection({ debug });

  const {
    serviceState,
    isReady: serviceReaderIsReady,
    lastServiceData,
    readDtaService,
    cancelRead: serviceReaderCancelRead,
    resetState: serviceReaderResetState,
  } = useBleServiceReader({ debug });

  // ============================================
  // STATE
  // ============================================

  const [state, setState] = useState<BleFullState>(INITIAL_STATE);
  const [pendingBatteryId, setPendingBatteryId] = useState<string | null>(null);
  const [pendingScanType, setPendingScanType] = useState<string | null>(null);

  // ============================================
  // REFS
  // ============================================

  const matchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isReadingEnergyRef = useRef(false);

  // Callback refs
  const onBatteryReadRef = useRef(onBatteryRead);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onBatteryReadRef.current = onBatteryRead;
    onErrorRef.current = onError;
  }, [onBatteryRead, onError]);

  // ============================================
  // CLEAR HELPERS
  // ============================================

  const clearMatchTimers = useCallback(() => {
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
    if (matchIntervalRef.current) {
      clearInterval(matchIntervalRef.current);
      matchIntervalRef.current = null;
    }
  }, []);

  // ============================================
  // SYNC STATE FROM COMPOSED HOOKS
  // ============================================

  useEffect(() => {
    setState(prev => ({
      ...prev,
      isScanning: scannerScanState.isScanning,
      detectedDevices: scannerScanState.detectedDevices,
      isConnecting: connectionState.isConnecting,
      isConnected: connectionState.isConnected,
      connectedDevice: connectionState.connectedDevice,
      connectionProgress: connectionState.connectionProgress,
      connectionFailed: connectionState.connectionFailed,
      requiresBluetoothReset: connectionState.requiresBluetoothReset,
      isReadingService: serviceState.isReading,
      error: scannerScanState.error || 
             connectionState.error || 
             serviceState.error || 
             null,
    }));
  }, [
    scannerScanState,
    connectionState,
    serviceState,
  ]);

  // ============================================
  // CONNECTION → SERVICE READING
  // ============================================

  // When connected, automatically read DTA service
  useEffect(() => {
    if (
      isConnected &&
      connectedDevice &&
      pendingBatteryId &&
      !isReadingEnergyRef.current
    ) {
      log('Connected! Starting DTA service read');
      isReadingEnergyRef.current = true;
      readDtaService(connectedDevice);
    }
  }, [
    isConnected,
    connectedDevice,
    pendingBatteryId,
    readDtaService,
    log,
  ]);

  // Handle service data received
  useEffect(() => {
    if (
      lastServiceData &&
      pendingBatteryId &&
      pendingScanType &&
      isReadingEnergyRef.current
    ) {
      log('Service data received, extracting energy');
      
      const energyData = extractEnergyFromDta(lastServiceData);
      
      if (energyData) {
        const battery = createBatteryData(
          pendingBatteryId,
          energyData,
          connectedDevice || undefined
        );
        
        log('Battery data extracted:', battery);
        
        // Notify callback
        onBatteryReadRef.current?.(battery, pendingScanType);
        
        // Clear pending state
        setPendingBatteryId(null);
        setPendingScanType(null);
        isReadingEnergyRef.current = false;
      } else {
        log('Failed to extract energy data');
        toast.error('Could not read battery data. Please try again.');
        onErrorRef.current?.('Failed to extract energy data');
        
        // Clear pending state
        setPendingBatteryId(null);
        setPendingScanType(null);
        isReadingEnergyRef.current = false;
      }
    }
  }, [lastServiceData, pendingBatteryId, pendingScanType, connectedDevice, log]);

  // ============================================
  // MAIN FUNCTION: SCAN AND BIND
  // ============================================

  /**
   * Start the scan-to-bind process
   * 
   * @param qrData - QR code data (JSON or plain string)
   * @param scanType - Type of scan ('old' | 'new' | custom)
   */
  const scanAndBind = useCallback((qrData: string, scanType: string) => {
    log('scanAndBind called:', { qrData, scanType });
    
    // Parse battery ID from QR
    const batteryId = parseBatteryIdFromQr(qrData);
    
    if (!batteryId) {
      toast.error('Invalid QR code');
      onErrorRef.current?.('Invalid QR code');
      return false;
    }
    
    log('Battery ID:', batteryId);
    
    // Store pending info
    setPendingBatteryId(batteryId);
    setPendingScanType(scanType);
    isReadingEnergyRef.current = false;
    
    // Start scanning if not already
    if (!scannerScanState.isScanning) {
      log('Starting BLE scan');
      scannerStartScan();
    }
    
    // Clear any previous match timers
    clearMatchTimers();
    
    // Set up device matching
    const matchDevice = () => {
      const targetSuffix = batteryId.slice(-MATCH_CHARS).toLowerCase();
      log('Looking for device with suffix:', targetSuffix);
      log('Available devices:', scannerGetDevices().map(d => d.name));
      
      // Find matching device
      const matched = scannerFindDeviceByNameSuffix(batteryId, MATCH_CHARS);
      
      if (matched) {
        log('Found matching device:', matched);
        clearMatchTimers();
        scannerStopScan();
        
        // Connect to matched device
        connectionConnect(matched.macAddress);
        return true;
      }
      
      return false;
    };
    
    // Try matching immediately
    if (matchDevice()) {
      return true;
    }
    
    // Set up interval to check for device
    matchIntervalRef.current = setInterval(() => {
      matchDevice();
    }, DEVICE_MATCH_RETRY_INTERVAL);
    
    // Set timeout for device matching
    matchTimeoutRef.current = setTimeout(() => {
      clearMatchTimers();
      scannerStopScan();
      
      log('Device matching timed out');
      
      setState(prev => ({
        ...prev,
        isScanning: false,
        error: 'Device not found',
      }));
      
      toast.error('Battery device not found. Make sure the battery is nearby and powered on.');
      onErrorRef.current?.('Device not found');
      
      // Clear pending state
      setPendingBatteryId(null);
      setPendingScanType(null);
    }, DEVICE_MATCH_TIMEOUT);
    
    return true;
  }, [scannerScanState.isScanning, scannerStartScan, scannerStopScan, scannerGetDevices, scannerFindDeviceByNameSuffix, connectionConnect, clearMatchTimers, log]);

  // ============================================
  // CANCEL / RESET
  // ============================================

  /**
   * Cancel ongoing operation
   */
  const cancel = useCallback(() => {
    log('Cancelling operation');
    
    clearMatchTimers();
    scannerStopScan();
    cancelConnection();
    serviceReaderCancelRead();
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    isReadingEnergyRef.current = false;
  }, [clearMatchTimers, scannerStopScan, cancelConnection, serviceReaderCancelRead, log]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    log('Resetting state');
    
    clearMatchTimers();
    scannerClearDevices();
    connectionResetState();
    serviceReaderResetState();
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    isReadingEnergyRef.current = false;
    
    setState(INITIAL_STATE);
  }, [clearMatchTimers, scannerClearDevices, connectionResetState, serviceReaderResetState, log]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      clearMatchTimers();
    };
  }, [clearMatchTimers]);

  // ============================================
  // RETURN
  // ============================================

  return {
    /** Current state */
    state,
    /** Pending battery ID */
    pendingBatteryId,
    /** Whether the hook is ready */
    isReady: scannerIsReady && connectionIsReady && serviceReaderIsReady,
    /** Start scan-to-bind process */
    scanAndBind,
    /** Cancel ongoing operation */
    cancel,
    /** Reset all state */
    reset,
    /** Start BLE scanning (without binding) */
    startScan: scannerStartScan,
    /** Stop BLE scanning */
    stopScan: scannerStopScan,
    /** Get detected devices */
    getDevices: scannerGetDevices,
    /** Find device by name suffix */
    findDevice: scannerFindDeviceByNameSuffix,
    /** Disconnect from device */
    disconnect: connectionDisconnect,
  };
}

export default useBatteryScanAndBind;
