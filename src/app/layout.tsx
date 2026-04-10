
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

import { ThemeProvider } from './context/themeContext';

// VConsole for mobile debugging
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html,body{background:#0a0f0f;margin:0}
              html[data-theme="light"],html[data-theme="light"] body{background:#f5fafa}
              #html-splash{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0a0f0f;transition:opacity .3s ease}
              html[data-theme="light"] #html-splash{background:#f5fafa}
              #html-splash img{height:48px;width:auto}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('oves-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}try{if(sessionStorage.getItem('oves-splash-shown')==='true'){var s=document.createElement('style');s.textContent='#html-splash{display:none!important}';document.head.appendChild(s);}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${outfit.variable} ${dmMono.variable} antialiased`}
      >
        <div id="html-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/Logo-Oves.png" alt="" />
        </div>
        <ThemeProvider>
          <ApolloProvider client={apolloClient}>
            <BridgeProvider>
              <AuthProvider>
                <I18nProvider>
                  {children}
                </I18nProvider>
              </AuthProvider>
            </BridgeProvider>
          </ApolloProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
