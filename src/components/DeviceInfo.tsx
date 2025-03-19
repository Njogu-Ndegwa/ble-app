import React from 'react';

interface DeviceInfoProps {
  device: {
    name: string;
    macAddress: string;
    rssi: string;
    imageUrl?: string;
  };
}

export const DeviceInfo: React.FC<DeviceInfoProps> = ({ device }) => {
  return (
    <div className="flex flex-col items-center p-6 pb-2">
      <img
        src={device.imageUrl}
        alt={device.name || "Device"}
        className="w-40 h-40 object-contain mb-4"
      />
      <h2 className="text-xl font-semibold">{device.name || "Unknown"}</h2>
      <p className="text-sm text-gray-400 mt-1">{device.macAddress || "Unknown"}</p>
      <p className="text-sm text-gray-400 mt-1">{device.rssi || "Unknown"}</p>
    </div>
  );
};
export default DeviceInfo;
