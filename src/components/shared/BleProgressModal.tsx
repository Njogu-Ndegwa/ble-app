'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { FlowBleScanState } from '@/lib/hooks/ble';
import { useI18n } from '@/i18n';

// Measured on device (30-rep benchmark, 2026-08-07): tap→data p50 7.4s, p90 7.8s,
// worst 8.1s. When the peripheral rejects the first connect attempt the native
// layer retries on a 20s timeout, so a genuinely-recovering attempt can run
// ~45s. Hence: tell the user 8s, flag "longer than usual" at 12s, and only
// force-close at 45s when retry hope is truly gone.
const EXPECTED_SECONDS = 8;
const SLOW_THRESHOLD_SECONDS = 12;
const HARD_STOP_SECONDS = 45;

// One continuous 0→100 scale for the whole operation - the bar must never fill
// and restart, and never move backwards. Segment boundaries are proportional to
// the measured duration of each phase (connect+enumerate ≈ 5.8s of 7.4s, reads
// ≈ 1.7s), so the bar's speed matches what is actually happening.
const SEG_CONNECT_END = 75;  // link + service enumeration
const SEG_ATT_END = 90;      // battery ID read
const SEG_DTA_END = 99;      // energy read; 100 only on real completion

export interface BleProgressModalProps {
  /** BLE scan state from useFlowBatteryScan hook */
  bleScanState: FlowBleScanState;
  /** ID of the battery being connected (for display) */
  pendingBatteryId: string | null;
  /** 
   * Callback when user clicks cancel/close or when timeout expires.
   * @param force - If true, this is a forced cancellation (timeout or stuck state).
   *                Default is false (user-initiated cancel).
   */
  onCancel: (force?: boolean) => void;
}

/**
 * BLE Connection Progress Modal
 * 
 * Shows a modal overlay during Bluetooth connection with:
 * - Connection progress bar and percentage
 * - Step indicators (Scan → Connect → Read)
 * - Status messages for each phase
 * - Continuous milestone-eased progress with an honest time expectation
 * 
 * The modal automatically closes after 60 seconds or when connection completes.
 * No secondary "retry" modals - it just closes cleanly.
 * 
 * Used by both AttendantFlow and SalesFlow for battery scanning operations.
 */
