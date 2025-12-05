'use client';

import React from 'react';
import { BatteryScanBind } from '@/components/shared';
import type { BleScanState, BatteryData } from '@/components/shared';

interface Step3Props {
  oldBattery: BatteryData | null;
  onScanNewBattery: () => void;
  isScannerOpening?: boolean;
  bleScanState?: BleScanState;
  scannedBattery?: BatteryData | null;
  onCancelBleOperation?: () => void;
  onRetryConnection?: () => void;
}

/**
 * Step3NewBattery - Scan the new battery to issue
 * 
 * Uses the shared BatteryScanBind component with mode="issue"
 * Shows the returned battery card alongside the scanner
 */
export default function Step3NewBattery({ 
  oldBattery, 
  onScanNewBattery,
  isScannerOpening = false,
  bleScanState,
  scannedBattery,
  onCancelBleOperation,
  onRetryConnection,
}: Step3Props) {
  return (
    <div className="screen active">
      <BatteryScanBind
        mode="issue"
        onScan={onScanNewBattery}
        isScannerOpening={isScannerOpening}
        previousBattery={oldBattery}
        bleScanState={bleScanState}
        scannedBattery={scannedBattery}
        onCancelBleOperation={onCancelBleOperation}
        onRetryConnection={onRetryConnection}
      />
    </div>
  );
}
