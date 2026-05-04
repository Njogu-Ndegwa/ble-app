'use client';

import React, { useState } from 'react';
import {
  Search,
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

const SkeletonBar: React.FC<{ width: string; height: number }> = ({ width, height }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 4,
      background: 'var(--bg-tertiary)',
    }}
  />
);

const DeviceItemSkeleton = () => (
  <div className="list-card animate-pulse">
    <div className="list-card-body list-card-body--with-avatar">
      <div
        className="list-card-image flex-shrink-0"
        style={{ background: 'var(--bg-tertiary)' }}
      />
      <div className="list-card-content">
        <SkeletonBar width="65%" height={16} />
        <SkeletonBar width="50%" height={13} />
        <SkeletonBar width="35%" height={11} />
      </div>
      <div className="list-card-actions">
        <SkeletonBar width="64px" height={20} />
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
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="p-4 max-w-md mx-auto">
        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            className="form-input"
            style={{ paddingRight: 100 }}
            placeholder={t('Search devices...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRescan();
              }}
              className={`transition-colors ${items.length === 0 && isScanning ? 'animate-spin' : ''}`}
              aria-label={t('Rescan')}
              style={{ color: 'var(--text-secondary)' }}
            >
              <RefreshCcw size={16} className="hover:opacity-80 transition-opacity" />
            </button>
            <button
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onScanQrCode();
              }}
              aria-label={t('Scan QR code')}
            >
              <Camera size={18} style={{ color: 'var(--text-secondary)' }} className="hover:opacity-80 transition-opacity" />
            </button>
            <Search className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
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
