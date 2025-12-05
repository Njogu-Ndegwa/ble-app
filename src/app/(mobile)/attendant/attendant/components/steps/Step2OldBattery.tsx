'use client';

import React from 'react';
import { BatteryScanBind } from '@/components/shared';
import type { BleScanState, BatteryData } from '@/components/shared';

interface Step2Props {
  onScanOldBattery: () => void;
  isFirstTimeCustomer?: boolean;
  isScannerOpening?: boolean;
  bleScanState?: BleScanState;
  scannedBattery?: BatteryData | null;
  onCancelBleOperation?: () => void;
  onRetryConnection?: () => void;
}

/**
 * Step2OldBattery - Scan the battery being returned
 * 
 * Uses the shared BatteryScanBind component with mode="return"
 */
export default function Step2OldBattery({ 
  onScanOldBattery, 
  isFirstTimeCustomer = false,
  isScannerOpening = false,
  bleScanState,
  scannedBattery,
  onCancelBleOperation,
  onRetryConnection,
}: Step2Props) {
  return (
    <div className="screen active">
      <BatteryScanBind
        mode="return"
        onScan={onScanOldBattery}
        isScannerOpening={isScannerOpening}
        isFirstTimeCustomer={isFirstTimeCustomer}
        bleScanState={bleScanState}
        scannedBattery={scannedBattery}
        onCancelBleOperation={onCancelBleOperation}
        onRetryConnection={onRetryConnection}
      />
    </div>
  );
}
