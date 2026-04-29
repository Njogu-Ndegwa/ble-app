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
  })

  // Auto-select if the backend signals only one SA
  if (session.auto_selected && session.service_accounts.length === 1) {
    selectServiceAccount(session.service_accounts[0], session.token)
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
 * Persist the user's chosen SA and mirror the employee token into the legacy
 * attendant + sales storage keys so existing per-app auth guards pass.
 */
export function selectServiceAccount(sa: ServiceAccount, tokenOverride?: string): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(KEYS.SELECTED_SA_ID, String(sa.id))

  // Mirror token into legacy keys so attendant/sales apps auto-authenticate
  const token = tokenOverride ?? localStorage.getItem(KEYS.EMPLOYEE_TOKEN) ?? ''
  const employeeRaw = localStorage.getItem(KEYS.EMPLOYEE_DATA)
  const legacyUserData = employeeRaw
    ? JSON.parse(employeeRaw)
    : {}

  if (token) {
    localStorage.setItem(KEYS.ATTENDANT_TOKEN, token)
    localStorage.setItem(KEYS.SALES_TOKEN, token)
    localStorage.setItem(KEYS.ATTENDANT_DATA, JSON.stringify({ ...legacyUserData, userType: 'attendant', accessToken: token }))
    localStorage.setItem(KEYS.SALES_DATA, JSON.stringify({ ...legacyUserData, userType: 'sales', accessToken: token }))
  }
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
  if (id === null) return []
  const raw = localStorage.getItem(`${KEYS.SA_APPLETS_PREFIX}${id}`)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
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
}
