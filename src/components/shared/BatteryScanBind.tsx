'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import ScannerArea from './ScannerArea';
import { BatteryData, BleScanState, getBatteryClass, formatEnergyKwh } from './types';

export type BatteryScanMode = 'return' | 'issue' | 'assign';

interface BatteryScanBindProps {
  /** Mode determines the UI messaging */
  mode: BatteryScanMode;
  /** Callback when scan is triggered */
  onScan: () => void;
  /** Whether scanner is currently opening */
  isScannerOpening?: boolean;
  /** BLE scan state for showing progress */
  bleScanState?: BleScanState;
  /** Scanned battery data (when successfully connected) */
  scannedBattery?: BatteryData | null;
  /** For first-time customer handling in return mode */
  isFirstTimeCustomer?: boolean;
  /** Previously returned battery (shown in issue mode) */
  previousBattery?: BatteryData | null;
  /** Callback to cancel/close BLE operation */
  onCancelBleOperation?: () => void;
  /** Callback to retry BLE connection */
  onRetryConnection?: () => void;
  /** Custom title override */
  title?: string;
  /** Custom subtitle override */
  subtitle?: string;
  /** Optional className */
  className?: string;
}

// Mode-specific configuration
const MODE_CONFIG: Record<BatteryScanMode, {
  titleKey: string;
  subtitleKey: string;
  hintKey: string;
  firstTimeTitle?: string;
  firstTimeSubtitle?: string;
}> = {
  return: {
    titleKey: 'attendant.returnBattery',
    subtitleKey: 'attendant.scanReturnBattery',
    hintKey: 'attendant.scanReturnBattery',
    firstTimeTitle: 'attendant.skipReturn',
    firstTimeSubtitle: 'attendant.firstTimeCustomer',
  },
  issue: {
    titleKey: 'attendant.issueNewBattery',
    subtitleKey: 'attendant.scanNewBattery',
    hintKey: 'attendant.scanNewBattery',
  },
  assign: {
    titleKey: 'sales.assignBattery',
    subtitleKey: 'sales.scanBatteryQr',
    hintKey: 'sales.scanBatteryQr',
  },
};

/**
 * BatteryScanBind - Reusable component for battery scan-to-bind workflow
 * 
 * This component handles the common pattern of:
 * 1. Displaying a scanner trigger area
 * 2. Showing BLE connection progress
 * 3. Displaying scanned battery information
 * 
 * Used in:
 * - Attendant Step 2: Scan Old Battery (return mode)
 * - Attendant Step 3: Scan New Battery (issue mode)
 * - Sales Step 6: Assign Battery (assign mode)
 * 
 * @example
 * <BatteryScanBind
 *   mode="return"
 *   onScan={handleScan}
 *   bleScanState={bleScanState}
 *   scannedBattery={oldBattery}
 * />
 */
