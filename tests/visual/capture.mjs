// Visual-regression capture runner for ble-app.
//
// Captures a screenshot of every reachable page (and each bottom-nav tab)
// at one or more viewports, with auth stubbed via localStorage and all
// backend traffic route-mocked so captures are deterministic.
//
// Usage:
//   node tests/visual/capture.mjs --out tests/visual-baseline          # all viewports
//   node tests/visual/capture.mjs --out tests/visual-current --viewports 390x844
//
// Compare a later capture against the baseline with tests/visual/compare.mjs.

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const args = process.argv.slice(2)
function argValue(flag, fallback) {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const OUT_ROOT = argValue('--out', 'tests/visual-baseline')
const VIEWPORTS = argValue('--viewports', '390x844,768x1024,1024x768,1440x900')
  .split(',')
  .map(v => {
    const [w, h] = v.split('x').map(Number)
    return { width: w, height: h }
  })
// Optional comma-separated slug filter, e.g. --filter orders,rider
const FILTER = argValue('--filter', '').split(',').filter(Boolean)

// Routes worth capturing. Redirect-only routes (/mydevices/devices,
// /rider/serviceplan1) are excluded.
const ROUTES = [
  { path: '/', slug: 'home', settleMs: 4500 }, // splash -> role select
  { path: '/signin', slug: 'signin' },
  { path: '/activator', slug: 'activator' },
  { path: '/assembly', slug: 'assembly' },
  { path: '/assets/ble-devices', slug: 'assets--ble-devices' },
  { path: '/assets/fleet-view', slug: 'assets--fleet-view' },
  { path: '/attendant/attendant', slug: 'attendant' },
  { path: '/attendant/manual-swap', slug: 'attendant--manual-swap' },
  { path: '/attendant/topup-swap', slug: 'attendant--topup-swap' },
  { path: '/customer-management', slug: 'customer-management' },
  { path: '/customers/customerform', slug: 'customers--customerform' },
  { path: '/fleets', slug: 'fleets' },
  { path: '/keypad/keypad', slug: 'keypad' },
  { path: '/location/routes', slug: 'location--routes' },
  { path: '/orders', slug: 'orders' },
  { path: '/ota/deviceota', slug: 'ota--deviceota' },
  { path: '/ota/upload', slug: 'ota--upload' },
  { path: '/products', slug: 'products' },
  { path: '/rider/app', slug: 'rider' },
  { path: '/rider-basic/app', slug: 'rider-basic' },
  { path: '/rollup', slug: 'rollup' },
  { path: '/support/app', slug: 'support' },
  { path: '/ticketing/app', slug: 'ticketing' },
  { path: '/topup', slug: 'topup' },
]

// Every applet slug the auth layer knows about, so the stub SA unlocks everything.
const ALL_APPLETS = [
  'assets', 'mydevices', 'ota', 'keypad', 'rider', 'rider-basic', 'attendant',
  'customers', 'customer-management', 'orders', 'products', 'activator',
  'ticketing', 'ticketing-customer', 'location', 'rollup', 'energytopup',
]

const STUB_SA = { id: 1, name: 'Baseline SA', my_role: 'admin', applets: ALL_APPLETS }
const STUB_EMPLOYEE = { id: 1, name: 'Baseline Tester', email: 'baseline@test.local' }
const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

// Legacy role gates (isSalesRoleLoggedIn etc.) decode the token as a JWT and
// require a future `exp` claim, so the stub token must be JWT-shaped.
function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const STUB_JWT = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({
    user_id: 1,
    username: 'Baseline Tester',
    email: STUB_EMPLOYEE.email,
    user_type: 'sales',
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  }),
  'stub',
].join('.')

