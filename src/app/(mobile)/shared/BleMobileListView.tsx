'use client';

import React, { useState } from 'react';
import { Search, X, Camera, RefreshCcw, BluetoothSearching } from 'lucide-react';
import { useI18n } from '@/i18n';

export interface BleDeviceItem {
  macAddress: string;
  name: string;
  rssi: string;
  rawRssi: number;
  imageUrl?: string;
  firmwareVersion?: string;
  deviceId?: string;
}

interface BleMobileListViewProps {
  items: BleDeviceItem[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
  /** Section title shown above the search bar (e.g. "All Devices", "My Devices", "Keypad") */
  title?: string;
}

const DeviceItemSkeleton = () => (
  <div className="rounded-xl border border-border bg-bg-tertiary p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-border/50 flex-shrink-0" />
      <div className="flex-1">
        <div className="h-4 w-3/5 bg-border/50 rounded mb-2" />
        <div className="h-3 w-4/5 bg-border/50 rounded" />
      </div>
    </div>
  </div>
);

const BleMobileListView: React.FC<BleMobileListViewProps> = ({
  items,
  onStartConnection,
  connectedDevice,
  onScanQrCode,
  onRescanBleItems,
  isScanning,
  title,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.macAddress.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderSkeletons = () =>
    Array(5)
      .fill(0)
      .map((_, i) => <DeviceItemSkeleton key={`sk-${i}`} />);

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="p-4 max-w-md mx-auto">

        {/* Optional section title + rescan button */}
        {title && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <button
              onClick={onRescanBleItems}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                items.length === 0 && isScanning ? 'animate-spin' : ''
              }`}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              aria-label={t('Rescan')}
            >
              <RefreshCcw size={15} />
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={16} className="text-text-muted" />
          </div>
          <input
            type="text"
            placeholder={t('Search devices...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 py-2.5 rounded-xl border border-border bg-bg-tertiary text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            style={{ paddingRight: title ? '5rem' : '7rem' }}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="flex items-center justify-center"
                aria-label="Clear search"
              >
                <X size={14} className="text-text-muted hover:text-text-primary" />
              </button>
            )}
            {/* Rescan — shown inline with search when there is no title row */}
            {!title && (
              <button
                type="button"
                onClick={onRescanBleItems}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                  items.length === 0 && isScanning ? 'animate-spin' : ''
                }`}
                style={{ color: 'var(--text-secondary)' }}
                aria-label={t('Rescan')}
              >
                <RefreshCcw size={15} />
              </button>
            )}
            {/* QR scan — always shown */}
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95"
              style={{ background: 'var(--color-brand)', color: 'white' }}
              onClick={(e) => {
                e.stopPropagation();
                onScanQrCode();
              }}
              aria-label="Scan QR Code"
            >
              <Camera size={16} />
            </button>
          </div>
        </div>

        {/* Device list */}
        <div className="space-y-2">
          {items.length === 0 && isScanning ? (
            renderSkeletons()
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isConnected = item.macAddress === connectedDevice;
              return (
                <button
                  key={item.macAddress}
                  className="list-card w-full text-left"
                  onClick={() => onStartConnection(item.macAddress)}
                >
                  <div className="list-card-body list-card-body--with-avatar">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="list-card-image"
                      />
                    ) : (
                      <div
                        className="list-card-image flex items-center justify-center"
                        style={{ background: 'var(--bg-tertiary)' }}
                      >
                        <BluetoothSearching size={18} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    <div className="list-card-content">
                      <div className="list-card-primary">{item.name}</div>
                      <div className="list-card-secondary list-card-meta-mono">
                        {item.macAddress}
                      </div>
                      <div className="list-card-meta">
                        <span>{item.rssi}</span>
                      </div>
                    </div>
                    <div className="list-card-actions">
                      {isConnected && (
                        <span className="list-card-badge list-card-badge--info">
                          {t('ble.connectedBadge') || 'Connected'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              {searchQuery
                ? t('No devices match your search.')
                : t('No devices found. Try scanning again.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BleMobileListView;
