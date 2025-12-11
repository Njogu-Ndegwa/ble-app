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
  extractActualBatteryIdFromAtt,
  createBatteryData, 
  parseBatteryIdFromQr,
} from './energyUtils';
import type { BatteryData, BleDevice, BleReadingPhase } from './types';

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
  /** Alias for isReadingEnergy - compatibility with BleFullState */
  isReadingService: boolean;
  /** Current reading phase: 'idle' | 'dta' | 'att' */
  readingPhase: BleReadingPhase;
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
  isReadingService: false,
  readingPhase: 'idle',
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
    forceBleReset: connectionForceBleReset,
  } = useBleDeviceConnection({ debug });

  const {
    serviceState,
    isReady: serviceReaderIsReady,
    lastServiceData,
    readDtaService,
    readAttService,
    cancelRead: serviceReaderCancelRead,
    resetState: serviceReaderResetState,
  } = useBleServiceReader({ debug });

  // ============================================
  // STATE
  // ============================================

  const [state, setState] = useState<FlowBleScanState>(INITIAL_STATE);
  const [pendingBatteryId, setPendingBatteryId] = useState<string | null>(null);
  const [pendingScanType, setPendingScanType] = useState<'old_battery' | 'new_battery' | null>(null);
  
  // Track reading phase: 'idle' | 'dta' | 'att'
  const [readingPhase, setReadingPhase] = useState<BleReadingPhase>('idle');
  // Store DTA data while waiting for ATT
  const [dtaData, setDtaData] = useState<unknown>(null);

  // ============================================
  // REFS
  // ============================================

  const matchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  // Track when we're in device matching phase (after QR scan, before actual connection)
  const isDeviceMatchingRef = useRef(false);

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
    setState(prev => {
      // Preserve isConnecting=true when in device matching phase (after QR scan, before actual connection)
      // This ensures the progress modal stays visible during device discovery
      const shouldBeConnecting = connectionState.isConnecting || isDeviceMatchingRef.current;
      
      // Filter out the connected device from the detected devices list
      // This prevents showing a device we're already connected to when rescanning
      const filteredDevices = connectionState.connectedDevice
        ? scannerScanState.detectedDevices.filter(
            device => device.macAddress.toUpperCase() !== connectionState.connectedDevice?.toUpperCase()
          )
        : scannerScanState.detectedDevices;
      
      return {
        ...prev,
        isScanning: scannerScanState.isScanning,
        detectedDevices: filteredDevices,
        isConnecting: shouldBeConnecting,
        connectedDevice: connectionState.connectedDevice,
        connectionProgress: serviceState.isReading 
          ? serviceState.progress 
          : connectionState.connectionProgress,
        connectionFailed: connectionState.connectionFailed,
        requiresBluetoothReset: connectionState.requiresBluetoothReset,
        isReadingEnergy: serviceState.isReading,
        isReadingService: serviceState.isReading,
        readingPhase,
        error: scannerScanState.error || 
               connectionState.error || 
               serviceState.error || 
               null,
      };
    });
  }, [
    scannerScanState,
    connectionState,
    serviceState,
    readingPhase,
  ]);

  // ============================================
  // CONNECTION → SERVICE READING (DTA → ATT flow)
  // ============================================

  // When connected, automatically start reading DTA service first
  useEffect(() => {
    if (
      isConnected &&
      connectedDevice &&
      pendingBatteryId &&
      !isProcessingRef.current &&
      readingPhase === 'idle'
    ) {
      log('Connected! Starting DTA service read (Step 1/2)');
      isProcessingRef.current = true;
      setReadingPhase('dta');
      readDtaService(connectedDevice);
    }
  }, [
    isConnected,
    connectedDevice,
    pendingBatteryId,
    readDtaService,
    readingPhase,
    log,
  ]);

  // Handle service data received - manages DTA → ATT flow
  useEffect(() => {
    if (
      lastServiceData &&
      pendingBatteryId &&
      pendingScanType &&
      isProcessingRef.current &&
      connectedDevice
    ) {
      // Check which phase we're in
      if (readingPhase === 'dta') {
        log('DTA service data received, storing and starting ATT read (Step 2/2)');
        
        // Validate DTA data has energy info
        const energyData = extractEnergyFromDta(lastServiceData);
        if (!energyData) {
          log('Failed to extract energy data from DTA');
          toast.error('Could not read battery data. Please try again.');
          onErrorRef.current?.('Failed to extract energy data from DTA');
          
          // Disconnect and clear pending state
          if (connectedDevice) {
            connectionDisconnect(connectedDevice);
          }
          setPendingBatteryId(null);
          setPendingScanType(null);
          setReadingPhase('idle');
          setDtaData(null);
          isProcessingRef.current = false;
          
          setState(prev => ({
            ...prev,
            error: 'Failed to read battery data',
            connectionFailed: true,
          }));
          return;
        }
        
        // Store DTA data and move to ATT phase
        setDtaData(lastServiceData);
        setReadingPhase('att');
        
        // Now read ATT service to get actual battery ID (opid/ppid)
        readAttService(connectedDevice);
        
      } else if (readingPhase === 'att') {
        log('ATT service data received, extracting actual battery ID');
        
        // Extract actual battery ID from ATT (opid or ppid)
        const actualBatteryId = extractActualBatteryIdFromAtt(lastServiceData);
        
        if (!actualBatteryId) {
          log('Warning: Could not extract actual battery ID from ATT, proceeding without it');
          // This is a warning, not an error - we can still proceed with QR-scanned ID
        } else {
          log('Actual battery ID from ATT:', actualBatteryId);
        }
        
        // Extract energy data from stored DTA data
        const energyData = extractEnergyFromDta(dtaData);
        
        if (energyData) {
          // Create battery data with actual battery ID from ATT
          const battery = createBatteryData(
            pendingBatteryId,
            energyData,
            connectedDevice || undefined,
            actualBatteryId || undefined
          );
          
          log('Battery data extracted with actual ID:', battery);
          
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
          setReadingPhase('idle');
          setDtaData(null);
          isProcessingRef.current = false;
        } else {
          log('Failed to extract energy data from stored DTA');
          
          // Disconnect on failure
          if (connectedDevice) {
            connectionDisconnect(connectedDevice);
          }
          
          toast.error('Could not read battery data. Please try again.');
          onErrorRef.current?.('Failed to extract energy data');
          
          // Clear pending state
          setPendingBatteryId(null);
          setPendingScanType(null);
          setReadingPhase('idle');
          setDtaData(null);
          isProcessingRef.current = false;
          
          setState(prev => ({
            ...prev,
            error: 'Failed to read battery data',
            connectionFailed: true,
          }));
        }
      }
    }
  }, [
    lastServiceData, 
    pendingBatteryId, 
    pendingScanType, 
    connectedDevice,
    readingPhase,
    dtaData,
    readAttService,
    connectionDisconnect,
    log,
  ]);

  // Handle connection failure
  useEffect(() => {
    if (connectionState.connectionFailed && pendingBatteryId) {
      log('Connection failed');
      clearMatchTimers();
      
      const requiresReset = connectionState.requiresBluetoothReset;
      
      // Check if error indicates MAC address mismatch
      const isMacMismatch = connectionState.error?.toLowerCase().includes('macaddress') ||
                           connectionState.error?.toLowerCase().includes('mac address') ||
                           connectionState.error?.toLowerCase().includes('connection stuck');
      
      if (isMacMismatch || requiresReset) {
        // Force reset BLE state when MAC mismatch or reset required
        log('MAC mismatch or reset required - forcing BLE reset');
        connectionForceBleReset();
      }
      
      onErrorRef.current?.('Connection failed', requiresReset || isMacMismatch);
      
      // Clear pending state
      setPendingBatteryId(null);
      setPendingScanType(null);
      setReadingPhase('idle');
      setDtaData(null);
      isProcessingRef.current = false;
    }
  }, [connectionState.connectionFailed, connectionState.requiresBluetoothReset, connectionState.error, pendingBatteryId, clearMatchTimers, connectionForceBleReset, log]);

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
    
    // Enter device matching phase - this keeps isConnecting=true until we find a device
    isDeviceMatchingRef.current = true;
    
    // Update state to show connecting
    setState(prev => ({
      ...prev,
      isConnecting: true,
      connectionProgress: 0, // Start at 0%
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
        
        // Exit device matching phase - actual connection is starting
        isDeviceMatchingRef.current = false;
        
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
      
      // Exit device matching phase
      isDeviceMatchingRef.current = false;
      
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
    
    // Exit device matching phase
    isDeviceMatchingRef.current = false;
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    setReadingPhase('idle');
    setDtaData(null);
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
    
    // Exit device matching phase
    isDeviceMatchingRef.current = false;
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    setReadingPhase('idle');
    setDtaData(null);
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
   * Force reset BLE state in both app and native layer
   * Use this when the BLE native layer gets into a stuck state (e.g., "macAddress is not match" error)
   */
  const forceBleReset = useCallback(() => {
    log('Force resetting BLE state');
    
    clearMatchTimers();
    scannerStopScan();
    scannerClearDevices();
    connectionForceBleReset();
    serviceReaderResetState();
    
    // Exit device matching phase
    isDeviceMatchingRef.current = false;
    
    setPendingBatteryId(null);
    setPendingScanType(null);
    setReadingPhase('idle');
    setDtaData(null);
    isProcessingRef.current = false;
    
    setState(INITIAL_STATE);
    
    log('BLE state fully reset');
  }, [clearMatchTimers, scannerStopScan, scannerClearDevices, connectionForceBleReset, serviceReaderResetState, log]);

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
    /** Current reading phase: 'idle' | 'dta' | 'att' */
    readingPhase,
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
    /** Force reset BLE state in both app and native layer - use when stuck */
    forceBleReset,
    /** Get detected devices */
    getDetectedDevices,
  };
}

export default useFlowBatteryScan;
