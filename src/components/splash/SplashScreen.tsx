'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { preloadRoleIcons } from '@/lib/preload-icons';

interface SplashScreenProps {
  onComplete: () => void;
  /** Total animation display time in ms. Default 1200ms. */
  duration?: number;
}

type Phase = 'init' | 'animating' | 'hiding';

function dismissHtmlSplash() {
  const el = document.getElementById('html-splash');
  if (!el) return;
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  setTimeout(() => {
    el.style.display = 'none';
  }, 350);
}

export default function SplashScreen({ 
  onComplete, 
  duration = 1200,
}: SplashScreenProps) {
  // Always start in 'init' — identical on server and client, avoids hydration
  // mismatch. The init phase renders a static logo that matches the HTML splash
  // in layout.tsx, so the user sees one unbroken screen.
  const [phase, setPhase] = useState<Phase>('init');
  const hasCompletedRef = useRef(false);

  // After hydration: wait for the SW to activate on first session, then start
  // the animation. clientsClaim:true in sw.js hands control to the SW without
  // a page reload, so we go straight from SW-ready → animation.
  useEffect(() => {
    const swSupported = 'serviceWorker' in navigator;
    const alreadyActivated = sessionStorage.getItem('sw-activated') === 'true';

    if (!swSupported || alreadyActivated) {
      dismissHtmlSplash();
      setPhase('animating');
      return;
    }

    let settled = false;

    // Adaptive cap: if the SW is already controlling this page it will respond
    // in <100ms, so 500ms is generous. For a first install (controller===null)
    // the SW must download and precache before activating — give it 1500ms.
    const alreadyControlled = !!navigator.serviceWorker.controller;
    const timeoutMs = alreadyControlled ? 500 : 1500;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      dismissHtmlSplash();
      setPhase('animating');
    }, timeoutMs);

    navigator.serviceWorker.ready.then(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      // sw.js uses clientsClaim:true + skipWaiting:true, so the SW already
      // controls this page as soon as it activates — no reload is needed to
      // hand off control. Precaching happens during install (before this
      // point), so offline mode is fully intact.
      sessionStorage.setItem('sw-activated', 'true');
      dismissHtmlSplash();
      setPhase('animating');
    });

    return () => clearTimeout(timeout);
  }, []);

  // Animation timer — only runs once phase becomes 'animating'.
  useEffect(() => {
    if (phase !== 'animating') return;

    // Use the splash window to warm the browser cache for role-grid icons so
    // they're already fetched by the time SelectRole mounts.
    preloadRoleIcons();

    const timer = setTimeout(() => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      setPhase('hiding');
      // 300ms matches the CSS fade-out transition on .splash-screen.hidden
      setTimeout(onComplete, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [phase, duration, onComplete]);

  // Init phase: static logo only — matches the HTML splash in layout.tsx
  // exactly, so SSR → hydration → possible reload all look the same.
  if (phase === 'init') {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <Image 
            src="/assets/Logo-Oves.png" 
            alt="Oves" 
            width={192}
            height={48}
            className="splash-logo-img"
            priority
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`splash-screen ${phase === 'hiding' ? 'hidden' : ''}`}>
      <div className="splash-content">
        {/* Battery Swap Animation */}
        <div className="splash-animation">
          <div className="splash-arrows">
            <svg className="splash-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-8 8h5v8h6v-8h5z"/>
            </svg>
            <svg className="splash-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-8 8h5v8h6v-8h5z"/>
            </svg>
            <svg className="splash-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-8 8h5v8h6v-8h5z"/>
            </svg>
          </div>
          
          <div className="splash-battery">
            <div className="splash-battery-fill"></div>
          </div>
          
          <div className="splash-particles">
            <div className="splash-particle"></div>
            <div className="splash-particle"></div>
            <div className="splash-particle"></div>
            <div className="splash-particle"></div>
          </div>
        </div>

        <Image 
          src="/assets/Logo-Oves.png" 
          alt="Oves" 
          width={192}
          height={48}
          className="splash-logo-img"
          priority
        />
        
        <div className="splash-loading">
          <div className="splash-loading-dots">
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
