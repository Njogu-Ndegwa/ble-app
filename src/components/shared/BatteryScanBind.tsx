'use client';

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useI18n } from '@/i18n';
import ScannerArea from './ScannerArea';
import { 
  useBatteryScanAndBind, 
  type BatteryData, 
  type BleFullState,
  type BleReadingPhase,
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
          
          {/* Bluetooth Reminder Banner */}
          <BluetoothReminder />
          
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
          
          {/* Bluetooth Reminder Banner */}
          <BluetoothReminder />
          
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

// Helpful tips shown during the long wait
const WAITING_TIPS = [
  'Make sure the battery is powered on and nearby',
  'This process loads device firmware for accurate readings',
  'Keep your phone close to the battery',
  'Bluetooth communication may take a moment',
  'Please wait while we establish a secure connection',
  'Reading battery data requires loading device information',
];

// Countdown timer constants
const COUNTDOWN_START_SECONDS = 60;

// Phase-specific messages for better feedback
const PHASE_MESSAGES = {
  scanning: {
    title: 'Searching for Device',
    subtitle: 'Looking for the battery nearby...',
  },
  connecting: {
    title: 'Connecting',
    subtitle: 'Establishing Bluetooth connection...',
  },
  reading: {
    title: 'Reading Battery Data',
    subtitle: 'Loading device information...',
  },
  readingDta: {
    title: 'Reading DTA Service',
    subtitle: 'Getting energy data from battery...',
  },
  readingAtt: {
    title: 'Reading ATT Service',
    subtitle: 'Getting battery ID (opid/ppid)...',
  },
};

/**
 * Shows BLE connection progress with improved UX for long wait times
 * Now supports the DTA → ATT reading flow with distinct phases
 */
function BleConnectionProgress({ 
  bleScanState, 
  onCancel 
}: { 
  bleScanState: BleFullState;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_START_SECONDS);
  // Track if we already triggered timeout cancel to prevent multiple calls
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  
  // Track elapsed time and countdown
  // IMPORTANT: Only initialize the timer once when component mounts.
  // The 60s countdown is a contract with the customer - we don't reset it
  // when transitioning between phases (e.g., connecting -> reading).
  useEffect(() => {
    // Only set start time once when timer hasn't been initialized
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      setCountdown(COUNTDOWN_START_SECONDS);
      setHasTimedOut(false);
    }
    
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
      setElapsedTime(elapsed);
      
      const remaining = Math.max(0, COUNTDOWN_START_SECONDS - elapsed);
      setCountdown(remaining);
      
      // When countdown reaches 0, automatically cancel - modal will close
      if (remaining <= 0 && !hasTimedOut) {
        setHasTimedOut(true);
        if (onCancel) {
          onCancel();
        }
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [onCancel, hasTimedOut]);
  
  // Rotate tips every 5 seconds
  useEffect(() => {
    const tipTimer = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % WAITING_TIPS.length);
    }, 5000);
    
    return () => clearInterval(tipTimer);
  }, []);
  
  // Determine current phase - now includes DTA/ATT reading phases
  // Phase priority: readingAtt > readingDta > reading > connecting > scanning
  let phase: 'scanning' | 'connecting' | 'reading' | 'readingDta' | 'readingAtt';
  
  if (bleScanState.isReadingService) {
    // Check the specific reading phase from state
    const readingPhase = bleScanState.readingPhase;
    if (readingPhase === 'att') {
      phase = 'readingAtt';
    } else if (readingPhase === 'dta') {
      phase = 'readingDta';
    } else {
      phase = 'reading'; // fallback for legacy behavior
    }
  } else if (bleScanState.isConnecting) {
    phase = 'connecting';
  } else {
    phase = 'scanning';
  }
  
  const phaseInfo = PHASE_MESSAGES[phase];
  
  // Format elapsed time
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Show progress bar from 0% for visual consistency
  const showProgress = bleScanState.isConnecting || bleScanState.isReadingService;

  return (
    <div className="ble-connection-progress">
      {/* Animated spinner with phase indicator */}
      <div className="connection-spinner-container">
        <div className="connection-spinner">
          <div className="spinner-ring" />
          <div className="spinner-phase-icon">
            {phase === 'scanning' && <SearchIcon />}
            {phase === 'connecting' && <BluetoothIcon />}
            {phase === 'reading' && <BatteryIcon />}
            {phase === 'readingDta' && <BatteryIcon />}
            {phase === 'readingAtt' && <ShieldCheckIcon />}
          </div>
        </div>
      </div>
      
      {/* Phase title and subtitle */}
      <div className="connection-phase-info">
        <h3 className="connection-phase-title">
          {t(`ble.phase.${phase}.title`) || phaseInfo.title}
        </h3>
        <p className="connection-phase-subtitle">
          {t(`ble.phase.${phase}.subtitle`) || phaseInfo.subtitle}
        </p>
      </div>
      
      {/* Progress bar - show from 0% */}
      {showProgress && (
        <div className="connection-progress-container">
          <div className="connection-progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${bleScanState.connectionProgress}%` }}
            />
          </div>
          <span className="connection-progress-percent">
            {bleScanState.connectionProgress}%
          </span>
        </div>
      )}
      
      {/* Countdown timer */}
      <div className="connection-countdown">
        {countdown > 0 ? (
          <span className="countdown-text">
            Connection will complete in about <strong>{countdown}s</strong>
          </span>
        ) : (
          <span className="countdown-expired">
            Connection timed out...
          </span>
        )}
      </div>
      
      {/* Elapsed time indicator */}
      <div className="connection-elapsed-time">
        <ClockIcon />
        <span>{formatTime(elapsedTime)}</span>
      </div>
      
      {/* Helpful tip with fade animation */}
      <div className="connection-tip">
        <LightbulbIcon />
        <p key={currentTipIndex} className="tip-text">
          {WAITING_TIPS[currentTipIndex]}
        </p>
      </div>
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
  
  // Check if error indicates device might already be connected or MAC mismatch
  const isAlreadyConnectedError = bleScanState.error?.includes('already connected');
  const isMacMismatchError = bleScanState.error?.toLowerCase().includes('macaddress') ||
                             bleScanState.error?.toLowerCase().includes('mac address') ||
                             bleScanState.error?.toLowerCase().includes('connection stuck');
  
  // Determine error message based on error type
  let errorMessage: string;
  if (bleScanState.requiresBluetoothReset || isMacMismatchError) {
    errorMessage = t('ble.connectionStuck') || t('attendant.bleResetRequired') || 'Bluetooth connection stuck. Please turn Bluetooth OFF then ON.';
  } else if (isAlreadyConnectedError) {
    errorMessage = t('ble.macAddressMismatch') || 'Device may already be connected. Turn Bluetooth off and on, then try again.';
  } else {
    errorMessage = bleScanState.error || t('attendant.connectionFailed') || 'Connection failed';
  }
  
  // Show reset instructions if needed
  const showResetInstructions = bleScanState.requiresBluetoothReset || isMacMismatchError || isAlreadyConnectedError;

  return (
    <div className="ble-error-state">
      <div className="error-icon">
        <ErrorCircleIcon />
      </div>
      <p className="error-message">{errorMessage}</p>
      
      {showResetInstructions && (
        <p className="error-instructions">
          {t('ble.resetInstructions') || 'Toggle Bluetooth OFF then ON in your phone settings to clear the stuck connection.'}
        </p>
      )}
      
      <div className="error-actions">
        {onRetry && !showResetInstructions && (
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
// BLUETOOTH REMINDER COMPONENT
// ============================================

/**
 * Bluetooth Reminder - Shows a prominent reminder for users to enable Bluetooth
 * 
 * This is displayed on battery scanning steps to ensure users have Bluetooth enabled
 * before attempting to scan and connect to batteries.
 */
function BluetoothReminder() {
  return (
    <div className="bluetooth-reminder">
      <div className="bluetooth-reminder-icon">
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          width="20"
          height="20"
        >
          <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
        </svg>
      </div>
      <div className="bluetooth-reminder-content">
        <span className="bluetooth-reminder-title">Bluetooth Required</span>
        <span className="bluetooth-reminder-text">
          Make sure Bluetooth is turned ON in your phone settings before scanning.
        </span>
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

function SearchIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="24"
      height="24"
    >
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

function BluetoothIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="24"
      height="24"
    >
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="24"
      height="24"
    >
      <rect x="1" y="6" width="18" height="12" rx="2" ry="2"/>
      <line x1="23" y1="10" x2="23" y2="14"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="16"
      height="16"
    >
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="16"
      height="16"
    >
      <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="24"
      height="24"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  );
}
