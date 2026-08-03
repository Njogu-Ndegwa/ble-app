// Width-agreement assertions for ble-app.
//
// The responsive layer's core promise is that a shell picks ONE width and its
// content, tab bar, action bar, header and FAB all honour it. Every layout bug
// found in review was a violation of exactly that: the Keypad tab bar capped at
// --content-default under a --content-wide column, the FAB anchored to
// --content-default inside a wide shell, the header capped independently.
//
// This asserts the promise directly instead of eyeballing screenshots, so the
// class of bug cannot come back silently.
//
// Usage:
//   node tests/visual/assert-widths.mjs                       # all tablet sizes
//   node tests/visual/assert-widths.mjs --viewports 820x1180
//
// Also verifies the CSS breakpoints still match the `layout` tokens in
// src/styles/tokens.ts — if those drift, MasterDetail switches panes at a
// different width than the CSS lays them out at, which is invisible until a
// tablet lands between the two values.

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const args = process.argv.slice(2)
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

// Real tablet CSS-pixel viewports, both orientations, plus a phone control.
const VIEWPORTS = argValue(
  '--viewports',
  [
    '390x844',    // iPhone — control, must stay phone-shaped
    '600x1024',   // 7" Android portrait
    '744x1133',   // iPad Mini portrait
    '800x1280',   // Galaxy Tab S9 portrait
    '820x1180',   // iPad 10th / Air 11" portrait
    '834x1194',   // iPad Pro 11" portrait
    '912x1368',   // Surface Pro portrait
    '1024x1366',  // iPad Pro 13" portrait — must NOT split
    '1133x744',   // iPad Mini landscape — must split
    '1180x820',   // iPad Air landscape
    '1194x834',   // iPad Pro 11" landscape
    '1366x1024',  // iPad Pro 13" landscape
  ].join(',')
).split(',').map(v => {
  const [width, height] = v.split('x').map(Number)
  return { width, height }
})

const ROUTES = [
  // The applet launcher ("My Apps") — the first screen every user sees, and
  // the one screen that is neither an applet nor a flow, so it is easy to leave
  // out of a sweep. Its tiles animate in (appletReveal), so it needs longer to
  // settle than an applet; at the default wait it renders no shell yet and gets
  // silently skipped rather than checked.
  { path: '/', slug: 'launcher', settleMs: 5000 },
  { path: '/orders', slug: 'orders' },
  { path: '/products', slug: 'products' },
  { path: '/fleets', slug: 'fleets' },
  { path: '/customer-management', slug: 'customer-management' },
  { path: '/ticketing/app', slug: 'ticketing' },
  { path: '/support/app', slug: 'support' },
  { path: '/rollup', slug: 'rollup' },
  { path: '/topup', slug: 'topup' },
  { path: '/charger', slug: 'charger' },
  { path: '/assembly', slug: 'assembly' },
  { path: '/activator', slug: 'activator' },
  { path: '/keypad/keypad', slug: 'keypad' },
  { path: '/mydevices/devices', slug: 'mydevices' },
  { path: '/assets/ble-devices', slug: 'ble-devices' },
  { path: '/rider/app', slug: 'rider' },
  { path: '/attendant/attendant', slug: 'attendant' },
  { path: '/customers/customerform', slug: 'customerform' },
  { path: '/location/routes', slug: 'location' },
  { path: '/ota/deviceota', slug: 'ota-device' },
  { path: '/ota/upload', slug: 'ota-upload' },
]

