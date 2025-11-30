
'use client'
// import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { useEffect } from "react";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { BridgeProvider } from './context/bridgeContext';
import { AuthProvider } from "./(auth)/context/auth-context";
import apolloClient from "@/lib/apollo-client";
import { ApolloProvider } from "@apollo/client";
import { I18nProvider } from "@/i18n";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  useEffect(() => {
    import('vconsole').then((module) => {
      const VConsole = module.default;
      new VConsole();
    });
  }, []);
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ApolloProvider client={apolloClient}>
          <BridgeProvider>
            <AuthProvider>
              <I18nProvider>
                {children}
              </I18nProvider>
            </AuthProvider>
          </BridgeProvider>
        </ApolloProvider>
      </body>
    </html>
  );
}
