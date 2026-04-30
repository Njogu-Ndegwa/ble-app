'use client';

import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '@/i18n';
import AppHeader from '@/components/AppHeader';

interface Props {
  onSignIn: () => void;
}

export default function PublicLanding({ onSignIn }: Props) {
  const router = useRouter();
  const { t } = useI18n();

  const handleKeypadClick = () => {
    router.push('/keypad/keypad');
  };

  const handleBleDevicesClick = () => {
    router.push('/assets/ble-devices');
  };

  const PUBLIC_APPS = [
    {
      id: 'keypad',
      label: t('role.keypad'),
      icon: '/assets/Keypad2.svg',
      gradient: 'role-grad-keypad',
      onClick: handleKeypadClick,
    },
    {
      id: 'bleDeviceManager',
      label: t('role.bleDeviceManager'),
      icon: '/assets/BleDeviceAttendant.svg',
      gradient: 'role-grad-ble',
      onClick: handleBleDevicesClick,
    },
  ];

  return (
    <div className="select-role-container">
      <div className="select-role-bg-gradient" />

      <AppHeader onSignIn={onSignIn} />

      <main className="select-role-main">
        <div className="role-selection">
          {/* Hero card */}
          <div className="role-hero-card">
            <div className="role-hero-card-bg" />
            <div className="role-hero-card-img">
              <Image
                src="/assets/Bikes Oves.png"
                alt="Electric Bikes"
                width={320}
                height={200}
                priority
              />
            </div>
            <div className="role-hero-card-content">
              <div className="role-hero-card-pill">
                <Zap size={10} />
                <span>E-Mobility</span>
              </div>
              <h1 className="role-title">{t('role.selectTitle')}</h1>
              <p className="role-description" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.publicAppsDescription')}
              </p>
            </div>
          </div>

          {/* Public apps */}
          <div className="role-grid">
            {PUBLIC_APPS.map((app, idx) => (
              <div
                key={app.id}
                className="role-app"
                onClick={app.onClick}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className={`role-app-icon ${app.gradient}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={app.icon}
                    alt={app.label}
                    className="role-app-icon-img"
                    draggable={false}
                  />
                </div>
                <span className="role-app-label">{app.label}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            {t('auth.signInPrompt')}
          </p>
        </div>
      </main>
    </div>
  );
}
