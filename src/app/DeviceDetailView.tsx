// DeviceDetailView.tsx
'use client'

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from './utils';
import { Toaster, toast } from 'react-hot-toast';
import { AsciiStringModal, NumericModal } from './modals';
import { Clipboard } from "lucide-react";
import DeviceHeader from '@/components/DeviceHeader';
import ServiceTabs from '@/components/ServiceTabs';
import CharacteristicCard from '@/components/CharacteristicCard';

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
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  
  const fixedTabs = [
    { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
    { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
    { id: 'STS', label: 'STS', serviceNameEnum: 'STS_SERVICE' },
    { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
    { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
  ];

  const [activeTab, setActiveTab] = useState(fixedTabs[0].id);

  const activeService = attributeList.find(service =>
    fixedTabs.find(tab => tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum)
  );

  const handleBack = () => onBack ? onBack() : router.back();

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

  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    setLoadingStates(prev => ({ ...prev, [characteristicUuid]: true }));

    readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
      setLoadingStates(prev => ({ ...prev, [characteristicUuid]: false }));

      if (data) {
        toast.success(`${name} read successfully`);
        setUpdatedValues(prev => ({
          ...prev,
          [characteristicUuid]: data.realVal
        }));
      } else {
        toast.error(`Failed to read ${name}`);
      }
    });
  };

  const handleWriteClick = (characteristic: any) => {
    setActiveCharacteristic(characteristic);
    if (characteristic.name.toLowerCase().includes('pubk')) {
      setAsciiModalOpen(true);
    } else {
      setNumericModalOpen(true);
    }
  };

  const handleWrite = (value: string | number) => {
    if (!activeCharacteristic || !activeService) return;

    writeBleCharacteristic(
      activeService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any, error: any) => {
        if (data) {
          toast.success(`Value written to ${activeCharacteristic.name}`);
          setTimeout(() => {
            handleRead(activeService.uuid, activeCharacteristic.uuid, device.name);
          }, 1000);
        }
      }
    );
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || "Public Key / Last Code"}
      />
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || "Read"}
      />
      <DeviceHeader onBack={handleBack} />
      <div className="flex flex-col items-center p-6 pb-2">
        <img
          src={device.imageUrl}
          alt={device.name || "Device Image"}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold">{device.name || "Device Name"}</h2>
        <p className="text-sm text-gray-400 mt-1">{device.macAddress || "MAC Address"}</p>
        <p className="text-sm text-gray-400 mt-1">{device.rssi || "RSSI"}</p>
      </div>
      <ServiceTabs
        tabs={fixedTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        attributeList={attributeList}
      />
      <div className="p-4">
        {activeService ? (
          <div className="space-y-4">
            {activeService.characteristicList.map((char: any) => (
              <CharacteristicCard
                key={char.uuid}
                characteristic={char}
                onRead={() => handleRead(activeService.uuid, char.uuid, char.name)}
                onWrite={() => handleWriteClick(char)}
                isLoading={loadingStates[char.uuid]}
                formattedValue={updatedValues[char.uuid] !== undefined ? updatedValues[char.uuid] : formatValue(char)}
              />
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