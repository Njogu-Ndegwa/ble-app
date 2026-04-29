// Unified Odoo employee session management.
// This module owns all `ov-*` localStorage keys and is the single source of
// truth for whether a user is logged in, which SA they have selected, and
// which applets are visible for that SA.
//
// It intentionally does NOT replicate the legacy attendant/sales storage logic;
// it mirrors the token into those keys only when an SA is selected so that
// existing per-app auth checks (isAttendantRoleLoggedIn etc.) continue to work.

import type {
  OdooEmployeeSession,
  OdooLoginResponse,
  ServiceAccount,
} from './sa-types'
import type { EmployeeUser } from './attendant-auth'
import { clearAttendantRoleLogin, clearSalesRoleLogin } from './attendant-auth'

// ---------------------------------------------------------------------------
// Storage key constants
// ---------------------------------------------------------------------------

const KEYS = {
  EMPLOYEE_TOKEN: 'ov-employee-token',
  EMPLOYEE_DATA: 'ov-employee-data',
  EMPLOYEE_TOKEN_EXPIRES: 'ov-employee-token-expires',
  SERVICE_ACCOUNTS: 'ov-service-accounts',
  SELECTED_SA_ID: 'ov-selected-sa-id',
  SA_APPLETS_PREFIX: 'ov_sa_applets_',
  // Legacy keys mirrored on SA selection so existing per-app checks work
  ATTENDANT_TOKEN: 'oves-attendant-token',
  ATTENDANT_DATA: 'oves-attendant-data',
  SALES_TOKEN: 'oves-sales-token',
  SALES_DATA: 'oves-sales-data',
} as const

// ---------------------------------------------------------------------------
// API config
// ---------------------------------------------------------------------------

const ODOO_BASE_URL = 'https://crm-omnivoltaic.odoo.com/api'
const ODOO_API_KEY = 'abs_connector_secret_key_2024'

// ---------------------------------------------------------------------------
// JWT helpers (no external dependency)
// ---------------------------------------------------------------------------

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const parsed = JSON.parse(json)
    return typeof parsed.exp === 'number' ? parsed.exp : null
  } catch {
    return null
  }
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  const exp = decodeJwtExp(token)
  if (exp === null) return true
  // 60-second buffer
  return Date.now() >= (exp - 60) * 1000
}

// ---------------------------------------------------------------------------
// Login API call
// ---------------------------------------------------------------------------

export async function odooEmployeeLogin(
  email: string,
  password: string,
): Promise<OdooLoginResponse> {
  console.info('[ov-auth] odooEmployeeLogin → POST /employee/login for', email)

  const response = await fetch(`${ODOO_BASE_URL}/employee/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': ODOO_API_KEY,
    },
    body: JSON.stringify({ email: email.trim(), password }),
  })

  const data = await response.json() as OdooLoginResponse

  if (!response.ok && !data.error) {
    data.success = false
    data.error = `HTTP ${response.status}`
  }

  if (data.success) {
    console.info('[ov-auth] Login response SUCCESS')
    console.info('[ov-auth] employee:', data.session?.employee?.name, '| id:', data.session?.employee?.id)
    console.info('[ov-auth] token expires_at:', data.session?.expires_at)
    console.info('[ov-auth] total SAs returned:', data.session?.service_accounts?.length ?? 0)
    console.info('[ov-auth] auto_selected:', data.session?.auto_selected)
    data.session?.service_accounts?.forEach(sa => {
      console.info(`[ov-auth]   SA #${sa.id} "${sa.name}" (${sa.my_role}) → applets: [${sa.applets?.join(', ')}]`)
    })
  } else {
    console.warn('[ov-auth] Login response FAILED:', data.error ?? data.message)
  }

  return data
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

export function saveOdooEmployeeSession(session: OdooEmployeeSession): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(KEYS.EMPLOYEE_TOKEN, session.token)
  localStorage.setItem(KEYS.EMPLOYEE_TOKEN_EXPIRES, session.expires_at)
  localStorage.setItem(KEYS.EMPLOYEE_DATA, JSON.stringify(session.employee))
  localStorage.setItem(KEYS.SERVICE_ACCOUNTS, JSON.stringify(session.service_accounts))

  // Cache each SA's applets keyed by SA id for zero-roundtrip access
  session.service_accounts.forEach(sa => {
    localStorage.setItem(
      `${KEYS.SA_APPLETS_PREFIX}${sa.id}`,
      JSON.stringify(sa.applets ?? []),
    )
    console.info(`[ov-auth] Cached applets for SA #${sa.id} "${sa.name}": [${sa.applets?.join(', ')}]`)
  })

  console.info('[ov-auth] Session saved. SAs cached:', session.service_accounts.length)

  // Auto-select when there is exactly one SA — no need to present a picker
  if (session.service_accounts.length === 1) {
    console.info('[ov-auth] Single SA — auto-selecting SA #', session.service_accounts[0].id)
    selectServiceAccount(session.service_accounts[0], session.token)
  }
}

