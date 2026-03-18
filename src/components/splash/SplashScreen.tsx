'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const needsSwRefresh = () => {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && !sessionStorage.getItem('sw-activated');
};

export default function SplashScreen({ 
  onComplete, 
  duration = 3000,
}: SplashScreenProps) {
  const [isHidden, setIsHidden] = useState(false);
  const [waitingForSw, setWaitingForSw] = useState(needsSwRefresh);
  const hasCompletedRef = useRef(false);

  // If the SW hasn't been activated yet, wait for it and reload once.
  // We only render the static logo (no animations) during this phase so the
  // reload doesn't look like the splash is restarting.
  useEffect(() => {
    if (!waitingForSw) return;

    if (!('serviceWorker' in navigator)) {
      setWaitingForSw(false);
      return;
    }

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        sessionStorage.setItem('sw-activated', 'true');
        window.location.reload();
      } else {
        setWaitingForSw(false);
      }
    });
  }, [waitingForSw]);

  // 3-second timer only starts after the SW check is done (or skipped).
  useEffect(() => {
    if (waitingForSw) return;

    const timer = setTimeout(() => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      setIsHidden(true);
      setTimeout(onComplete, 600);
    }, duration);

    return () => clearTimeout(timer);
  }, [waitingForSw, duration, onComplete]);

  // Pre-refresh: show only the static background + logo (no animation).
  // This way the reload is near-invisible — same screen before and after.
  if (waitingForSw) {
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
    <div className={`splash-screen ${isHidden ? 'hidden' : ''}`}>
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
