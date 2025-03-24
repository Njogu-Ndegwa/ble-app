import React from 'react';
import { Clipboard } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CharacteristicCardProps {
  characteristic: any;
  serviceUuid: string;
  updatedValues: { [key: string]: any };
  loadingStates: { [key: string]: boolean };
  handleRead: (serviceUuid: string, characteristicUuid: string, name: string) => void;
  handleWriteClick?: (characteristic: any) => void;
  showWriteButton: boolean;
}

export const CharacteristicCard: React.FC<CharacteristicCardProps> = ({
  characteristic,
  serviceUuid,
  updatedValues,
  loadingStates,
  handleRead,
  handleWriteClick,
  showWriteButton
}) => {
  // Format values based on type
  const formatValue = (char: any) => {
    if (typeof char.realVal === 'number') {
      switch (char.valType) {
        case 0: return char.realVal;
        case 1: return `${char.realVal} mA`;
        case 2: return `${char.realVal} mV`;
        default: return char.realVal;
      }
    }
    return char.realVal || 'N/A';
  };

  const handleCopyToClipboard = () => {
    const valueToCopy = updatedValues[characteristic.uuid] !== undefined
      ? updatedValues[characteristic.uuid]
      : formatValue(characteristic);
    navigator.clipboard.writeText(String(valueToCopy));
    toast.success('Value copied to clipboard');
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
        <span className="text-sm font-medium">{characteristic.name}</span>
        <div className="flex space-x-2">
          <button
            className={`text-xs ${
              loadingStates[characteristic.uuid] ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'
            } px-3 py-1 rounded transition-colors`}
            onClick={() => handleRead(serviceUuid, characteristic.uuid, characteristic.name)}
            disabled={loadingStates[characteristic.uuid]}
          >
            {loadingStates[characteristic.uuid] ? 'Reading...' : 'Read'}
          </button>
          {showWriteButton && handleWriteClick && (
            <button
              className="text-xs bg-blue-700 px-3 py-1 rounded hover:bg-blue-600 transition-colors"
              onClick={() => handleWriteClick(characteristic)}
            >
              Write
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div>
          <p className="text-xs text-gray-400">Description</p>
          <p className="text-sm">{characteristic.desc}</p>
        </div>
        <div className="flex items-center justify-between group">
          <div className="flex-grow">
            <p className="text-xs text-gray-400">Current Value</p>
            <p className="text-sm font-mono">
              {updatedValues[characteristic.uuid] !== undefined
                ? updatedValues[characteristic.uuid]
                : formatValue(characteristic)}
            </p>
          </div>
          <button
            className="p-2 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors"
            onClick={handleCopyToClipboard}
            aria-label="Copy to clipboard"
          >
            <Clipboard size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