export default function BatteryScanBind({
  mode,
  onScan,
  isScannerOpening = false,
  bleScanState,
  scannedBattery,
  isFirstTimeCustomer = false,
  previousBattery,
  onCancelBleOperation,
  onRetryConnection,
  title,
  subtitle,
  className = '',
}: BatteryScanBindProps) {
  const { t } = useI18n();
  
  const config = MODE_CONFIG[mode];
  
  // Determine title and subtitle
  const displayTitle = title || (
    isFirstTimeCustomer && config.firstTimeTitle 
      ? t(config.firstTimeTitle) 
      : t(config.titleKey)
  );
  
  const displaySubtitle = subtitle || (
    isFirstTimeCustomer && config.firstTimeSubtitle
      ? t(config.firstTimeSubtitle)
      : t(config.subtitleKey)
  );

  const displayHint = isFirstTimeCustomer && config.firstTimeSubtitle
    ? t(config.firstTimeSubtitle)
    : t(config.hintKey);

  // Check if we're in an active BLE operation
  const isConnecting = bleScanState?.isConnecting || bleScanState?.isReadingEnergy;
  const hasError = bleScanState?.error || bleScanState?.connectionFailed;

  return (
    <div className={`battery-scan-bind ${className}`}>
      {/* Show previous battery card in issue mode */}
      {mode === 'issue' && previousBattery && (
        <BatteryReturnCard battery={previousBattery} />
      )}

      {/* BLE Connection Progress Overlay */}
      {isConnecting && (
        <BleConnectionProgress
          bleScanState={bleScanState!}
          onCancel={onCancelBleOperation}
        />
      )}

      {/* BLE Error State */}
      {hasError && !isConnecting && (
        <BleErrorState
          bleScanState={bleScanState!}
          onRetry={onRetryConnection}
          onCancel={onCancelBleOperation}
        />
      )}

      {/* Main scan prompt (shown when not connecting or error) */}
      {!isConnecting && !hasError && (
        <div className="scan-prompt">
          <h1 className="scan-title">{displayTitle}</h1>
          <p className="scan-subtitle">{displaySubtitle}</p>
          
          <ScannerArea 
            onClick={onScan} 
            type="battery" 
            size="small" 
            disabled={isScannerOpening}
            label={t('common.tapToScan') || 'Tap to scan'}
          />
          
          <p className="scan-hint">
            <InfoIcon />
            {displayHint}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Shows the returned battery card (used in issue mode)
 */
function BatteryReturnCard({ battery }: { battery: BatteryData }) {
  const { t } = useI18n();
  const chargeLevel = battery.chargeLevel ?? 0;
  const energyKwh = battery.energy / 1000;
  const batteryClass = getBatteryClass(chargeLevel);

  return (
    <div className="battery-return-card">
      <div className="battery-return-header">
        <span className="battery-return-label">{t('attendant.returnedBattery')}</span>
        <span className="battery-return-status">✓ Connected</span>
      </div>
      <div className="battery-return-content">
        <div className="battery-return-id">{battery.shortId || '---'}</div>
        <div className="battery-return-charge">
          <div className={`battery-return-icon ${batteryClass}`}>
            <div 
              className="battery-return-fill" 
              style={{ '--level': `${chargeLevel}%` } as React.CSSProperties}
            />
          </div>
          <span className="battery-return-percent">{energyKwh.toFixed(3)} kWh</span>
          <span className="battery-return-unit">{t('attendant.energyRemaining')}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Shows BLE connection progress
 */
function BleConnectionProgress({ 
  bleScanState, 
  onCancel 
}: { 
  bleScanState: BleScanState;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  
  const statusMessage = bleScanState.isConnecting 
    ? t('attendant.connecting') || 'Connecting to battery...'
    : bleScanState.isReadingEnergy 
      ? t('attendant.readingEnergy') || 'Reading energy data...'
      : t('attendant.scanning') || 'Scanning...';

  return (
    <div className="ble-connection-progress">
      <div className="connection-spinner">
        <div className="spinner-ring" />
      </div>
      <p className="connection-status">{statusMessage}</p>
      {bleScanState.connectionProgress > 0 && (
        <div className="connection-progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${bleScanState.connectionProgress}%` }}
          />
        </div>
      )}
      {onCancel && (
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={onCancel}
          type="button"
        >
          {t('common.cancel') || 'Cancel'}
        </button>
      )}
    </div>
  );
}

/**
 * Shows BLE error state with retry option
 */
function BleErrorState({
  bleScanState,
  onRetry,
  onCancel,
}: {
  bleScanState: BleScanState;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  
  const errorMessage = bleScanState.requiresBluetoothReset
    ? t('attendant.bleResetRequired') || 'Please toggle Bluetooth off and on, then try again'
    : bleScanState.error || t('attendant.connectionFailed') || 'Connection failed';

  return (
    <div className="ble-error-state">
      <div className="error-icon">
        <ErrorCircleIcon />
      </div>
      <p className="error-message">{errorMessage}</p>
      <div className="error-actions">
        {onRetry && !bleScanState.requiresBluetoothReset && (
          <button 
            className="btn btn-primary btn-sm"
            onClick={onRetry}
            type="button"
          >
            {t('common.retry') || 'Retry'}
          </button>
        )}
        {onCancel && (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            type="button"
          >
            {t('common.close') || 'Close'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// ICON COMPONENTS
// ============================================

function InfoIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  );
}

function ErrorCircleIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/>
      <path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  );
}
