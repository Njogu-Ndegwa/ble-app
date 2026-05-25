'use client';

import { useEffect } from 'react';
import { BridgeProvider } from './context/bridgeContext';
import { AuthProvider } from './(auth)/context/auth-context';
import apolloClient from '@/lib/apollo-client';
import { ApolloProvider } from '@apollo/client';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from './context/themeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// VConsole for mobile debugging — same pattern as dennis-master-latest-code (root layout there).
// Set to false to disable.
const ENABLE_VCONSOLE = true;

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (ENABLE_VCONSOLE && typeof window !== 'undefined') {
      import('vconsole')
        .then((VConsoleModule) => {
          const VConsole = VConsoleModule.default;
          const vConsole = new VConsole({ theme: 'dark' });
          console.log('[VConsole] Initialized for debugging');

          (window as unknown as { __vconsole__: typeof vConsole }).__vconsole__ = vConsole;
        })
        .catch((err) => {
          console.error('[VConsole] Failed to initialize:', err);
        });
    }

    return () => {
      const w = window as unknown as { __vconsole__?: { destroy: () => void } };
      if (w.__vconsole__) {
        w.__vconsole__.destroy();
        delete w.__vconsole__;
      }
    };
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
