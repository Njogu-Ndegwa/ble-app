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
    <div className="max-w-md mx-auto bg-gradient-page min-h-screen text-text-primary">
      <div className="p-4 flex items-center">
        <button onClick={onBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-text-secondary" />
        </button>
        <h1 className="text-lg font-semibold flex-1">{t('Device Upgrade')}</h1>
      </div>
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">{t('MAC Address')}</h2>
        <p className="text-sm text-text-secondary font-mono">{device.macAddress || t('Unknown MAC')}</p>
      </div>
    </div>
  );
};

export default DeviceDetailView;