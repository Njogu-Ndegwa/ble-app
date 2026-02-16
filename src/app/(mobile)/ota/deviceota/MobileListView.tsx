'use client';

import React, { useState } from 'react';
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
  onDeviceSelect: (macAddress: string) => void;
  connectedDevice: string | null;
  onScanQrCode: () => void;
  onRescanBleItems: () => void;
  isScanning: boolean;
}

const DeviceItemSkeleton = () => (
  <div className="flex items-start p-3 rounded-lg bg-bg-tertiary animate-pulse">
    <div className="w-12 h-12 rounded-full mr-3 bg-bg-elevated"></div>
    <div className="flex-1">
      <div className="h-4 bg-bg-elevated rounded w-2/3 mb-2"></div>
      <div className="h-3 bg-bg-elevated rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-bg-elevated rounded w-1/3"></div>
    </div>
    <div className="w-5 h-5 rounded-full bg-bg-elevated"></div>
  </div>
);

const MobileListView: React.FC<MobileListViewProps> = ({
  items,
  onDeviceSelect,
  connectedDevice,
  onScanQrCode,
  onRescanBleItems,
  isScanning,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.macAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeviceClick = (macAddress: string) => {
    onDeviceSelect(macAddress);
  };

  const handleRescan = () => {
    onRescanBleItems();
  };

  const renderSkeletons = () => {
    return Array(5)
      .fill(0)
      .map((_, index) => <DeviceItemSkeleton key={`skeleton-${index}`} />);
  };

  return (
    <div className="relative max-w-md mx-auto bg-gradient-page min-h-screen overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-center flex-1">
            <h2 className="text-text-primary font-medium">{t('Bluetooth OTA')}</h2>
          </div>
          <div className="relative">
            <RefreshCcw
              onClick={handleRescan}
              className={`w-6 h-6 text-text-secondary ${items.length === 0 && isScanning ? 'animate-spin' : ''}`}
            />
          </div>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            className="w-full px-4 py-2 border border-border bg-bg-secondary rounded-lg pr-20 focus:outline-none text-text-primary"
            placeholder={t('Search devices...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-2.5 flex items-center space-x-3">
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onScanQrCode();
              }}
            >
              <Camera size={18} className="text-text-secondary hover:text-text-primary transition-colors" />
            </div>
            <Search className="w-5 h-5 text-text-secondary" />
          </div>
        </div>

        <div className="flex gap-2 mb-4">
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
        </div>

        <div className="space-y-3">
          {items.length === 0 && isScanning ? (
            renderSkeletons()
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item.macAddress}
                className="flex items-start p-3 rounded-lg bg-bg-tertiary cursor-pointer hover:bg-bg-elevated transition-colors"
                onClick={() => handleDeviceClick(item.macAddress)}
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-12 h-12 rounded-full mr-3"
                />
                <div className="flex-1">
                  <h3 className="text-[14px] font-medium text-text-primary">{item.name}</h3>
                  <p className="text-[10px] text-text-secondary">{item.macAddress}</p>
                  <p className="text-[10px] text-text-muted mt-1">{item.rssi}</p>
                </div>
                <span className="text-lg">
                  {item.macAddress === connectedDevice ? (
                    <BluetoothConnected className="text-blue-500" />
                  ) : (
                    <BluetoothSearching className="text-text-secondary" />
                  )}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-text-secondary">
              {searchQuery ? t('No devices match your search.') : t('No devices found. Try scanning again.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileListView;