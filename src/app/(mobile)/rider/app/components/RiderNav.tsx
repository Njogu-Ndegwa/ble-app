"use client";

import React, { useMemo } from 'react';
import { useI18n } from '@/i18n';
import BottomNav, { NavItem, NavIcons } from '@/components/ui/BottomNav';

export type RiderScreen = 'home' | 'stations' | 'activity' | 'profile';

interface RiderNavProps {
  currentScreen: RiderScreen;
  onNavigate: (screen: RiderScreen) => void;
}

/**
 * RiderNav - Bottom navigation for the Rider app
 * Uses the shared BottomNav component with Rider-specific items
 */
const RiderNav: React.FC<RiderNavProps> = ({ currentScreen, onNavigate }) => {
  const { t } = useI18n();

  // Memoize nav items to prevent unnecessary re-renders
  const navItems: NavItem[] = useMemo(() => [
    {
      key: 'home',
      label: t('rider.home') || 'Home',
      icon: NavIcons.home,
    },
    {
      key: 'stations',
      label: t('rider.stations') || 'Stations',
      icon: NavIcons.stations,
    },
    {
      key: 'activity',
      label: t('rider.activity') || 'Activity',
      icon: NavIcons.activity,
    },
    {
      key: 'profile',
      label: t('rider.profile') || 'Profile',
      icon: NavIcons.profile,
    },
  ], [t]);

  return (
    <BottomNav
      items={navItems}
      currentScreen={currentScreen}
      onNavigate={(screen) => onNavigate(screen as RiderScreen)}
      className="rider-nav"
    />
  );
};

export default RiderNav;
