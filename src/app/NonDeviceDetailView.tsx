'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from './utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, Clipboard } from 'lucide-react';
import { AsciiStringModal } from './modals';

interface NonDeviceDetailViewProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
}

const NonDeviceDetailView: React.FC<NonDeviceDetailViewProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
}) => {
  const router = useRouter();
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [inputCode, setInputCode] = useState('');
  const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
  const stsService = attributeList.find((service) => service.serviceNameEnum === 'STS_SERVICE');

  useEffect(() => {
    if (!cmdService && onRequestServiceData) {
      onRequestServiceData('CMD');
    }
    if (!stsService && onRequestServiceData) {
      onRequestServiceData('STS');
    }
  }, [cmdService, stsService, onRequestServiceData]);
  
  useEffect(() => {
    if (cmdService) {
      const pubkChar = cmdService.characteristicList.find(
        (char: any) => char.name.toLowerCase() === 'pubk'
      );
      if (pubkChar) {
        console.log('Setting activeCharacteristic to pubk for non-distributor');
        setActiveCharacteristic(pubkChar);
      } else {
        console.error('pubk characteristic not found in cmdService');
        toast.error('Public key characteristic not found on load');
      }
    }
  }, [cmdService]);

  const handleBack = () => onBack ? onBack() : router.back();

  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    console.warn(serviceUuid, characteristicUuid, name, "-----65------")
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
      setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
      if (data) {
        console.log(`${name} read successfully:`, data.realVal);
        toast.success(`${name} read successfully`);
        setUpdatedValues((prev) => ({
          ...prev,
          [characteristicUuid]: data.realVal,
        }));
      } else {
        console.error('Error reading characteristic:', name, error);
        toast.error(`Failed to read ${name}`);
      }
    });
  };
 
  const handleWrite = (value: string | number) => {
    console.warn(value, "---------83-------Value Write")
    if (!activeCharacteristic || !cmdService) return;
     // Collect all the write info
     const writeInfo = {
        action: 'write',
        serviceUuid: cmdService.uuid,
        characteristicUuid: activeCharacteristic.uuid,
        macAddress: device.macAddress,
        name: device.name,
        value: value,
      };
      
      // Log to console
      console.warn(writeInfo);

    writeBleCharacteristic(
      cmdService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any, error: any) => {
        console.warn({ data: data, error: error }, "-------104----");
        if (data) {
          console.warn(data, 'Is Data 123');
          toast.success(`Value written to ${activeCharacteristic.name}`);
          setTimeout(() => {
            handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name);
          }, 1000);
        } else {
          toast.error(`Failed to write to ${activeCharacteristic.name}`);
        }
      }
    );
  };
 
  const submitInput = () => {
    if (isLoadingService) {
        toast.error("Service is loading, please wait");
        return;
      }
      if (!inputCode) {
        toast.error("Input code is empty");
        return;
      }
      if (!cmdService) {
        toast.error("CMD service not loaded. Please refresh CMD service.");
        return;
      }
      const rawCode = inputCode.replace(/\s/g, '');
  if (rawCode.length !== 23) {
    toast.error("Input code must be exactly 23 characters (e.g., *0307561888551305839957#)");
    return;
  }
  const value = formatInputCode(inputCode);
//   toast.success(`Submitting value: ${value}`, { duration: 3000 });
  handleWrite(value);
  setInputCode('');
};
  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const formatInputCode = (code: string) => {
    const rawCode = code.replace(/\s/g, '');
    if (!rawCode) return '';

    const segments = [];
    if (rawCode.length > 0) segments.push(rawCode.slice(0, 4));
    if (rawCode.length > 4) segments.push(rawCode.slice(4, 7));
    if (rawCode.length > 7) segments.push(rawCode.slice(7, 10));
    if (rawCode.length > 10) segments.push(rawCode.slice(10, 13));
    if (rawCode.length > 13) segments.push(rawCode.slice(13, 16));
    if (rawCode.length > 16) segments.push(rawCode.slice(16, 19));
    if (rawCode.length > 19) segments.push(rawCode.slice(19, 23));

    return segments.join(' ');
  };

  const handleNumpadClick = (key: string) => {
    setInputCode((prev) => {
      const rawCode = prev.replace(/\s/g, '');

      if (key === 'backspace') {
        return formatInputCode(rawCode.slice(0, -1));
      }

      if (rawCode.length >= 23) {
        return prev;
      }

      if (
        (rawCode.length === 0 && key !== '*') ||
        (rawCode.length >= 1 && rawCode.length < 22 && !/^[0-9]$/.test(key)) ||
        (rawCode.length === 22 && key !== '#')
      ) {
        return prev;
      }

      return formatInputCode(rawCode + key);
    });
  };

  const clearInput = () => {
    setInputCode((prev) => {
      const rawCode = prev.replace(/\s/g, '');
      return formatInputCode(rawCode.slice(0, -1));
    });
  };

  const handleCopyToClipboard = (value: string) => {
    navigator.clipboard.writeText(String(value));
    toast.success('Value copied to clipboard');
  };

  const pubkValue =
  updatedValues[cmdService?.characteristicList?.find((char: any) => char.name.toLowerCase() === 'pubk')?.uuid] ||
  cmdService?.characteristicList?.find((char: any) => char.name.toLowerCase() === 'pubk')?.realVal ||
  'N/A';

  const rcrdValue =
    stsService?.characteristicList?.find((char: any) => char.name.toLowerCase() === 'rcrd')?.realVal ??
    'N/A';

