
'use client'

import React, { useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({ device, attributeList, onBack }) => {
  const router = useRouter();

  // Service mapping configuration
  const fixedTabs = [
    { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
    { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
    { id: 'STS', label: 'STS', serviceNameEnum: 'STS_SERVICE' },
    { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
    { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
  ];

  // State management
  const [activeTab, setActiveTab] = useState(fixedTabs[0].id);

  // Get active service data
  const activeService = attributeList.find(service => 
    fixedTabs.find(tab => 
      tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum
    )
  );

  // Handle back navigation
  const handleBack = () => onBack ? onBack() : router.back();

  // Format values based on type
  const formatValue = (characteristic: any) => {
    if (typeof characteristic.realVal === 'number') {
      switch (characteristic.valType) {
        case 0: return characteristic.realVal;
        case 1: return `${characteristic.realVal} mA`;
        case 2: return `${characteristic.realVal} mV`;
        default: return characteristic.realVal;
      }
    }
    return characteristic.realVal || 'N/A';
  };

  // console.log(attributeList, "Attribute List")

  // console.log(activeService, "Attribute Service")

    // Handle read operation
    const handleRead = (uuid: string) => {
      console.log({
        action: 'read',
        uuid,
        macAddress: device.macAddress,
        name: device.name
      });
    };
  
    // Handle write operation
    const handleWrite = (uuid: string) => {
      console.log({
        action: 'write',
        uuid,
        macAddress: device.macAddress,
        name: device.name
      });
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

      {/* Device Image and Info */}
      <div className="flex flex-col items-center p-6 pb-2">
        <img 
          src={device.imageUrl} 
          alt={device.name}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold">{device.name}</h2>
        <p className="text-sm text-gray-400 mt-1">{device.macAddress}</p>
        <p className="text-sm text-gray-400 mt-1">{device.rssi}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex justify-between px-4">
          {fixedTabs.map(tab => {
            const serviceExists = attributeList.some(s => s.serviceNameEnum === tab.serviceNameEnum);
            return (
              <button
                key={tab.id}
                className={`py-3 px-4 text-sm font-medium relative ${
                  activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
                } ${!serviceExists ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => serviceExists && setActiveTab(tab.id)}
                disabled={!serviceExists}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Service Content */}
      {/* Service Content */}
      <div className="p-4">
        {activeService ? (
          <div className="space-y-4">
            {activeService.characteristicList.map((char: any) => (
              <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
                  <span className="text-sm font-medium">{char.name}</span>
                  <div className="flex space-x-2">
                    <button 
                      className="text-xs bg-gray-700 px-3 py-1 rounded hover:bg-gray-600 transition-colors"
                      onClick={() => handleRead(char.uuid)}
                    >
                      Read
                    </button>
                    {activeTab === 'CMD' && (
                      <button 
                        className="text-xs bg-blue-700 px-3 py-1 rounded hover:bg-blue-600 transition-colors"
                        onClick={() => handleWrite(char.uuid)}
                      >
                        Write
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Description</p>
                    <p className="text-sm">{char.desc}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Current Value</p>
                    <p className="text-sm font-mono">{formatValue(char)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400">
            <p>No data available for this service</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailView;