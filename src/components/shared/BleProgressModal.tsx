'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { FlowBleScanState } from '@/lib/hooks/ble';

// Connection process typically takes 25-40 seconds, countdown from 60s
const COUNTDOWN_START_SECONDS = 60;

export interface BleProgressModalProps {
  /** BLE scan state from useFlowBatteryScan hook */
  bleScanState: FlowBleScanState;
  /** ID of the battery being connected (for display) */
  pendingBatteryId: string | null;
  /** Callback when user clicks cancel/close */
  onCancel: () => void;
}

// State for timeout expiration - shown when 60s elapses without connection
interface TimeoutState {
  hasExpired: boolean;
  showRetryInstructions: boolean;
}

/**
 * BLE Connection Progress Modal
 * 
 * Shows a modal overlay with:
 * - Connection progress bar and percentage
 * - Step indicators (Scan → Connect → Read)
 * - Status messages for each phase
 * - Bluetooth reset instructions when needed
 * - Cancel button when connection fails
 * 
 * Used by both AttendantFlow and SalesFlow for battery scanning operations.
 */
export function BleProgressModal({
  bleScanState,
  pendingBatteryId,
  onCancel,
}: BleProgressModalProps) {
  // Countdown timer state
  const [countdown, setCountdown] = useState(COUNTDOWN_START_SECONDS);
  const [showCancelButton, setShowCancelButton] = useState(false);
  // New: Track if countdown has expired - shows retry instructions instead of auto-retry
  const [timeoutState, setTimeoutState] = useState<TimeoutState>({
    hasExpired: false,
    showRetryInstructions: false,
  });
  const startTimeRef = useRef<number | null>(null);
  // Track if we've ever been active in this session to prevent reset during stage transitions
  const wasActiveRef = useRef(false);
  
  // Determine if modal should be visible
  // IMPORTANT: When timeout expires, we keep modal visible with retry instructions
  // Don't reopen based on connectionFailed from the hook's global timeout
  const isConnectionActive = bleScanState.isConnecting || bleScanState.isReadingEnergy;
  const isModalVisible = isConnectionActive || bleScanState.connectionFailed || timeoutState.hasExpired;
  const isActive = isConnectionActive;
  
  // Reset timer state when modal becomes hidden (not just when isActive changes)
  // This prevents timer reset during transitions between Connect → Read stages
  useEffect(() => {
    // Only reset when both: not active AND not showing timeout instructions
    if (!isActive && !bleScanState.connectionFailed && !timeoutState.hasExpired) {
      // Modal is fully closed, reset everything for the next session
      startTimeRef.current = null;
      wasActiveRef.current = false;
      setCountdown(COUNTDOWN_START_SECONDS);
      setShowCancelButton(false);
      setTimeoutState({ hasExpired: false, showRetryInstructions: false });
    }
  }, [isActive, bleScanState.connectionFailed, timeoutState.hasExpired]);
  
  // Start/continue countdown when modal is active
  useEffect(() => {
    if (isActive && !bleScanState.connectionFailed && !timeoutState.hasExpired) {
      // Start countdown only when first becoming active in this session
      // The 60s countdown covers ALL stages (Scan → Connect → Read) without resetting
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
        wasActiveRef.current = true;
        setCountdown(COUNTDOWN_START_SECONDS);
        setShowCancelButton(false);
      }
      
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        const remaining = Math.max(0, COUNTDOWN_START_SECONDS - elapsed);
        setCountdown(remaining);
        
        // When countdown reaches 0, show retry instructions instead of auto-retrying
        // The system does NOT auto-retry - user must manually toggle Bluetooth and retry
        if (remaining <= 0 && !timeoutState.hasExpired) {
          setTimeoutState({ hasExpired: true, showRetryInstructions: true });
          setShowCancelButton(true);
          // Cancel the operation to stop any ongoing BLE operations
          // but keep the modal open with instructions
          onCancel();
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
    // Note: We intentionally don't reset startTimeRef when isActive becomes false
    // because we might just be transitioning between stages (Connect → Read).
    // The reset only happens when the modal fully closes (isModalVisible becomes false).
  }, [isActive, bleScanState.connectionFailed, timeoutState.hasExpired, onCancel]);
  
  // Don't render if not in an active BLE operation state and no timeout
  if (!bleScanState.isConnecting && !bleScanState.isReadingEnergy && !bleScanState.connectionFailed && !timeoutState.hasExpired) {
    return null;
  }

  // Handle user closing the timeout instructions
  const handleCloseTimeoutInstructions = () => {
    setTimeoutState({ hasExpired: false, showRetryInstructions: false });
    startTimeRef.current = null;
    wasActiveRef.current = false;
    setCountdown(COUNTDOWN_START_SECONDS);
    setShowCancelButton(false);
    onCancel();
  };

  const getStatusMessage = () => {
    // Don't show status message when timeout instructions are displayed
    if (timeoutState.showRetryInstructions) {
      return '';
    }
    if (bleScanState.requiresBluetoothReset) {
      return 'The Bluetooth connection was lost. Please toggle Bluetooth to reset it.';
    }
    if (bleScanState.error) {
      return bleScanState.error;
    }
    if (bleScanState.isReadingEnergy) {
      return 'Reading energy level from battery...';
    }
    if (bleScanState.connectionProgress >= 75) {
      return 'Finalizing connection...';
    }
    if (bleScanState.connectionProgress >= 50) {
      return 'Establishing secure connection...';
    }
    if (bleScanState.connectionProgress >= 25) {
      return 'Authenticating with battery...';
    }
    if (bleScanState.connectionProgress >= 10) {
      return 'Locating battery via Bluetooth...';
    }
    return `Connecting to battery ${pendingBatteryId ? '...' + String(pendingBatteryId).slice(-6).toUpperCase() : ''}...`;
  };

  const getHelpText = () => {
    // Don't show help text when timeout instructions are displayed
    if (timeoutState.showRetryInstructions) {
      return '';
    }
    if (bleScanState.requiresBluetoothReset) {
      return 'This usually happens when the battery connection is interrupted. Toggling Bluetooth will clear the stuck connection.';
    }
    if (bleScanState.connectionFailed) {
      // Check if error indicates device might already be connected
      if (bleScanState.error?.includes('already connected')) {
        return 'The device may already be connected to another phone or app. Turn your Bluetooth off and on, then try again.';
      }
      return 'Connection failed. Please ensure the battery is powered on and nearby, then try again.';
    }
    return 'Please wait while connecting. Make sure the battery is powered on and within 2 meters.';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="ble-progress-container">
          {/* Header - Hide when timeout instructions are shown (they have their own header) */}
          {!timeoutState.showRetryInstructions && (
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
                      : bleScanState.isReadingEnergy 
                      ? 'Reading Battery Data' 
                      : 'Connecting to Battery'}
              </div>
            </div>
          )}

          {/* Bluetooth Reset Instructions - Show when Bluetooth reset is required (not during timeout) */}
          {bleScanState.requiresBluetoothReset && !timeoutState.showRetryInstructions && (
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

          {/* Battery ID Display - Show which battery we're connecting to (hide when reset required or timeout) */}
          {pendingBatteryId && !bleScanState.requiresBluetoothReset && !timeoutState.showRetryInstructions && (
            <div className="ble-battery-id">
              <span className="ble-battery-id-label">Battery ID:</span>
              <span className="ble-battery-id-value">
                ...{String(pendingBatteryId).slice(-6).toUpperCase()}
              </span>
            </div>
          )}

          {/* Progress Bar - Show from 0% when connecting starts for visual consistency */}
          {!bleScanState.requiresBluetoothReset && 
           !timeoutState.showRetryInstructions &&
           (bleScanState.isConnecting || bleScanState.isReadingEnergy) && (
            <div className="ble-progress-bar-container">
              <div className="ble-progress-bar-bg">
                <div 
                  className="ble-progress-bar-fill"
                  style={{ width: `${bleScanState.connectionProgress}%` }}
                />
              </div>
              <div className="ble-progress-percent">
                {bleScanState.connectionProgress}%
              </div>
            </div>
          )}
          
          {/* Countdown Timer - Show estimated time remaining */}
          {!bleScanState.requiresBluetoothReset && 
           !bleScanState.connectionFailed &&
           !timeoutState.hasExpired &&
           (bleScanState.isConnecting || bleScanState.isReadingEnergy) && (
            <div className="ble-countdown-timer">
              {countdown > 0 ? (
                <span className="ble-countdown-text">
                  Connection will complete in about <strong>{countdown}s</strong>
                </span>
              ) : (
                <span className="ble-countdown-expired">
                  Connection timed out...
                </span>
              )}
            </div>
          )}

          {/* Timeout Instructions - Shown when 60s expires without successful connection */}
          {timeoutState.showRetryInstructions && (
            <div className="ble-timeout-instructions">
              <div className="ble-timeout-header">
                <svg className="ble-timeout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <span className="ble-timeout-title">Connection Timed Out</span>
              </div>
              <p className="ble-timeout-message">
                We couldn&apos;t connect to the battery. Please follow these steps and try again:
              </p>
              <div className="ble-reset-steps">
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">1</span>
                  <span>Go to your phone&apos;s Settings</span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">2</span>
                  <span>Turn Bluetooth <strong>OFF</strong></span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">3</span>
                  <span>Wait 5 seconds</span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">4</span>
                  <span>Turn Bluetooth <strong>ON</strong></span>
                </div>
                <div className="ble-reset-step">
                  <span className="ble-reset-step-number">5</span>
                  <span>Return here and scan the battery again</span>
                </div>
              </div>
              <button
                onClick={handleCloseTimeoutInstructions}
                className="ble-cancel-button ble-cancel-button-primary"
                title="Close and try again"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Close &amp; Retry
              </button>
            </div>
          )}

          {/* Status Message - Hide when timeout instructions are shown */}
          {!timeoutState.showRetryInstructions && (
            <div className="ble-progress-status">
              {getStatusMessage()}
            </div>
          )}

          {/* Step Indicators - Hide when Bluetooth reset is required or timeout instructions shown */}
          {!bleScanState.requiresBluetoothReset && !timeoutState.showRetryInstructions && (
            <div className="ble-progress-steps">
              <div className="ble-step active completed">
                <div className="ble-step-dot" />
                <span>Scan</span>
              </div>
              <div className={`ble-step ${bleScanState.isConnecting || bleScanState.isReadingEnergy ? 'active' : ''} ${bleScanState.isReadingEnergy ? 'completed' : ''}`}>
                <div className="ble-step-dot" />
                <span>Connect</span>
              </div>
              <div className={`ble-step ${bleScanState.isReadingEnergy ? 'active' : ''}`}>
                <div className="ble-step-dot" />
                <span>Read</span>
              </div>
            </div>
          )}

          {/* Cancel/Close Button - Shown when connection failed (not during timeout instructions, which has its own button) */}
          {(bleScanState.connectionFailed || (showCancelButton && !timeoutState.showRetryInstructions)) && (
            <button
              onClick={onCancel}
              className={`ble-cancel-button ${bleScanState.requiresBluetoothReset ? 'ble-cancel-button-primary' : ''}`}
              title="Close and try again"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              {bleScanState.requiresBluetoothReset ? 'Close & Reset Bluetooth' : 'Cancel & Retry'}
            </button>
          )}
          
          {/* Help Text - Hide when timeout instructions are shown */}
          {!timeoutState.showRetryInstructions && (
            <p className="ble-progress-help">
              {getHelpText()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default BleProgressModal;
