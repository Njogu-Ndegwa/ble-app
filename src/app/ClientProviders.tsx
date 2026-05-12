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
      // Pin the toggle button to the bottom-right corner.
      // vConsole positions its button with an inline transform, so we need
      // !important overrides to win; transform: none removes any dragged offset.
      const style = document.createElement('style');
      style.textContent = `
        #__vconsole .vc-switch {
          position: fixed !important;
          right: 8px !important;
          bottom: 80px !important;
          left: auto !important;
          top: auto !important;
          transform: none !important;
        }
      `;
      document.head.appendChild(style);
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
