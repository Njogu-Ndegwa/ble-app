'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  Camera,
  RefreshCcw,
  ArrowUpDown,
  ListFilter,
  BluetoothSearching,
  BluetoothConnected,
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
  <div className="list-card animate-pulse">
    <div className="list-card-body list-card-body--with-avatar">
      <div className="w-12 h-12 rounded-lg flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }} />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 rounded w-2/3" style={{ background: 'var(--bg-tertiary)' }} />
        <div className="h-3 rounded w-1/2" style={{ background: 'var(--bg-tertiary)' }} />
      </div>
      <div className="w-5 h-5 rounded-full" style={{ background: 'var(--bg-tertiary)' }} />
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

  // Filter items based on search query
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

  // Generate skeleton loaders
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
          <input
            type="text"
            className="form-input"
            style={{ paddingRight: 80 }}
            placeholder={t('Search devices...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onScanQrCode();
              }}
            >
              <Camera size={18} style={{ color: 'var(--text-secondary)' }} className="hover:opacity-80 transition-opacity" />
            </div>
            <Search className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </div>
        </div>

        {/* Sort and Filter */}
        {/* <div className="flex gap-2 mb-4">
          <button
            className="flex-1 px-4 py-2 border border-border rounded-lg text-text-primary text-sm flex items-center justify-between bg-bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            {t('Sort by...')}
            <span className="text-xs">
              <ArrowUpDown />
            </span>
          </button>
          <button
            className="flex-1 px-4 py-2 border border-border rounded-lg text-text-primary text-sm flex items-center justify-between bg-bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            {t('Filter')}
            <span className="text-lg">
              <ListFilter />
            </span>
          </button>
        </div> */}

        {/* List Items or Skeleton Loaders */}
        <div className="space-y-2">
          {items.length === 0 && isScanning ? (
            renderSkeletons()
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isConnected = item.macAddress === connectedDevice;
              return (
                <div
                  key={item.macAddress}
                  className="list-card"
                  onClick={() => handleDeviceClick(item.macAddress)}
                >
                  <div className="list-card-body list-card-body--with-avatar">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="list-card-image"
                    />
                    <div className="list-card-content">
                      <div className="list-card-primary">{item.name}</div>
                      <div className="list-card-meta">
                        <span className="list-card-meta-mono">{item.macAddress}</span>
                        <span className="list-card-dot">&middot;</span>
                        <span>{item.rssi}</span>
                      </div>
                    </div>
                    <div className={`list-card-device-status ${isConnected ? 'list-card-device-status--connected' : ''}`}>
                      {isConnected ? (
                        <BluetoothConnected size={20} />
                      ) : (
                        <BluetoothSearching size={20} />
                      )}
                    </div>
                  </div>
                </div>
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