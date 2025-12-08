'use client';

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { colors, spacing, radius, fontSize, fontWeight } from '@/styles';
import type { BleDevice } from './types';

// Default battery image for detected devices
const DEFAULT_BATTERY_IMAGE = 'https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png';

// Device image mapping based on name patterns
const DEVICE_IMAGE_MAP: Record<string, string> = {
  'BATT': 'https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png',
  'Batt': 'https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png',
  'BATP': 'https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731935040/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Right_Side_kbqym1.png',
};

interface BleDeviceListProps {
  /** List of detected BLE devices */
  devices: BleDevice[];
  /** Currently selected device MAC address */
  selectedDevice?: string | null;
  /** Whether scanning is in progress */
  isScanning?: boolean;
  /** Callback when a device is selected for connection */
  onSelectDevice: (device: BleDevice) => void;
  /** Callback to rescan for devices */
  onRescan?: () => void;
  /** Title for the list */
  title?: string;
  /** Subtitle for the list */
  subtitle?: string;
  /** Maximum height of the list (scrollable) */
  maxHeight?: string;
  /** Whether the list is disabled */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Get device image URL based on device name
 */
function getDeviceImage(deviceName: string): string {
  const nameParts = deviceName.split(' ');
  if (nameParts.length >= 2) {
    const keyword = nameParts[1];
    const mapKey = Object.keys(DEVICE_IMAGE_MAP).find(
      k => k.toLowerCase() === keyword.toLowerCase()
    );
    if (mapKey) {
      return DEVICE_IMAGE_MAP[mapKey];
    }
  }
  return DEFAULT_BATTERY_IMAGE;
}

/**
 * Get signal strength indicator based on RSSI
 */
function getSignalStrength(rawRssi: number): { level: 'excellent' | 'good' | 'fair' | 'weak'; bars: number } {
  if (rawRssi >= -50) return { level: 'excellent', bars: 4 };
  if (rawRssi >= -70) return { level: 'good', bars: 3 };
  if (rawRssi >= -85) return { level: 'fair', bars: 2 };
  return { level: 'weak', bars: 1 };
}

/**
 * Extract device ID from device name (typically last 6 characters)
 */
function extractDeviceId(deviceName: string): string {
  // Try to extract the ID from the name (e.g., "OVES BATT 45AH12345" -> "12345")
  const parts = deviceName.split(' ');
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    // Return last 6 chars if it looks like an ID
    return lastPart.length >= 6 ? lastPart.slice(-6).toUpperCase() : lastPart.toUpperCase();
  }
  return deviceName.slice(-6).toUpperCase();
}

/**
 * Device Item Skeleton for loading state
 */
function DeviceItemSkeleton() {
  return (
    <div className="ble-device-item ble-device-skeleton">
      <div className="ble-device-image-skeleton" />
      <div className="ble-device-info-skeleton">
        <div className="skeleton-line skeleton-id" />
        <div className="skeleton-line skeleton-mac" />
        <div className="skeleton-line skeleton-rssi" />
      </div>
    </div>
  );
}

/**
 * Signal Bars Component
 */
