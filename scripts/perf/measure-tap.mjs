/**
 * Measures the REAL user path: role grid -> tap applet tile -> applet content
 * visible, under Fast 3G + 4x CPU throttle, with the staggered prefetch given
 * time to warm the route chunks (mirrors a user who looks at the grid for a
 * few seconds before tapping — and the very first launch right after the
 * grid paints, before prefetch finishes).
 */
import puppeteer from 'puppeteer-core';

const BROWSER = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:3000';

const FAST_3G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const FAKE_JWT = `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url('{"exp":4102444800}')}.sig`;
const APPLETS = ['assets', 'keypad', 'rider', 'attendant', 'orders', 'customers', 'rollup', 'ticketing', 'location', 'ota'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function tapAndTime(page, labelMatch, targetPath, { settleMs }) {
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.clearBrowserCache');

  // Seed session + SA so the role grid renders with applet tiles
  await page.goto(BASE + '/offline.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((jwt, applets) => {
    localStorage.setItem('ov-employee-token', jwt);
    localStorage.setItem('ov-selected-sa-id', '1');
    localStorage.setItem('ov-service-accounts', JSON.stringify([{ id: 1, name: 'Perf Test SA' }]));
    localStorage.setItem('ov_sa_applets_1', JSON.stringify(applets));
    sessionStorage.setItem('oves-splash-shown', 'true');
  }, FAKE_JWT, APPLETS);

  await client.send('Network.emulateNetworkConditions', FAST_3G);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
  // Wait for the role grid tiles to be interactive
  await page.waitForFunction(
    () => document.querySelectorAll('.role-app').length > 0,
    { timeout: 60000 },
  );

  // settleMs: how long the user "looks at the grid" before tapping —
  // determines how much of the staggered prefetch has completed.
  await wait(settleMs);

  const t0 = Date.now();
  // Tap the tile whose label contains labelMatch
  await page.evaluate((match) => {
    const tiles = [...document.querySelectorAll('.role-app')];
    const tile = tiles.find((el) => el.textContent.toLowerCase().includes(match.toLowerCase()));
    if (!tile) throw new Error('tile not found: ' + match);
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, labelMatch);

  // Milestone 1: visual response (overlay or page change painted)
  await page.waitForFunction(
    () => !!document.querySelector('.loading-spinner') || !document.querySelector('.role-grid'),
    { timeout: 30000 },
  );
  const tFeedback = Date.now() - t0;

  // Milestone 2: applet content visible (role grid gone, real content present,
  // URL switched to the applet)
  await page.waitForFunction(
    (path) =>
      location.pathname.startsWith(path) &&
      !document.querySelector('.role-grid') &&
      document.body.innerText.trim().length > 20,
    { timeout: 60000 },
    targetPath,
  );
  const tOpen = Date.now() - t0;

  await client.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: -1, uploadThroughput: -1, latency: 0 });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await client.detach();
  return { tFeedback, tOpen };
}

const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true, args: ['--no-first-run'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });

  console.log('scenario, visual-feedback(ms), applet-open(ms)');

  const scenarios = [
    ['BLE-DM tap@0.5s (cold prefetch)', 'Device Manager', '/assets/ble-devices', 500],
    ['BLE-DM tap@6s (prefetch warm)', 'Device Manager', '/assets/ble-devices', 6000],
    ['Keypad tap@3s', 'Keypad', '/keypad/keypad', 3000],
    ['Rider tap@6s', 'Rider', '/rider/app', 6000],
  ];
  for (const [label, match, path, settleMs] of scenarios) {
    try {
      const r = await tapAndTime(page, match, path, { settleMs });
      console.log(`${label}, ${r.tFeedback}, ${r.tOpen}`);
    } catch (e) {
      console.log(`${label}, FAILED: ${String(e).slice(0, 120)}`);
    }
  }
} finally {
  await browser.close();
}
