
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // Enable VConsole for mobile debugging
  useEffect(() => {
    import('vconsole').then((module) => {
      const VConsole = module.default;
      new VConsole();
    });
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
