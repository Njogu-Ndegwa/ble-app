'use client';

import { useEffect, type ComponentType } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Globe,
  BatteryCharging,
  BadgeDollarSign,
  Bike,
  KeyRound,
  Bluetooth,
  Zap,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface RoleConfig {
  id: string;
  labelKey: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  gradient: string;
  path: string;
  disabled?: boolean;
  badgeKey?: string;
}

const roles: RoleConfig[] = [
  {
    id: 'attendant',
    labelKey: 'role.attendant',
    icon: BatteryCharging,
    gradient: 'role-grad-attendant',
    path: '/attendant/attendant',
  },
  {
    id: 'sales',
    labelKey: 'role.salesRep',
    icon: BadgeDollarSign,
    gradient: 'role-grad-sales',
    path: '/customers/customerform',
  },
  {
    id: 'rider',
    labelKey: 'role.rider',
    icon: Bike,
    gradient: 'role-grad-rider',
    path: '/rider/app',
  },
  {
    id: 'keypad',
    labelKey: 'role.keypad',
    icon: KeyRound,
    gradient: 'role-grad-keypad',
    path: '/keypad/keypad',
  },
  {
    id: 'bleDeviceManager',
    labelKey: 'role.bleDeviceManager',
    icon: Bluetooth,
    gradient: 'role-grad-ble',
    path: '/assets/ble-devices',
  },
];

export default function SelectRole() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  useEffect(() => {
    for (const role of roles) {
      if (!role.disabled) {
        router.prefetch(role.path);
      }
    }
  }, [router]);

  const handleRoleClick = (role: RoleConfig) => {
    if (role.disabled) return;
    router.push(role.path);
  };

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
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
          {/* Hero banner */}
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
              <p className="role-description">
                {t('role.selectDescription')}
              </p>
            </div>
          </div>

          {/* App icon grid */}
          <div className="role-grid">
            {roles.map((role, i) => {
              const Icon = role.icon;
              return (
                <div
                  key={role.id}
                  className={`role-app ${role.disabled ? 'disabled' : ''}`}
                  onClick={() => handleRoleClick(role)}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div className={`role-app-icon ${role.gradient}`}>
                    <Icon strokeWidth={1.7} />
                    {role.badgeKey && (
                      <span className="role-app-badge">{t(role.badgeKey)}</span>
                    )}
                  </div>
                  <span className="role-app-label">{t(role.labelKey)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
