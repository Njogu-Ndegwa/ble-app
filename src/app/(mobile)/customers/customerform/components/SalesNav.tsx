"use client";

import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem, NavIcons } from '@/components/ui/BottomNav';

export type SalesScreen = 'sales' | 'sessions' | 'transactions' | 'profile';

interface SalesNavProps {
  currentScreen: SalesScreen;
  onNavigate: (screen: SalesScreen) => void;
}

/**
 * SalesNav - Bottom navigation for the Sales Rep app
 * Uses the shared BottomNav component with Sales-specific items
 */
const SalesNav: React.FC<SalesNavProps> = ({ currentScreen, onNavigate }) => {
  const { t } = useI18n();

  // Memoize nav items to prevent unnecessary re-renders
  // Order: Sales → Transactions → Sessions → Profile
  const navItems: NavItem[] = useMemo(() => [
    {
      key: 'sales',
      label: t('sales.nav.sales') || 'Sales',
      icon: NavIcons.sales,
    },
    {
      key: 'transactions',
      label: t('sales.nav.transactions') || 'Transactions',
      icon: NavIcons.transactions,
    },
    {
      key: 'sessions',
      label: t('sales.nav.sessions') || 'Sessions',
      icon: NavIcons.sessions,
    },
    {
      key: 'profile',
      label: t('sales.nav.profile') || 'Profile',
      icon: NavIcons.profile,
    },
  ], [t]);

  return (
    <BottomNav
      items={navItems}
      currentScreen={currentScreen}
      onNavigate={(screen) => onNavigate(screen as SalesScreen)}
      className="sales-nav"
    />
  );
};

export default SalesNav;
