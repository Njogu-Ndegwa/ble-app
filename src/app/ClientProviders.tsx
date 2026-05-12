'use client';

import { useEffect } from 'react';
import { BridgeProvider } from './context/bridgeContext';
import { AuthProvider } from './(auth)/context/auth-context';
import apolloClient from '@/lib/apollo-client';
import { ApolloProvider } from '@apollo/client';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from './context/themeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function VConsoleInit() {
  useEffect(() => {
    import('vconsole').then(({ default: VConsole }) => {
      new VConsole({ theme: 'dark' });
    });
  }, []);
  return null;
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ApolloProvider client={apolloClient}>
        <BridgeProvider>
          <AuthProvider>
            <I18nProvider>
              <ErrorBoundary>
                <VConsoleInit />
                {children}
              </ErrorBoundary>
            </I18nProvider>
          </AuthProvider>
        </BridgeProvider>
      </ApolloProvider>
    </ThemeProvider>
  );
}
