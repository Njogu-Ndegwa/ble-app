'use client';

import { BridgeProvider } from './context/bridgeContext';
import { AuthProvider } from './(auth)/context/auth-context';
import apolloClient from '@/lib/apollo-client';
import { ApolloProvider } from '@apollo/client';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from './context/themeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ApolloProvider client={apolloClient}>
        <BridgeProvider>
          <AuthProvider>
            <I18nProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </I18nProvider>
          </AuthProvider>
        </BridgeProvider>
      </ApolloProvider>
    </ThemeProvider>
  );
}
