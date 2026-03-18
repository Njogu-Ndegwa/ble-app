'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export default function SplashScreen({ 
  onComplete, 
  duration = 3000,
}: SplashScreenProps) {
  const [isHidden, setIsHidden] = useState(false);
  const hasCompletedRef = useRef(false);

  // One-time masked refresh so the service worker can take control and cache assets.
  // On first visit the SW installs in the background but can't serve the current page load.
  // Reloading while the splash is visible lets the SW intercept requests and populate caches.
  // sessionStorage resets each WebView session, so a fresh app open re-triggers caching.
  useEffect(() => {
    if ('serviceWorker' in navigator && !sessionStorage.getItem('sw-activated')) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          sessionStorage.setItem('sw-activated', 'true');
          window.location.reload();
        }
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      setIsHidden(true);
      setTimeout(onComplete, 600);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

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
