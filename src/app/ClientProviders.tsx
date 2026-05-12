'use client';

import { useEffect } from 'react';
import { BridgeProvider } from './context/bridgeContext';
import { AuthProvider } from './(auth)/context/auth-context';
import apolloClient from '@/lib/apollo-client';
import { ApolloProvider } from '@apollo/client';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from './context/themeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const VCONSOLE_FLAG = '__BLE_APP_VCONSOLE__';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_VCONSOLE === 'true') return;

    const w = window as Window & Record<string, unknown>;
    if (w[VCONSOLE_FLAG]) return;
    w[VCONSOLE_FLAG] = true;

    void import('vconsole').then(({ default: VConsole }) => {
      // Mobile WebView builds often have no devtools; VConsole surfaces log/info/warn/error here.
      new VConsole({ theme: 'dark' });
    });
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