//   const isWriting = activeCharacteristic && loadingStates[activeCharacteristic.uuid];

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-gray-800 to-gray-900 min-h-screen text-white">
      <Toaster />
      {/* Header */}
      <div className="p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Device Details</h1>
        <Share2 className="w-5 h-5 text-gray-400" />
      </div>

      <div className="p-4">
        <div className="space-y-6">
          <div className="flex space-x-4 mb-6">
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-3/4">
              <div className="text-sm text-gray-400 mb-2">Current PUBK Value</div>
              {cmdService ? (
                <div className="min-h-8 flex items-center">
                  <div className="font-mono text-sm overflow-hidden overflow-ellipsis w-5/6 whitespace-nowrap">
                    {pubkValue}
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(pubkValue)}
                    className="ml-1 p-1 text-gray-400 hover:text-blue-500"
                  >
                    <Clipboard size={16} />
                  </button>
                </div>
              ) : (
                <div className="w-full flex justify-center items-center py-2">
                  <div className="animate-pulse text-sm text-gray-500">Loading ...</div>
                </div>
              )}
            </div>
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-1/4 flex flex-col">
              <div className="text-sm text-gray-400 mb-2 text-center">Days</div>
              <div className="flex items-center justify-center min-h-8">
                {stsService ? (
                  <span className="text-xl font-medium">{rcrdValue}</span>
                ) : (
                  <div className="w-full flex justify-center items-center py-2">
                    <div className="animate-pulse text-sm text-gray-500">Loading ...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="border border-gray-700 rounded-lg p-3 bg-gray-800 mb-4">
            <p className="text-sm text-gray-400 mb-1">Input Code:</p>
            <p
              className="font-mono h-8 mt-1 truncate p-1 bg-gray-900 rounded"
              style={{
                fontSize: inputCode.length > 20 ? '0.75rem' : inputCode.length > 15 ? '0.875rem' : '1rem',
                maxWidth: '100%',
              }}
            >
                 {formatInputCode(inputCode)}
            </p>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {keypad.map((row, rowIndex) =>
                row.map((key, keyIndex) => (
                  <button
                    key={`${rowIndex}-${keyIndex}`}
                    className="bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold rounded-lg py-3"
                    onClick={() => handleNumpadClick(key)}
                  >
                    {key}
                  </button>
                ))
              )}
            </div>
            <div className="flex space-x-4">
              <div
                className="h-14 flex-1 flex items-center justify-center rounded bg-gray-600 text-white text-xl cursor-pointer active:bg-gray-500"
                onClick={clearInput}
              >
                ←
              </div>
              <div
                className={`h-14 flex-1 flex items-center justify-center rounded ${
                  isLoadingService ? 'bg-gray-500' : 'bg-blue-600 active:bg-blue-500'
                } text-white text-xl cursor-pointer`}
                onClick={submitInput}
              >
                OK
                {/* {isLoadingService ? 'Loading...' : isWriting ? 'Writing...' : 'OK'} */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NonDeviceDetailView;
