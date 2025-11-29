'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useBridge } from '@/app/context/bridgeContext';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
  maxWaitTime?: number;
}

export default function SplashScreen({ 
  onComplete, 
  minDuration = 2000,  // Minimum time to show splash (for branding)
  maxWaitTime = 10000  // Maximum time to wait for initialization before proceeding anyway
}: SplashScreenProps) {
  const { isBridgeReady, isMqttConnected } = useBridge();
  const [isHidden, setIsHidden] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const hasCompletedRef = useRef(false);

  // Track minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration]);

  // Update status messages
  useEffect(() => {
    if (!isBridgeReady) {
      setStatus('Connecting to device...');
    } else if (!isMqttConnected) {
      setStatus('Connecting to server...');
    } else {
      setStatus('Ready!');
    }
  }, [isBridgeReady, isMqttConnected]);

  // Complete when everything is ready AND minimum time has passed
  useEffect(() => {
    if (hasCompletedRef.current) return;

    const isReady = isBridgeReady && isMqttConnected;
    
    if (isReady && minTimeElapsed) {
      hasCompletedRef.current = true;
      console.info('=== Splash Complete: Bridge and MQTT ready ===');
      setIsHidden(true);
      setTimeout(onComplete, 600);
    }
  }, [isBridgeReady, isMqttConnected, minTimeElapsed, onComplete]);

  // Fallback: proceed after max wait time even if not fully ready
  // (better to show the app than leave user stuck on splash)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        console.warn('=== Splash Complete: Max wait time reached ===', {
          isBridgeReady,
          isMqttConnected
        });
        setIsHidden(true);
        setTimeout(onComplete, 600);
      }
    }, maxWaitTime);

    return () => clearTimeout(timer);
  }, [maxWaitTime, onComplete, isBridgeReady, isMqttConnected]);

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
          <span>{status}</span>
          <div className="splash-loading-dots">
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
            <div className="splash-loading-dot"></div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="splash-status">
          <div className={`splash-status-item ${isBridgeReady ? 'ready' : ''}`}>
            <span className="splash-status-dot"></span>
            <span>Device</span>
          </div>
          <div className={`splash-status-item ${isMqttConnected ? 'ready' : ''}`}>
            <span className="splash-status-dot"></span>
            <span>Server</span>
          </div>
        </div>
      </div>
    </div>
  );
}
