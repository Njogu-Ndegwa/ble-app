"use client";

import React from 'react';
import BottomNav, { type NavItem } from '@/components/ui/BottomNav';
import NavRail from './NavRail';

export interface AppNavProps {
  /** Same contract as BottomNav — the *Nav.tsx wrappers pass straight through. */
  items: NavItem[];
  currentScreen: string;
  onNavigate: (screen: string) => void;
  className?: string;
}

/**
 * AppNav — responsive navigation with the exact BottomNav contract.
 *
 * Renders BOTH variants; visibility is pure CSS (no hydration flash):
 *   - <lg (1024px): the existing bottom tab bar, unchanged.
 *   - >=lg: the vertical left rail.
 *
 * NOTE: the rail needs a row-capable shell to sit against the left edge —
 * use inside AppShell (which positions rail and tab bar separately via its
 * `nav` prop) or a container that lays out .nav-rail as a row child.
 */
const AppNav: React.FC<AppNavProps> = ({ items, currentScreen, onNavigate, className = '' }) => (
  <>
    <NavRail items={items} currentScreen={currentScreen} onNavigate={onNavigate} />
    <BottomNav
      items={items}
      currentScreen={currentScreen}
      onNavigate={onNavigate}
      className={`app-nav-bottom ${className}`.trim()}
    />
  </>
);

export default AppNav;
