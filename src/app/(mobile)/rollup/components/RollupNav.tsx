'use client';

import React, { useMemo } from 'react';
import BottomNav, { type NavItem, NavIcons } from '@/components/ui/BottomNav';

export type RollupScreen = 'dashboard' | 'accounts' | 'records';

interface RollupNavProps {
  currentScreen: RollupScreen;
  onNavigate: (screen: RollupScreen) => void;
}

const NAV_ICON_DASHBOARD = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="4" rx="1" />
    <rect x="14" y="10" width="7" height="11" rx="1" />
    <rect x="3" y="13" width="7" height="8" rx="1" />
  </svg>
);

const NAV_ICON_ACCOUNTS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const NAV_ICON_RECORDS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export default function RollupNav({ currentScreen, onNavigate }: RollupNavProps) {
  const items: NavItem[] = useMemo(() => [
    { key: 'dashboard', label: 'Dashboard', icon: NAV_ICON_DASHBOARD },
    { key: 'accounts', label: 'Accounts', icon: NAV_ICON_ACCOUNTS },
    { key: 'records', label: 'Records', icon: NAV_ICON_RECORDS },
  ], []);

  return (
    <BottomNav
      items={items}
      currentScreen={currentScreen}
      onNavigate={(screen) => onNavigate(screen as RollupScreen)}
      className="sales-nav"
    />
  );
}
