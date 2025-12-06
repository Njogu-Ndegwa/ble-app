'use client';

import React, { useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n';
import ScannerArea from './ScannerArea';
import { 
  useBatteryScanAndBind, 
  type BatteryData, 
  type BleFullState,
} from '@/lib/hooks/ble';

// Legacy type alias for backwards compatibility
export type BleScanState = BleFullState;

export type BatteryScanMode = 'return' | 'issue' | 'assign';

interface BatteryScanBindProps {
  /** Mode determines the UI messaging */
  mode: BatteryScanMode;
  /** Callback when scan is triggered (opens QR scanner) */
  onScan: () => void;
  /** Whether scanner is currently opening */
  isScannerOpening?: boolean;
  /** BLE scan state - if provided, component is in "controlled" mode */
  bleScanState?: BleFullState;
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
    hintKey: 'attendant.scanReturnHint',
    firstTimeTitle: 'attendant.skipReturn',
    firstTimeSubtitle: 'attendant.firstTimeCustomer',
  },
  issue: {
    titleKey: 'attendant.issueNewBattery',
    subtitleKey: 'attendant.scanNewBattery',
    hintKey: 'attendant.scanNewHint',
  },
  assign: {
    titleKey: 'sales.assignBattery',
    subtitleKey: 'sales.scanBatteryQr',
    hintKey: 'sales.scanBatteryHint',
  },
};

