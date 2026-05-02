'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Globe, LogOut, RefreshCw, Layers, Menu, LogIn, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {
  getOdooEmployee,
  getSelectedSA,
  clearSelectedSA,
  clearOdooEmployeeSession,
} from '@/lib/ov-auth';

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
   * Custom back handler. Defaults to router.back().
   */
  onBack?: () => void;
}

export default function AppHeader({ onSwitchSA, onMenuOpen, onSignIn, showBack = false, onBack }: AppHeaderProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 16 });

  const employee = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getOdooEmployee();
  }, []);

  const selectedSA = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSelectedSA();
  }, []);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

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
    clearOdooEmployeeSession();
    router.replace('/signin');
  };

  return (
    <>
      <header className="flow-header">
        <div className="flow-header-inner">
          {/* Left: back arrow (applets) OR hamburger (layout) + logo */}
          <div className="flow-header-left">
            {showBack ? (
              <button
                className="flow-header-back"
                onClick={handleBack}
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
          </div>

          {/* Right: theme toggle + sign-in button (unauthenticated) or avatar (authenticated) */}
          <div className="flow-header-right">
            <ThemeToggle />
            {onSignIn ? (
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
            <span>{t('role.switchLanguage') || 'Language'}</span>
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

          {/* Sign out */}
          <button
            className="app-header-dropdown-item app-header-dropdown-item--danger"
            onClick={handleSignOut}
          >
            <LogOut size={14} />
            <span>{t('sa.signOut') || 'Sign Out'}</span>
          </button>
        </div>
      )}
    </>
  );
}
