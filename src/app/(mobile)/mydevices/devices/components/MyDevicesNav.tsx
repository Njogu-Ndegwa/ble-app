"use client";

import React, { useMemo } from 'react';
import { Bluetooth, Battery, User } from 'lucide-react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem } from '@/components/ui/BottomNav';

export type MyDevicesTab = 'all-devices' | 'my-devices' | 'profile';

interface MyDevicesNavProps {
  currentTab: MyDevicesTab;
  onNavigate: (tab: MyDevicesTab) => void;
}

const MyDevicesNav: React.FC<MyDevicesNavProps> = ({ currentTab, onNavigate }) => {
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
      onNavigate={(tab) => onNavigate(tab as MyDevicesTab)}
      className="my-devices-nav"
    />
  );
};

export default MyDevicesNav;
