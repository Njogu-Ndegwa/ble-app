'use client';

import React from 'react';
import { BatteryInputSelector } from '@/components/shared';
import type { BleFullState, BatteryData, BleDevice, BatteryInputMode } from '@/components/shared';

interface Step2Props {
  /** Callback when QR scan is triggered */
  onScanOldBattery: () => void;
  /** Callback when a device is manually selected */
  onDeviceSelect?: (device: BleDevice) => void;
  /** List of detected BLE devices for manual selection */
  detectedDevices?: BleDevice[];
  /** Whether BLE scanning is in progress */
  isScanning?: boolean;
  /** Callback to start/restart BLE scanning */
  onStartScan?: () => void;
  /** Currently selected device MAC */
  selectedDeviceMac?: string | null;
  /** For first-time customer handling */
  isFirstTimeCustomer?: boolean;
  /** Whether scanner is currently opening */
  isScannerOpening?: boolean;
  /** BLE scan state (legacy, for compatibility) */
  bleScanState?: BleFullState;
  /** Scanned battery data (legacy, for compatibility) */
  scannedBattery?: BatteryData | null;
  /** Callback to cancel BLE operation (legacy) */
  onCancelBleOperation?: () => void;
  /** Callback to retry connection (legacy) */
  onRetryConnection?: () => void;
  /** Current input mode */
  inputMode?: BatteryInputMode;
  /** Callback when input mode changes */
  onInputModeChange?: (mode: BatteryInputMode) => void;
}

/**
 * Step2OldBattery - Scan or select the battery being returned
 * 
 * Uses the shared BatteryInputSelector component with mode="return"
 * Supports both QR scanning and manual device selection
 */
export default function Step2OldBattery({ 
  onScanOldBattery, 
  onDeviceSelect,
  detectedDevices = [],
  isScanning = false,
  onStartScan,
  selectedDeviceMac,
  isFirstTimeCustomer = false,
  isScannerOpening = false,
  bleScanState,
  scannedBattery,
  onCancelBleOperation,
  onRetryConnection,
  inputMode,
  onInputModeChange,
}: Step2Props) {
  // Handle device selection - use provided callback or fall back to simulating QR scan
  const handleDeviceSelect = (device: BleDevice) => {
    if (onDeviceSelect) {
      onDeviceSelect(device);
    }
  };

  return (
    <div className="screen active">
      <BatteryInputSelector
        mode="return"
        onScan={onScanOldBattery}
        onDeviceSelect={handleDeviceSelect}
        detectedDevices={detectedDevices}
        isScanning={isScanning}
        onStartScan={onStartScan}
        selectedDeviceMac={selectedDeviceMac}
        isScannerOpening={isScannerOpening}
        isFirstTimeCustomer={isFirstTimeCustomer}
        inputMode={inputMode}
        onInputModeChange={onInputModeChange}
      />
    </div>
  );
}
