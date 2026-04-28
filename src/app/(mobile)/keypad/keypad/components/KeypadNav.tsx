"use client";

import React, { useMemo } from 'react';
import { Bluetooth } from 'lucide-react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem, NavIcons } from '@/components/ui/BottomNav';

export type KeypadScreen = 'devices' | 'profile';

interface KeypadNavProps {
  currentScreen: KeypadScreen;
  onNavigate: (screen: KeypadScreen) => void;
}

const KeypadNav: React.FC<KeypadNavProps> = ({ currentScreen, onNavigate }) => {
  const { t } = useI18n();

  const navItems: NavItem[] = useMemo(() => [
    {
      key: 'devices',
      label: t('ble.nav.devices') || 'Devices',
      icon: <Bluetooth size={22} />,
    },
    {
      key: 'profile',
      label: t('ble.nav.profile') || 'Profile',
      icon: NavIcons.profile,
    },
  ], [t]);

  return (
    <BottomNav
      items={navItems}
      currentScreen={currentScreen}
      onNavigate={(screen) => onNavigate(screen as KeypadScreen)}
      className="keypad-nav"
    />
  );
};

export default KeypadNav;
