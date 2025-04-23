'use client'

import React from 'react';
import { BluetoothSearching, BluetoothConnected } from 'lucide-react';
import { BleDevice } from '@/app/page'; // Adjust this import based on your file structure

interface DeviceItemProps {
  device: BleDevice;
  isConnected: boolean;
  onClick: (macAddress: string) => void;
}

const DeviceItem: React.FC<DeviceItemProps> = ({ device, isConnected, onClick }) => {
  return (
    <div
      className="flex items-start p-3 rounded-lg bg-[#2A2F33] cursor-pointer hover:bg-[#343a40] transition-colors"
      onClick={() => onClick(device.macAddress)}
    >
      <img
        src={device.imageUrl}
        alt={device.name}
        className="w-12 h-12 rounded-full mr-3"
      />
      <div className="flex-1">
        <h3 className="text-[14px] font-medium text-white">{device.name}</h3>
        <p className="text-[10px] text-gray-400">{device.macAddress}</p>
        <p className="text-[10px] text-gray-500 mt-1">{device.rssi}</p>
      </div>
      <span className="text-lg">
        {isConnected ? (
          <BluetoothConnected className="text-blue-500" />
        ) : (
          <BluetoothSearching className="text-gray-400" />
        )}
      </span>
    </div>
  );
};

export default DeviceItem;