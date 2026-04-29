'use client';

import { useState, useEffect } from 'react';
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

  // Dismiss the SSR HTML splash overlay (#html-splash) when any mobile page
  // mounts. Normally `src/app/page.tsx` does this after the SplashScreen
  // animation, but users who deep-link straight into a tool page (e.g.
  // /assets/ble-devices, /keypad/keypad, /mydevices/devices) never hit that
  // code path, so the splash sits on top forever and the page looks "stuck"
  // even though it rendered underneath.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('html-splash');
    if (!el) return;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    const id = window.setTimeout(() => {
      el.style.display = 'none';
    }, 350);
    try {
      sessionStorage.setItem('oves-splash-shown', 'true');
    } catch {
      /* ignore storage errors */
    }
    return () => window.clearTimeout(id);
  }, []);

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
