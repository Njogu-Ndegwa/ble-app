'use client';

import { useState } from 'react';
import Sidebar from '../../components/sidebar/sidebar';   // wherever you put the sidebar file
import { User } from 'lucide-react';
import { isAuth } from '@/lib/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useI18n } from '@/i18n';
import Image from 'next/image';

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

      {/* Header with Logo */}
      <header className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Left: Profile Button */}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200"
          style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border)',
          }}
          aria-label="Open profile menu"
        >
          <User className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </button>

        {/* Center: Logo */}
        <div className="flex-1 flex justify-center">
          <Image
            src="/assets/Logo-Oves.png"
            alt="Omnivoltaic"
            width={100}
            height={32}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        {/* Right: Language Switcher */}
        <LanguageSwitcher />
      </header>

      <main className={`${open ? 'opacity-30' : ''} transition-opacity duration-300 p-4`}>
        {children}
      </main>
    </div>
  );
}

export default isAuth(MobileLayout);