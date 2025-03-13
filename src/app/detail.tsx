'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DeviceHeader from '@/app/DeviceHeader';
import DeviceInfo from '@/app/DeviceInfo';
import DeviceTabs from '@/app/DeviceTabs';
import DeviceTabContent from '@/app/DeviceTabContent';
import { Device } from '@/app/Device';

interface DeviceDetailProps {
  device?: Device;
  onBack?: () => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device = {
    id: '1',
    title: 'HESS-Bat242004',
    subtitle: '82:05:10:00:A9:48',
    imageUrl: 'https://res.cloudinary.com/dhffnvn2d/image/upload/v1740005127/Bat48100TP_Right_Side_uesgfn-modified_u6mvuc.png',
    firmwareVersion: '1.4.7',
    deviceId: 'VCUA2404:0019'
  },
  onBack,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ATT');

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      {/* Device Header */}
      <DeviceHeader onBack={onBack || (() => router.back())} />

      {/* Device Image and Basic Info */}
      <DeviceInfo device={device} />

      {/* Tabs */}
      <DeviceTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Content based on active tab */}
      <DeviceTabContent activeTab={activeTab} device={device} />
    </div>
  );
};

export default DeviceDetailView;
