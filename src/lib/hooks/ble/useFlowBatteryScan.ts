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
import { requiresBluetoothReset } from './bleErrors';
import {
  BATTERY_READ_NAMES,
  extractProductType,
  fastReadByNames,
  learnGattMap,
} from './bleFastRead';
import type { BatteryData, BleDevice, BleReadingPhase } from './types';

// ============================================
// CONSTANTS
// ============================================

const DEVICE_MATCH_TIMEOUT = 25000; // 25 seconds to find matching device
// Backstop only - matching is driven by the scanner's onDeviceFound callback,
// so this just covers a device that was already in the list before we started.
const DEVICE_MATCH_RETRY_INTERVAL = 500;
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

  // Set by handleQrScanned while we are hunting for a device; the scanner calls
  // it the moment a matching advertisement arrives.
  const deviceFoundMatcherRef = useRef<((device: BleDevice) => void) | null>(null);
  const handleDeviceFound = useCallback((device: BleDevice) => {
    deviceFoundMatcherRef.current?.(device);
  }, []);

  const {
    scanState: scannerScanState,
    isReady: scannerIsReady,
    startScan: scannerStartScan,
    stopScan: scannerStopScan,
    clearDevices: scannerClearDevices,
    findDeviceByNameSuffix: scannerFindDeviceByNameSuffix,
    getDevices: scannerGetDevices,
  } = useBleDeviceScanner({ debug, nameFilter: 'OVES', onDeviceFound: handleDeviceFound });

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
  // Advertised name of the device we connected to - the GATT layout cache is
  // keyed by product type, which is derived from that name.
  const connectedDeviceNameRef = useRef<string | null>(null);
  // Bumped by any teardown; in-flight async reads compare against it and bail
  // out rather than resolving into state that has already been reset.
  const readGenerationRef = useRef(0);
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

    // Invalidate any in-flight targeted read so it cannot resolve into the
    // state we are about to clear
    readGenerationRef.current += 1;
    deviceFoundMatcherRef.current = null;
    connectedDeviceNameRef.current = null;

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

  /**
   * Finish a read: build the battery record, disconnect, notify the caller.
   * Shared by the fast path and the ATT→DTA fallback so they cannot drift.
   */
  const completeBatteryRead = useCallback((
    batteryId: string,
    scanType: 'old_battery' | 'new_battery',
    mac: string,
    energyData: ReturnType<typeof extractEnergyFromDta>,
    actualBatteryId: string | undefined
  ) => {
    if (!energyData) return false;

    const battery = createBatteryData(batteryId, energyData, mac || undefined, actualBatteryId || undefined);
    log('Battery data extracted with actual ID:', battery);

    if (mac) connectionDisconnect(mac);

    if (scanType === 'old_battery') {
      onOldBatteryReadRef.current?.(battery);
    } else if (scanType === 'new_battery') {
      onNewBatteryReadRef.current?.(battery);
    }

    setPendingBatteryId(null);
    setPendingScanType(null);
    setReadingPhase('idle');
    setDtaData(null);
    isProcessingRef.current = false;
    return true;
  }, [connectionDisconnect, log]);

  // When connected, read the battery.
  //
  // Fast path: read only the characteristics we need, by UUID, using the GATT
  // layout learned from a previous full read of this product type. Measured on
  // device this is ~0.4 s versus ~8 s for the two whole-service reads, because
  // the native initServiceBleData reads every characteristic and descriptor in
  // the service (32 of them in DTA) to get the four values we use.
  //
  // Fallback: the original ATT → DTA service reads, which also re-learn the
  // layout - so the first battery of a new product type pays the old cost once
  // and every one after it is fast.
  useEffect(() => {
    if (
      !isConnected ||
      !connectedDevice ||
      !pendingBatteryId ||
      isProcessingRef.current ||
      readingPhase !== 'idle'
    ) {
      return;
    }

    isProcessingRef.current = true;
    const mac = connectedDevice;
    const batteryId = pendingBatteryId;
    const scanType = pendingScanType;
    const productType = extractProductType(connectedDeviceNameRef.current);

    // The effect re-runs when readingPhase changes (including changes we make
    // below), so an effect-cleanup flag would cancel our own in-flight read.
    // Tie the async continuation to a generation that only a real teardown bumps.
    const generation = readGenerationRef.current;
    const cancelled = () => readGenerationRef.current !== generation;

    const startFallback = () => {
      if (cancelled()) return;
      log('Connected! Starting ATT service read (Step 1/2) - Reading Battery ID');
      setReadingPhase('att');
      readAttService(mac);
    };

    (async () => {
      if (!productType || !scanType) {
        startFallback();
        return;
      }

      setReadingPhase('fast');
      const fast = await fastReadByNames(mac, productType, BATTERY_READ_NAMES);

      if (cancelled()) return;

      if (!fast) {
        log('Fast read unavailable for product type', productType, '- falling back to service reads');
        startFallback();
        return;
      }

      const energyData = extractEnergyFromDta({ characteristicList: fast.characteristicList });
      const actualBatteryId = extractActualBatteryIdFromAtt({ characteristicList: fast.characteristicList });

      if (!energyData) {
        log('Fast read returned no usable energy data - falling back to service reads');
        startFallback();
        return;
      }

      log('Fast read succeeded', { productType, missing: fast.missing });
      completeBatteryRead(batteryId, scanType, mac, energyData, actualBatteryId || undefined);
    })().catch((err) => {
      log('Fast read threw - falling back to service reads:', err);
      startFallback();
    });
  }, [
    isConnected,
    connectedDevice,
    pendingBatteryId,
    pendingScanType,
    readAttService,
    readingPhase,
    completeBatteryRead,
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

        // Record where these characteristics live so the next battery of this
        // product type can be read directly by UUID instead of service-wide.
        learnGattMap(extractProductType(connectedDeviceNameRef.current), lastServiceData);

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

        // Same as the ATT branch: learn the layout for next time
        learnGattMap(extractProductType(connectedDeviceNameRef.current), lastServiceData);

        // Extract energy data from DTA
        const energyData = extractEnergyFromDta(lastServiceData);

        // Get the stored actualBatteryId from the ATT phase
        const actualBatteryId = (dtaData as { actualBatteryId?: string })?.actualBatteryId;

        if (energyData) {
          // NOTE: Toast notifications are handled by the caller (AttendantFlow/SalesFlow)
          // to avoid duplicate notifications
          completeBatteryRead(
            pendingBatteryId,
            pendingScanType,
            connectedDevice,
            energyData,
            actualBatteryId || undefined
          );
        } else {
          log('Failed to extract energy data from DTA - using consolidated cleanup');
          
          // Disconnect on failure
          if (connectedDevice) {
            connectionDisconnect(connectedDevice);
          }
          
          toast.error('Could not read battery data. Please try again.');
          
          // Notify error callback before cleanup
          onErrorRef.current?.('Failed to extract energy data from DTA');
          
          // Use consolidated cleanup - this ensures modal closes properly
          // by setting forceClosedRef and resetting all state
          cleanupAllBleState(true);
          
          log('DTA extraction failure handled via cleanupAllBleState');
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
    cleanupAllBleState,
    completeBatteryRead,
    log,
  ]);

  // Handle connection failure
  // Uses the consolidated cleanupAllBleState function for complete cleanup.
  useEffect(() => {
    if (connectionState.connectionFailed && pendingBatteryId) {
      log('Connection failed - using consolidated cleanup');
      
      // Use centralized error detection - checks both flag and error message
      const needsReset = connectionState.requiresBluetoothReset || 
                        (connectionState.error ? requiresBluetoothReset(connectionState.error) : false);
      
      // Notify error callback before cleanup
      onErrorRef.current?.('Connection failed', needsReset);
      
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
      // Use centralized error detection from bleErrors.ts
      const needsReset = requiresBluetoothReset(serviceState.error);
      onErrorRef.current?.(serviceState.error, needsReset);
      
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
   * Performs full cleanup (including clearing devices) before starting fresh scan.
   * This ensures we get fresh device data without stale entries.
   */
  const startScanning = useCallback(() => {
    log('Starting BLE scanning - full cleanup first for fresh scan');

    // Self-heal before scanning: a battery that is still connected does not
    // advertise, so a GATT link left open by an interrupted flow (app killed
    // mid-read, back-navigation during connect, a crash) makes that battery
    // permanently invisible to this scan - the classic "it only works after I
    // restart the app and toggle Bluetooth". The MAC of any live or pending
    // connection survives in sessionStorage, so release it here, where we know
    // no read is in flight (we are about to pick a device, not reading one).
    // Native ignores the call if that MAC is not actually connected.
    try {
      const stale =
        sessionStorage.getItem('connectedDeviceMac') ||
        sessionStorage.getItem('pendingBleMac');
      if (stale && window.WebViewJavascriptBridge) {
        log('Releasing stale BLE link before scan:', stale);
        window.WebViewJavascriptBridge.callHandler('disconnBleByMacAddress', stale, () => {});
        sessionStorage.removeItem('connectedDeviceMac');
        sessionStorage.removeItem('pendingBleMac');
      }
    } catch {
      // sessionStorage unavailable - nothing to heal
    }

    // Full cleanup including clearing devices for fresh scan
    cleanupAllBleState(false);

    // Start fresh scan
    scannerStartScan();
  }, [cleanupAllBleState, scannerStartScan, log]);

  /**
   * Stop BLE scanning
   * 
   * Stops the native BLE scan but PRESERVES detected devices.
   * This is important because:
   * 1. The step useEffect calls stop-then-start, and we don't want to lose devices
   * 2. User might resume scanning and want to use previously detected devices
   * 
   * For full cleanup (clearing devices), use cancelOperation instead.
   */
  const stopScanning = useCallback(() => {
    log('Stopping BLE scanning (preserving detected devices)');
    
    // Just stop the native scan - don't clear devices or reset connection state
    // This allows the detected devices to persist for potential matching
    scannerStopScan();
    
    // Clear match timers if any (in case stop is called during matching)
    clearMatchTimers();
  }, [scannerStopScan, clearMatchTimers, log]);

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
    let hasConnected = false;
    const connectToMatch = (matched: BleDevice) => {
      if (hasConnected) return true;
      hasConnected = true;

      log('Found matching device:', matched);
      clearMatchTimers();
      deviceFoundMatcherRef.current = null;
      scannerStopScan();

      // Exit device matching phase - actual connection is starting
      isDeviceMatchingRef.current = false;

      // Remember the advertised name: the GATT layout cache is keyed by the
      // product type encoded in it.
      connectedDeviceNameRef.current = matched.name || null;

      // Connect to matched device
      connectionConnect(matched.macAddress);
      return true;
    };

    const matchDevice = () => {
      const targetSuffix = batteryId.slice(-MATCH_CHARS).toLowerCase();
      log('Looking for device with suffix:', targetSuffix);

      const devices = scannerGetDevices();
      log('Available devices:', devices.map(d => d.name));

      // Find matching device
      const matched = scannerFindDeviceByNameSuffix(batteryId, MATCH_CHARS);

      return matched ? connectToMatch(matched) : false;
    };

    // Connect the instant a matching advertisement arrives, rather than waiting
    // for the next poll tick. Advertisements land every ~100-300 ms, so polling
    // was adding up to a full interval of dead time to every scan.
    const targetSuffix = batteryId.slice(-MATCH_CHARS).toLowerCase();
    deviceFoundMatcherRef.current = (device: BleDevice) => {
      if (hasConnected) return;
      if ((device.name || '').toLowerCase().slice(-MATCH_CHARS) === targetSuffix) {
        connectToMatch(device);
      }
    };

    // Try matching immediately against devices already discovered
    if (matchDevice()) {
      return true;
    }

    // Backstop poll in case an advertisement was missed
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
   * Reset connection/reading state for retry - PRESERVES detected devices
   * 
   * This is a lightweight reset that clears connection state but keeps
   * the detected devices list intact. Use this when:
   * - User selects a device to connect (devices needed for matching)
   * - Retrying after a soft failure
   * 
   * For full cleanup (including clearing devices), use cleanupAllBleState.
   */
  const resetState = useCallback(() => {
    log('Resetting state for retry (PRESERVING detected devices)');
    
    // Clear force closed flag to allow sync effect to manage state
    forceClosedRef.current = false;

    // Invalidate any in-flight targeted read
    readGenerationRef.current += 1;
    deviceFoundMatcherRef.current = null;

    // Clear match timers
    clearMatchTimers();
    
    // Cancel any pending service reads
    serviceReaderCancelRead();
    
    // Reset connection state (but NOT forceBleReset which clears sessionStorage)
    connectionResetState();
    
    // Reset service reader state
    serviceReaderResetState();
    
    // Exit device matching phase
    isDeviceMatchingRef.current = false;
    
    // Clear pending operation state
    setPendingBatteryId(null);
    setPendingScanType(null);
    setReadingPhase('idle');
    setDtaData(null);
    isProcessingRef.current = false;
    
    // Reset to initial state (but detected devices come from scanner hook, not this state)
    setState(INITIAL_STATE);
    
    log('State reset complete - detected devices preserved');
  }, [clearMatchTimers, serviceReaderCancelRead, connectionResetState, serviceReaderResetState, log]);

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
