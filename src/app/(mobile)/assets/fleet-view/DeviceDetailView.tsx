
'use client'

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, RefreshCw } from 'lucide-react';
import { AsciiStringModal, NumericModal } from '../../../modals';
import { Clipboard } from 'lucide-react';
import HeartbeatView from '@/components/HeartbeatView';

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
  serviceLoadingProgress?: number;
  handlePublish?: (attributeList: any, serviceType: string) => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
  handlePublish,
}) => {
  const router = useRouter();
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('CMD');
  const [pubkValue, setPubkValue] = useState<string | null>(null);
  // Persist initial data load and heartbeat sent state across HeartbeatView mounts
  const initialDataLoadedRef = useRef<boolean>(false);
  const heartbeatSentRef = useRef<boolean>(false);

  const fixedTabs = [
    { id: 'ATT', label: 'ATT', serviceNameEnum: 'ATT_SERVICE' },
    { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
    { id: 'STS', label: 'STS', serviceNameEnum: 'STS_SERVICE' },
    { id: 'DTA', label: 'DTA', serviceNameEnum: 'DTA_SERVICE' },
    { id: 'DIA', label: 'DIA', serviceNameEnum: 'DIA_SERVICE' },
    { id: 'HEARTBEAT', label: 'HB', serviceNameEnum: null },
  ];



  // Function to get pubk value
  const getPubkValue = () => {
    const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
    console.error(cmdService, "------CMD Service-----sfdsfs")
    if (cmdService) {
      const pubkCharacteristic = cmdService.characteristicList.find((char: any) => char.name.toLowerCase() === 'pubk');
      console.error(pubkCharacteristic, "------66------sfdsfs")
      if (pubkCharacteristic) {
        console.error(pubkCharacteristic, "------66------sfdsfs")
        setActiveCharacteristic(pubkCharacteristic); // Set the active characteristic
        return pubkCharacteristic.realVal;
      } else {
        console.warn('pubk characteristic not found in CMD_SERVICE');
        return null;
      }
    } else {
      console.warn('CMD_SERVICE not found in attributeList');
      return null;
    }
  };

  // Automatically request CMD and STS services when the component is mounted
  useEffect(() => {
    if (onRequestServiceData) {
      onRequestServiceData('CMD'); // Request CMD service data
      onRequestServiceData('STS'); // Request STS service data
    }
  }, []);

  // Watch for the loading state of CMD and STS, and extract the pubk value once they are loaded
  useEffect(() => {
    console.error(isLoadingService, loadingStates['CMD'] , loadingStates['STS'], "Extracted PUBK<------89------>")
    if (isLoadingService === null && !loadingStates['CMD'] && !loadingStates['STS']) {
      const extractedPubk = getPubkValue();
      console.error(extractedPubk, "Extracted PUBK<------89------>")
      setPubkValue(extractedPubk);
    }
  }, [isLoadingService, loadingStates, attributeList]);

  const activeService = attributeList.find((service) =>
    fixedTabs.find((tab) => tab.id === activeTab && tab.serviceNameEnum === service.serviceNameEnum)
  );

  const isServiceLoaded = (serviceNameEnum: string) => {
    return attributeList.some((service) => service.serviceNameEnum === serviceNameEnum);
  };

  const handleBack = () => (onBack ? onBack() : router.back());

  const formatValue = (characteristic: any) => {
    if (typeof characteristic.realVal === 'number') {
      switch (characteristic.valType) {
        case 0:
          return characteristic.realVal;
        case 1:
          return `${characteristic.realVal} mA`;
        case 2:
          return `${characteristic.realVal} mV`;
        default:
          return characteristic.realVal;
      }
    }
    return characteristic.realVal || 'N/A';
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const tab = fixedTabs.find((t) => t.id === tabId);
    if (!tab || !tab.serviceNameEnum || tabId === 'HEARTBEAT') return;
    const serviceNameEnum = tab.serviceNameEnum;
    if (!isServiceLoaded(serviceNameEnum) && onRequestServiceData) {
      onRequestServiceData(tabId);
    }
  };

  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    console.error(serviceUuid, characteristicUuid, device.macAddress, "------133----")
    readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
      setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
      if (data) {
        console.info(data.realVal, 'Value of Field');
        toast.success(`${name} read successfully`);
        setUpdatedValues((prev) => ({
          ...prev,
          [characteristicUuid]: data.realVal,
        }));
        if (name.toLowerCase() === 'pubk') {
          setPubkValue(data.realVal); // Update pubkValue when the pubk characteristic is read
        }
      } else {
        console.error('Error Reading Characteristics');
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
    console.info({
      action: 'write',
      serviceUuid: activeService.uuid,
      characteristicUuid: activeCharacteristic.uuid,
      macAddress: device.macAddress,
      name: device.name,
      value: value,
    });
    writeBleCharacteristic(
      activeService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any, error: any) => {
        console.info({ data: data, error: error });
        if (data) {
          console.info(data, 'Is Data 123');
        }
      }
    );
    toast.success(`Value written to ${activeCharacteristic.name}`);
    setTimeout(() => {
      console.error(activeService.uuid, activeCharacteristic.uuid, device.name, "------184-----")
      handleRead(activeService.uuid, activeCharacteristic.uuid, device.name);
    }, 1000);
  };

  const handleRefreshService = () => {
    if (!activeTab || !onRequestServiceData) return;
    onRequestServiceData(activeTab);
  };
console.error()
  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || 'Public Key / Last Code'}
      />
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || 'Read'}
      />
      
      {pubkValue && (
        <div className="p-4">
          <h3 className="text-lg font-medium">Public Key (pubk) Value</h3>
          <p className="text-sm font-mono">{pubkValue}</p>
          <button
            onClick={() => handleWriteClick({ name: 'pubk' })}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-md"
          >
            Write
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceDetailView;