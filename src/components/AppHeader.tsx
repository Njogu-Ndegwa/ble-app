'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Globe, LogOut, RefreshCw, Layers, Menu } from 'lucide-react';
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
  /** If provided, shows a hamburger/menu button that calls this on press. */
  onMenuOpen?: () => void;
}

export default function AppHeader({ onSwitchSA, onMenuOpen }: AppHeaderProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const employee = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getOdooEmployee();
  }, []);

  const selectedSA = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getSelectedSA();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
    <header className="flow-header" style={{ borderBottom: '1px solid var(--border-default)' }}>
      <div className="flow-header-inner">
        {/* Left: optional menu button + logo */}
        <div className="flow-header-left">
          {onMenuOpen && (
            <button
              className="flow-header-back"
              onClick={onMenuOpen}
              aria-label={t('common.menu') || 'Menu'}
            >
              <Menu size={16} />
            </button>
          )}
          <button
            className="flow-header-logo app-header-logo-btn"
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

        {/* Right: theme toggle + user avatar dropdown */}
        <div className="flow-header-right">
          <ThemeToggle />

          <div className="app-header-profile" ref={menuRef}>
            <button
              className="app-header-avatar-btn"
              onClick={() => setOpen(v => !v)}
              aria-label={t('common.menu') || 'User menu'}
              aria-expanded={open}
            >
              <span className="app-header-avatar-initial">{initial}</span>
            </button>

            {open && (
              <div className="app-header-dropdown">
                  {/* User identity block */}
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

                  {/* Language toggle */}
                  <button className="app-header-dropdown-item" onClick={handleLocale}>
                    <Globe size={14} />
                    <span>{t('role.switchLanguage') || 'Language'}</span>
                    <span className="app-header-dropdown-badge">{locale.toUpperCase()}</span>
                  </button>

                  <div className="app-header-dropdown-divider" />

                  {/* Switch SA — only shown when an SA is already selected */}
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
          </div>
        </div>
      </div>
    </header>
  );
}
