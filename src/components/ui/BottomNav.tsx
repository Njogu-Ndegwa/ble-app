"use client";

import React from 'react';

/**
 * Navigation item configuration
 */
export interface NavItem {
  /** Unique key for the screen/route */
  key: string;
  /** Display label for the nav item */
  label: string;
  /** SVG icon as a React node or JSX */
  icon: React.ReactNode;
}

/**
 * BottomNav props
 */
export interface BottomNavProps {
  /** Array of navigation items to display */
  items: NavItem[];
  /** Currently active screen key */
  currentScreen: string;
  /** Callback when a nav item is clicked */
  onNavigate: (screen: string) => void;
  /** Optional additional className for custom styling */
  className?: string;
}

/**
 * BottomNav - Reusable bottom navigation component
 * 
 * A flexible bottom navigation bar that can be configured with different
 * items for different app contexts (Rider, Attendant, Sales, etc.)
 * 
 * @example
 * ```tsx
 * const navItems: NavItem[] = [
 *   { key: 'home', label: 'Home', icon: <HomeIcon /> },
 *   { key: 'profile', label: 'Profile', icon: <ProfileIcon /> },
 * ];
 * 
 * <BottomNav
 *   items={navItems}
 *   currentScreen={currentScreen}
 *   onNavigate={setCurrentScreen}
 * />
 * ```
 */
const BottomNav: React.FC<BottomNavProps> = ({ 
  items, 
  currentScreen, 
  onNavigate,
  className = '',
}) => {
  return (
    <nav className={`bottom-nav ${className}`.trim()}>
      {items.map((item) => (
        <button
          key={item.key}
          className={`bottom-nav-item ${currentScreen === item.key ? 'active' : ''}`}
          onClick={() => onNavigate(item.key)}
          aria-label={item.label}
          aria-current={currentScreen === item.key ? 'page' : undefined}
        >
          <span className="bottom-nav-icon">
            {item.icon}
          </span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;

// ============================================
// Pre-built Icon Components for common nav items
// ============================================

export const NavIcons = {
  /** Home icon */
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  
  /** Stations/Map pin icon */
  stations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  
  /** Activity/Clock icon */
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  
  /** Profile/User icon */
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  
  /** Swap icon (bidirectional arrows) */
  swap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4M7 4L3 8M7 4L11 8"/>
      <path d="M17 8v12M17 20l4-4M17 20l-4-4"/>
    </svg>
  ),
  
  /** Transactions/Card icon */
  transactions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M7 15h0M2 9.5h20"/>
    </svg>
  ),
  
  /** Sessions/History icon */
  sessions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  
  /** Customers/People icon */
  customers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  
  /** Sales/Shopping bag icon */
  sales: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  
  /** Settings/Gear icon */
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
};
