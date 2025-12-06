'use client';

/**
 * useFlowBatteryScan - Hook for battery scanning in Attendant/Sales workflows
 * 
 * This hook wraps the modular BLE hooks and provides a simpler interface
 * specifically designed for the battery swap flow in AttendantFlow and SalesFlow.
 * 
 * It handles:
 * - Device discovery (background scanning)
 * - QR code → device matching by last 6 chars
 * - BLE connection with retry
 * - DTA service reading
 * - Energy extraction
 * 
 * The flow component only needs to:
 * 1. Call startScanning() when entering battery scan steps
 * 2. Call handleQrScanned(qrData, type) when QR is scanned
 * 3. Handle onBatteryRead callback with battery data
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useBleDeviceScanner } from './useBleDeviceScanner';
import { useBleDeviceConnection } from './useBleDeviceConnection';
import { useBleServiceReader } from './useBleServiceReader';
import { 
  extractEnergyFromDta, 
  createBatteryData, 
  parseBatteryIdFromQr,
} from './energyUtils';
import type { BatteryData, BleDevice } from './types';

// ============================================
// CONSTANTS
// ============================================

const DEVICE_MATCH_TIMEOUT = 25000; // 25 seconds to find matching device
const DEVICE_MATCH_RETRY_INTERVAL = 2000; // Check every 2 seconds
const MATCH_CHARS = 6; // Match by last 6 characters

// ============================================
// STATE TYPE
// ============================================

export interface FlowBleScanState {
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

const INITIAL_STATE: FlowBleScanState = {
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
// OPTIONS
// ============================================

export interface UseFlowBatteryScanOptions {
  /** Called when old battery data is read */
  onOldBatteryRead?: (battery: BatteryData) => void;
  /** Called when new battery data is read */
  onNewBatteryRead?: (battery: BatteryData) => void;
  /** Called on any error */
  onError?: (error: string, requiresReset?: boolean) => void;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// HOOK
// ============================================

