'use client'

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { writeBleCharacteristic, readBleCharacteristic } from './utils';
import { Clipboard, RefreshCw, ArrowLeft } from 'lucide-react';
import { AsciiStringModal, NumericModal } from './modals';

interface CmdServiceViewProps {
  serviceData: any;
  deviceMacAddress: string;
  deviceName: string;
  onRefresh: () => void;
  isLoading?: boolean;
  onBack?: () => void;
}

const CmdServiceView: React.FC<CmdServiceViewProps> = ({
  serviceData,
  deviceMacAddress,
  deviceName,
  onRefresh,
  isLoading = false,
  onBack,
}) => {
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);

  const handleRead = (serviceUuid: string, characteristicUuid: string, name: string) => {
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
    
    readBleCharacteristic(serviceUuid, characteristicUuid, deviceMacAddress, (data: any, error: any) => {
      setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
      
      if (data) {
        setUpdatedValues((prev) => ({
          ...prev,
          [characteristicUuid]: data.realVal,
        }));
        toast.success(`${name} read successfully`);
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
    if (!activeCharacteristic || !serviceData) return;
    writeBleCharacteristic(
      serviceData.uuid,
      activeCharacteristic.uuid,
      value,
      deviceMacAddress,
      (data: any, error: any) => {
        if (data) {
          toast.success(`Value written to ${activeCharacteristic.name}`);
          setTimeout(() => {
            handleRead(serviceData.uuid, activeCharacteristic.uuid, activeCharacteristic.name);
          }, 1000);
        } else {
          toast.error(`Failed to write to ${activeCharacteristic.name}`);
        }
      }
    );
  };

  const formatValue = (characteristic: any) => {
    const value = updatedValues[characteristic.uuid] !== undefined 
      ? updatedValues[characteristic.uuid] 
      : characteristic.realVal;
      
    if (value === null || value === undefined) return "N/A";
    
    if (typeof value === "boolean") {
      return value ? "Enabled" : "Disabled";
    }
    
    return value.toString();
  };

  return (
    <div className="space-y-4">
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
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <h3 className="text-lg font-medium text-white">CMD Service</h3>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors"
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
      
      {serviceData?.characteristicList.map((char: any) => (
        <div key={char.uuid} className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center bg-gray-800 px-4 py-3">
            <span className="text-sm font-medium">{char.name}</span>
            <div className="flex space-x-2">
              <button
                className={`text-xs ${
                  loadingStates[char.uuid] 
                    ? 'bg-gray-500' 
                    : 'bg-gray-700 hover:bg-gray-600'
                } px-3 py-1 rounded transition-colors`}
                onClick={() => handleRead(serviceData.uuid, char.uuid, char.name)}
                disabled={loadingStates[char.uuid]}
              >
                {loadingStates[char.uuid] ? 'Reading...' : 'Read'}
              </button>
              <button
                className={`text-xs ${
                  loadingStates[char.uuid] 
                    ? 'bg-gray-500' 
                    : 'bg-blue-700 hover:bg-blue-600'
                } px-3 py-1 rounded transition-colors`}
                onClick={() => handleWriteClick(char)}
                disabled={loadingStates[char.uuid]}
              >
                Write
              </button>
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div>
              <p className="text-xs text-gray-400">Description</p>
              <p className="text-sm">{char.desc || "No description available"}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-grow">
                <p className="text-xs text-gray-400">Current Value</p>
                <p className="text-sm font-mono">{formatValue(char)}</p>
              </div>
              <button
                className="p-2 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(String(formatValue(char)));
                  toast.success('Value copied to clipboard');
                }}
                aria-label="Copy to clipboard"
              >
                <Clipboard size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
      
      {!serviceData?.characteristicList?.length && (
        <div className="text-center p-8 text-gray-400">
          <p>No commands available</p>
        </div>
      )}
    </div>
  );
};

export default CmdServiceView;