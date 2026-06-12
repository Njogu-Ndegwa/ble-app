/**
 * Cold-start timing harness for applet routes.
 *
 * Simulates the WebView worst case: full document navigation to an applet
 * with EMPTY cache over a throttled mobile connection (Fast 3G-ish), plus a
 * warm-cache pass that approximates every launch after the first install
 * (the Android app no longer wipes the WebView cache on exit).
 *
 * The in-app SPA tap path (role grid -> applet) is strictly faster than the
 * cold full-document numbers measured here, because the shared chunks are
 * already loaded and only the applet's route chunks must arrive.
 */
import puppeteer from 'puppeteer-core';

const BROWSER = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:3000';
const ROUTES = [
  '/assets/ble-devices', // heaviest applet (BLE Device Manager)
  '/rider/app',          // largest overall
  '/keypad/keypad',
  '/attendant/attendant',
  '/orders',
];

// Fast 3G profile (Chrome DevTools preset values)
const FAST_3G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Fake employee JWT (exp in year 2100) so the isAuth guard doesn't redirect
// the measurement to /signin. Only the exp claim is ever decoded client-side.
const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const FAKE_JWT = `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url('{"exp":4102444800}')}.sig`;

async function measure(page, url, { throttle, coldCache }) {
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  if (coldCache) {
    await client.send('Network.clearBrowserCache');
    await client.send('Network.clearBrowserCookies');
  }
  await client.send('Network.setCacheDisabled', { cacheDisabled: false });

  // Seed the session on the origin BEFORE the measured navigation (cheap
  // static page, unthrottled), so auth guards see a logged-in user.
  await page.goto(BASE + '/offline.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((jwt) => {
    localStorage.setItem('ov-employee-token', jwt);
    sessionStorage.setItem('oves-splash-shown', 'true');
  }, FAKE_JWT);

  if (throttle) {
    await client.send('Network.emulateNetworkConditions', FAST_3G);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // mid-range phone
  }

  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  // Let FCP/LCP settle
  await wait(1500);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((p) => p.name === 'first-contentful-paint');
    return {
      ttfb: Math.round(nav.responseStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      fcp: fcp ? Math.round(fcp.startTime) : null,
    };
  });
  if (throttle) {
    await client.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: -1, uploadThroughput: -1, latency: 0 });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await client.detach();
  return metrics;
}

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: ['--no-first-run', '--disable-features=msEdgeSidebarV2'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });

  console.log('route, pass, FCP(ms), DCL(ms), load(ms), TTFB(ms)');
  for (const route of ROUTES) {
    // Pass 1: first-install worst case — empty cache + Fast 3G + 4x CPU throttle
    const cold = await measure(page, BASE + route, { throttle: true, coldCache: true });
    console.log(`${route}, cold-3G, ${cold.fcp}, ${cold.domContentLoaded}, ${cold.load}, ${cold.ttfb}`);

    // Pass 2: warm cache + Fast 3G — approximates every later cold start
    const warm = await measure(page, BASE + route, { throttle: true, coldCache: false });
    console.log(`${route}, warm-3G, ${warm.fcp}, ${warm.domContentLoaded}, ${warm.load}, ${warm.ttfb}`);
  }
} finally {
  await browser.close();
}
