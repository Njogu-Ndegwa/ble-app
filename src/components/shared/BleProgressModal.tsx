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

/**
 * BLE Connection Progress Modal
 * 
 * Shows a modal overlay during Bluetooth connection with:
 * - Connection progress bar and percentage
 * - Step indicators (Scan → Connect → Read)
 * - Status messages for each phase
 * - 60 second countdown timer
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
  // Countdown timer state
  const [countdown, setCountdown] = useState(COUNTDOWN_START_SECONDS);
  // Track if we already triggered timeout cancel to prevent multiple calls
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  
  // Determine if modal should be visible
  // ONLY show when actively connecting/reading - nothing else
  // When connection ends (success, failure, timeout), modal just closes. No second modal ever.
  const isActive = bleScanState.isConnecting || bleScanState.isReadingEnergy;
  const isModalVisible = isActive;
  
  // Reset all state when modal closes
  useEffect(() => {
    if (!isModalVisible) {
      startTimeRef.current = null;
      setCountdown(COUNTDOWN_START_SECONDS);
      setHasTimedOut(false);
    }
  }, [isModalVisible]);
  
  // Start/continue countdown when modal is active
  useEffect(() => {
    if (isActive && !bleScanState.connectionFailed) {
      // Start countdown only when first becoming active in this session
      // The 60s countdown covers ALL stages (Scan → Connect → Read) without resetting
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
        setCountdown(COUNTDOWN_START_SECONDS);
        setHasTimedOut(false);
      }
      
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        const remaining = Math.max(0, COUNTDOWN_START_SECONDS - elapsed);
        setCountdown(remaining);
        
        // When countdown reaches 0, automatically cancel and close the modal
        if (remaining <= 0 && !hasTimedOut) {
          setHasTimedOut(true);
          onCancel(); // This triggers cleanup: stops scanning, cancels connection, resets state
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
    if (bleScanState.requiresBluetoothReset) {
      return 'This usually happens when the battery connection is interrupted. Toggling Bluetooth will clear the stuck connection.';
    }
    return 'Please wait while connecting. Make sure the battery is powered on and within 2 meters.';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="ble-progress-container">
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
                    : bleScanState.isReadingEnergy 
                    ? 'Reading Battery Data' 
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

          {/* Progress Bar - Show from 0% when connecting starts for visual consistency */}
          {!bleScanState.requiresBluetoothReset && 
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

          {/* Status Message */}
          <div className="ble-progress-status">
            {getStatusMessage()}
          </div>

          {/* Step Indicators - Hide when Bluetooth reset is required */}
          {!bleScanState.requiresBluetoothReset && (
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
