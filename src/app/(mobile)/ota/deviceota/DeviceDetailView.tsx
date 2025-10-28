'use client';

import React from 'react';
import { useI18n } from '@/i18n';
import { ArrowLeft } from 'lucide-react';

interface DeviceDetailProps {
  device: {
    macAddress: string;
  };
  onBack?: () => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({ device, onBack }) => {
  const { t } = useI18n();
  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <div className="p-4 flex items-center">
        <button onClick={onBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold flex-1">{t('Device Upgrade')}</h1>
      </div>
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">{t('MAC Address')}</h2>
        <p className="text-sm text-gray-400 font-mono">{device.macAddress || t('Unknown MAC')}</p>
      </div>
    </div>
  );
};

export default DeviceDetailView;