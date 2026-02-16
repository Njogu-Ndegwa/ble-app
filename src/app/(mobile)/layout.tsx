'use client';

import { useState } from 'react';
import Sidebar from '../../components/sidebar/sidebar';   // wherever you put the sidebar file
import { User } from 'lucide-react';
import { isAuth } from '@/lib/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/i18n';
import Image from 'next/image';
import ThemeToggle from '@/components/ui/ThemeToggle';

function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {open && <Sidebar onClose={() => setOpen(false)} />}

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        />
      )}

      {/* Header with Profile + Logo on left, Language Switcher on right */}
      <header className="flow-header" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button
              onClick={() => setOpen(true)}
              className="flow-header-back"
              aria-label="Open profile menu"
            >
              <User className="w-4 h-4" />
            </button>
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
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className={`${open ? 'opacity-30' : ''} transition-opacity duration-300 p-4`}>
        {children}
      </main>
    </div>
  );
}

export default isAuth(MobileLayout);