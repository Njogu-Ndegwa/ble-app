import React from 'react';
import { Device } from '@/app/Device';
interface DeviceInfoProps {
  device: Device;
}

const DeviceInfo: React.FC<DeviceInfoProps> = ({ device }) => {
  return (
    <div className="flex flex-col items-center p-6 pb-2">
      <div className="relative mb-4">
        <img src={device.imageUrl} alt={device.title} className="w-40 h-40 object-contain" />
      </div>
      <h2 className="text-xl font-semibold">{device.title}</h2>
      <p className="text-sm text-gray-400 mt-1">{device.subtitle}</p>
    </div>
  );
};

export default DeviceInfo;
