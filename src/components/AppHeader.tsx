'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Globe, LogOut, RefreshCw, Layers, Menu, LogIn, ArrowLeft, MoreVertical } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  getOdooEmployee,
  getSelectedSA,
  clearSelectedSA,
} from '@/lib/ov-auth';
import { clearAllAuth } from '@/lib/attendant-auth';

export interface OverflowMenuItem {
  /** Stable key for React. */
  key: string;
  /** Visible label. */
  label: string;
  /** Optional icon (Lucide icon node). */
  icon?: React.ReactNode;
  /** Click handler. The menu closes automatically after the click. */
  onClick: () => void;
  /** Render the item in destructive (red) styling. */
  danger?: boolean;
  /** Disable the item. */
  disabled?: boolean;
}

interface AppHeaderProps {
  /**
   * Called when the user taps "Switch Service Account" in the profile menu.
   * If omitted, defaults to clearSelectedSA() + router.push('/').
   */
  onSwitchSA?: () => void;
  /** If provided, shows a hamburger button on the left that calls this on press. */
  onMenuOpen?: () => void;
  /**
   * When provided, replaces the avatar with a visible "Sign In" button.
   * Use this on unauthenticated pages (public landing, etc.).
   */
  onSignIn?: () => void;
  /**
   * When true, shows a back arrow button on the left (mutually exclusive with onMenuOpen).
   * Defaults to false.
   */
  showBack?: boolean;
  /**
   * Custom back handler. Defaults to navigating to '/' (roles page).
   */
  onBack?: () => void;
  /**
   * When provided, replaces the logo with a page title in the header center.
   * Use this on drill-down sub-pages (e.g. device details).
   */
  title?: string;
  /**
   * When provided, replaces the avatar/sign-in slot in the right area.
   * Use this to surface contextual actions (e.g. disconnect button) on sub-pages.
   */
  actions?: React.ReactNode;
  /**
   * Items for a workflow-scope overflow menu (kebab) rendered to the LEFT of
   * the avatar. Use this for screen/flow actions like "End session" or
   * "Refresh quota" — keeping them in the header chrome instead of floating
   * pills above the workflow content. Empty array hides the kebab.
   */
  overflowMenu?: OverflowMenuItem[];
}

