'use client'

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from './utils';
import { Toaster, toast } from 'react-hot-toast';
import { AsciiStringModal, NumericModal } from './modals';
import  DeviceHeader from '@/components/DeviceHeader';
import  DeviceInfo  from '@/components/DeviceInfo';
import  ServiceTabs  from '@/components/ServiceTabs';
import  ServiceContent  from '@/components/ServiceContent';

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

  // Modal states
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);

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

  // Handle read operation
  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    // Set loading state for this characteristic
    setLoadingStates(prev => ({ ...prev, [characteristicUuid]: true }));

    readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
      // Clear loading state
      setLoadingStates(prev => ({ ...prev, [characteristicUuid]: false }));

      if (data) {
        console.info(data.realVal, "Value of Field");
        toast.success(`${name} read successfully`);
        // Update the value in our state
        setUpdatedValues(prev => ({
          ...prev,
          [characteristicUuid]: data.realVal
        }));
      } else {
        console.error("Error Reading Characteristics");
        toast.error(`Failed to read ${name}`);
      }
    });
  };

  // Handle opening the appropriate modal
  const handleWriteClick = (characteristic: any) => {
    setActiveCharacteristic(characteristic);

    // Determine which modal to open based on characteristic name
    if (characteristic.name.toLowerCase().includes('pubk')) {
      setAsciiModalOpen(true);
    } else {
      setNumericModalOpen(true);
    }
  };

  // Handle write operation
  const handleWrite = (value: string | number) => {
    if (!activeCharacteristic || !activeService) return;

    console.info({
      action: 'write',
      serviceUuid: activeService.uuid,
      characteristicUuid: activeCharacteristic.uuid,
      macAddress: device.macAddress,
      name: device.name,
      value: value
    });
    
    writeBleCharacteristic(
      activeService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any, error: any) => {
        console.info({"data": data, "error": error})
        if (data) {
          console.info(data, "Is Data 123")
        }
      }
    );
    
    toast.success(`Value written to ${activeCharacteristic.name}`);

    setTimeout(() => {
      handleRead(
        activeService.uuid,
        activeCharacteristic.uuid,
        activeCharacteristic.name
      )
    }, 1000)
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />

      {/* ASCII String Modal */}
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || "Public Key / Last Code"}
      />

      {/* Numeric Modal */}
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || "Read"}
      />

      {/* Header */}
      <DeviceHeader onBack={handleBack} />

      {/* Device Image and Info */}
      <DeviceInfo device={device} />

      {/* Tabs */}
      <ServiceTabs 
        tabs={fixedTabs} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        attributeList={attributeList} 
      />

      {/* Service Content */}
      <div className="p-4">
        <ServiceContent
          activeService={activeService}
          activeTab={activeTab}
          updatedValues={updatedValues}
          loadingStates={loadingStates}
          handleRead={handleRead}
          handleWriteClick={handleWriteClick}
        />
      </div>
    </div>
  );
};

export default DeviceDetailView;