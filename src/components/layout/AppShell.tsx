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
 * The forward path for applet shells, replacing the five duplicated
 * `*-container` shells in globals.css (.sales-container, .attendant-container,
 * .rider-container, .login-page-container, .select-role-container). Those five
 * are frozen, not yet gone — several applets still use them, so don't assume
 * this is the only shell in the app.
 *
 * Base styles reproduce the mobile shell exactly; at the split breakpoint the
 * shell becomes a row with a nav rail on the left (when `nav` is provided).
 *
 * The `width` variant is declared on the ROOT, not on <main>, so that
 * --shell-width cascades to the bottom bar, the tab bar and the FAB. That is
 * what keeps the content column and its chrome from disagreeing about width —
 * they read one inherited variable rather than each picking a --content-* token.
 * All shell CSS lives in the SHELL/NAV sections of src/styles/responsive.css —
 * never add per-applet shell CSS.
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
  <div className={`app-shell app-shell--${width} ${className}`.trim()}>
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
      <main className="app-shell-main">
        {children}
      </main>
      {bottomBar && <div className="app-shell-bottom">{bottomBar}</div>}
      {nav && (
        <BottomNav
          items={nav.items}
          currentScreen={nav.currentScreen}
          onNavigate={nav.onNavigate}
          className="app-nav-bottom"
        />
      )}
    </div>
  </div>
);

export default AppShell;
