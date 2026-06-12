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