export function useFlowBatteryScan(options: UseFlowBatteryScanOptions = {}) {
  const { onOldBatteryRead, onNewBatteryRead, onError, debug = false } = options;

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.info('[FlowBatteryScan]', ...args);
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
  } = useBleDeviceScanner({ debug, nameFilter: 'OVES' });

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

  const [state, setState] = useState<FlowBleScanState>(INITIAL_STATE);
  const [pendingBatteryId, setPendingBatteryId] = useState<string | null>(null);
  const [pendingScanType, setPendingScanType] = useState<'old_battery' | 'new_battery' | null>(null);

  // ============================================
  // REFS
  // ============================================

  const matchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Callback refs (updated on every render to avoid stale closures)
  const onOldBatteryReadRef = useRef(onOldBatteryRead);
  const onNewBatteryReadRef = useRef(onNewBatteryRead);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onOldBatteryReadRef.current = onOldBatteryRead;
    onNewBatteryReadRef.current = onNewBatteryRead;
    onErrorRef.current = onError;
  }, [onOldBatteryRead, onNewBatteryRead, onError]);

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
      connectedDevice: connectionState.connectedDevice,
      connectionProgress: serviceState.isReading 
        ? serviceState.progress 
        : connectionState.connectionProgress,
      connectionFailed: connectionState.connectionFailed,
      requiresBluetoothReset: connectionState.requiresBluetoothReset,
      isReadingEnergy: serviceState.isReading,
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
      !isProcessingRef.current
    ) {
      log('Connected! Starting DTA service read');
      isProcessingRef.current = true;
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
      isProcessingRef.current
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
        
        // Disconnect from device
        if (connectedDevice) {
          connectionDisconnect(connectedDevice);
        }
        
        // Notify appropriate callback based on scan type
        // NOTE: Toast notifications are handled by the caller (AttendantFlow/SalesFlow)
        // to avoid duplicate notifications
        if (pendingScanType === 'old_battery') {
          onOldBatteryReadRef.current?.(battery);
        } else if (pendingScanType === 'new_battery') {
          onNewBatteryReadRef.current?.(battery);
        }
        
        // Clear pending state
        setPendingBatteryId(null);
        setPendingScanType(null);
        isProcessingRef.current = false;
      } else {
        log('Failed to extract energy data');
        
        // Disconnect on failure
        if (connectedDevice) {
          connectionDisconnect(connectedDevice);
        }
        
        toast.error('Could not read battery data. Please try again.');
        onErrorRef.current?.('Failed to extract energy data');
        
        // Clear pending state
        setPendingBatteryId(null);
        setPendingScanType(null);
        isProcessingRef.current = false;
        
        setState(prev => ({
          ...prev,
          error: 'Failed to read battery data',
          connectionFailed: true,
        }));
      }
    }
  }, [
    lastServiceData, 
    pendingBatteryId, 
    pendingScanType, 
    connectedDevice,
    connectionDisconnect,
    log,
  ]);

  // Handle connection failure
  useEffect(() => {
    if (connectionState.connectionFailed && pendingBatteryId) {
      log('Connection failed');
      clearMatchTimers();
      
      const requiresReset = connectionState.requiresBluetoothReset;
      onErrorRef.current?.('Connection failed', requiresReset);
      
      // Clear pending state
      setPendingBatteryId(null);
      setPendingScanType(null);
      isProcessingRef.current = false;
    }
  }, [connectionState.connectionFailed, connectionState.requiresBluetoothReset, pendingBatteryId, clearMatchTimers, log]);

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Start BLE scanning (call when entering battery scan steps)
   */
  const startScanning = useCallback(() => {
    log('Starting BLE scanning');
    scannerStartScan();
  }, [scannerStartScan, log]);

  /**
   * Stop BLE scanning
   */
  const stopScanning = useCallback(() => {
    log('Stopping BLE scanning');
    scannerStopScan();
  }, [scannerStopScan, log]);

  /**
   * Handle QR code scanned - starts the scan-to-bind process
   * 
   * @param qrData - Raw QR code data
   * @param scanType - 'old_battery' or 'new_battery'
   */
  const handleQrScanned = useCallback((qrData: string, scanType: 'old_battery' | 'new_battery') => {
    log('QR scanned:', { qrData, scanType });
    
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
    isProcessingRef.current = false;
    
    // Ensure scanning is running
    if (!scannerScanState.isScanning) {
      log('Starting BLE scan');
      scannerStartScan();
    }
    
    // Clear any previous match timers
    clearMatchTimers();
    
    // Update state to show connecting
    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
      connectionFailed: false,
    }));
    
    // Set up device matching
    const matchDevice = () => {
      const targetSuffix = batteryId.slice(-MATCH_CHARS).toLowerCase();
      log('Looking for device with suffix:', targetSuffix);
      
      const devices = scannerGetDevices();
      log('Available devices:', devices.map(d => d.name));
      
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
        isConnecting: false,
        error: 'Device may already be connected',
        connectionFailed: true,
      }));
      
      toast.error('Device may already be connected. Try turning Bluetooth off and on, then try again.');
      onErrorRef.current?.('Device may already be connected');
      
      // Clear pending state
      setPendingBatteryId(null);
      setPendingScanType(null);
    }, DEVICE_MATCH_TIMEOUT);
    
    return true;
  }, [scannerScanState.isScanning, scannerStartScan, scannerStopScan, scannerGetDevices, scannerFindDeviceByNameSuffix, connectionConnect, clearMatchTimers, log]);

  /**
   * Cancel ongoing operation
   */
  const cancelOperation = useCallback(() => {
    // Don't cancel if we're actively reading data
    if (isProcessingRef.current && isConnected) {
      log('Cannot cancel - reading battery data');
      toast('Please wait while reading battery data...', { icon: '⏳' });
      return false;
    }
    
    log('Cancelling operation');
    
    clearMatchTimers();
    scannerStopScan();
    cancelConnection();
    serviceReaderCancelRead();
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    isProcessingRef.current = false;
    
    setState(INITIAL_STATE);
    return true;
  }, [clearMatchTimers, scannerStopScan, cancelConnection, serviceReaderCancelRead, isConnected, log]);

  /**
   * Reset all state (for retry)
   */
  const resetState = useCallback(() => {
    log('Resetting state');
    
    clearMatchTimers();
    scannerClearDevices();
    connectionResetState();
    serviceReaderResetState();
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    isProcessingRef.current = false;
    
    setState(INITIAL_STATE);
  }, [clearMatchTimers, scannerClearDevices, connectionResetState, serviceReaderResetState, log]);

  /**
   * Retry after failure - resets and restarts scanning
   */
  const retryConnection = useCallback(() => {
    log('Retrying connection');
    resetState();
    scannerStartScan();
  }, [resetState, scannerStartScan, log]);

  /**
   * Get detected devices (for debugging/display)
   */
  const getDetectedDevices = useCallback(() => {
    return scannerGetDevices();
  }, [scannerGetDevices]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      clearMatchTimers();
      scannerStopScan();
    };
  }, [clearMatchTimers, scannerStopScan]);

  // ============================================
  // RETURN
  // ============================================

  return {
    /** Current BLE state (compatible with existing BleScanState) */
    bleScanState: state,
    /** Pending battery ID being processed */
    pendingBatteryId,
    /** Current scan type */
    pendingScanType,
    /** Whether the hook is ready */
    isReady: scannerIsReady && connectionIsReady && serviceReaderIsReady,
    /** Start BLE scanning */
    startScanning,
    /** Stop BLE scanning */
    stopScanning,
    /** Handle QR code scanned */
    handleQrScanned,
    /** Cancel ongoing operation */
    cancelOperation,
    /** Reset all state */
    resetState,
    /** Retry after failure */
    retryConnection,
    /** Get detected devices */
    getDetectedDevices,
  };
}

export default useFlowBatteryScan;
