"use client";

import React, { useMemo } from 'react';
import { Bluetooth, Battery, Keyboard, User } from 'lucide-react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem } from '@/components/ui/BottomNav';

export type KeypadTab = 'all-devices' | 'my-devices' | 'keypad' | 'profile';

interface KeypadNavProps {
  currentTab: KeypadTab;
  onNavigate: (tab: KeypadTab) => void;
}

const KeypadNav: React.FC<KeypadNavProps> = ({ currentTab, onNavigate }) => {
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
      key: 'keypad',
      label: t('nav.keypad') || 'Keypad',
      icon: <Keyboard size={22} />,
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
      onNavigate={(tab) => onNavigate(tab as KeypadTab)}
      className="keypad-nav"
    />
  );
};

export default KeypadNav;
