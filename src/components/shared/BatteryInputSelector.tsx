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
      {/* Header */}
      <div className="battery-input-header">
        <h1 className="battery-input-title">{displayTitle}</h1>
        <p className="battery-input-subtitle">{displaySubtitle}</p>
      </div>

      {/* Previous Battery Card (issue mode) */}
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

      {/* QR Scan Button - Large, prominent */}
      {!isFirstTimeCustomer && (
        <button
          type="button"
          className="battery-scan-btn"
          onClick={onScan}
          disabled={isScannerOpening || disabled}
        >
          <div className="battery-scan-btn-content">
            <div className="battery-scan-icon">
              <QrScanIcon />
            </div>
            <div className="battery-scan-text">
              <span className="battery-scan-label">
                {t(config.scanButtonKey) || fallback.scanButton}
              </span>
              <span className="battery-scan-hint">
                {t(config.hintKey) || fallback.hint}
              </span>
            </div>
          </div>
          {isScannerOpening && (
            <div className="battery-scan-spinner" />
          )}
        </button>
      )}

      {/* Divider with "or" text */}
      {!isFirstTimeCustomer && detectedDevices.length > 0 && (
        <div className="battery-divider">
          <span className="battery-divider-text">{t('common.or') || 'or select from list'}</span>
        </div>
      )}

      {/* Device List - Always visible when devices are detected */}
      {!isFirstTimeCustomer && (
        <div className="battery-input-device-list">
          <BleDeviceList
            devices={detectedDevices}
            selectedDevice={selectedDeviceMac}
            isScanning={isScanning}
            onSelectDevice={onDeviceSelect}
            onRescan={onStartScan}
            disabled={disabled}
            maxHeight="240px"
          />
        </div>
      )}

      <style jsx>{`
        .battery-input-selector {
          display: flex;
          flex-direction: column;
          gap: ${spacing[4]};
        }

        .battery-input-header {
          text-align: center;
        }

        .battery-input-title {
          margin: 0;
          font-size: ${fontSize['2xl']};
          font-weight: ${fontWeight.bold};
          color: ${colors.text.primary};
        }

        .battery-input-subtitle {
          margin: ${spacing[2]} 0 0;
          font-size: ${fontSize.base};
          color: ${colors.text.secondary};
        }

        .battery-return-card {
          padding: ${spacing[3]};
          background: ${colors.successSoft};
          border: 1px solid ${colors.success}40;
          border-radius: ${radius.lg};
        }

        .battery-return-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${spacing[2]};
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
          font-size: ${fontSize.lg};
          font-weight: ${fontWeight.semibold};
          color: ${colors.text.primary};
          font-family: var(--font-mono);
        }

        .battery-return-energy {
          font-size: ${fontSize.sm};
          color: ${colors.text.secondary};
        }

        /* QR Scan Button - Large, prominent */
        .battery-scan-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: ${spacing[4]};
          background: linear-gradient(135deg, ${colors.brand.primary}15, ${colors.brand.primary}08);
          border: 2px dashed ${colors.brand.primary}60;
          border-radius: ${radius.xl};
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .battery-scan-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, ${colors.brand.primary}25, ${colors.brand.primary}15);
          border-color: ${colors.brand.primary};
          transform: translateY(-1px);
        }

        .battery-scan-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .battery-scan-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .battery-scan-btn-content {
          display: flex;
          align-items: center;
          gap: ${spacing[4]};
        }

        .battery-scan-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background: ${colors.brand.primary};
          border-radius: ${radius.lg};
          color: ${colors.bg.primary};
        }

        .battery-scan-icon :global(svg) {
          width: 28px;
          height: 28px;
        }

        .battery-scan-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: ${spacing[1]};
        }

        .battery-scan-label {
          font-size: ${fontSize.lg};
          font-weight: ${fontWeight.semibold};
          color: ${colors.text.primary};
        }

        .battery-scan-hint {
          font-size: ${fontSize.sm};
          color: ${colors.text.secondary};
        }

        .battery-scan-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid ${colors.brand.primary}40;
          border-top-color: ${colors.brand.primary};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Divider */
        .battery-divider {
          display: flex;
          align-items: center;
          gap: ${spacing[3]};
        }

        .battery-divider::before,
        .battery-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: ${colors.border.default};
        }

        .battery-divider-text {
          font-size: ${fontSize.sm};
          color: ${colors.text.muted};
          white-space: nowrap;
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
