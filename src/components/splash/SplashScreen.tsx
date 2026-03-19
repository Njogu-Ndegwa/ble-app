'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete: () => void;
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
  duration = 3000,
}: SplashScreenProps) {
  // Always start in 'init' — identical on server and client, avoids hydration
  // mismatch. The init phase renders a static logo that matches the HTML splash
  // in layout.tsx, so the user sees one unbroken screen.
  const [phase, setPhase] = useState<Phase>('init');
  const hasCompletedRef = useRef(false);

  // After hydration: check if the SW needs its first-activation reload.
  // If yes, the reload fires while the user still sees the static logo
  // (the HTML splash in layout.tsx re-appears instantly on reload).
  // If no, we move straight to the battery animation.
  useEffect(() => {
    const swSupported = 'serviceWorker' in navigator;
    const alreadyActivated = sessionStorage.getItem('sw-activated') === 'true';

    if (!swSupported || alreadyActivated) {
      dismissHtmlSplash();
      setPhase('animating');
      return;
    }

    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      dismissHtmlSplash();
      setPhase('animating');
    }, 4000);

    navigator.serviceWorker.ready.then((registration) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (registration.active) {
        sessionStorage.setItem('sw-activated', 'true');
        window.location.reload();
      } else {
        dismissHtmlSplash();
        setPhase('animating');
      }
    });

    return () => clearTimeout(timeout);
  }, []);

  // Animation timer — only runs once phase becomes 'animating'.
  useEffect(() => {
    if (phase !== 'animating') return;

    const timer = setTimeout(() => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      setPhase('hiding');
      setTimeout(onComplete, 600);
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