export default function AppHeader({ onSwitchSA, onMenuOpen, onSignIn, showBack = false, onBack, title, actions, overflowMenu }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 16 });
  // Overflow (kebab) menu state — separate from the avatar dropdown so the
  // workflow-scope actions don't get hidden under the account menu.
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const overflowDropdownRef = useRef<HTMLDivElement>(null);
  const [overflowPos, setOverflowPos] = useState<{ top: number; right: number }>({ top: 0, right: 16 });

  const employee = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getOdooEmployee();
  }, []);

  /** Re-read when routes change so the chip updates after SA selection / switch. */
  const selectedSA = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSelectedSA();
  }, [pathname]);

  const handleBack = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    if (navResetRef.current) clearTimeout(navResetRef.current);
    navResetRef.current = setTimeout(() => setIsNavigating(false), 600);
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  }, [onBack, router, isNavigating]);

  // When opening, compute the fixed position from the avatar button's viewport rect.
  // This escapes any overflow:hidden ancestor (e.g. select-role-container).
  const handleAvatarClick = useCallback(() => {
    if (avatarBtnRef.current) {
      const rect = avatarBtnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(v => !v);
  }, []);

  // Close when clicking outside both the button and the dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        avatarBtnRef.current && !avatarBtnRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Overflow (kebab) menu: anchor to its own button, close on outside click.
  const handleOverflowClick = useCallback(() => {
    if (overflowBtnRef.current) {
      const rect = overflowBtnRef.current.getBoundingClientRect();
      setOverflowPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOverflowOpen(v => !v);
  }, []);

  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        overflowDropdownRef.current && !overflowDropdownRef.current.contains(target) &&
        overflowBtnRef.current && !overflowBtnRef.current.contains(target)
      ) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  const initial = (employee?.name || employee?.email || 'U').charAt(0).toUpperCase();

  const handleLocale = () => {
    const next = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(next);
  };

  const handleSwitchSA = () => {
    setOpen(false);
    if (onSwitchSA) {
      onSwitchSA();
    } else {
      clearSelectedSA();
      router.push('/');
    }
  };

  const handleSignOut = () => {
    setOpen(false);
    clearAllAuth();
    router.replace('/signin');
  };

  return (
    <>
      <header className="flow-header">
        <div className="flow-header-inner">
          {/* Left: back arrow (applets) OR hamburger (layout) + logo/title */}
          <div className="flow-header-left">
            {showBack ? (
              <button
                className="flow-header-back"
                onClick={handleBack}
                disabled={isNavigating}
                aria-label={t('common.back') || 'Back'}
              >
                <ArrowLeft size={18} />
              </button>
            ) : onMenuOpen ? (
              <button
                className="flow-header-back"
                onClick={onMenuOpen}
                aria-label={t('common.menu') || 'Menu'}
              >
                <Menu size={16} />
              </button>
            ) : null}
            {!title && (
              <button
                className="app-header-logo-btn"
                onClick={() => router.push('/')}
                aria-label="Home"
              >
                <Image
                  src="/assets/Logo-Oves.png"
                  alt="Omnivoltaic"
                  width={100}
                  height={28}
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </button>
            )}
          </div>

          {/* Center: page title (only on sub-pages) */}
          {title && (
            <span className="flow-header-title">{title}</span>
          )}

          {/* Right: active SA (when signed in), theme toggle, contextual actions or avatar */}
          <div className="flow-header-right">
            {selectedSA && !onSignIn && (
              <button
                type="button"
                className="app-header-sa-chip"
                onClick={handleSwitchSA}
                aria-label={`${t('sa.switchAccount') || 'Switch Service Account'}: ${selectedSA.name}`}
              >
                <Layers size={11} aria-hidden />
                <span className="app-header-sa-chip-name">{selectedSA.name}</span>
              </button>
            )}
            <ThemeToggle />
            {overflowMenu && overflowMenu.length > 0 && (
              <button
                ref={overflowBtnRef}
                type="button"
                className="app-header-overflow-btn"
                onClick={handleOverflowClick}
                aria-label={t('common.moreActions') || 'More actions'}
                aria-haspopup="menu"
                aria-expanded={overflowOpen}
              >
                <MoreVertical size={18} />
              </button>
            )}
            {actions != null ? actions : onSignIn ? (
              <button
                className="flow-header-lang"
                onClick={onSignIn}
                aria-label={t('auth.signIn') || 'Sign In'}
                style={{ gap: 6 }}
              >
                <LogIn size={14} />
                <span className="flow-header-lang-label">{t('auth.signIn') || 'Sign In'}</span>
              </button>
            ) : (
              <button
                ref={avatarBtnRef}
                className="app-header-avatar-btn"
                onClick={handleAvatarClick}
                aria-label={t('common.menu') || 'User menu'}
                aria-expanded={open}
              >
                <span className="app-header-avatar-initial">{initial}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Dropdown rendered as a fixed overlay so it escapes any overflow:hidden container */}
      {open && (
        <div
          ref={dropdownRef}
          className="app-header-dropdown"
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
        >
          {/* User identity */}
          <div className="app-header-dropdown-user">
            <div className="app-header-dropdown-avatar">
              <span className="app-header-avatar-initial app-header-avatar-initial--lg">
                {initial}
              </span>
            </div>
            <div className="app-header-dropdown-info">
              <p className="app-header-dropdown-name">{employee?.name || 'User'}</p>
              {employee?.email && (
                <p className="app-header-dropdown-email">{employee.email}</p>
              )}
              {selectedSA && (
                <p className="app-header-dropdown-sa">
                  <Layers size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                  {selectedSA.name}
                </p>
              )}
            </div>
          </div>

          <div className="app-header-dropdown-divider" />

          {/* Language */}
          <button className="app-header-dropdown-item" onClick={handleLocale}>
            <Globe size={14} />
            <span>{t('role.switchLanguage') || 'Select Language'}</span>
            <span className="app-header-dropdown-badge">{locale.toUpperCase()}</span>
          </button>

          <div className="app-header-dropdown-divider" />

          {/* Switch SA — only shown when an SA is already active */}
          {selectedSA && (
            <button className="app-header-dropdown-item" onClick={handleSwitchSA}>
              <RefreshCw size={14} />
              <span>{t('sa.switchAccount') || 'Switch Service Account'}</span>
            </button>
          )}

          {/* Sign out — hidden on the signin page itself */}
          {pathname !== '/signin' && (
            <button
              className="app-header-dropdown-item app-header-dropdown-item--danger"
              onClick={handleSignOut}
            >
              <LogOut size={14} />
              <span>{t('sa.signOut') || 'Sign Out'}</span>
            </button>
          )}
        </div>
      )}

      {/* Overflow (workflow-scope) dropdown */}
      {overflowOpen && overflowMenu && overflowMenu.length > 0 && (
        <div
          ref={overflowDropdownRef}
          className="app-header-dropdown app-header-dropdown--overflow"
          role="menu"
          style={{ top: overflowPos.top, right: overflowPos.right }}
        >
          {overflowMenu.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={
                'app-header-dropdown-item' +
                (item.danger ? ' app-header-dropdown-item--danger' : '')
              }
              onClick={() => {
                setOverflowOpen(false);
                item.onClick();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