export function BleProgressModal({
  bleScanState,
  pendingBatteryId,
  onCancel,
}: BleProgressModalProps) {
  const { t } = useI18n();

  // Elapsed seconds since this attempt started (drives copy + hard stop)
  const [elapsed, setElapsed] = useState(0);
  // Track if we already triggered timeout cancel to prevent multiple calls
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  // Continuous display progress. Eases toward the current phase's segment cap
  // so the bar is always visibly moving, and jumps forward when a real
  // milestone lands. Monotonic by construction: we only ever take max().
  const [displayProgress, setDisplayProgress] = useState(0);
  const displayProgressRef = useRef(0);
  
  // Track the battery ID to detect when a NEW connection starts
  // This is used to reset timer state when scanning a new battery
  const lastBatteryIdRef = useRef<string | null>(null);
  
  // Determine if modal should be visible
  // ONLY show when actively connecting/reading - nothing else
  // When connection ends (success, failure, timeout), modal just closes. No second modal ever.
  const isActive = bleScanState.isConnecting || bleScanState.isReadingEnergy;

  // Completion beat: when the operation finishes successfully the bar snaps to
  // 100% and holds for a moment before the modal closes. Without this the modal
  // unmounts at ~90% and the operator reads the vanishing bar as "went back" /
  // "never finished" - the exact complaint that prompted the continuous bar.
  const [justCompleted, setJustCompleted] = useState(false);
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (isActive) {
      wasActiveRef.current = true;
      return;
    }
    // Only beat on a real completion: we were mid-operation, nothing failed,
    // and the bar had genuinely progressed.
    if (wasActiveRef.current && !bleScanState.connectionFailed && displayProgressRef.current > 10) {
      wasActiveRef.current = false;
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 650);
      return () => clearTimeout(t);
    }
    wasActiveRef.current = false;
  }, [isActive, bleScanState.connectionFailed]);

  const isModalVisible = isActive || justCompleted;
  
  // CRITICAL FIX: Reset timer state when pendingBatteryId changes to a NEW value
  // This handles the case where user scans a new battery immediately after timeout
  // Without this, React's state batching could prevent the reset effect from running
  useEffect(() => {
    // Detect when a new battery is being scanned
    if (pendingBatteryId && pendingBatteryId !== lastBatteryIdRef.current) {
      // New battery detected - reset all timer state for a fresh attempt
      startTimeRef.current = null;
      setElapsed(0);
      setHasTimedOut(false);
      displayProgressRef.current = 0;
      setDisplayProgress(0);
      lastBatteryIdRef.current = pendingBatteryId;
    } else if (!pendingBatteryId && lastBatteryIdRef.current !== null) {
      // Battery cleared (connection completed/cancelled) - reset tracking
      lastBatteryIdRef.current = null;
    }
  }, [pendingBatteryId]);

  // Reset all state when modal closes
  useEffect(() => {
    if (!isModalVisible) {
      startTimeRef.current = null;
      setElapsed(0);
      setHasTimedOut(false);
      displayProgressRef.current = 0;
      setDisplayProgress(0);
    }
  }, [isModalVisible]);

  // Drive the continuous bar. Real milestones set a floor; between milestones
  // the bar eases toward (but never reaches) the current segment's cap, so it
  // keeps moving during the ~5s the phone spends enumerating the battery's
  // attribute table - the phase that used to show a frozen 0%.
  const segmentKeyRef = useRef('');
  const segmentStartRef = useRef(0);
  useEffect(() => {
    if (!isActive) return;
    const tick = setInterval(() => {
      if (startTimeRef.current === null) return;

      const reading = bleScanState.isReadingEnergy || bleScanState.isReadingService;
      const phase = bleScanState.readingPhase;

      // Segment = [floor reached by real milestones, cap it may ease toward].
      // tau is roughly how long the segment takes on device; easing closes
      // ~63% of the remaining gap per tau, so the bar slows as it nears the
      // cap but never parks.
      let key = 'connect';
      let floor = 0;
      let cap = SEG_CONNECT_END;
      let tau = 3.0;
      if (reading) {
        if (phase === 'dta') { key = 'dta'; floor = SEG_ATT_END; cap = SEG_DTA_END; tau = 0.9; }
        else { key = 'att'; floor = SEG_CONNECT_END; cap = SEG_ATT_END; tau = 0.9; }
      }

      // Easing runs on time-in-segment, not time-since-tap, so each phase
      // animates its own stretch of the bar instead of snapping to its cap.
      if (segmentKeyRef.current !== key) {
        segmentKeyRef.current = key;
        segmentStartRef.current = Date.now();
      }
      const inSeg = (Date.now() - segmentStartRef.current) / 1000;

      const eased = floor + (cap - floor) * (1 - Math.exp(-inSeg / tau));
      const next = Math.max(displayProgressRef.current, Math.min(cap, eased), floor);
      displayProgressRef.current = next;
      setDisplayProgress(next);
    }, 120);
    return () => clearInterval(tick);
  }, [isActive, bleScanState.isReadingEnergy, bleScanState.isReadingService, bleScanState.readingPhase]);
  
  // Elapsed-time clock while the modal is active. One clock covers all stages
  // (Scan → Connect → Read) without resetting.
  useEffect(() => {
    if (isActive && !bleScanState.connectionFailed) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
        setElapsed(0);
        setHasTimedOut(false);
      }

      const timer = setInterval(() => {
        const sec = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        setElapsed(sec);

        // Hard stop: past this point even a native 20s connect retry has had
        // time to succeed twice. Force cancel so a stuck read can't hold the
        // modal open forever.
        if (sec >= HARD_STOP_SECONDS && !hasTimedOut) {
          setHasTimedOut(true);
          onCancel(true);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
    // Note: We intentionally don't reset startTimeRef when isActive becomes false
    // because we might just be transitioning between stages (Connect → Read).
    // The reset only happens when the modal fully closes (isModalVisible becomes false).
  }, [isActive, bleScanState.connectionFailed, hasTimedOut, onCancel]);
  
  // Don't render if not visible
  if (!isModalVisible) {
    return null;
  }

  const getStatusMessage = () => {
    if (bleScanState.requiresBluetoothReset) {
      return 'The Bluetooth connection was lost. Please toggle Bluetooth to reset it.';
    }
    if (bleScanState.error) {
      return bleScanState.error;
    }
    // Show specific messages for ATT → DTA reading phases (user-friendly labels)
    if (bleScanState.isReadingEnergy || bleScanState.isReadingService) {
      if (bleScanState.readingPhase === 'att') {
        return 'Reading battery ID...';
      }
      if (bleScanState.readingPhase === 'dta') {
        return 'Reading energy data...';
      }
      return 'Reading battery data...';
    }
    // During connect the phone is walking the battery's attribute table; the
    // old thresholds keyed off connectionProgress, which stays 0 for this
    // entire phase, so operators only ever saw the first message. Key off the
    // same clock the bar uses instead.
    if (displayProgress >= 40) {
      return 'Reading battery configuration...';
    }
    if (displayProgress >= 15) {
      return 'Linked — preparing battery...';
    }
    return `Connecting to battery ${pendingBatteryId ? '...' + String(pendingBatteryId).slice(-6).toUpperCase() : ''}...`;
  };

  const getHelpText = () => {
    if (bleScanState.requiresBluetoothReset) {
      return 'This usually happens when the battery connection is interrupted. Toggling Bluetooth will clear the stuck connection.';
    }
    return 'Please wait while connecting. Make sure the battery is powered on and within 2 meters.';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="ble-progress-container">
          {/* Close/Cancel Icon - Top Right */}
          <button
            type="button"
            className="ble-progress-close-icon"
            onClick={() => onCancel(true)}
            aria-label={t('ble.cancelConnection') || 'Cancel'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Header */}
          <div className="ble-progress-header">
            <div className={`ble-progress-icon ${bleScanState.requiresBluetoothReset ? 'ble-progress-icon-warning' : ''}`}>
              {bleScanState.requiresBluetoothReset ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
                </svg>
              )}
            </div>
            <div className="ble-progress-title">
                {bleScanState.requiresBluetoothReset
                    ? 'Bluetooth Reset Required'
                    : (bleScanState.isReadingEnergy || bleScanState.isReadingService)
                    ? (bleScanState.readingPhase === 'att' 
                        ? 'Reading Battery ID' 
                        : bleScanState.readingPhase === 'dta'
                        ? 'Reading Energy Data'
                        : 'Reading Battery Data')
                    : 'Connecting to Battery'}
            </div>
          </div>

          {/* Bluetooth Reset Instructions - Show when Bluetooth reset is required */}
          {bleScanState.requiresBluetoothReset && (
            <div className="ble-reset-instructions">
              <div className="ble-reset-steps">
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">1</span>
                  <span>Open your phone&apos;s Settings</span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">2</span>
                  <span>Turn Bluetooth OFF</span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">3</span>
                  <span>Wait 3 seconds</span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">4</span>
                  <span>Turn Bluetooth ON</span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">5</span>
                  <span>Return here and try again</span>
                </div>
              </div>
            </div>
          )}

          {/* Battery ID Display - Show which battery we're connecting to (hide when reset required) */}
          {pendingBatteryId && !bleScanState.requiresBluetoothReset && (
            <div className="ble-battery-id">
              <span className="ble-battery-id-label">Battery ID:</span>
              <span className="ble-battery-id-value">
                ...{String(pendingBatteryId).slice(-6).toUpperCase()}
              </span>
            </div>
          )}

          {/* One continuous progress bar for the whole operation. Driven by
              displayProgress: milestone floors + easing, monotonic, never
              resets between phases. */}
          {!bleScanState.requiresBluetoothReset &&
           (bleScanState.isConnecting || bleScanState.isReadingEnergy) && (
            <div className="ble-progress-bar-container">
              <div className="ble-progress-bar-bg">
                <div
                  className="ble-progress-bar-fill"
                  style={{ width: `${justCompleted ? 100 : displayProgress}%`, transition: 'width 200ms ease-out' }}
                />
              </div>
              <div className="ble-progress-percent">
                {justCompleted ? 100 : Math.round(displayProgress)}%
              </div>
            </div>
          )}

          {/* Expectation, not a fake countdown. Before 12s: the measured
              typical duration. After 12s: acknowledge the delay and say what
              is actually happening (the app is retrying), so a slow attempt
              stops looking identical to a dead one. */}
          {!bleScanState.requiresBluetoothReset &&
           !bleScanState.connectionFailed &&
           (bleScanState.isConnecting || bleScanState.isReadingEnergy) && (
            <div className="ble-countdown-timer">
              {elapsed < SLOW_THRESHOLD_SECONDS ? (
                <span className="ble-countdown-text">
                  Usually takes about <strong>{EXPECTED_SECONDS}s</strong>
                </span>
              ) : (
                <span className="ble-countdown-expired">
                  Taking longer than usual — still trying ({elapsed}s)
                </span>
              )}
            </div>
          )}

          {/* Status Message */}
          <div className="ble-progress-status">
            {getStatusMessage()}
          </div>

          {/* Step Indicators - Hide when Bluetooth reset is required */}
          {/* Shows 4 steps: Scan → Connect → ID (ATT) → Energy (DTA) */}
          {/* User-friendly labels: "ID" for ATT service, "Energy" for DTA service */}
          {!bleScanState.requiresBluetoothReset && (
            <div className="ble-progress-steps">
              <div className="ble-step active completed">
                <div className="ble-step-dot" />
                <span>Scan</span>
              </div>
              <div className={`ble-step ${bleScanState.isConnecting || bleScanState.isReadingEnergy || bleScanState.isReadingService ? 'active' : ''} ${bleScanState.isReadingEnergy || bleScanState.isReadingService ? 'completed' : ''}`}>
                <div className="ble-step-dot" />
                <span>Connect</span>
              </div>
              <div className={`ble-step ${(bleScanState.isReadingEnergy || bleScanState.isReadingService) && bleScanState.readingPhase !== 'idle' ? 'active' : ''} ${bleScanState.readingPhase === 'dta' ? 'completed' : ''}`}>
                <div className="ble-step-dot" />
                <span>ID</span>
              </div>
              <div className={`ble-step ${bleScanState.readingPhase === 'dta' ? 'active' : ''}`}>
                <div className="ble-step-dot" />
                <span>Energy</span>
              </div>
            </div>
          )}

          {/* Help Text */}
          <p className="ble-progress-help">
            {getHelpText()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default BleProgressModal;