/**
 * Bridge a Microsoft SSO result into the unified ov-auth storage.
 * Called from page.tsx after a successful Microsoft OAuth callback.
 * Service accounts are NOT available at this point — SelectSA will lazy-fetch them.
 */
export function saveOdooEmployeeSessionFromMicrosoft(user: EmployeeUser): void {
  if (typeof window === 'undefined') return

  if (!user.accessToken) {
    console.warn('[ov-auth] saveOdooEmployeeSessionFromMicrosoft: no accessToken on user, aborting')
    return
  }

  console.info('[ov-auth] saveOdooEmployeeSessionFromMicrosoft: saving token for', user.name, '| expires:', user.tokenExpiresAt)
  localStorage.setItem(KEYS.EMPLOYEE_TOKEN, user.accessToken)
  if (user.tokenExpiresAt) {
    localStorage.setItem(KEYS.EMPLOYEE_TOKEN_EXPIRES, user.tokenExpiresAt)
  }
  localStorage.setItem(
    KEYS.EMPLOYEE_DATA,
    JSON.stringify({
      id: user.employeeId ?? user.id,
      name: user.name,
      email: user.email,
      company_id: user.companyId ?? null,
      user_type: 'abs.employee',
    }),
  )
  // Service accounts are not embedded in the Microsoft callback — clear any stale
  // list so SelectSA can detect the empty state and trigger a live fetch.
  localStorage.removeItem(KEYS.SERVICE_ACCOUNTS)
  console.info('[ov-auth] Microsoft session saved. SAs cleared — SelectSA will fetch them live.')
}

/**
 * Fetch and cache service accounts from the API.
 * Used by SelectSA after Microsoft SSO, where SAs were not embedded in the callback.
 */
export async function fetchAndCacheServiceAccounts(): Promise<ServiceAccount[]> {
  const token = getOdooEmployeeToken()
  if (!token) {
    console.info('[ov-auth] fetchAndCacheServiceAccounts: no token, skipping')
    return []
  }

  console.info('[ov-auth] fetchAndCacheServiceAccounts: fetching live SA list…')
  try {
    const resp = await fetch(`${ODOO_BASE_URL}/me/service-accounts`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': ODOO_API_KEY,
        Authorization: `Bearer ${token}`,
      },
    })
    console.info('[ov-auth] fetchAndCacheServiceAccounts: HTTP', resp.status)
    if (!resp.ok) return []
    const data = await resp.json()
    const accounts: ServiceAccount[] = data.service_accounts ?? []
    console.info('[ov-auth] fetchAndCacheServiceAccounts: received', accounts.length, 'accounts')
    if (accounts.length > 0) {
      localStorage.setItem(KEYS.SERVICE_ACCOUNTS, JSON.stringify(accounts))
      accounts.forEach(sa => {
        console.info(`[ov-auth]   SA #${sa.id} "${sa.name}" applets: [${(sa.applets ?? []).join(', ')}]`)
        if (sa.applets?.length) {
          localStorage.setItem(`${KEYS.SA_APPLETS_PREFIX}${sa.id}`, JSON.stringify(sa.applets))
        }
      })
    }
    return accounts
  } catch (err) {
    console.warn('[ov-auth] fetchAndCacheServiceAccounts error:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Auth checks
// ---------------------------------------------------------------------------

export function isOdooEmployeeLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  const token = localStorage.getItem(KEYS.EMPLOYEE_TOKEN)
  return !isTokenExpired(token)
}

export function getOdooEmployeeToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(KEYS.EMPLOYEE_TOKEN)
  return isTokenExpired(token) ? null : token
}

// ---------------------------------------------------------------------------
// Employee data
// ---------------------------------------------------------------------------

export function getOdooEmployee(): OdooEmployeeSession['employee'] | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(KEYS.EMPLOYEE_DATA)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Service accounts
// ---------------------------------------------------------------------------

