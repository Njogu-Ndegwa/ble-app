'use client';

import React, { useState } from 'react';
import {
  Search,
  X,
  Camera,
  RefreshCcw,
  BluetoothSearching,
} from 'lucide-react';
import { BleDevice } from './page';
import { useI18n } from '@/i18n';

interface MobileListViewProps {
  items: BleDevice[];
  onStartConnection: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
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

const MobileListView: React.FC<MobileListViewProps> = ({
  items,
  onStartConnection,
  connectedDevice,
  onScanQrCode,
  onRescanBleItems,
  isScanning,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeviceClick = async (macAddress: string) => {
    onStartConnection(macAddress);
  };

  const handleRescan = () => {
    onRescanBleItems();
  };

  const renderSkeletons = () => {
    return Array(5).fill(0).map((_, index) => (
      <DeviceItemSkeleton key={`skeleton-${index}`} />
    ));
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
      <div className="p-4 max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-center flex-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('All Devices')}</h2>
          </div>
          <div className="relative">
            <div
              onClick={handleRescan}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                items.length === 0 && isScanning ? 'animate-spin' : ''
              }`}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <RefreshCcw size={16} />
            </div>
          </div>
        </div>

        {/* Search Bar */}
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
            style={{ paddingRight: '5rem' }}
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

        {/* List Items or Skeleton Loaders */}
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
                  onClick={() => handleDeviceClick(item.macAddress)}
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
            <div className="text-center py-6" style={{ color: 'var(--text-secondary)' }}>
              {searchQuery ? t('No devices match your search.') : t('No devices found. Try scanning again.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileListView;
