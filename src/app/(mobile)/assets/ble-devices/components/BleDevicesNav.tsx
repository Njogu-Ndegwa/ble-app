"use client";

import React, { useMemo } from 'react';
import { Bluetooth, Battery, User } from 'lucide-react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem } from '@/components/ui/BottomNav';

export type BleDevicesTab = 'all-devices' | 'my-devices' | 'profile';

interface BleDevicesNavProps {
  currentTab: BleDevicesTab;
  onNavigate: (tab: BleDevicesTab) => void;
}

const BleDevicesNav: React.FC<BleDevicesNavProps> = ({ currentTab, onNavigate }) => {
  const { t } = useI18n();

  const navItems: NavItem[] = useMemo(() => [
    {
      key: 'all-devices',
      label: t('nav.assets.bledevices') || 'All Devices',
      icon: <Bluetooth size={22} />,
    },
    {
      key: 'my-devices',
      label: t('nav.mydevices') || 'My Devices',
      icon: <Battery size={22} />,
    },
    {
      key: 'profile',
      label: t('ble.nav.profile') || 'Profile',
      icon: <User size={22} />,
    },
  ], [t]);

  return (
    <BottomNav
      items={navItems}
      currentScreen={currentTab}
      onNavigate={(tab) => onNavigate(tab as BleDevicesTab)}
      className="ble-devices-nav"
    />
  );
};

export default BleDevicesNav;
