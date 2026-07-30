"use client";

import React from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav, { type NavItem } from '@/components/ui/BottomNav';
import NavRail from './NavRail';
import type { ContentWidth } from './ContentColumn';

export interface AppShellNav {
  items: NavItem[];
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export interface AppShellHeader {
  showBack?: boolean;
  onBack?: () => void;
  onMenuOpen?: () => void;
  onSwitchSA?: () => void;
  onSignIn?: () => void;
  title?: string;
  actions?: React.ReactNode;
  overflowMenu?: React.ComponentProps<typeof AppHeader>['overflowMenu'];
}

export interface AppShellProps {
  children: React.ReactNode;
  /** AppHeader props passthrough; `false` renders no header (applet owns it). */
  header?: AppShellHeader | false;
  /** Responsive navigation: bottom tab bar <lg, left rail >=lg. */
  nav?: AppShellNav;
  /** Fixed bottom content (action bars); width-capped to the content column. */
  bottomBar?: React.ReactNode;
  background?: 'gradient' | 'plain';
  /** Which --content-* token caps the scrollable content column. */
  width?: ContentWidth;
  className?: string;
}

/**
 * AppShell — the one applet shell.
 *
 * Replaces the five duplicated `*-container` fixed shells in globals.css
 * (.sales-container, .attendant-container, .rider-container,
 * .login-page-container, .select-role-container). Base styles reproduce the
 * mobile shell exactly; at lg+ the shell becomes a row with a nav rail on the
 * left (when `nav` is provided). All shell CSS lives in the SHELL/NAV sections
 * of src/styles/responsive.css — never add per-applet shell CSS.
 */
const AppShell: React.FC<AppShellProps> = ({
  children,
  header,
  nav,
  bottomBar,
  background = 'gradient',
  width = 'default',
  className = '',
}) => (
  <div className={`app-shell ${className}`.trim()}>
    {nav && (
      <NavRail
        items={nav.items}
        currentScreen={nav.currentScreen}
        onNavigate={nav.onNavigate}
      />
    )}
    <div className="app-shell-body">
      {background === 'gradient' && <div className="app-shell-bg-gradient" />}
      {header !== false && <AppHeader {...(header ?? {})} />}
      <main className={`app-shell-main app-shell-main--${width}${nav || bottomBar ? ' app-shell-main--with-bottom' : ''}`}>
        {children}
      </main>
      {(bottomBar || nav) && (
        <div className="app-shell-bottom">
          {bottomBar}
          {nav && (
            <BottomNav
              items={nav.items}
              currentScreen={nav.currentScreen}
              onNavigate={nav.onNavigate}
              className="app-nav-bottom"
            />
          )}
        </div>
      )}
    </div>
  </div>
);

export default AppShell;
