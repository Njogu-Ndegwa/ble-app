'use client';

import React from 'react';
import type { FlowBleScanState } from '@/lib/hooks/ble';

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
  // Don't render if not in an active BLE operation state
  if (!bleScanState.isConnecting && !bleScanState.isReadingEnergy && !bleScanState.connectionFailed) {
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
    if (bleScanState.connectionFailed) {
      return 'Connection failed. Please ensure the battery is powered on and nearby, then try again.';
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

          {/* Progress Bar - Hide when Bluetooth reset is required */}
          {!bleScanState.requiresBluetoothReset && (
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

          {/* Cancel/Close Button - Only shown when connection has definitively failed */}
          {bleScanState.connectionFailed && (
            <button
              onClick={onCancel}
              className={`ble-cancel-button ${bleScanState.requiresBluetoothReset ? 'ble-cancel-button-primary' : ''}`}
              title="Close and try again"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              {bleScanState.requiresBluetoothReset ? 'Close & Reset Bluetooth' : 'Close'}
            </button>
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
