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
  // CRITICAL: Force closed flag - when true, sync effect will not override with active states
  // This prevents the modal from staying open when cancelOperation is called
  // The flag is set when cancelOperation runs and cleared when a new QR scan starts
  const forceClosedRef = useRef(false);

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

  /**
   * CONSOLIDATED CLEANUP FUNCTION
   * 
   * This is the single source of truth for ALL BLE cleanup operations.
   * Call this whenever the modal closes, times out, errors, or user cancels.
   * 
   * Cleans up:
   * - Match timers (device discovery polling)
   * - BLE scanning (stops native scan)
   * - Detected devices list (prevents stale device data)
   * - Service reader state (cancels pending reads)
   * - BLE connection state AND sessionStorage:
   *   - connectedDeviceMac
   *   - pendingBleMac  
   *   - bleConnectionSession
   * - Disconnects from any stuck BLE connections in native layer
   * - All internal refs and state
   * 
   * @param setForceClosedFlag - If true, sets forceClosedRef to prevent sync effect 
   *                             from overriding state. Use true for cancel/close operations,
   *                             false for reset/retry operations where we want scanning to resume.
   */
  const cleanupAllBleState = useCallback((setForceClosedFlag: boolean = true) => {
    log('=== CLEANUP: Resetting ALL BLE state ===');
    log('  - Clearing match timers');
    log('  - Stopping BLE scan');
    log('  - Clearing detected devices');
    log('  - Resetting service reader');
    log('  - Force resetting BLE connection (clears sessionStorage)');
    log('  - setForceClosedFlag:', setForceClosedFlag);
    
    // Set or clear force closed flag based on operation type
    forceClosedRef.current = setForceClosedFlag;
    
    // Clear all timers
    clearMatchTimers();
    
    // Stop scanning and clear detected devices
    scannerStopScan();
    scannerClearDevices();
    
    // Cancel any pending service reads
    serviceReaderCancelRead();
    
    // Force reset BLE connection - this clears ALL sessionStorage:
    // - connectedDeviceMac
    // - pendingBleMac
    // - bleConnectionSession
    // AND disconnects from any stuck connections in the native layer
    connectionForceBleReset();
    
    // Reset service reader state
    serviceReaderResetState();
    
    // Exit device matching phase
    isDeviceMatchingRef.current = false;
    
    // Clear all pending operation state
    setPendingBatteryId(null);
    setPendingScanType(null);
    setReadingPhase('idle');
    setDtaData(null);
    isProcessingRef.current = false;
    
    // Reset to initial state
    setState(INITIAL_STATE);
    
    log('=== CLEANUP COMPLETE ===');
  }, [
    clearMatchTimers,
    scannerStopScan,
    scannerClearDevices,
    serviceReaderCancelRead,
    connectionForceBleReset,
    serviceReaderResetState,
    log,
  ]);

  // ============================================
  // SYNC STATE FROM COMPOSED HOOKS
  // ============================================

  useEffect(() => {
    setState(prev => {
      // CRITICAL: If force closed, don't override with active states
      // This ensures the modal closes when cancelOperation is called
      // even if the underlying hooks haven't fully reset yet
      if (forceClosedRef.current) {
        log('Sync effect: force closed flag is set, using INITIAL_STATE');
        return INITIAL_STATE;
      }
      
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
      
      // CRITICAL FIX: Keep isReadingEnergy=true during ATT→DTA transition
      // The service reader sets isReading=false when ATT completes, but we need to keep
      // the modal visible while we transition to DTA reading.
      // Use readingPhase !== 'idle' to ensure we stay in "reading" state during the full ATT→DTA flow.
      // This prevents the BleProgressModal from closing prematurely between phases.
      const isInReadingFlow = readingPhase !== 'idle';
      const shouldBeReading = serviceState.isReading || isInReadingFlow;
      
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
        isReadingEnergy: shouldBeReading,
        isReadingService: shouldBeReading,
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
    log,
  ]);

  // ============================================
  // CONNECTION → SERVICE READING (ATT → DTA flow)
  // ============================================

  // When connected, automatically start reading ATT service first (battery ID)
  useEffect(() => {
    if (
      isConnected &&
      connectedDevice &&
      pendingBatteryId &&
      !isProcessingRef.current &&
      readingPhase === 'idle'
    ) {
      log('Connected! Starting ATT service read (Step 1/2) - Reading Battery ID');
      isProcessingRef.current = true;
      setReadingPhase('att');
      readAttService(connectedDevice);
    }
  }, [
    isConnected,
    connectedDevice,
    pendingBatteryId,
    readAttService,
    readingPhase,
    log,
  ]);

  // Handle service data received - manages ATT → DTA flow
  // Order: ATT first (battery ID), then DTA (energy data)
  // IMPORTANT: We check serviceNameEnum to ensure we process the correct service data,
  // preventing race conditions where the effect re-runs before new data arrives.
  useEffect(() => {
    if (
      lastServiceData &&
      pendingBatteryId &&
      pendingScanType &&
      isProcessingRef.current &&
      connectedDevice
    ) {
      // Get the service name from the response to verify we're processing the right data
      const serviceData = lastServiceData as { serviceNameEnum?: string };
      const serviceName = serviceData?.serviceNameEnum?.toUpperCase() || '';
      
      // Check which phase we're in
      if (readingPhase === 'att') {
        // Verify this is actually ATT data (not stale DTA data from a previous read)
        // serviceNameEnum from native layer is 'ATT_SERVICE', not just 'ATT'
        if (serviceName && !serviceName.includes('ATT')) {
          log('Received non-ATT data while in ATT phase, ignoring:', serviceName);
          return;
        }
        
        log('ATT service data received (Step 1/2) - Extracting battery ID');
        
        // Extract actual battery ID from ATT (opid or ppid)
        const actualBatteryId = extractActualBatteryIdFromAtt(lastServiceData);
        
        if (!actualBatteryId) {
          log('Warning: Could not extract actual battery ID from ATT, proceeding without it');
          // This is a warning, not an error - we can still proceed with QR-scanned ID
        } else {
          log('Actual battery ID from ATT:', actualBatteryId);
        }
        
        // Store ATT data (which contains actualBatteryId) and move to DTA phase
        setDtaData({ actualBatteryId }); // Repurpose dtaData to temporarily store ATT result
        setReadingPhase('dta');
        
        // Now read DTA service to get energy data
        log('Starting DTA service read (Step 2/2) - Reading Energy Data');
        readDtaService(connectedDevice);
        
      } else if (readingPhase === 'dta') {
        // Verify this is actually DTA data (not stale ATT data)
        // serviceNameEnum from native layer is 'DTA_SERVICE', not just 'DTA'
        if (serviceName && !serviceName.includes('DTA')) {
          log('Received non-DTA data while in DTA phase, ignoring:', serviceName);
          return;
        }
        
        log('DTA service data received (Step 2/2) - Extracting energy data');
        
        // Extract energy data from DTA
        const energyData = extractEnergyFromDta(lastServiceData);
        
        // Get the stored actualBatteryId from the ATT phase
        const actualBatteryId = (dtaData as { actualBatteryId?: string })?.actualBatteryId;
        
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
          log('Failed to extract energy data from DTA');
          
          // Disconnect on failure
          if (connectedDevice) {
            connectionDisconnect(connectedDevice);
          }
          
          toast.error('Could not read battery data. Please try again.');
          onErrorRef.current?.('Failed to extract energy data from DTA');
          
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
    readDtaService,
    connectionDisconnect,
    log,
  ]);

  // Handle connection failure
  // Uses the consolidated cleanupAllBleState function for complete cleanup.
  useEffect(() => {
    if (connectionState.connectionFailed && pendingBatteryId) {
      log('Connection failed - using consolidated cleanup');
      
      const requiresReset = connectionState.requiresBluetoothReset;
      
      // Check if error indicates MAC address mismatch
      const isMacMismatch = connectionState.error?.toLowerCase().includes('macaddress') ||
                           connectionState.error?.toLowerCase().includes('mac address') ||
                           connectionState.error?.toLowerCase().includes('connection stuck');
      
      // Notify error callback before cleanup
      onErrorRef.current?.('Connection failed', requiresReset || isMacMismatch);
      
      // Use consolidated cleanup - this handles everything including MAC mismatch scenarios
      cleanupAllBleState(true);
      
      log('Connection failure handled via cleanupAllBleState');
    }
  }, [connectionState.connectionFailed, connectionState.requiresBluetoothReset, connectionState.error, pendingBatteryId, cleanupAllBleState, log]);

  // Handle service reader failure/timeout
  // CRITICAL: When DTA/ATT read times out or fails, we MUST reset state to allow modal to close
  // Uses the consolidated cleanupAllBleState function for complete cleanup.
  useEffect(() => {
    if (serviceState.error && (readingPhase === 'att' || readingPhase === 'dta')) {
      log('Service read failed/timed out during', readingPhase, '- Error:', serviceState.error);
      
      // Notify error callback before cleanup
      const requiresReset = serviceState.error.toLowerCase().includes('toggle bluetooth') ||
                           serviceState.error.toLowerCase().includes('bluetooth off') ||
                           serviceState.error.toLowerCase().includes('connection stuck');
      onErrorRef.current?.(serviceState.error, requiresReset);
      
      // Use consolidated cleanup - this handles everything
      cleanupAllBleState(true);
      
      log('Service read failure handled via cleanupAllBleState');
    }
  }, [serviceState.error, readingPhase, cleanupAllBleState, log]);

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Start BLE scanning (call when entering battery scan steps or rescanning)
   * 
   * ALWAYS clears detected devices before starting to ensure a fresh scan.
   * This prevents stale device data from causing issues.
   */
  const startScanning = useCallback(() => {
    log('Starting BLE scanning - clearing devices first for fresh scan');
    
    // CRITICAL: Clear force closed flag when starting a new scan
    // This allows the sync effect to properly manage state again
    // Without this, after a force close, subsequent scans won't update state properly
    forceClosedRef.current = false;
    
    // Clear detected devices BEFORE starting scan to ensure fresh results
    // This prevents stale device data from causing "macAddress is not match" errors
    scannerClearDevices();
    
    // Start fresh scan
    scannerStartScan();
  }, [scannerStartScan, scannerClearDevices, log]);

  /**
   * Stop BLE scanning
   * 
   * Stops scanning and clears detected devices to prevent stale data.
   * User can tap rescan to start fresh.
   */
  const stopScanning = useCallback(() => {
    log('Stopping BLE scanning - clearing devices');
    scannerStopScan();
    // Clear devices when stopping to prevent stale data on next operation
    scannerClearDevices();
  }, [scannerStopScan, scannerClearDevices, log]);

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
    
    // CRITICAL: Clear force closed flag when starting a new scan
    // This allows the sync effect to properly manage state again
    forceClosedRef.current = false;
    
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
      log('Device matching timed out - using consolidated cleanup');
      
      toast.error('Device may already be connected. Try turning Bluetooth off and on, then try again.');
      onErrorRef.current?.('Device may already be connected');
      
      // Use consolidated cleanup - this handles everything
      cleanupAllBleState(true);
      
      log('Device matching timeout handled via cleanupAllBleState');
    }, DEVICE_MATCH_TIMEOUT);
    
    return true;
  }, [scannerScanState.isScanning, scannerStartScan, scannerStopScan, scannerGetDevices, scannerFindDeviceByNameSuffix, connectionConnect, clearMatchTimers, cleanupAllBleState, log]);

  /**
   * Cancel ongoing operation
   * 
   * Uses the consolidated cleanupAllBleState function to reset everything.
   * 
   * @param force - Parameter kept for API compatibility, but cleanup is always complete.
   */
  const cancelOperation = useCallback((force: boolean = false) => {
    log('Cancelling operation', force ? '(forced)' : '');
    
    // Use consolidated cleanup with forceClosedFlag=true to close modal immediately
    cleanupAllBleState(true);
    
    return true;
  }, [cleanupAllBleState, log]);

  /**
   * Reset all state (for retry)
   * 
   * Uses the consolidated cleanupAllBleState function with forceClosedFlag=false
   * to allow the sync effect to manage state properly for subsequent scans.
   */
  const resetState = useCallback(() => {
    log('Resetting state for retry');
    
    // Use consolidated cleanup with forceClosedFlag=false to allow new scans to work
    cleanupAllBleState(false);
  }, [cleanupAllBleState, log]);

  /**
   * Retry after failure - resets and restarts scanning
   */
  const retryConnection = useCallback(() => {
    log('Retrying connection');
    resetState();
    // Clear force closed flag to allow sync effect to manage state
    forceClosedRef.current = false;
    scannerStartScan();
  }, [resetState, scannerStartScan, log]);

  /**
   * Force reset BLE state in both app and native layer
   * Use this when the BLE native layer gets into a stuck state (e.g., "macAddress is not match" error)
   * 
   * Uses the consolidated cleanupAllBleState function.
   */
  const forceBleReset = useCallback(() => {
    log('Force resetting BLE state');
    
    // Use consolidated cleanup with forceClosedFlag=true to close modal immediately
    cleanupAllBleState(true);
  }, [cleanupAllBleState, log]);

  /**
   * Get detected devices (for debugging/display)
   */
  const getDetectedDevices = useCallback(() => {
    return scannerGetDevices();
  }, [scannerGetDevices]);

  // ============================================
  // CLEANUP ON UNMOUNT
  // ============================================

  useEffect(() => {
    return () => {
      // Use consolidated cleanup on unmount to ensure complete cleanup
      // Pass false for forceClosedFlag since component is unmounting anyway
      cleanupAllBleState(false);
    };
  }, [cleanupAllBleState]);

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
    /** Cancel ongoing operation - uses cleanupAllBleState internally */
    cancelOperation,
    /** Reset all state - uses cleanupAllBleState internally */
    resetState,
    /** Retry after failure */
    retryConnection,
    /** Force reset BLE state in both app and native layer - uses cleanupAllBleState internally */
    forceBleReset,
    /** 
     * Consolidated cleanup function - clears ALL BLE state including:
     * - Detected devices
     * - sessionStorage (connectedDeviceMac, pendingBleMac, bleConnectionSession)
     * - BLE connection state
     * - Service reader state
     * @param setForceClosedFlag - true to close modal, false for retry operations
     */
    cleanupAllBleState,
    /** Get detected devices */
    getDetectedDevices,
  };
}

export default useFlowBatteryScan;
