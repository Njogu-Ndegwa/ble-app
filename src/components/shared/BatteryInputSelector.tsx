'use client';

import React, { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n';
import { colors, spacing, radius, fontSize, fontWeight } from '@/styles';
import BleDeviceList from './BleDeviceList';
import type { BleDevice, BatteryData } from './types';

/**
 * Battery input mode - QR scan or manual device selection
 * @deprecated No longer used - unified UI shows both options
 */
export type BatteryInputMode = 'scan' | 'manual';

/**
 * Mode configuration for different battery operations
 */
export type BatteryOperationMode = 'return' | 'issue' | 'assign';

// Mode-specific configuration
const MODE_CONFIG: Record<BatteryOperationMode, {
  titleKey: string;
  subtitleKey: string;
  hintKey: string;
  scanButtonKey: string;
}> = {
  return: {
    titleKey: 'attendant.returnBattery',
    subtitleKey: 'attendant.scanReturnBattery',
    hintKey: 'attendant.scanReturnHint',
    scanButtonKey: 'battery.scanQr',
  },
  issue: {
    titleKey: 'attendant.issueNewBattery',
    subtitleKey: 'attendant.scanNewBattery',
    hintKey: 'attendant.scanNewHint',
    scanButtonKey: 'battery.scanQr',
  },
  assign: {
    titleKey: 'sales.assignBattery',
    subtitleKey: 'sales.scanBatteryQr',
    hintKey: 'sales.scanBatteryHint',
    scanButtonKey: 'battery.scanQr',
  },
};

// Fallback values
const FALLBACK_CONFIG = {
  return: {
    title: 'Return Battery',
    subtitle: 'Scan QR or select from nearby devices',
    hint: 'Position the QR code within the frame',
    scanButton: 'Scan QR Code',
  },
  issue: {
    title: 'Issue New Battery',
    subtitle: 'Scan QR or select from nearby devices',
    hint: 'Scan the QR code on the battery to issue',
    scanButton: 'Scan QR Code',
  },
  assign: {
    title: 'Assign Battery',
    subtitle: 'Scan QR or select from nearby devices',
    hint: 'Scan the QR code on the battery to assign',
    scanButton: 'Scan QR Code',
  },
};

interface BatteryInputSelectorProps {
  /** Operation mode determines messaging */
  mode: BatteryOperationMode;
  /** Callback when QR scan is triggered */
  onScan: () => void;
  /** Callback when a device is manually selected */
  onDeviceSelect: (device: BleDevice) => void;
  /** List of detected BLE devices for manual selection */
  detectedDevices?: BleDevice[];
  /** Whether BLE scanning is in progress */
  isScanning?: boolean;
  /** Callback to start/restart BLE scanning */
  onStartScan?: () => void;
  /** Whether scanner is currently opening */
  isScannerOpening?: boolean;
  /** Currently selected device MAC (for highlighting) */
  selectedDeviceMac?: string | null;
  /** For first-time customer handling in return mode */
  isFirstTimeCustomer?: boolean;
  /** Previously returned battery (shown in issue mode) */
  previousBattery?: BatteryData | null;
  /** @deprecated No longer used - unified UI shows both options */
  defaultMode?: BatteryInputMode;
  /** @deprecated No longer used - unified UI shows both options */
  inputMode?: BatteryInputMode;
  /** @deprecated No longer used - unified UI shows both options */
  onInputModeChange?: (mode: BatteryInputMode) => void;
  /** Custom title override */
  title?: string;
  /** Custom subtitle override */
  subtitle?: string;
  /** @deprecated No longer used - unified UI shows both options */
  showModeToggle?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * BatteryInputSelector - Unified component for selecting batteries
 * 
 * Provides a unified interface with:
 * 1. **Scan QR Button**: Large, prominent button to open QR scanner
 * 2. **Device List**: Always-visible list of nearby BLE devices
 * 
 * Users can either:
 * - Tap the QR scan button for quick scanning
 * - Select a device from the list when QR is damaged/inaccessible
 * 
 * No tabs or mode switching required - both options are visible at once.
 * 
 * Used in:
 * - Attendant Step 2: Scan Old Battery (return mode)
 * - Attendant Step 3: Scan New Battery (issue mode)  
 * - Sales Step 4: Assign Battery (assign mode)
 * 
 * @example
 * <BatteryInputSelector
 *   mode="return"
 *   onScan={handleOpenQrScanner}
 *   onDeviceSelect={(device) => handleConnect(device.macAddress)}
 *   detectedDevices={bleDevices}
 *   isScanning={isBleScanActive}
 *   onStartScan={startBleScan}
 * />
 */
export default function BatteryInputSelector({
  mode,
  onScan,
  onDeviceSelect,
  detectedDevices = [],
  isScanning = false,
  onStartScan,
  isScannerOpening = false,
  selectedDeviceMac,
  isFirstTimeCustomer = false,
  previousBattery,
  title,
  subtitle,
  disabled = false,
  className = '',
}: BatteryInputSelectorProps) {
  const { t } = useI18n();
  
  // Track if we've auto-started scanning
  const hasAutoStartedRef = useRef(false);

  // Auto-start BLE scanning when component mounts (if not already scanning)
  useEffect(() => {
    if (!hasAutoStartedRef.current && onStartScan && !isScanning) {
      hasAutoStartedRef.current = true;
      onStartScan();
    }
  }, [onStartScan, isScanning]);

  const config = MODE_CONFIG[mode];
  const fallback = FALLBACK_CONFIG[mode];
  
  // Handle first-time customer edge case for return mode
  const displayTitle = title || (
    isFirstTimeCustomer 
      ? (t('attendant.skipReturn') || 'Skip Return')
      : (t(config.titleKey) || fallback.title)
  );
  
  const displaySubtitle = subtitle || (
    isFirstTimeCustomer
      ? (t('attendant.firstTimeCustomer') || 'First time customer - no battery to return')
      : (t(config.subtitleKey) || fallback.subtitle)
  );

  return (
    <div className={`battery-input-selector ${className}`}>
      {/* Compact Header */}
      <div className="battery-input-header">
        <h2 className="battery-input-title">{displayTitle}</h2>
        <p className="battery-input-subtitle">{displaySubtitle}</p>
      </div>

      {/* Previous Battery Card (issue mode) - Compact */}
      {mode === 'issue' && previousBattery && (
        <div className="battery-return-card">
          <div className="battery-return-header">
            <span className="battery-return-label">{t('attendant.returnedBattery') || 'Returned Battery'}</span>
            <span className="battery-return-status">✓ {t('common.connected') || 'Connected'}</span>
          </div>
          <div className="battery-return-content">
            <div className="battery-return-id">{previousBattery.shortId || previousBattery.id}</div>
            <div className="battery-return-energy">
              {(previousBattery.energy / 1000).toFixed(3)} kWh {t('attendant.remaining') || 'remaining'}
            </div>
          </div>
        </div>
      )}

      {/* Action Bar - QR Scan button with instruction text */}
      {!isFirstTimeCustomer && (
        <div className="battery-search-bar">
          <div className="battery-search-icon">
            <QrScanIcon />
          </div>
          <span className="battery-search-placeholder">
            {t('common.scanOrSelect') || 'Scan QR code or select from list below'}
          </span>
          <button
            type="button"
            className="battery-qr-btn"
            onClick={onScan}
            disabled={isScannerOpening || disabled}
            aria-label={t(config.scanButtonKey) || fallback.scanButton}
          >
            {isScannerOpening ? (
              <div className="battery-qr-spinner" />
            ) : (
              <QrScanIcon />
            )}
          </button>
        </div>
      )}

      {/* Device List - Always visible, no scrolling needed to discover */}
      {!isFirstTimeCustomer && (
        <div className="battery-input-device-list">
          <BleDeviceList
            devices={detectedDevices}
            selectedDevice={selectedDeviceMac}
            isScanning={isScanning}
            onSelectDevice={onDeviceSelect}
            onRescan={onStartScan}
            disabled={disabled}
            hideSearch={true}
            maxHeight="320px"
          />
        </div>
      )}

      <style jsx>{`
        .battery-input-selector {
          display: flex;
          flex-direction: column;
          gap: ${spacing[3]};
        }

        .battery-input-header {
          text-align: center;
        }

        .battery-input-title {
          margin: 0;
          font-size: ${fontSize.xl};
          font-weight: ${fontWeight.bold};
          color: ${colors.text.primary};
        }

        .battery-input-subtitle {
          margin: ${spacing[1]} 0 0;
          font-size: ${fontSize.sm};
          color: ${colors.text.secondary};
        }

        .battery-return-card {
          padding: ${spacing[2]} ${spacing[3]};
          background: ${colors.successSoft};
          border: 1px solid ${colors.success}40;
          border-radius: ${radius.lg};
        }

        .battery-return-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${spacing[1]};
        }

        .battery-return-label {
          font-size: ${fontSize.xs};
          color: ${colors.text.secondary};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .battery-return-status {
          font-size: ${fontSize.xs};
          color: ${colors.success};
          font-weight: ${fontWeight.medium};
        }

        .battery-return-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .battery-return-id {
          font-size: ${fontSize.base};
          font-weight: ${fontWeight.semibold};
          color: ${colors.text.primary};
          font-family: var(--font-mono);
        }

        .battery-return-energy {
          font-size: ${fontSize.xs};
          color: ${colors.text.secondary};
        }

        /* Compact Search Bar with QR Scan - Like Keypad */
        .battery-search-bar {
          display: flex;
          align-items: center;
          gap: ${spacing[2]};
          padding: ${spacing[2]} ${spacing[3]};
          background: ${colors.bg.tertiary};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          transition: border-color 0.2s;
        }

        .battery-search-bar:focus-within {
          border-color: ${colors.brand.primary};
        }

        .battery-search-icon {
          flex-shrink: 0;
          color: ${colors.text.muted};
        }

        .battery-search-icon :global(svg) {
          width: 18px;
          height: 18px;
        }

        .battery-search-placeholder {
          flex: 1;
          font-size: ${fontSize.sm};
          color: ${colors.text.muted};
        }

        .battery-qr-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          padding: 0;
          background: ${colors.brand.primary};
          border: none;
          border-radius: ${radius.md};
          color: ${colors.bg.primary};
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .battery-qr-btn:hover:not(:disabled) {
          background: ${colors.brand.primaryDark};
          transform: scale(1.05);
        }

        .battery-qr-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .battery-qr-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .battery-qr-btn :global(svg) {
          width: 20px;
          height: 20px;
        }

        .battery-qr-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Device List Container */
        .battery-input-device-list {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}

// ============================================
// ICON COMPONENTS
// ============================================

function QrScanIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      {/* QR code pattern */}
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="3" height="3" rx="0.5"/>
      <rect x="18" y="14" width="3" height="3" rx="0.5"/>
      <rect x="14" y="18" width="3" height="3" rx="0.5"/>
      <rect x="18" y="18" width="3" height="3" rx="0.5"/>
      {/* Inner squares */}
      <rect x="5" y="5" width="3" height="3" fill="currentColor"/>
      <rect x="16" y="5" width="3" height="3" fill="currentColor"/>
      <rect x="5" y="16" width="3" height="3" fill="currentColor"/>
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
    >
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}
