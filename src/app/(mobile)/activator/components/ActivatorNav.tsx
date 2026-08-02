"use client";

import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem, NavIcons } from '@/components/ui/BottomNav';

export type ActivatorScreen = 'activate' | 'sessions' | 'profile';

interface ActivatorNavProps {
  currentScreen: ActivatorScreen;
  onNavigate: (screen: ActivatorScreen) => void;
}

/** Nav items shared by the bottom bar (flow screens) and AppShell's rail. */
export function useActivatorNavItems(): NavItem[] {
  const { t } = useI18n();

  return useMemo(() => [
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
}

const ActivatorNav: React.FC<ActivatorNavProps> = ({ currentScreen, onNavigate }) => {
  const navItems = useActivatorNavItems();

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
