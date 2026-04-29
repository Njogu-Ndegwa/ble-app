'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Globe, LogIn, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface Props {
  onSignIn: () => void;
}

export default function PublicLanding({ onSignIn }: Props) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  };

  const handleKeypadClick = () => {
    router.push('/keypad/keypad');
  };

  return (
    <div className="select-role-container">
      <div className="select-role-bg-gradient" />

      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <div className="flow-header-logo">
              <Image
                src="/assets/Logo-Oves.png"
                alt="Omnivoltaic"
                width={100}
                height={28}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label={t('role.switchLanguage')}
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

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
                {t('auth.signInToAccessApps')}
              </p>
            </div>
          </div>

          {/* Keypad — the only public applet */}
          <div className="role-grid" style={{ marginBottom: 24 }}>
            <div
              className="role-app"
              onClick={handleKeypadClick}
              style={{ animationDelay: '0ms' }}
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

          {/* Sign In CTA */}
          <div style={{ width: '100%', maxWidth: 420, padding: '0 4px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 12 }}>
              {t('auth.signInPrompt')}
            </p>
            <button
              className="btn btn-primary login-btn"
              onClick={onSignIn}
            >
              <LogIn size={16} />
              <span>{t('auth.signIn')}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