export function getStoredServiceAccounts(): ServiceAccount[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(KEYS.SERVICE_ACCOUNTS)
  if (!raw) return []
  try {
    return JSON.parse(raw) as ServiceAccount[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// SA selection
// ---------------------------------------------------------------------------

/**
 * Persist the user's chosen SA and mirror the employee token AND the SA selection
 * into every legacy storage key so individual applets (customer-management, orders,
 * activator, attendant, etc.) skip their own per-applet login / SA-picker screens.
 *
 * Legacy keys written:
 *   Auth  → oves-attendant-token, oves-sales-token (+ *-data variants)
 *   SA    → oves-sales-sa-id, oves-sales-sa-data, oves-attendant-sa-id, oves-attendant-sa-data
 *
 * Without the SA keys, individual applets see hasSASelected()=false and fall back to
 * their own SA picker, which contains a Microsoft sign-in button → OAuth loop.
 */
export function selectServiceAccount(sa: ServiceAccount, tokenOverride?: string): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(KEYS.SELECTED_SA_ID, String(sa.id))

  // Mirror token into legacy auth keys
  const token = tokenOverride ?? localStorage.getItem(KEYS.EMPLOYEE_TOKEN) ?? ''
  const employeeRaw = localStorage.getItem(KEYS.EMPLOYEE_DATA)
  const legacyUserData = employeeRaw ? JSON.parse(employeeRaw) : {}

  if (token) {
    localStorage.setItem(KEYS.ATTENDANT_TOKEN, token)
    localStorage.setItem(KEYS.SALES_TOKEN, token)
    localStorage.setItem(KEYS.ATTENDANT_DATA, JSON.stringify({ ...legacyUserData, userType: 'attendant', accessToken: token }))
    localStorage.setItem(KEYS.SALES_DATA, JSON.stringify({ ...legacyUserData, userType: 'sales', accessToken: token }))
  }

  // Mirror SA selection into legacy per-applet SA keys.
  // Written directly (not via saveSelectedSA()) to avoid its cross-contamination
  // clearing logic which would erase the other role's entry we just wrote.
  const saJson = JSON.stringify(sa)
  localStorage.setItem('oves-sales-sa-id', String(sa.id))
  localStorage.setItem('oves-sales-sa-data', saJson)
  localStorage.setItem('oves-attendant-sa-id', String(sa.id))
  localStorage.setItem('oves-attendant-sa-data', saJson)

  console.info(`[ov-auth] selectServiceAccount: SA #${sa.id} "${sa.name}" bridged to all legacy keys (token + SA selection)`)
}

export function getSelectedSAId(): number | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(KEYS.SELECTED_SA_ID)
  if (!val) return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

export function getSelectedSA(): ServiceAccount | null {
  const id = getSelectedSAId()
  if (id === null) return null
  return getStoredServiceAccounts().find(sa => sa.id === id) ?? null
}

/** Clear only the SA selection (for "Switch Account" — no re-login required) */
export function clearSelectedSA(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEYS.SELECTED_SA_ID)
}

// ---------------------------------------------------------------------------
// Applets
// ---------------------------------------------------------------------------

export function getActiveSAApplets(): string[] {
  if (typeof window === 'undefined') return []
  const id = getSelectedSAId()
  if (id === null) {
    console.info('[ov-auth] getActiveSAApplets: no SA selected → returning []')
    return []
  }
  const raw = localStorage.getItem(`${KEYS.SA_APPLETS_PREFIX}${id}`)
  if (!raw) {
    console.info(`[ov-auth] getActiveSAApplets: no cached applets for SA #${id} → returning []`)
    return []
  }
  try {
    const applets = JSON.parse(raw) as string[]
    console.info(`[ov-auth] getActiveSAApplets (SA #${id}): [${applets.join(', ')}]`)
    return applets
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Logout / session clear
// ---------------------------------------------------------------------------

export function clearOdooEmployeeSession(): void {
  if (typeof window === 'undefined') return

  // Remove core ov-* keys
  localStorage.removeItem(KEYS.EMPLOYEE_TOKEN)
  localStorage.removeItem(KEYS.EMPLOYEE_DATA)
  localStorage.removeItem(KEYS.EMPLOYEE_TOKEN_EXPIRES)
  localStorage.removeItem(KEYS.SERVICE_ACCOUNTS)
  localStorage.removeItem(KEYS.SELECTED_SA_ID)

  // Remove all per-SA applet caches
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(KEYS.SA_APPLETS_PREFIX)) {
      toRemove.push(key)
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k))

  // Clear legacy mirrored tokens so per-app auth checks also reset
  clearAttendantRoleLogin()
  clearSalesRoleLogin()

  // Clear legacy per-applet SA selections
  localStorage.removeItem('oves-sales-sa-id')
  localStorage.removeItem('oves-sales-sa-data')
  localStorage.removeItem('oves-attendant-sa-id')
  localStorage.removeItem('oves-attendant-sa-data')
}
