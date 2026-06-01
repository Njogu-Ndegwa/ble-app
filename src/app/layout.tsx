import { Outfit, DM_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "./ClientProviders";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ['400', '500', '700'],
  display: 'swap',
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ['400'],
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to API servers so the first GraphQL request pays no TCP cost */}
        <link rel="preconnect" href="https://federated-graphql-api.omnivoltaic.com" />
        <link rel="preconnect" href="https://dev-federated-graphql-api.omnivoltaic.com" />
        <link rel="preconnect" href="https://abs-platform-dev.omnivoltaic.com" />
        {/* Preload applet grid assets so icons are ready when SelectRole renders */}
        <link rel="preload" as="image" href="/assets/Bikes Oves.png" />
        <link rel="preload" as="image" href="/assets/Customer.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/Products.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/Orders.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/Rider.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/Activator.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/Salesperson.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/Attendant2.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/Keypad2.svg" type="image/svg+xml" />
        <link rel="preload" as="image" href="/assets/BleDeviceAttendant.svg" type="image/svg+xml" />
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
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
