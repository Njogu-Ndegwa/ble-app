'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n';

interface RoleConfig {
  id: string;
  labelKey: string;
  image: string;
  path: string;
  disabled?: boolean;
  badgeKey?: string;
}

const roles: RoleConfig[] = [
  {
    id: 'attendant',
    labelKey: 'role.attendant',
    image: '/assets/Attendant.png',
    path: '/attendant/attendant',
  },
  {
    id: 'sales',
    labelKey: 'role.salesRep',
    image: '/assets/Sales.png',
    path: '/customers/customerform',
  },
  {
    id: 'keypad',
    labelKey: 'role.keypad',
    image: '/assets/Keypad.png',
    path: '/keypad/keypad',
  },
  {
    id: 'rider',
    labelKey: 'role.rider',
    image: '/assets/Rider.png',
    path: '/rider/serviceplan1',
    disabled: true,
    badgeKey: 'role.comingSoon',
  },
];

export default function SelectRole() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  // Lock body overflow for fixed container
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleRoleClick = (role: RoleConfig) => {
    if (role.disabled) return;
    router.push(role.path);
  };

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'fr' : 'en');
  };

  return (
    <div className="select-role-container">
      {/* Background gradient */}
      <div className="select-role-bg-gradient" />

      {/* Language Switcher Header */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-spacer" />
          <button
            className="flow-header-lang"
            onClick={toggleLocale}
            aria-label={t('role.switchLanguage')}
          >
            <Globe size={16} />
            <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
          </button>
        </div>
      </header>

      <main className="select-role-main">
        <div className="role-selection">
          {/* Hero Section with Bikes */}
          <div className="role-hero">
            <div className="role-hero-image">
              <Image
                src="/assets/Bikes Oves.png"
                alt="Electric Bikes"
                width={320}
                height={200}
                priority
              />
            </div>
            {/* Atmospheric effects */}
            <div className="role-hero-atmosphere" />
            <div className="role-hero-mist" />
            <div className="role-hero-reflect" />
          </div>

          {/* Title Section */}
          <div className="role-header">
            <h1 className="role-title">{t('role.selectTitle')}</h1>
            <p className="role-description">
              {t('role.selectDescription')}
            </p>
          </div>

          {/* Applet Grid */}
          <div className="role-grid">
            {roles.map((role) => (
              <div
                key={role.id}
                className={`role-applet ${role.disabled ? 'disabled' : ''}`}
                onClick={() => handleRoleClick(role)}
              >
                <div className="role-applet-image">
                  <Image
                    src={role.image}
                    alt={t(role.labelKey)}
                    width={100}
                    height={100}
                  />
                </div>
                <span className="role-applet-label">{t(role.labelKey)}</span>
                
                {role.badgeKey && (
                  <span className="role-applet-badge">{t(role.badgeKey)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
