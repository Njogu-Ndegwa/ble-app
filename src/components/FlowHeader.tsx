'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Globe } from 'lucide-react';
import { useI18n } from '@/i18n';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface FlowHeaderProps {
  showBack?: boolean;
  backPath?: string;
  onBack?: () => void;
  title?: string;
}

/**
 * Shared header component for new design flow pages.
 * Includes language switcher and optional back navigation.
 * Also manages body overflow for fixed containers.
 */
export default function FlowHeader({ showBack = true, backPath, onBack, title }: FlowHeaderProps) {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const navResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock body overflow when this component mounts (for fixed container pages)
  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  const handleBack = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    if (navResetRef.current) clearTimeout(navResetRef.current);
    navResetRef.current = setTimeout(() => setIsNavigating(false), 600);
    if (onBack) {
      onBack();
    } else if (backPath) {
      router.push(backPath);
    } else {
      router.back();
    }
  }, [onBack, backPath, router, isNavigating]);

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  };

  return (
    <header className="flow-header">
      <div className="flow-header-inner">
        {showBack ? (
          <button
            className="flow-header-back"
            onClick={handleBack}
            disabled={isNavigating}
            aria-label={t('Back')}
          >
            <ArrowLeft size={18} />
            <span>{t('Back')}</span>
          </button>
        ) : (
          <div className="flow-header-spacer" />
        )}
        
        {title && <h1 className="flow-header-title">{title}</h1>}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ThemeToggle />
          <button
            className="flow-header-lang"
            onClick={toggleLocale}
            aria-label={t('role.switchLanguage') || 'Select Language'}
          >
            <Globe size={16} />
            <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