// Fallback hints for when translations aren't available
const FALLBACK_HINTS: Record<BatteryScanMode, string> = {
  return: 'Scan the QR code on the battery being returned',
  issue: 'Scan the QR code on the new battery to issue',
  assign: 'Scan the QR code on the battery to assign to customer',
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

  // Get hint text with fallback
  const hintKey = isFirstTimeCustomer && config.firstTimeSubtitle
    ? config.firstTimeSubtitle
    : config.hintKey;
  const displayHint = t(hintKey) || FALLBACK_HINTS[mode];

  // Check if we're in an active BLE operation
  const isConnecting = bleScanState?.isConnecting || bleScanState?.isReadingService;
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
            disabled={isScannerOpening}
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
// STANDALONE COMPONENT WITH BUILT-IN BLE HANDLING
// ============================================

interface BatteryScanBindWithHookProps {
  /** Mode determines the UI messaging */
  mode: BatteryScanMode;
  /** Scan type identifier (e.g., 'old_battery', 'new_battery') */
  scanType: string;
  /** Called when QR code scanner should open */
  onOpenScanner: () => void;
  /** Called when battery data is successfully read */
  onBatteryRead: (battery: BatteryData) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** For first-time customer handling in return mode */
  isFirstTimeCustomer?: boolean;
  /** Previously returned battery (shown in issue mode) */
  previousBattery?: BatteryData | null;
  /** Custom title override */
  title?: string;
  /** Custom subtitle override */
  subtitle?: string;
  /** Whether to auto-start BLE scanning when mounted */
  autoStartScan?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * BatteryScanBindWithHook - Self-contained version with built-in BLE handling
 * 
 * This version uses the modular useBatteryScanAndBind hook internally,
 * making it completely self-contained for BLE operations.
 * 
 * @example
 * <BatteryScanBindWithHook
 *   mode="return"
 *   scanType="old_battery"
 *   onOpenScanner={() => startQrCodeScan()}
 *   onBatteryRead={(battery) => setOldBattery(battery)}
 * />
 */
export function BatteryScanBindWithHook({
  mode,
  scanType,
  onOpenScanner,
  onBatteryRead,
  onError,
  isFirstTimeCustomer = false,
  previousBattery,
  title,
  subtitle,
  autoStartScan = true,
  className = '',
}: BatteryScanBindWithHookProps) {
  const { t } = useI18n();
  
  // Use the modular battery scan-and-bind hook
  const {
    state,
    isReady,
    scanAndBind,
    cancel,
    reset,
    startScan,
    stopScan,
  } = useBatteryScanAndBind({
    onBatteryRead: (battery, type) => {
      if (type === scanType) {
        onBatteryRead(battery);
      }
    },
    onError: (error) => {
      onError?.(error);
    },
    autoStartScan,
  });

  // Handle scan trigger
  const handleScan = useCallback(() => {
    onOpenScanner();
  }, [onOpenScanner]);

  // Handle retry
  const handleRetry = useCallback(() => {
    reset();
    if (autoStartScan) {
      startScan();
    }
  }, [reset, startScan, autoStartScan]);

  // Expose scanAndBind for external use (e.g., after QR scan result)
  // This is stored on window for the QR callback to access
  useEffect(() => {
    (window as any).__bleScanAndBind = (qrData: string) => {
      scanAndBind(qrData, scanType);
    };
    return () => {
      delete (window as any).__bleScanAndBind;
    };
  }, [scanAndBind, scanType]);

  // Stop scanning on unmount
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, [stopScan]);

  const config = MODE_CONFIG[mode];
  
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

  const hintKey = isFirstTimeCustomer && config.firstTimeSubtitle
    ? config.firstTimeSubtitle
    : config.hintKey;
  const displayHint = t(hintKey) || FALLBACK_HINTS[mode];

  // Map new state structure to legacy flags
  const isConnecting = state.isConnecting || state.isReadingService;
  const hasError = state.error || state.connectionFailed;

  // Create legacy-compatible state object for sub-components
  const legacyState: BleFullState = state;

  return (
    <div className={`battery-scan-bind ${className}`}>
      {mode === 'issue' && previousBattery && (
        <BatteryReturnCard battery={previousBattery} />
      )}

      {isConnecting && (
        <BleConnectionProgress
          bleScanState={legacyState}
          onCancel={cancel}
        />
      )}

      {hasError && !isConnecting && (
        <BleErrorState
          bleScanState={legacyState}
          onRetry={handleRetry}
          onCancel={cancel}
        />
      )}

      {!isConnecting && !hasError && (
        <div className="scan-prompt">
          <h1 className="scan-title">{displayTitle}</h1>
          <p className="scan-subtitle">{displaySubtitle}</p>
          
          <ScannerArea 
            onClick={handleScan} 
            type="battery" 
            disabled={false}
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
 * Get battery class based on charge level
 */
function getBatteryClass(level: number): 'full' | 'medium' | 'low' {
  if (level >= 80) return 'full';
  if (level >= 40) return 'medium';
  return 'low';
}

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
        <span className="battery-return-label">{t('attendant.returnedBattery') || 'Returned Battery'}</span>
        <span className="battery-return-status">✓ {t('common.connected') || 'Connected'}</span>
      </div>
      <div className="battery-return-content">
        <div className="battery-return-id">{battery.shortId || battery.id || '---'}</div>
        <div className="battery-return-charge">
          <div className={`battery-return-icon ${batteryClass}`}>
            <div 
              className="battery-return-fill" 
              style={{ '--level': `${chargeLevel}%` } as React.CSSProperties}
            />
          </div>
          <span className="battery-return-percent">{energyKwh.toFixed(3)} kWh</span>
          <span className="battery-return-unit">{t('attendant.energyRemaining') || 'remaining'}</span>
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
  bleScanState: BleFullState;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  
  const statusMessage = bleScanState.isConnecting 
    ? t('attendant.connecting') || 'Connecting to battery...'
    : bleScanState.isReadingService 
      ? t('attendant.readingEnergy') || 'Reading energy data...'
      : t('attendant.scanning') || 'Scanning...';

  // Only show progress bar when we have actual progress from BLE operations
  // Don't show fake progress during device matching phase
  const showProgress = bleScanState.connectionProgress > 0 && 
    (bleScanState.isConnecting || bleScanState.isReadingService);

  return (
    <div className="ble-connection-progress">
      <div className="connection-spinner">
        <div className="spinner-ring" />
      </div>
      <p className="connection-status">{statusMessage}</p>
      {showProgress && (
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
  bleScanState: BleFullState;
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
