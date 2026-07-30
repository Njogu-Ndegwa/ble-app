"use client";

import React from 'react';
import type { NavItem } from '@/components/ui/BottomNav';

export interface NavRailProps {
  items: NavItem[];
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

/**
 * NavRail — vertical desktop navigation rail (>=lg only; display:none below).
 *
 * Reuses .bottom-nav-item tokens/colors so the rail matches the tab bar;
 * .nav-rail-item only adjusts geometry at lg+ (see responsive.css NAV section).
 */
const NavRail: React.FC<NavRailProps> = ({ items, currentScreen, onNavigate }) => (
  <nav className="nav-rail" aria-label="Primary">
    {items.map((item) => (
      <button
        key={item.key}
        className={`bottom-nav-item nav-rail-item ${currentScreen === item.key ? 'active' : ''}`}
        onClick={() => onNavigate(item.key)}
        aria-label={item.label}
        aria-current={currentScreen === item.key ? 'page' : undefined}
      >
        <span className="bottom-nav-icon">{item.icon}</span>
        <span className="bottom-nav-label">{item.label}</span>
      </button>
    ))}
  </nav>
);

export default NavRail;
