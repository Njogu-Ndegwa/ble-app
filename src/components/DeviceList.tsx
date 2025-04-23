'use client'

import React from 'react';
import { BleDevice } from '@/app/page'; // Adjust this import based on your file structure
import DeviceItem from './DeviceItem';
import DeviceItemSkeleton from '@/components/DeviceItemSkeleton'; // We'll assume this is moved to its own file

interface DeviceListProps {
  items: BleDevice[];
  filteredItems: BleDevice[];
  connectedDevice: string | null;
  onDeviceClick: (macAddress: string) => void;
  isScanning: boolean;
  searchQuery: string;
}

const DeviceList: React.FC<DeviceListProps> = ({
  items,
  filteredItems,
  connectedDevice,
  onDeviceClick,
  isScanning,
  searchQuery
}) => {
  // Generate skeleton loaders
  const renderSkeletons = () => {
    return Array(5).fill(0).map((_, index) => (
      <DeviceItemSkeleton key={`skeleton-${index}`} />
    ));
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && isScanning ? (
        renderSkeletons()
      ) : filteredItems.length > 0 ? (
        filteredItems.map((item) => (
          <DeviceItem
            key={item.macAddress}
            device={item}
            isConnected={item.macAddress === connectedDevice}
            onClick={onDeviceClick}
          />
        ))
      ) : (
        <div className="text-center py-6 text-gray-400">
          {searchQuery ? "No devices match your search." : "No devices found. Try scanning again."}
        </div>
      )}
    </div>
  );
};

export default DeviceList;