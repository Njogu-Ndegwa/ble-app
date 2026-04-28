"use client";

import React from 'react';
import { Globe, ChevronRight, Bluetooth, ArrowLeft, LogOut } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface DeviceManagerProfileProps {
  onChangeRole: () => void;
  onLogout: () => void;
  toolLabel?: string;
  /** Optional override for the subtitle in the tool card */
  toolSubtitle?: string;
}

const sectionHeader: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
};

const cardSection: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  borderRadius: 12,
  overflow: 'hidden',
};

const rowBase: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 16px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontFamily: 'inherit',
  textAlign: 'left',
};

const DeviceManagerProfile: React.FC<DeviceManagerProfileProps> = ({
  onChangeRole,
  onLogout,
  toolLabel,
  toolSubtitle,
}) => {
  const { t, locale, setLocale } = useI18n();

  const cycleLocale = () => {
    const next = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(next);
  };

  const localeLabel =
    locale === 'en'
      ? t('common.language.english') || 'English'
      : locale === 'fr'
      ? t('common.language.french') || 'French'
      : t('common.language.chinese') || 'Chinese';

  return (
    <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
      <div className="p-4 max-w-md mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Tool card */}
        <div
          style={{
            ...cardSection,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bluetooth size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 16 }}>
              {toolLabel || t('ble.profile.toolName') || 'BLE Device Manager'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
              {toolSubtitle || t('ble.profile.toolSubtitle') || 'Field tool for technicians'}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div style={cardSection}>
          <div style={sectionHeader}>
            {t('ble.profile.preferences') || 'Preferences'}
          </div>

          <div
            style={{
              ...rowBase,
              cursor: 'default',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span>{t('ble.profile.theme') || 'Theme'}</span>
            <ThemeToggle />
          </div>

          <button
            onClick={cycleLocale}
            style={rowBase}
          >
            <span>{t('ble.profile.language') || 'Language'}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--text-secondary)',
                fontSize: 12,
              }}
            >
              <Globe size={14} />
              {localeLabel}
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </span>
          </button>
        </div>

        {/* Account */}
        <div style={cardSection}>
          <div style={sectionHeader}>
            {t('ble.menu.account') || 'Account'}
          </div>

          <button
            onClick={onChangeRole}
            style={{
              ...rowBase,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
              {t('ble.profile.changeRole') || 'Change Role'}
            </span>
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button
            onClick={onLogout}
            style={{
              ...rowBase,
              color: 'var(--color-error, #ef4444)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <LogOut size={16} />
              {t('common.logout') || 'Logout'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceManagerProfile;