function SignalBars({ bars, level }: { bars: number; level: string }) {
  return (
    <div className={`signal-bars signal-${level}`}>
      {[1, 2, 3, 4].map((bar) => (
        <div 
          key={bar} 
          className={`signal-bar ${bar <= bars ? 'active' : ''}`}
          style={{ height: `${bar * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

/**
 * BleDeviceList - Reusable component to display detected BLE devices
 * 
 * Shows nearby devices with:
 * - Device image (based on device type)
 * - Device ID (extracted from name)
 * - MAC address
 * - Signal strength (RSSI with visual indicator)
 * 
 * Used for manual device selection as an alternative to QR scan.
 * 
 * @example
 * <BleDeviceList
 *   devices={detectedDevices}
 *   isScanning={isScanning}
 *   onSelectDevice={(device) => connectToDevice(device.macAddress)}
 *   onRescan={() => startBleScan()}
 * />
 */
export default function BleDeviceList({
  devices,
  selectedDevice,
  isScanning = false,
  onSelectDevice,
  onRescan,
  title,
  subtitle,
  maxHeight = '300px',
  disabled = false,
  className = '',
}: BleDeviceListProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter devices based on search query
  const filteredDevices = devices.filter((device) => {
    const query = searchQuery.toLowerCase();
    return (
      device.name.toLowerCase().includes(query) ||
      device.macAddress.toLowerCase().includes(query)
    );
  });

  // Sort by signal strength (closest first)
  const sortedDevices = [...filteredDevices].sort((a, b) => b.rawRssi - a.rawRssi);

  const handleDeviceClick = (device: BleDevice) => {
    if (!disabled) {
      onSelectDevice(device);
    }
  };

  return (
    <div className={`ble-device-list ${className}`}>
      {/* Header */}
      <div className="ble-device-list-header">
        <div className="ble-device-list-title-section">
          <h3 className="ble-device-list-title">
            {title || t('ble.nearbyDevices') || 'Nearby Devices'}
          </h3>
          {subtitle && (
            <p className="ble-device-list-subtitle">{subtitle}</p>
          )}
        </div>
        {onRescan && (
          <button
            type="button"
            className={`ble-rescan-btn ${isScanning ? 'scanning' : ''}`}
            onClick={onRescan}
            disabled={isScanning || disabled}
            aria-label={t('ble.rescan') || 'Rescan'}
          >
            <RefreshIcon />
          </button>
        )}
      </div>

      {/* Search */}
      {devices.length > 3 && (
        <div className="ble-device-search">
          <SearchIcon />
          <input
            type="text"
            placeholder={t('ble.searchDevices') || 'Search by ID or MAC...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ble-device-search-input"
            disabled={disabled}
          />
        </div>
      )}

      {/* Device List */}
      <div 
        className="ble-device-list-items"
        style={{ maxHeight }}
      >
        {/* Loading State */}
        {isScanning && devices.length === 0 && (
          <>
            <DeviceItemSkeleton />
            <DeviceItemSkeleton />
            <DeviceItemSkeleton />
          </>
        )}

        {/* Empty State */}
        {!isScanning && devices.length === 0 && (
          <div className="ble-device-empty">
            <BluetoothIcon />
            <p>{t('ble.noDevicesFound') || 'No devices found nearby'}</p>
            <span className="ble-device-empty-hint">
              {t('ble.noDevicesHint') || 'Make sure the battery is powered on and Bluetooth is enabled'}
            </span>
          </div>
        )}

        {/* No Results */}
        {devices.length > 0 && sortedDevices.length === 0 && (
          <div className="ble-device-empty">
            <SearchIcon />
            <p>{t('ble.noMatchingDevices') || 'No devices match your search'}</p>
          </div>
        )}

        {/* Device Items */}
        {sortedDevices.map((device) => {
          const signal = getSignalStrength(device.rawRssi);
          const deviceId = extractDeviceId(device.name);
          const isSelected = selectedDevice === device.macAddress;

          return (
            <div
              key={device.macAddress}
              className={`ble-device-item ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => handleDeviceClick(device)}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDeviceClick(device);
                }
              }}
            >
              {/* Device Image */}
              <div className="ble-device-image-container">
                <img
                  src={getDeviceImage(device.name)}
                  alt={device.name}
                  className="ble-device-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_BATTERY_IMAGE;
                  }}
                />
              </div>

              {/* Device Info */}
              <div className="ble-device-info">
                <div className="ble-device-id">
                  <span className="ble-device-id-label">ID:</span>
                  <span className="ble-device-id-value font-mono-oves">{deviceId}</span>
                </div>
                <div className="ble-device-mac font-mono-oves">
                  {device.macAddress}
                </div>
                <div className="ble-device-rssi">
                  <span className="ble-device-rssi-value">{device.rssi}</span>
                </div>
              </div>

              {/* Signal Indicator */}
              <div className="ble-device-signal">
                <SignalBars bars={signal.bars} level={signal.level} />
                {isSelected && (
                  <div className="ble-device-selected-badge">
                    <CheckIcon />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Scanning Indicator */}
        {isScanning && devices.length > 0 && (
          <div className="ble-scanning-indicator">
            <div className="ble-scanning-dot" />
            <span>{t('ble.scanning') || 'Scanning for more devices...'}</span>
          </div>
        )}
      </div>

      {/* Count */}
      {devices.length > 0 && (
        <div className="ble-device-count">
          {sortedDevices.length} {sortedDevices.length === 1 
            ? (t('ble.deviceFound') || 'device found')
            : (t('ble.devicesFound') || 'devices found')
          }
        </div>
      )}

      <style jsx>{`
        .ble-device-list {
          display: flex;
          flex-direction: column;
          gap: ${spacing[3]};
        }

        .ble-device-list-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .ble-device-list-title-section {
          flex: 1;
        }

        .ble-device-list-title {
          margin: 0;
          font-size: ${fontSize.lg};
          font-weight: ${fontWeight.semibold};
          color: ${colors.text.primary};
        }

        .ble-device-list-subtitle {
          margin: ${spacing[1]} 0 0;
          font-size: ${fontSize.sm};
          color: ${colors.text.secondary};
        }

        .ble-rescan-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          padding: 0;
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.md};
          background: ${colors.bg.tertiary};
          color: ${colors.text.secondary};
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ble-rescan-btn:hover:not(:disabled) {
          background: ${colors.bg.elevated};
          color: ${colors.brand.primary};
          border-color: ${colors.brand.primary};
        }

        .ble-rescan-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ble-rescan-btn.scanning :global(svg) {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .ble-device-search {
          position: relative;
          display: flex;
          align-items: center;
        }

        .ble-device-search :global(svg) {
          position: absolute;
          left: ${spacing[3]};
          width: 16px;
          height: 16px;
          color: ${colors.text.muted};
        }

        .ble-device-search-input {
          width: 100%;
          padding: ${spacing[2]} ${spacing[3]} ${spacing[2]} ${spacing[10]};
          font-size: ${fontSize.sm};
          color: ${colors.text.primary};
          background: ${colors.bg.tertiary};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.md};
          outline: none;
          transition: border-color 0.2s;
        }

        .ble-device-search-input:focus {
          border-color: ${colors.brand.primary};
        }

        .ble-device-search-input::placeholder {
          color: ${colors.text.muted};
        }

        .ble-device-list-items {
          display: flex;
          flex-direction: column;
          gap: ${spacing[2]};
          overflow-y: auto;
          padding-right: ${spacing[1]};
        }

        .ble-device-item {
          display: flex;
          align-items: center;
          gap: ${spacing[3]};
          padding: ${spacing[3]};
          background: ${colors.bg.tertiary};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ble-device-item:hover:not(.disabled) {
          background: ${colors.bg.elevated};
          border-color: ${colors.brand.primary}40;
        }

        .ble-device-item.selected {
          background: ${colors.brand.primary}15;
          border-color: ${colors.brand.primary};
        }

        .ble-device-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ble-device-image-container {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: ${radius.md};
          background: ${colors.bg.secondary};
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ble-device-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .ble-device-info {
          flex: 1;
          min-width: 0;
        }

        .ble-device-id {
          display: flex;
          align-items: center;
          gap: ${spacing[1]};
          margin-bottom: ${spacing[1]};
        }

        .ble-device-id-label {
          font-size: ${fontSize.xs};
          color: ${colors.text.muted};
        }

        .ble-device-id-value {
          font-size: ${fontSize.base};
          font-weight: ${fontWeight.semibold};
          color: ${colors.text.primary};
        }

        .ble-device-mac {
          font-size: ${fontSize.xs};
          color: ${colors.text.secondary};
          margin-bottom: ${spacing[1]};
        }

        .ble-device-rssi {
          font-size: ${fontSize['2xs']};
          color: ${colors.text.muted};
        }

        .ble-device-signal {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: ${spacing[1]};
        }

        .signal-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 20px;
        }

        .signal-bar {
          width: 4px;
          background: ${colors.border.default};
          border-radius: 1px;
          transition: background 0.2s;
        }

        .signal-bar.active {
          background: ${colors.text.muted};
        }

        .signal-excellent .signal-bar.active {
          background: ${colors.success};
        }

        .signal-good .signal-bar.active {
          background: ${colors.successLight};
        }

        .signal-fair .signal-bar.active {
          background: ${colors.warning};
        }

        .signal-weak .signal-bar.active {
          background: ${colors.error};
        }

        .ble-device-selected-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: ${radius.full};
          background: ${colors.brand.primary};
          color: ${colors.bg.primary};
        }

        .ble-device-selected-badge :global(svg) {
          width: 12px;
          height: 12px;
        }

        .ble-device-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: ${spacing[8]} ${spacing[4]};
          color: ${colors.text.muted};
          text-align: center;
        }

        .ble-device-empty :global(svg) {
          width: 48px;
          height: 48px;
          margin-bottom: ${spacing[3]};
          opacity: 0.5;
        }

        .ble-device-empty p {
          margin: 0;
          font-size: ${fontSize.base};
          color: ${colors.text.secondary};
        }

        .ble-device-empty-hint {
          display: block;
          margin-top: ${spacing[2]};
          font-size: ${fontSize.xs};
        }

        .ble-device-skeleton {
          pointer-events: none;
        }

        .ble-device-image-skeleton {
          width: 48px;
          height: 48px;
          border-radius: ${radius.md};
          background: ${colors.bg.elevated};
          animation: pulse 1.5s infinite;
        }

        .ble-device-info-skeleton {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: ${spacing[2]};
        }

        .skeleton-line {
          height: 12px;
          border-radius: ${radius.sm};
          background: ${colors.bg.elevated};
          animation: pulse 1.5s infinite;
        }

        .skeleton-id {
          width: 60%;
        }

        .skeleton-mac {
          width: 80%;
        }

        .skeleton-rssi {
          width: 40%;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        .ble-scanning-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${spacing[2]};
          padding: ${spacing[2]};
          font-size: ${fontSize.xs};
          color: ${colors.text.muted};
        }

        .ble-scanning-dot {
          width: 8px;
          height: 8px;
          border-radius: ${radius.full};
          background: ${colors.brand.primary};
          animation: pulse 1s infinite;
        }

        .ble-device-count {
          font-size: ${fontSize.xs};
          color: ${colors.text.muted};
          text-align: center;
        }
      `}</style>
    </div>
  );
}

// ============================================
// ICON COMPONENTS
// ============================================

function RefreshIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="18"
      height="18"
    >
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
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
      width="16"
      height="16"
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
      width="48"
      height="48"
    >
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      width="12"
      height="12"
    >
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
