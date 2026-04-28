"use client";

import React from 'react';
import { Globe, ChevronRight, Bluetooth, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface DeviceManagerProfileProps {
  onChangeRole: () => void;
  toolLabel?: string;
}

const DeviceManagerProfile: React.FC<DeviceManagerProfileProps> = ({
  onChangeRole,
  toolLabel,
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
        <div
          className="rounded-lg"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
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
              {t('ble.profile.toolSubtitle') || 'Field tool for technicians'}
            </div>
          </div>
        </div>

        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
        >
          <div
            style={{
              padding: '12px 16px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {t('ble.profile.preferences') || 'Preferences'}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ color: 'var(--text-primary)', fontSize: 14 }}>
              {t('ble.profile.theme') || 'Theme'}
            </div>
            <ThemeToggle />
          </div>

          <button
            onClick={cycleLocale}
            style={{
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
            }}
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

        <button
          onClick={onChangeRole}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
            {t('ble.profile.changeRole') || 'Change Role'}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  );
};

export default DeviceManagerProfile;
