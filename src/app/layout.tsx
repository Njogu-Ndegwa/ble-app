
'use client'
// import type { Metadata } from "next";
import { Outfit, DM_Mono } from "next/font/google";
import "./globals.css";
import { useEffect } from "react";

// Oves Design System fonts
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700'],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ['400', '500'],
});

import { BridgeProvider } from './context/bridgeContext';
import { AuthProvider } from "./(auth)/context/auth-context";
import apolloClient from "@/lib/apollo-client";
import { ApolloProvider } from "@apollo/client";
import { I18nProvider } from "@/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// VConsole for mobile debugging - disabled
// Set to true to enable for debugging
const ENABLE_VCONSOLE = false;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // Initialize VConsole for mobile debugging
  useEffect(() => {
    if (ENABLE_VCONSOLE && typeof window !== 'undefined') {
      import('vconsole').then((VConsoleModule) => {
        const VConsole = VConsoleModule.default;
        const vConsole = new VConsole({ theme: 'dark' });
        console.log('[VConsole] Initialized for debugging');
        
        // Store reference to destroy on cleanup
        (window as any).__vconsole__ = vConsole;
      }).catch((err) => {
        console.error('[VConsole] Failed to initialize:', err);
      });
    }
    
    return () => {
      // Cleanup VConsole on unmount (though this rarely happens for root layout)
      if ((window as any).__vconsole__) {
        (window as any).__vconsole__.destroy();
        delete (window as any).__vconsole__;
      }
    };
  }, []);

  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${dmMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <ApolloProvider client={apolloClient}>
            <BridgeProvider>
              <AuthProvider>
                <I18nProvider>
                  {children}
                </I18nProvider>
              </AuthProvider>
            </BridgeProvider>
          </ApolloProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
