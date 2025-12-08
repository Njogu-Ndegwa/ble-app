'use client';

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { colors, spacing, radius, fontSize, fontWeight } from '@/styles';
import type { BleDevice } from './types';

// Device image mapping based on name patterns
// This should match the itemImageMap used in Keypad and BLE Device Manager pages
// NOTE: No default image - unmapped devices show no image to avoid confusing users
const DEVICE_IMAGE_MAP: Record<string, string> = {
  // Integrated Home Energy Systems
  PPSP: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1739505681/OVES-PRODUCTS/CROSS-GRID/Integrated%20Home%20Energy%20Systems%20-%20Oasis%E2%84%A2%20Series/ovT20-2400W/T20-2400W_efw5mh.png",
  // E-Stove
  STOV: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1738897820/OVES-PRODUCTS/CROSS-GRID/AC-Productive%20Appliances/E-STOVE-BLE-AF/E-STOVE-BLE-AF_Left_side_cvs2wl.png",
  // Inverter
  INVE: "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731914963/OVES-PRODUCTS/CROSS-GRID/xGrid_Inverter_Charger/INVP-48V-6.2KW-HF/INVP-48V-6.2KW-HP_Left_Side_2024-1118_fo0hpr.png",
  // Electric Two-Wheelers
  "E-3P": "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1733295976/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3%20Plus/E-3_L_wspsx8.png",
  "S-6": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1726639186/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/S-6/F_el4vpq.png",
  "E-3": "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1690366674/OVES-PRODUCTS/E-MOBILITY/Electric%20Two-Wheelers/E-3/ovego-e-3-e-3_v2023114_c7mb0q.png",
  // Home Battery Systems
  BATP: "https://res.cloudinary.com/oves/image/upload/t_BLE app 500x500 no background/v1731935040/OVES-PRODUCTS/CROSS-GRID/HOME%20BATTERY%20SYSTEMS/Bat24100P/Bat24100TP_Right_Side_kbqym1.png",
  // ovCamp Battery Hubs
  CAMP: "https://res.cloudinary.com/oves/image/upload/v1627881710/OVES-PRODUCTS/OFF-GRID/ovCAMP%20SERIES/ovCAMP%20SERIES%20APPLIANCES/ovCamp%20Battery%20Hubs/6Ah%20ovCamp%20Hub%20Battery/6AH_W600_NB_uhlc3f.png",
  // LumnHome battery hub
  HOME: "https://res.cloudinary.com/oves/image/upload/v1724910821/OVES-PRODUCTS/OFF-GRID/LUMN-HOME%20SERIES/LUMN-HOME%20SHARED%20COMPONENTS/LumnHome%20battery%20hub/lumn-home-battery-hub_front_NBG_HDR.png",
  // E-Mobility Batteries
  BATT: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
  Batt: "https://res.cloudinary.com/oves/image/upload/t_ovEgo1000x1000/v1731146523/OVES-PRODUCTS/E-MOBILITY/Electric%20Battery%20Solutions/E-Mob-Bat45Ah/E-Mob-Bat45Ah_bxwpf9.png",
  // Unicell Boost Pulsar
  UBP1: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743147157/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-1K/UBP1K_AC_Output_250W_ee1ar3.png",
  UBP2: "https://res.cloudinary.com/oves/image/upload/t_BLE%20APP%20500X500/v1743155669/OVES-PRODUCTS/CROSS-GRID/Unicell%20Boost%20Pulsar/UBP-2K/UBP_2_AC_Output_._ottb1j.png",
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
  /** Hide the internal search input (useful when parent provides search) */
  hideSearch?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Check if a device is a battery based on its name
 * Batteries have "BATT" or "Batt" as the second word in their name
 * Example device names: "OVES BATT 45AH2311000102", "OVES Batt 45AH2311000103"
 */
export function isBatteryDevice(deviceName: string): boolean {
  const nameParts = deviceName.split(' ');
  if (nameParts.length >= 2) {
    const deviceType = nameParts[1].toLowerCase();
    return deviceType === 'batt';
  }
  return false;
}

/**
 * Filter a list of BLE devices to only include batteries
 * @param devices - Array of BLE devices to filter
 * @returns Array of devices that are batteries
 */
export function filterBatteryDevices(devices: BleDevice[]): BleDevice[] {
  return devices.filter(device => isBatteryDevice(device.name));
}

/**
 * Get device image URL based on device name
 * Returns null for unmapped devices (better to show nothing than confuse users)
 */
function getDeviceImage(deviceName: string): string | null {
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
  // Return null for unmapped devices - show nothing rather than confuse users
  return null;
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
 * Extract device model and ID from device name
 * Shows full device name for better identification (matching Keypad behavior)
 */
function extractDeviceDisplay(deviceName: string): { name: string; id: string } {
  // Return full device name like "OVES BATT 45AH2311000102"
  // Also extract the ID portion (last part after spaces)
  const parts = deviceName.split(' ');
  const lastPart = parts.length > 0 ? parts[parts.length - 1] : deviceName;
  return {
    name: deviceName, // Full name like "OVES BATT 45AH2311000102"
    id: lastPart.toUpperCase(), // ID portion like "45AH2311000102"
  };
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
  hideSearch = false,
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

      {/* Search - only show if not hidden by parent and there are enough devices */}
      {!hideSearch && devices.length > 3 && (
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
          const deviceDisplay = extractDeviceDisplay(device.name);
          const isSelected = selectedDevice === device.macAddress;
          const deviceImageUrl = getDeviceImage(device.name);

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
              {/* Device Image - only show if we have a mapped image */}
              {deviceImageUrl && (
                <div className="ble-device-image-container">
                  <img
                    src={deviceImageUrl}
                    alt={device.name}
                    className="ble-device-image"
                    onError={(e) => {
                      // Hide the container if image fails to load
                      (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Device Info */}
              <div className="ble-device-info">
                <div className="ble-device-name font-mono-oves">{deviceDisplay.name}</div>
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

        .ble-device-name {
          font-size: ${fontSize.sm};
          font-weight: ${fontWeight.semibold};
          color: ${colors.text.primary};
          margin-bottom: ${spacing[1]};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
