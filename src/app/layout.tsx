import { Outfit, DM_Mono } from "next/font/google";
import "./globals.css";
// Must stay after globals.css: all min-width overrides win by source order.
import "../styles/responsive.css";
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
        <link rel="preload" as="image" href="/assets/optimized/Bikes Oves.png" />
        <link rel="preload" as="image" href="/assets/optimized/Customer.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/Products.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/Orders.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/Rider.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/Activator.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/Salesperson.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/Attendant2.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/Keypad2.png" type="image/png" />
        <link rel="preload" as="image" href="/assets/optimized/BleDeviceAttendant.png" type="image/png" />
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
        {/* Boot/chunk watchdog: the static splash above is all the user sees
            until the JS bundle runs and React hydrates. This script runs with no
            app code, so it's the only thing that can recover a stalled or broken
            cold start.
            (1) Boot watchdog — if React hasn't booted in 10s, reload once (a warm
                SW cache usually fixes it); if still stuck, show a Retry button.
            (2) Chunk-load recovery — after a new deploy, this client may hold
                stale HTML pointing at chunk filenames the server no longer has;
                the failed import throws ChunkLoadError. Reload once to pick up
                the revalidated HTML and its new chunks. Both are guarded by a
                one-shot sessionStorage flag so a truly broken build can't loop. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var KEY='oves-boot-retries',CKEY='oves-chunk-reload',MAX=1,WAIT=10000;function retryUI(){var el=document.getElementById('html-splash');if(!el)return;el.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:16px;font-family:sans-serif;color:#B0BEC5;padding:24px;text-align:center"><img src="/assets/Logo-Oves.png" alt="" style="height:40px;width:auto"/><div style="font-size:14px;line-height:1.4;max-width:280px">Could not load the app. Check your connection and try again.</div><button id="oves-retry" style="background:#22c55e;color:#04130b;border:0;border-radius:8px;padding:10px 22px;font-size:14px;font-weight:600">Retry</button></div>';var b=document.getElementById('oves-retry');if(b)b.onclick=function(){try{sessionStorage.removeItem(KEY);sessionStorage.removeItem(CKEY);}catch(e){}location.reload();};}setTimeout(function(){if(window.__appBooted)return;var n=0;try{n=parseInt(sessionStorage.getItem(KEY)||'0',10)||0;}catch(e){}if(n<MAX){try{sessionStorage.setItem(KEY,String(n+1));}catch(e){}location.reload();}else{retryUI();}},WAIT);function isChunkErr(m){return !!m&&(/ChunkLoadError/i.test(m)||/Loading (?:CSS )?chunk [\\w-]+ failed/i.test(m)||/error loading dynamically imported module/i.test(m)||/Importing a module script failed/i.test(m));}function onChunkFail(){var n=0;try{n=parseInt(sessionStorage.getItem(CKEY)||'0',10)||0;}catch(e){}if(n>=MAX)return;try{sessionStorage.setItem(CKEY,String(n+1));}catch(e){}location.reload();}window.addEventListener('error',function(e){var t=e&&e.target;if(t&&t.tagName==='SCRIPT'&&t.src&&t.src.indexOf('/_next/')>-1){onChunkFail();return;}if(e&&isChunkErr(e.message))onChunkFail();},true);window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;if(isChunkErr(r&&(r.message||(''+r))))onChunkFail();});})();`,
          }}
        />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
