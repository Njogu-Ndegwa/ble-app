import React from 'react';
import { Device } from '@/app/Device';

interface DeviceTabContentProps {
  activeTab: string;
  device: Device;
}

const DeviceTabContent: React.FC<DeviceTabContentProps> = ({ activeTab, device }) => {
  return (
    <div className="p-4">
      {activeTab === 'ATT' && (
        <div className="space-y-4">
          <DataCard title="FRMV" value={device.firmwareVersion} description="Firmware Version" />
          <DataCard title="OPID" value={device.deviceId} description="OEM Device ID, Factory Set" />
        </div>
      )}

      {activeTab === 'CMD' && <TabPlaceholder text="Command interface will be displayed here" />}
      {activeTab === 'SVC' && <TabPlaceholder text="Service information will be displayed here" />}
      {activeTab === 'DTA' && <TabPlaceholder text="Data metrics will be displayed here" />}
      {activeTab === 'DIA' && <TabPlaceholder text="Diagnostics will be displayed here" />}
    </div>
  );
};

const DataCard: React.FC<{ title: string; value: string; description: string }> = ({ title, value, description }) => (
  <div className="border border-gray-700 rounded-lg overflow-hidden">
    <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
      <span className="text-sm font-medium">{title}</span>
      <button className="text-xs bg-gray-700 px-3 py-1 rounded">Read</button>
    </div>
    <div className="p-4 space-y-2">
      <div>
        <p className="text-xs text-gray-400">Value</p>
        <p className="text-sm">{value}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">{description}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  </div>
);

const TabPlaceholder: React.FC<{ text: string }> = ({ text }) => (
  <div className="p-6 text-center text-gray-400">
    <p>{text}</p>
  </div>
);

export default DeviceTabContent;
