'use client'

import React, { useState } from 'react';
import { ArrowLeft, Battery, Download, Bluetooth, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DeviceDetailProps {
  device?: {
    id: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    firmwareVersion: string;
    deviceId: string;
  };
  onBack?: () => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({ 
  device = {
    id: '1',
    title: 'HESS-Bat242004',
    subtitle: '82:05:10:00:A9:48',
    imageUrl: 'https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png',
    firmwareVersion: '1.4.7',
    deviceId: 'VCUA2404:0019'
  }, 
  onBack 
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ATT');
  
  const tabs = [
    { id: 'ATT', label: 'ATT' },
    { id: 'CMD', label: 'CMD' },
    { id: 'SVC', label: 'SVC' },
    { id: 'DTA', label: 'DTA' },
    { id: 'DIA', label: 'DIA' },
  ];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      {/* Header */}
      <div className="p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Device Details</h1>
        <Share2 className="w-5 h-5 text-gray-400" />
      </div>

      {/* Device Image and Basic Info */}
      <div className="flex flex-col items-center p-6 pb-2">
        <div className="relative mb-4">
          <img 
            src={device.imageUrl} 
            alt={device.title}
            className="w-40 h-40 object-contain"
          />
        </div>
        <h2 className="text-xl font-semibold">{device.title}</h2>
        <p className="text-sm text-gray-400 mt-1">{device.subtitle}</p>

      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex justify-between px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`py-3 px-4 text-sm font-medium relative ${
                activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="p-4">
        {activeTab === 'ATT' && (
          <div className="space-y-4">
            {/* FRMV Section */}
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
                <span className="text-sm font-medium">FRMV</span>
                <button className="text-xs bg-gray-700 px-3 py-1 rounded">Read</button>
              </div>
              <div className="p-4 space-y-2">
                <div>
                  <p className="text-xs text-gray-400">Value</p>
                  <p className="text-sm">{device.firmwareVersion}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Firmware Version</p>
                  <p className="text-sm">{device.firmwareVersion}</p>
                </div>
              </div>
            </div>

            {/* OEM Device ID Section */}
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
                <span className="text-sm font-medium">OPID</span>
                <button className="text-xs bg-gray-700 px-3 py-1 rounded">Read</button>
              </div>
              <div className="p-4 space-y-2">
                <div>
                  <p className="text-xs text-gray-400">Value</p>
                  <p className="text-sm">{device.deviceId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">OEM Device ID, Factory Set</p>
                  <p className="text-sm">{device.deviceId}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'CMD' && (
          <div className="p-6 text-center text-gray-400">
            <p>Command interface will be displayed here</p>
          </div>
        )}

        {activeTab === 'SVC' && (
          <div className="p-6 text-center text-gray-400">
            <p>Service information will be displayed here</p>
          </div>
        )}

        {activeTab === 'DTA' && (
          <div className="p-6 text-center text-gray-400">
            <p>Data metrics will be displayed here</p>
          </div>
        )}

        {activeTab === 'DIA' && (
          <div className="p-6 text-center text-gray-400">
            <p>Diagnostics will be displayed here</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default DeviceDetailView;