"use client";

import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem, NavIcons } from '@/components/ui/BottomNav';

export type ActivatorScreen = 'activate' | 'sessions' | 'profile';

interface ActivatorNavProps {
  currentScreen: ActivatorScreen;
  onNavigate: (screen: ActivatorScreen) => void;
}

const ActivatorNav: React.FC<ActivatorNavProps> = ({ currentScreen, onNavigate }) => {
  const { t } = useI18n();

  const navItems: NavItem[] = useMemo(() => [
    {
      key: 'activate',
      label: t('activator.nav.activate') || 'Activate',
      icon: NavIcons.sales,
    },
    {
      key: 'sessions',
      label: t('activator.nav.sessions') || 'Sessions',
      icon: NavIcons.sessions,
    },
    {
      key: 'profile',
      label: t('activator.nav.profile') || 'Profile',
      icon: NavIcons.profile,
    },
  ], [t]);

  return (
    <BottomNav
      items={navItems}
      currentScreen={currentScreen}
      onNavigate={(screen) => onNavigate(screen as ActivatorScreen)}
      className="sales-nav"
    />
  );
};

export default ActivatorNav;
