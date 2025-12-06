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
  // COMPOSED HOOKS
  // ============================================

  const scanner = useBleDeviceScanner({ debug, nameFilter: 'OVES' });
  const connection = useBleDeviceConnection({ debug });
  const serviceReader = useBleServiceReader({ debug });

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
      isScanning: scanner.scanState.isScanning,
      detectedDevices: scanner.scanState.detectedDevices,
      isConnecting: connection.connectionState.isConnecting,
      connectedDevice: connection.connectionState.connectedDevice,
      connectionProgress: serviceReader.serviceState.isReading 
        ? serviceReader.serviceState.progress 
        : connection.connectionState.connectionProgress,
      connectionFailed: connection.connectionState.connectionFailed,
      requiresBluetoothReset: connection.connectionState.requiresBluetoothReset,
      isReadingEnergy: serviceReader.serviceState.isReading,
      error: scanner.scanState.error || 
             connection.connectionState.error || 
             serviceReader.serviceState.error || 
             null,
    }));
  }, [
    scanner.scanState,
    connection.connectionState,
    serviceReader.serviceState,
  ]);

  // ============================================
  // CONNECTION → SERVICE READING
  // ============================================

  // When connected, automatically read DTA service
  useEffect(() => {
    if (
      connection.isConnected &&
      connection.connectedDevice &&
      pendingBatteryId &&
      !isProcessingRef.current
    ) {
      log('Connected! Starting DTA service read');
      isProcessingRef.current = true;
      serviceReader.readDtaService(connection.connectedDevice);
    }
  }, [
    connection.isConnected,
    connection.connectedDevice,
    pendingBatteryId,
    serviceReader,
    log,
  ]);

  // Handle service data received
  useEffect(() => {
    if (
      serviceReader.lastServiceData &&
      pendingBatteryId &&
      pendingScanType &&
      isProcessingRef.current
    ) {
      log('Service data received, extracting energy');
      
      const energyData = extractEnergyFromDta(serviceReader.lastServiceData);
      
      if (energyData) {
        const battery = createBatteryData(
          pendingBatteryId,
          energyData,
          connection.connectedDevice || undefined
        );
        
        log('Battery data extracted:', battery);
        
        // Disconnect from device
        if (connection.connectedDevice) {
          connection.disconnect(connection.connectedDevice);
        }
        
        // Notify appropriate callback based on scan type
        if (pendingScanType === 'old_battery') {
          onOldBatteryReadRef.current?.(battery);
          toast.success(`Old battery: ${(battery.energy / 1000).toFixed(3)} kWh (${battery.chargeLevel}%)`);
        } else if (pendingScanType === 'new_battery') {
          onNewBatteryReadRef.current?.(battery);
          toast.success(`New battery: ${(battery.energy / 1000).toFixed(3)} kWh (${battery.chargeLevel}%)`);
        }
        
        // Clear pending state
        setPendingBatteryId(null);
        setPendingScanType(null);
        isProcessingRef.current = false;
      } else {
        log('Failed to extract energy data');
        
        // Disconnect on failure
        if (connection.connectedDevice) {
          connection.disconnect(connection.connectedDevice);
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
    serviceReader.lastServiceData, 
    pendingBatteryId, 
    pendingScanType, 
    connection.connectedDevice,
    connection,
    log,
  ]);

  // Handle connection failure
  useEffect(() => {
    if (connection.connectionState.connectionFailed && pendingBatteryId) {
      log('Connection failed');
      clearMatchTimers();
      
      const requiresReset = connection.connectionState.requiresBluetoothReset;
      onErrorRef.current?.('Connection failed', requiresReset);
      
      // Clear pending state
      setPendingBatteryId(null);
      setPendingScanType(null);
      isProcessingRef.current = false;
    }
  }, [connection.connectionState.connectionFailed, connection.connectionState.requiresBluetoothReset, pendingBatteryId, clearMatchTimers, log]);

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Start BLE scanning (call when entering battery scan steps)
   */
  const startScanning = useCallback(() => {
    log('Starting BLE scanning');
    scanner.startScan();
  }, [scanner, log]);

  /**
   * Stop BLE scanning
   */
  const stopScanning = useCallback(() => {
    log('Stopping BLE scanning');
    scanner.stopScan();
  }, [scanner, log]);

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
    if (!scanner.scanState.isScanning) {
      log('Starting BLE scan');
      scanner.startScan();
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
      
      const devices = scanner.getDevices();
      log('Available devices:', devices.map(d => d.name));
      
      // Find matching device
      const matched = scanner.findDeviceByNameSuffix(batteryId, MATCH_CHARS);
      
      if (matched) {
        log('Found matching device:', matched);
        clearMatchTimers();
        scanner.stopScan();
        
        // Connect to matched device
        connection.connect(matched.macAddress);
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
      scanner.stopScan();
      
      log('Device matching timed out');
      
      setState(prev => ({
        ...prev,
        isScanning: false,
        isConnecting: false,
        error: 'Device not found',
        connectionFailed: true,
      }));
      
      toast.error('Battery device not found. Make sure the battery is nearby and powered on.');
      onErrorRef.current?.('Device not found');
      
      // Clear pending state
      setPendingBatteryId(null);
      setPendingScanType(null);
    }, DEVICE_MATCH_TIMEOUT);
    
    return true;
  }, [scanner, connection, clearMatchTimers, log]);

  /**
   * Cancel ongoing operation
   */
  const cancelOperation = useCallback(() => {
    // Don't cancel if we're actively reading data
    if (isProcessingRef.current && connection.isConnected) {
      log('Cannot cancel - reading battery data');
      toast('Please wait while reading battery data...', { icon: '⏳' });
      return false;
    }
    
    log('Cancelling operation');
    
    clearMatchTimers();
    scanner.stopScan();
    connection.cancelConnection();
    serviceReader.cancelRead();
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    isProcessingRef.current = false;
    
    setState(INITIAL_STATE);
    return true;
  }, [clearMatchTimers, scanner, connection, serviceReader, log]);

  /**
   * Reset all state (for retry)
   */
  const resetState = useCallback(() => {
    log('Resetting state');
    
    clearMatchTimers();
    scanner.clearDevices();
    connection.resetState();
    serviceReader.resetState();
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    isProcessingRef.current = false;
    
    setState(INITIAL_STATE);
  }, [clearMatchTimers, scanner, connection, serviceReader, log]);

  /**
   * Retry after failure - resets and restarts scanning
   */
  const retryConnection = useCallback(() => {
    log('Retrying connection');
    resetState();
    scanner.startScan();
  }, [resetState, scanner, log]);

  /**
   * Get detected devices (for debugging/display)
   */
  const getDetectedDevices = useCallback(() => {
    return scanner.getDevices();
  }, [scanner]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      clearMatchTimers();
      scanner.stopScan();
    };
  }, [clearMatchTimers, scanner]);

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
    isReady: scanner.isReady && connection.isReady && serviceReader.isReady,
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
