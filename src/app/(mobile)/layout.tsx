'use client';

import { useState } from 'react';
import Sidebar from '../../components/sidebar/sidebar';
import { isAuth } from '@/lib/auth';
import AppHeader from '@/components/AppHeader';
import { useKeyboardVisible } from '@/lib/useKeyboardVisible';

function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useKeyboardVisible();

  // The #html-splash overlay used to be dismissed here, for users who
  // deep-link straight into a tool page. <DismissHtmlSplash /> in the root
  // layout now covers every route, including /signin and 404s, which this
  // copy never could.

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Navigation sidebar (cross-section navigation within applets) */}
      {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        />
      )}

      {/* Unified app header — hamburger opens sidebar, avatar opens profile menu */}
      <AppHeader onMenuOpen={() => setSidebarOpen(true)} />

      <main className={`${sidebarOpen ? 'opacity-30' : ''} transition-opacity duration-300 p-4`}>
        {children}
      </main>
    </div>
  );
}

export default isAuth(MobileLayout);
