'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from './utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2 } from 'lucide-react';
import { Clipboard } from "lucide-react";

interface CmdServiceViewProps {
  device: {
    macAddress: string;
    name: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
}

const CmdServiceView: React.FC<CmdServiceViewProps> = ({
  device, 
  attributeList, 
  onBack,
  onRequestServiceData,
  isLoadingService,
}) => {
  const router = useRouter();
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  // Loading state for read operations
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [inputCode, setInputCode] = useState('');
  

  // Services we need
  const services = {
    CMD: { serviceNameEnum: 'CMD_SERVICE', charNameContains: 'pubk' },
    STS: { serviceNameEnum: 'STS_SERVICE', charNameContains: 'rcrd' }
    
  };

  // Find our services and characteristics
  const cmdService = attributeList.find(service => service.serviceNameEnum === services.CMD.serviceNameEnum);
  const stsService = attributeList.find(service => service.serviceNameEnum === services.STS.serviceNameEnum);

  const pubkChar = cmdService?.characteristicList.find((char: any) =>
    char.name.toLowerCase().includes(services.CMD.charNameContains)
  );

  const rcrdChar = stsService?.characteristicList.find((char: any) =>
    char.name.toLowerCase().includes(services.STS.charNameContains)
  );

  // Load service data if not already loaded
  useEffect(() => {
    if (!cmdService && onRequestServiceData) {
      onRequestServiceData('CMD');
    }
    if (!stsService && onRequestServiceData) {
      onRequestServiceData('STS');
    }
  }, [cmdService, stsService, onRequestServiceData]);

  // Handle back navigation
  const handleBack = () => onBack ? onBack() : router.back();

  // Format values based on type
  const formatValue = (characteristic: any) => {
    if (!characteristic) return 'N/A';

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

// Handle read operation
const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
  if (!serviceUuid || !characteristicUuid) return;

  console.warn(`Beginning read operation for ${name} (Service: ${serviceUuid}, Characteristic: ${characteristicUuid})`);

  // Set loading state for this characteristic
  setLoadingStates(prev => ({ ...prev, [characteristicUuid]: true }));

  readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data: any, error: any) => {
    // Clear loading state
    setLoadingStates(prev => ({ ...prev, [characteristicUuid]: false }));

    if (data) {
      toast.success(`${name} read successfully`);
      // Update the value in our state
      setUpdatedValues(prev => ({
        ...prev,
        [characteristicUuid]: data.realVal
      }));
    } else {
      toast.error(`Failed to read ${name}`);
    }
  });
};

// Handle write operation
const handleWrite = (value: string | number) => {
  if (!pubkChar || !cmdService) return;

  const serviceUuid = cmdService.uuid;
  const characteristicUuid = pubkChar.uuid;

  console.warn(`Beginning write operation for ${pubkChar.name} (Service: ${serviceUuid}, Characteristic: ${characteristicUuid}, Value: ${value})`);

  writeBleCharacteristic(
    serviceUuid,
    characteristicUuid,
    value,
    device.macAddress,
    (data: any, error: any) => {
      if (data) {
        toast.success(`Value written successfully`);
        // Read back the value after writing to update the UI
        setTimeout(() => {
          handleRead(
            serviceUuid,
            characteristicUuid,
            pubkChar.name
          );
        }, 1000);
      } else {
        toast.error(`Failed to write value`);
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

    // Validate raw input length (should be 23 characters)
    const rawCode = inputCode.replace(/\s/g, '');
    if (rawCode.length !== 23) {
      toast.error("Input code must be exactly 23 characters (e.g., *0307561888551305839957#)");
      return;
    }

    // Find the 'pubk' characteristic in the CMD service
    if (!pubkChar) {
      toast.error("Public key characteristic not found");
      return;
    }

    // Format the input code
    const formattedCode = formatInputCode(inputCode);

    // Call handleWrite with the value
    handleWrite(formattedCode);
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
        toast.error("Maximum code length reached");
        return prev;
      }

      // First character must be *
      if (rawCode.length === 0 && key !== '*') {
        toast.error("Please start with * as the first character");
        return prev;
      }

      // Last character must be #
      if (rawCode.length === 22 && key !== '#') {
        toast.error("Please end with # as the last character");
        return prev;
      }

      // Middle characters must be digits
      if (rawCode.length >= 1 && rawCode.length < 22 && !/^[0-9]$/.test(key)) {
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

  // Get displayed value
  const getDisplayValue = (char: any) => {
    if (!char) return 'N/A';
    return updatedValues[char.uuid] !== undefined ? updatedValues[char.uuid] : formatValue(char);
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#171923] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />

      {/* Header */}
      <div className="p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Device Detail View</h1>
        <Share2 className="w-5 h-5 text-gray-400" />
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="space-y-6">
          {/* Cards Row */}
          <div className="flex space-x-4">
            {/* PUBK Card */}
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-3/4">
              <div className="text-sm text-gray-400 mb-2">Current PUBK Value</div>
              {pubkChar ? (
                <div className="min-h-8 flex items-center">
                  <div className="font-mono text-sm overflow-hidden overflow-ellipsis w-5/6 whitespace-nowrap">
                    {getDisplayValue(pubkChar)}
                  </div>
                  <button
                    onClick={() => {
                      const valueToCopy = getDisplayValue(pubkChar);
                      navigator.clipboard.writeText(String(valueToCopy));
                      toast.success('Value copied to clipboard');
                    }}
                    className="ml-1 p-1 text-gray-400 hover:text-blue-500"
                    aria-label="Copy to clipboard"
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

            {/* RCRD Card - Days */}
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-1/4 flex flex-col">
              <div className="text-sm text-gray-400 mb-2 text-center">Days</div>
              <div className="flex items-center justify-center min-h-8">
                {rcrdChar ? (
                  <span className="text-xl font-medium">{getDisplayValue(rcrdChar)}</span>
                ) : (
                  <div className="w-full flex justify-center items-center py-2">
                    <div className="animate-pulse text-sm text-gray-500">Loading ...</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input Code Display */}
          <div className="border border-gray-700 rounded-lg p-3 bg-gray-800">
            <p className="text-sm text-gray-400 mb-1">Input Code:</p>
            <div className="relative">
              <p
                className="font-mono h-8 mt-1 truncate p-1 bg-gray-900 rounded flex items-center"
                style={{
                  fontSize: inputCode.length > 20 ? '0.75rem' : inputCode.length > 15 ? '0.875rem' : '1rem',
                  maxWidth: '100%',
                }}
              >
                {inputCode ? (
                  formatInputCode(inputCode)
                ) : (
                  <span className="text-gray-500 italic">Format: (*...#)</span>
                )}
              </p>
            </div>
          </div>

          {/* Keypad */}
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
                className={`h-14 flex-1 flex items-center justify-center rounded ${isLoadingService ? 'bg-gray-500' : 'bg-blue-600 active:bg-blue-500'
                  } text-white text-xl cursor-pointer`}
                onClick={submitInput}
              >
                OK
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CmdServiceView;