const ALL_APPLETS = [
  'assets', 'mydevices', 'ota', 'keypad', 'rider', 'rider-basic', 'attendant',
  'customers', 'customer-management', 'orders', 'products', 'activator',
  'ticketing', 'ticketing-customer', 'location', 'rollup', 'energytopup',
  'charger',
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

// ---------------------------------------------------------------- static check

function checkBreakpointSync() {
  const css = readFileSync('src/styles/responsive.css', 'utf8')
  const ts = readFileSync('src/styles/tokens.ts', 'utf8')

  const layoutBlock = ts.match(/export const layout = \{([\s\S]*?)\} as const/)
  if (!layoutBlock) return ['tokens.ts: could not find `export const layout`']

  const tokens = {}
  for (const [, k, v] of layoutBlock[1].matchAll(/(\w+):\s*'(\d+)px'/g)) tokens[k] = Number(v)

  const cssWidths = new Set(
    [...css.matchAll(/@media \(min-width:\s*(\d+)px\)/g)].map(m => Number(m[1]))
  )

  const errors = []
  for (const [name, px] of Object.entries(tokens)) {
    if (!cssWidths.has(px)) {
      errors.push(`layout.${name} = ${px}px has no matching @media in responsive.css`)
    }
  }
  for (const px of cssWidths) {
    if (!Object.values(tokens).includes(px)) {
      errors.push(`responsive.css has @media (min-width: ${px}px) with no matching layout token`)
    }
  }
  return errors
}

// --------------------------------------------------------------- runtime check

const MEASURE = () => {
  // Scope every query to the shell that is actually on screen. AppShell is
  // `position: fixed; inset: 0`, so it covers the (mobile) route layout — and
  // that layout renders its own .flow-header-inner underneath. A document-wide
  // querySelector picks the hidden one and reports a width nobody can see.
  const root =
    document.querySelector('.app-shell') ||
    document.querySelector('.sales-flow-container') ||
    document.querySelector('.attendant-container') ||
    document.querySelector('.sales-container') ||
    document.querySelector('.rider-container') ||
    document.querySelector('.login-page-container') ||
    document.querySelector('.select-role-container') ||
    document.body

  const box = sel => {
    const el = root.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0) return null
    return { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) }
  }

  // The content column, whichever shell is in play.
  const content =
    box('.app-shell-main') || box('.attendant-main') || box('.sales-main') ||
    box('.rider-main') || box('.select-role-main') || box('.content-col--wide')

  // The width the shell DECLARED, which is the number chrome must honour. The
  // innermost content column may legitimately be narrower — flows deliberately
  // use a narrow reading measure inside a default-width shell — so the content
  // element is not the right reference for the chrome.
  const declared = root === document.body
    ? null
    : getComputedStyle(root).getPropertyValue('--shell-width').trim()
  const declaredPx = declared && declared.endsWith('px') ? Math.round(parseFloat(declared)) : null

  return {
    vw: window.innerWidth,
    hasShell: root !== document.body,
    shell: root === document.body ? 'none' : root.className.split(' ').slice(0, 2).join(' '),
    declaredPx,
    // What the shell body actually offers, so a cap wider than the screen
    // simply doesn't bind (as on a phone).
    avail: Math.round((root === document.body ? document.body : root).getBoundingClientRect().width),
    content,
    nav: box('.bottom-nav'),
    rail: box('.nav-rail'),
    bottomBar: box('.app-shell-bottom'),
    header: box('.flow-header-inner'),
    split: !!root.querySelector('.master-detail'),
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
  }
}

const SPLIT_PX = 1080

async function main() {
  const failures = []
  const notes = []

  for (const e of checkBreakpointSync()) failures.push(`[breakpoints] ${e}`)

  const browser = await chromium.launch()
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })
      await context.addInitScript(initScript)
      await mockBackend(context)
      const page = await context.newPage()

      for (const route of ROUTES) {
        const tag = `${vp.width}x${vp.height} ${route.slug}`
        try {
          // Same settle sequence as capture.mjs: dev first-compile is slow, and
          // auth gates / dynamic imports hold a .loading-spinner for a while.
          await page.goto(BASE_URL + route.path, { waitUntil: 'load', timeout: 90_000 })
        } catch {
          notes.push(`${tag}: navigation failed, skipped`)
          continue
        }
        await page
          .waitForFunction(() => !document.querySelector('.loading-spinner'), { timeout: 20_000 })
          .catch(() => {})
        await page.waitForTimeout(route.settleMs ?? 2000)

        const m = await page.evaluate(MEASURE)

        // 1. Nothing may scroll sideways, at any width.
        if (m.docScroll > m.docClient + 1) {
          failures.push(`${tag}: horizontal overflow (${m.docScroll} > ${m.docClient})`)
        }

        if (!m.hasShell) { notes.push(`${tag}: no shell — width checks skipped`); continue }
        if (!m.content) { notes.push(`${tag}: no content column found`); continue }

        // The effective column: the declared cap, or the available width when
        // the screen is narrower than the cap (every phone, and small tablets).
        const target = m.declaredPx == null ? m.avail : Math.min(m.declaredPx, m.avail)

        // 2. Tab bar must match the shell's declared width.
        if (m.nav && Math.abs(m.nav.w - target) > 2) {
          failures.push(
            `${tag}: tab bar ${m.nav.w}px vs shell ${target}px (${Math.abs(m.nav.w - target)}px apart)`
          )
        }

        // 3. Action bar must match the shell's declared width.
        if (m.bottomBar && Math.abs(m.bottomBar.w - target) > 2) {
          failures.push(`${tag}: action bar ${m.bottomBar.w}px vs shell ${target}px`)
        }

        // 4. Nothing may exceed the shell it lives in.
        if (m.header && m.header.w - target > 2) {
          failures.push(`${tag}: header ${m.header.w}px exceeds shell ${target}px`)
        }
        if (m.content.w - target > 2) {
          failures.push(`${tag}: content ${m.content.w}px exceeds shell ${target}px`)
        }

        // 5. Split only above the split breakpoint — a tablet in portrait must
        //    never get the two-pane layout.
        if (m.split && vp.width < SPLIT_PX) {
          failures.push(`${tag}: master-detail split at ${vp.width}px, below the ${SPLIT_PX}px threshold`)
        }
        if (m.rail && vp.width < SPLIT_PX) {
          failures.push(`${tag}: nav rail visible at ${vp.width}px, below the ${SPLIT_PX}px threshold`)
        }
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }

  for (const n of notes) console.log('note   ' + n)
  for (const f of failures) console.log('FAIL   ' + f)
  console.log(
    `\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ${failures.length} width disagreement(s) ` +
    `across ${VIEWPORTS.length} viewports x ${ROUTES.length} routes`
  )
  process.exit(failures.length === 0 ? 0 : 1)
}

await main()
