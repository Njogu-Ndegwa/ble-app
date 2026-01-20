"use client";

import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import BottomNav, {NavItem, NavIcons} from '@/components/ui/BottomNav';

export type AttendantScreen = 'swap' | 'transactions' | 'sessions' | 'profile';

interface AttendantNavProps {
  currentScreen: AttendantScreen;
  onNavigate: (screen: AttendantScreen) => void;
}

/**
 * AttendantNav - Bottom navigation for the Attendant app
 * Uses the shared BottomNav component with Attendant-specific items
 */
const AttendantNav: React.FC<AttendantNavProps> = ({ currentScreen, onNavigate }) => {
  const { t } = useI18n();

  // Memoize nav items to prevent unnecessary re-renders
  const navItems: NavItem[] = useMemo(() => [
    {
      key: 'swap',
      label: t('attendant.nav.swap') || 'Swap',
      icon: NavIcons.swap,
    },
    {
      key: 'transactions',
      label: t('attendant.nav.transactions') || 'Transactions',
      icon: NavIcons.transactions,
    },
    {
      key: 'sessions',
      label: t('attendant.nav.sessions') || 'Sessions',
      icon: NavIcons.sessions,
    },
    {
      key: 'profile',
      label: t('attendant.nav.profile') || 'Profile',
      icon: NavIcons.profile,
    },
  ], [t]);

  return (
    <BottomNav
      items={navItems}
      currentScreen={currentScreen}
      onNavigate={(screen) => onNavigate(screen as AttendantScreen)}
      className="attendant-nav"
    />
  );
};

export default AttendantNav;
