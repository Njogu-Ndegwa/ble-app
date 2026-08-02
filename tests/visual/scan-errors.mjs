// Runtime error sweep across every applet.
//
// Visits each route with auth stubbed and the backend mocked, then reports any
// uncaught exception, console error, or ErrorBoundary catch. Complements
// assert-widths.mjs: that one proves the layout is right, this one proves the
// screen renders at all.
//
// The mock returns a deliberately minimal payload, which is the point — a
// component that only works when every optional key is present will crash here
// and would equally crash on a partial or changed backend response.
//
// Usage:
//   node tests/visual/scan-errors.mjs
//   node tests/visual/scan-errors.mjs --viewports 820x1180

import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const args = process.argv.slice(2)
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const VIEWPORTS = argValue('--viewports', '390x844,820x1180,1133x744')
  .split(',').map(v => {
    const [width, height] = v.split('x').map(Number)
    return { width, height }
  })

const ROUTES = [
  '/', '/signin', '/activator', '/assembly', '/assets/ble-devices',
  '/assets/fleet-view', '/attendant/attendant', '/attendant/manual-swap',
  '/attendant/topup-swap', '/customer-management', '/customers/customerform',
  '/fleets', '/keypad/keypad', '/location/routes', '/orders',
  '/ota/deviceota', '/ota/upload', '/products', '/rider/app',
  '/rider-basic/app', '/rollup', '/support/app', '/ticketing/app', '/topup',
]

const ALL_APPLETS = [
  'assets', 'mydevices', 'ota', 'keypad', 'rider', 'rider-basic', 'attendant',
  'customers', 'customer-management', 'orders', 'products', 'activator',
  'ticketing', 'ticketing-customer', 'location', 'rollup', 'energytopup',
]
const STUB_SA = { id: 1, name: 'Baseline SA', my_role: 'admin', applets: ALL_APPLETS }
const STUB_EMPLOYEE = { id: 1, name: 'Baseline Tester', email: 'baseline@test.local' }
const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
const b64url = obj =>
  Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const STUB_JWT = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({
    user_id: 1, username: 'Baseline Tester', email: STUB_EMPLOYEE.email,
    user_type: 'sales', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  }),
  'stub',
].join('.')

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
  localStorage.setItem('oves-attendant-token', token)
  localStorage.setItem('oves-sales-token', token)
  localStorage.setItem('oves-attendant-data', JSON.stringify({ ...emp, userType: 'attendant', accessToken: token }))
  localStorage.setItem('oves-sales-data', JSON.stringify({ ...emp, userType: 'sales', accessToken: token }))
  localStorage.setItem('oves-sales-sa-id', String(sa.id))
  localStorage.setItem('oves-sales-sa-data', JSON.stringify(sa))
  localStorage.setItem('oves-attendant-sa-id', String(sa.id))
  localStorage.setItem('oves-attendant-sa-data', JSON.stringify(sa))
  localStorage.setItem('oves-onboarding-done', 'true')
})()`

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
}

async function mockBackend(context) {
  const emptyJson = JSON.stringify({ success: true, data: [], items: [], results: [], records: [] })
  const handler = route => {
    if (route.request().method() === 'OPTIONS') {
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

// Dev-only noise that says nothing about the applet's health.
const IGNORE = [
  /Hydration failed/i,
  /server rendered HTML didn't match/i,
  /Download the React DevTools/i,
  /\[i18n\] Missing translation key/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /favicon/i,
  /WebViewJavascriptBridge/i,   // native bridge is absent in a desktop browser
  /Bluetooth/i,                 // ditto
]
const ignored = text => IGNORE.some(re => re.test(text))

async function main() {
  const found = new Map() // "route @ viewport" -> Set of messages
  const browser = await chromium.launch()

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })
      await context.addInitScript(initScript)
      await mockBackend(context)
      const page = await context.newPage()

      for (const path of ROUTES) {
        const tag = `${path} @ ${vp.width}x${vp.height}`
        const bucket = new Set()
        const onConsole = m => {
          if (m.type() !== 'error') return
          const t = m.text().replace(/\s+/g, ' ').trim()
          if (!ignored(t)) bucket.add('console: ' + t.slice(0, 220))
        }
        const onPageError = e => {
          const t = String(e).replace(/\s+/g, ' ').trim()
          if (!ignored(t)) bucket.add('uncaught: ' + t.slice(0, 220))
        }
        page.on('console', onConsole)
        page.on('pageerror', onPageError)

        try {
          await page.goto(BASE_URL + path, { waitUntil: 'load', timeout: 90_000 })
        } catch (e) {
          bucket.add('navigation: ' + String(e.message).slice(0, 160))
        }
        await page
          .waitForFunction(() => !document.querySelector('.loading-spinner'), { timeout: 20_000 })
          .catch(() => {})
        await page.waitForTimeout(2500)

        // The ErrorBoundary swallows the render error and shows a recovery
        // message, so a screen can be fully broken with a clean console.
        const boundary = await page.evaluate(() =>
          /Something went wrong/i.test(document.body.innerText || '')
        ).catch(() => false)
        if (boundary) bucket.add('ErrorBoundary: screen replaced by recovery message')

        // Errors that are caught and shown to the user as a toast never reach
        // the console, so the console alone under-reports. react-hot-toast
        // renders into [id="_rht_toaster"]; anything that reads like an
        // exception in there is a failure the user actually sees.
        const toasts = await page.evaluate(() => {
          const host = document.querySelector('#_rht_toaster')
          if (!host) return []
          return [...host.querySelectorAll('div')]
            .map(n => (n.innerText || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
        }).catch(() => [])
        for (const t of new Set(toasts)) {
          if (/undefined|not iterable|not a function|TypeError|NaN|\[object/i.test(t)) {
            bucket.add('error toast: ' + t.slice(0, 200))
          }
        }

        page.off('console', onConsole)
        page.off('pageerror', onPageError)
        if (bucket.size) found.set(tag, bucket)
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (found.size === 0) {
    console.log(`\nCLEAN — no errors across ${ROUTES.length} routes x ${VIEWPORTS.length} viewports`)
    process.exit(0)
  }

  for (const [tag, msgs] of found) {
    console.log(`\n### ${tag}`)
    for (const m of msgs) console.log('    ' + m)
  }
  console.log(`\n${found.size} route/viewport combination(s) with errors`)
  process.exit(1)
}

await main()
