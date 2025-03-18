'use client'

import React from 'react';

interface CharacteristicCardProps {
  characteristic: any;
  onRead: () => void;
  onWrite: () => void;
  isLoading: boolean;
  formattedValue: string;
}

const CharacteristicCard: React.FC<CharacteristicCardProps> = ({ characteristic, onRead, onWrite, isLoading, formattedValue }) => (
  <div className="border border-gray-700 rounded-lg overflow-hidden">
    <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
      <span className="text-sm font-medium">{characteristic.name}</span>
      <div className="flex space-x-2">
        <button
          className={`text-xs ${isLoading ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'} px-3 py-1 rounded transition-colors`}
          onClick={onRead}
          disabled={isLoading}
        >
          {isLoading ? 'Reading...' : 'Read'}
        </button>
        <button
          className="text-xs bg-blue-700 px-3 py-1 rounded hover:bg-blue-600 transition-colors"
          onClick={onWrite}
        >
          Write
        </button>
      </div>
    </div>
    <div className="p-4 space-y-2">
      <p className="text-xs text-gray-400">Current Value</p>
      <p className="text-sm font-mono">{formattedValue}</p>
    </div>
  </div>
);

export default CharacteristicCard;