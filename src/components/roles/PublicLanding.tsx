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

          {/* Public apps — Keypad only */}
          <div className="role-grid">
            <div
              className="role-app"
              onClick={() => router.push('/keypad/keypad')}
            >
              <div className="role-app-icon role-grad-keypad">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/Keypad2.svg"
                  alt={t('role.keypad')}
                  className="role-app-icon-img"
                  draggable={false}
                />
              </div>
              <span className="role-app-label">{t('role.keypad')}</span>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            {t('auth.signInPrompt')}
          </p>
        </div>
      </main>
    </div>
  );
}