// Runs before any page script on every navigation: stub the whole auth surface.
const initScript = `(() => {
  const sa = ${JSON.stringify(STUB_SA)}
  const emp = ${JSON.stringify(STUB_EMPLOYEE)}
  const token = '${STUB_JWT}'
  localStorage.setItem('ov-employee-token', token)
  localStorage.setItem('ov-employee-token-expires', '${FUTURE}')
  localStorage.setItem('ov-employee-data', JSON.stringify(emp))
  localStorage.setItem('ov-service-accounts', JSON.stringify([sa]))
  localStorage.setItem('ov-selected-sa-id', String(sa.id))
  localStorage.setItem('ov_sa_applets_' + sa.id, JSON.stringify(sa.applets))
  // Legacy per-applet mirrors (see ov-auth.ts selectServiceAccount)
  localStorage.setItem('oves-attendant-token', token)
  localStorage.setItem('oves-sales-token', token)
  localStorage.setItem('oves-attendant-data', JSON.stringify({ ...emp, userType: 'attendant', accessToken: token }))
  localStorage.setItem('oves-sales-data', JSON.stringify({ ...emp, userType: 'sales', accessToken: token }))
  localStorage.setItem('oves-sales-sa-id', String(sa.id))
  localStorage.setItem('oves-sales-sa-data', JSON.stringify(sa))
  localStorage.setItem('oves-attendant-sa-id', String(sa.id))
  localStorage.setItem('oves-attendant-sa-data', JSON.stringify(sa))
  // Skip onboarding carousels / splash re-runs where keyed off storage
  localStorage.setItem('oves-onboarding-done', 'true')
})()`

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
}

// Freeze animations/transitions and the text caret so captures are stable,
// and hide the Next.js dev-error overlay (it intercepts clicks and pollutes
// screenshots — dev-only element, never present in production builds).
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  nextjs-portal { display: none !important; }
`

function sanitize(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
}

async function mockBackend(context) {
  // Odoo REST connector + any GraphQL endpoint: deterministic empty responses.
  const emptyJson = JSON.stringify({ success: true, data: [], items: [], results: [], records: [] })
  const handler = route => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS })
    }
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
      body: emptyJson,
    })
  }
  await context.route('**crm-omnivoltaic.odoo.com/**', handler)
  await context.route('**/graphql**', handler)
}

async function captureRoute(page, route, outDir) {
  const url = BASE_URL + route.path
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }) // dev first-compile can be slow
  } catch (e) {
    console.warn(`  ! goto failed for ${route.path}: ${e.message}`)
  }
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {})
  // Dynamic imports + auth gates show .loading-spinner while resolving; wait
  // it out (bounded — some screens keep a spinner in empty states).
  await page
    .waitForFunction(() => !document.querySelector('.loading-spinner'), { timeout: 20000 })
    .catch(() => {})
  await page.waitForTimeout(route.settleMs ?? 2000)
  // Re-inject in case of client-side re-render replacing <head> styles
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {})

  await page.screenshot({ path: join(outDir, `${route.slug}.png`) })
  console.log(`  ✓ ${route.slug}`)

  // Generic tab sweep: click each bottom-nav tab and capture it.
  const tabs = await page.$$('.bottom-nav-item')
  for (let i = 0; i < tabs.length; i++) {
    // Re-query — clicking may re-render the nav
    const items = await page.$$('.bottom-nav-item')
    if (!items[i]) continue
    const label = sanitize((await items[i].getAttribute('aria-label')) ?? `tab${i}`)
    try {
      await items[i].click({ timeout: 3000 })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: join(outDir, `${route.slug}--tab-${label}.png`) })
      console.log(`  ✓ ${route.slug}--tab-${label}`)
    } catch (e) {
      console.warn(`  ! tab ${label} on ${route.slug}: ${e.message}`)
    }
  }
}

const browser = await chromium.launch()
for (const vp of VIEWPORTS) {
  const outDir = join(OUT_ROOT, String(vp.width))
  mkdirSync(outDir, { recursive: true })
  console.log(`\n=== ${vp.width}x${vp.height} → ${outDir} ===`)

  const context = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
  })
  await context.addInitScript(initScript)
  await mockBackend(context)
  const page = await context.newPage()

  const routes = FILTER.length ? ROUTES.filter(r => FILTER.includes(r.slug)) : ROUTES
  for (const route of routes) {
    await captureRoute(page, route, outDir)
  }
  await context.close()
}
await browser.close()
console.log('\nDone.')
