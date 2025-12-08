'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n';
import { colors, spacing, radius, fontSize, fontWeight } from '@/styles';
import ScannerArea from './ScannerArea';
import BleDeviceList from './BleDeviceList';
import type { BleDevice, BatteryData, InputMode } from './types';

/**
 * Battery input mode - QR scan or manual device selection
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
  manualTitleKey: string;
  manualSubtitleKey: string;
  hintKey: string;
}> = {
  return: {
    titleKey: 'attendant.returnBattery',
    subtitleKey: 'attendant.scanReturnBattery',
    manualTitleKey: 'attendant.selectReturnBattery',
    manualSubtitleKey: 'attendant.selectFromNearbyDevices',
    hintKey: 'attendant.scanReturnHint',
  },
  issue: {
    titleKey: 'attendant.issueNewBattery',
    subtitleKey: 'attendant.scanNewBattery',
    manualTitleKey: 'attendant.selectNewBattery',
    manualSubtitleKey: 'attendant.selectFromNearbyDevices',
    hintKey: 'attendant.scanNewHint',
  },
  assign: {
    titleKey: 'sales.assignBattery',
    subtitleKey: 'sales.scanBatteryQr',
    manualTitleKey: 'sales.selectBatteryManually',
    manualSubtitleKey: 'sales.selectFromNearbyDevices',
    hintKey: 'sales.scanBatteryHint',
  },
};

// Fallback values
const FALLBACK_CONFIG = {
  return: {
    title: 'Return Battery',
    subtitle: 'Scan the QR code on the battery',
    manualTitle: 'Select Battery to Return',
    manualSubtitle: 'Choose from nearby devices',
    hint: 'Position the QR code within the frame',
  },
  issue: {
    title: 'Issue New Battery',
    subtitle: 'Scan the QR code on the new battery',
    manualTitle: 'Select New Battery',
    manualSubtitle: 'Choose from nearby devices',
    hint: 'Scan the QR code on the battery to issue',
  },
  assign: {
    title: 'Assign Battery',
    subtitle: 'Scan the battery QR code',
    manualTitle: 'Select Battery',
    manualSubtitle: 'Choose from nearby devices',
    hint: 'Scan the QR code on the battery to assign',
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
  /** Default input mode */
  defaultMode?: BatteryInputMode;
  /** Control input mode externally */
  inputMode?: BatteryInputMode;
  /** Callback when input mode changes */
  onInputModeChange?: (mode: BatteryInputMode) => void;
  /** Custom title override */
  title?: string;
  /** Custom subtitle override */
  subtitle?: string;
  /** Whether to show the mode toggle (default: true) */
  showModeToggle?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * BatteryInputSelector - Reusable component for selecting batteries
 * 
 * Provides two modes:
 * 1. **Scan Mode (Default)**: QR code scanning via BatteryScanBind pattern
 * 2. **Manual Mode**: Select from detected nearby BLE devices
 * 
 * Users can toggle between modes using a clean UI switch. This enables:
 * - Quick QR scanning when codes are accessible
 * - Manual device selection when QR is damaged or hard to access
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
  defaultMode = 'scan',
  inputMode: controlledInputMode,
  onInputModeChange,
  title,
  subtitle,
  showModeToggle = true,
  disabled = false,
  className = '',
}: BatteryInputSelectorProps) {
  const { t } = useI18n();
  
  // Internal state for input mode (can be controlled or uncontrolled)
  const [internalMode, setInternalMode] = useState<BatteryInputMode>(defaultMode);
  const currentInputMode = controlledInputMode ?? internalMode;
  
  // Track if we've auto-started scanning
  const hasAutoStartedRef = useRef(false);

  const handleModeChange = useCallback((newMode: BatteryInputMode) => {
    if (controlledInputMode !== undefined) {
      onInputModeChange?.(newMode);
    } else {
      setInternalMode(newMode);
    }
    
    // Auto-start BLE scanning when switching to manual mode
    if (newMode === 'manual' && onStartScan && !isScanning && detectedDevices.length === 0) {
      onStartScan();
    }
  }, [controlledInputMode, onInputModeChange, onStartScan, isScanning, detectedDevices.length]);

  // Auto-start scanning when entering manual mode for the first time
  useEffect(() => {
    if (currentInputMode === 'manual' && !hasAutoStartedRef.current && onStartScan && !isScanning) {
      hasAutoStartedRef.current = true;
      onStartScan();
    }
    // Reset when switching back to scan mode
    if (currentInputMode === 'scan') {
      hasAutoStartedRef.current = false;
    }
  }, [currentInputMode, onStartScan, isScanning]);

  const config = MODE_CONFIG[mode];
  const fallback = FALLBACK_CONFIG[mode];
  
  // Handle first-time customer edge case for return mode
  const displayTitle = title || (
    isFirstTimeCustomer 
      ? (t('attendant.skipReturn') || 'Skip Return')
      : (currentInputMode === 'manual' 
          ? (t(config.manualTitleKey) || fallback.manualTitle)
          : (t(config.titleKey) || fallback.title))
  );
  
  const displaySubtitle = subtitle || (
    isFirstTimeCustomer
      ? (t('attendant.firstTimeCustomer') || 'First time customer - no battery to return')
      : (currentInputMode === 'manual'
          ? (t(config.manualSubtitleKey) || fallback.manualSubtitle)
          : (t(config.subtitleKey) || fallback.subtitle))
  );

  const hintText = t(config.hintKey) || fallback.hint;

  return (
    <div className={`battery-input-selector ${className}`}>
      {/* Header with Title and Mode Toggle */}
      <div className="battery-input-header">
        <div className="battery-input-title-section">
          <h1 className="battery-input-title">{displayTitle}</h1>
          <p className="battery-input-subtitle">{displaySubtitle}</p>
        </div>
      </div>

      {/* Mode Toggle */}
      {showModeToggle && !isFirstTimeCustomer && (
        <div className="battery-input-mode-toggle">
          <button
            type="button"
            className={`mode-toggle-btn ${currentInputMode === 'scan' ? 'active' : ''}`}
            onClick={() => handleModeChange('scan')}
            disabled={disabled}
          >
            <QrIcon />
            <span>{t('battery.scanQr') || 'Scan QR'}</span>
          </button>
          <button
            type="button"
            className={`mode-toggle-btn ${currentInputMode === 'manual' ? 'active' : ''}`}
            onClick={() => handleModeChange('manual')}
            disabled={disabled}
          >
            <ListIcon />
            <span>{t('battery.selectManually') || 'Select Manually'}</span>
          </button>
        </div>
      )}

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

      {/* Bluetooth Reminder */}
      <div className="bluetooth-reminder">
        <BluetoothIcon />
        <div className="bluetooth-reminder-content">
          <span className="bluetooth-reminder-title">
            {t('ble.bluetoothRequired') || 'Bluetooth Required'}
          </span>
          <span className="bluetooth-reminder-text">
            {currentInputMode === 'manual'
              ? (t('ble.bluetoothRequiredManual') || 'Make sure Bluetooth is ON to detect nearby batteries')
              : (t('ble.bluetoothRequiredScan') || 'Make sure Bluetooth is ON before scanning')
            }
          </span>
        </div>
      </div>

      {/* Scan Mode Content */}
      {currentInputMode === 'scan' && (
        <div className="battery-input-scan-mode">
          <ScannerArea 
            onClick={onScan} 
            type="battery" 
            disabled={isScannerOpening || disabled}
          />
          
          <p className="battery-input-hint">
            <InfoIcon />
            {hintText}
          </p>
        </div>
      )}

      {/* Manual Mode Content */}
      {currentInputMode === 'manual' && (
        <div className="battery-input-manual-mode">
          <BleDeviceList
            devices={detectedDevices}
            selectedDevice={selectedDeviceMac}
            isScanning={isScanning}
            onSelectDevice={onDeviceSelect}
            onRescan={onStartScan}
            disabled={disabled}
            maxHeight="280px"
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

        .battery-input-mode-toggle {
          display: flex;
          gap: ${spacing[2]};
          padding: ${spacing[1]};
          background: ${colors.bg.tertiary};
          border-radius: ${radius.lg};
          border: 1px solid ${colors.border.default};
        }

        .mode-toggle-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${spacing[2]};
          padding: ${spacing[2.5]} ${spacing[3]};
          font-size: ${fontSize.sm};
          font-weight: ${fontWeight.medium};
          color: ${colors.text.secondary};
          background: transparent;
          border: none;
          border-radius: ${radius.md};
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mode-toggle-btn:hover:not(:disabled) {
          color: ${colors.text.primary};
          background: ${colors.bg.elevated};
        }

        .mode-toggle-btn.active {
          color: ${colors.bg.primary};
          background: ${colors.brand.primary};
        }

        .mode-toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mode-toggle-btn :global(svg) {
          width: 16px;
          height: 16px;
        }

        .bluetooth-reminder {
          display: flex;
          align-items: flex-start;
          gap: ${spacing[3]};
          padding: ${spacing[3]};
          background: ${colors.infoSoft};
          border: 1px solid ${colors.info}40;
          border-radius: ${radius.md};
        }

        .bluetooth-reminder :global(svg) {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          color: ${colors.info};
        }

        .bluetooth-reminder-content {
          display: flex;
          flex-direction: column;
          gap: ${spacing[0.5]};
        }

        .bluetooth-reminder-title {
          font-size: ${fontSize.sm};
          font-weight: ${fontWeight.medium};
          color: ${colors.info};
        }

        .bluetooth-reminder-text {
          font-size: ${fontSize.xs};
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

        .battery-input-scan-mode {
          display: flex;
          flex-direction: column;
          gap: ${spacing[4]};
        }

        .battery-input-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${spacing[2]};
          margin: 0;
          font-size: ${fontSize.sm};
          color: ${colors.text.muted};
        }

        .battery-input-hint :global(svg) {
          width: 14px;
          height: 14px;
        }

        .battery-input-manual-mode {
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

function QrIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function ListIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
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
    >
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
    </svg>
  );
}

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
