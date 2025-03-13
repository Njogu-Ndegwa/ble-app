import React from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';

interface DeviceHeaderProps {
  onBack: () => void;
}

const DeviceHeader: React.FC<DeviceHeaderProps> = ({ onBack }) => {
  return (
    <div className="p-4 flex items-center">
      <button onClick={onBack} className="mr-4">
        <ArrowLeft className="w-6 h-6 text-gray-400" />
      </button>
      <h1 className="text-lg font-semibold flex-1">Device Details</h1>
      <Share2 className="w-5 h-5 text-gray-400" />
    </div>
  );
};

export default DeviceHeader;
