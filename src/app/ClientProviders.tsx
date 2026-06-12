'use client';

import { useEffect } from 'react';
import { BridgeProvider } from './context/bridgeContext';
import { AuthProvider } from './(auth)/context/auth-context';
import apolloClient from '@/lib/apollo-client';
import { ApolloProvider } from '@apollo/client';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from './context/themeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  // Ask the browser to exempt this origin's storage (service-worker caches,
  // IndexedDB) from automatic LRU eviction. Without this, leaving the app
  // unused for months can silently delete the offline shell, turning the next
  // cold launch into a full network download. No-op where unsupported.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // Deferred service-worker registration (next.config sets register: false).
  // The SW's install precaches every route; on a first launch those downloads
  // saturate the connection pool exactly when the user's first applet tap
  // needs it. 12s in, the tap has happened and the role grid's staggered
  // prefetches have already warmed the HTTP cache, so the precache is cheap.
  // On every later launch the SW is already installed and controls the page
  // from the start — registration here is a no-op then.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const id = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }, 12000);
    return () => clearTimeout(id);
  }, []);

  return (
    <ThemeProvider>
      <ApolloProvider client={apolloClient}>
        <BridgeProvider>
          <AuthProvider>
            <I18nProvider>
              <ErrorBoundary>{children}</ErrorBoundary>
            </I18nProvider>
          </AuthProvider>
        </BridgeProvider>
      </ApolloProvider>
    </ThemeProvider>
  );
}
