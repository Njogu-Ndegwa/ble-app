import type { ServiceAccount, MyServiceAccountsResponse } from './sa-types'

const ODOO_BASE_URL =
  process.env.NEXT_PUBLIC_ODOO_API_URL || 'https://crm-omnivoltaic.odoo.com'
const ODOO_API_KEY =
  process.env.NEXT_PUBLIC_ODOO_API_KEY || 'abs_connector_secret_key_2024'

const SA_STORAGE_KEYS = {
  ATTENDANT_SA_ID: 'oves-attendant-sa-id',
  ATTENDANT_SA_DATA: 'oves-attendant-sa-data',
  SALES_SA_ID: 'oves-sales-sa-id',
  SALES_SA_DATA: 'oves-sales-sa-data',
} as const

function storageKeys(userType: 'attendant' | 'sales') {
  if (userType === 'attendant') {
    return {
      id: SA_STORAGE_KEYS.ATTENDANT_SA_ID,
      data: SA_STORAGE_KEYS.ATTENDANT_SA_DATA,
    }
  }
  return {
    id: SA_STORAGE_KEYS.SALES_SA_ID,
    data: SA_STORAGE_KEYS.SALES_SA_DATA,
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function fetchMyServiceAccounts(
  authToken: string,
): Promise<MyServiceAccountsResponse> {
  const url = `${ODOO_BASE_URL}/api/me/service-accounts`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': ODOO_API_KEY,
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Failed to fetch service accounts (HTTP ${response.status}): ${text.substring(0, 200)}`,
    )
  }

  const data: MyServiceAccountsResponse = await response.json()
  console.info('[fetchMyServiceAccounts] Available SAs:', JSON.stringify(data.service_accounts?.map(sa => ({ id: sa.id, name: sa.name })) ?? []))
  console.info('[fetchMyServiceAccounts] auto_selected:', data.auto_selected)
  return data
}

// ---------------------------------------------------------------------------
// localStorage helpers (role-scoped)
// ---------------------------------------------------------------------------

export function saveSelectedSA(
  userType: 'attendant' | 'sales',
  sa: ServiceAccount,
): void {
  if (typeof window === 'undefined') return
  const keys = storageKeys(userType)
  console.info(`[saveSelectedSA] Saving SA for "${userType}" — id: ${sa.id}, name: ${sa.name ?? 'N/A'}, key: ${keys.id}`)
  console.info('[saveSelectedSA] Full SA object:', JSON.stringify(sa))
  localStorage.setItem(keys.id, String(sa.id))
  localStorage.setItem(keys.data, JSON.stringify(sa))
}

export function getSelectedSA(
  userType: 'attendant' | 'sales',
): ServiceAccount | null {
  if (typeof window === 'undefined') return null
  const keys = storageKeys(userType)
  const raw = localStorage.getItem(keys.data)
  if (!raw) {
    console.info(`[getSelectedSA] No SA data found for "${userType}" (key: ${keys.data})`)
    return null
  }
  try {
    const sa = JSON.parse(raw) as ServiceAccount
    console.info(`[getSelectedSA] Loaded SA for "${userType}" — id: ${sa.id}, name: ${sa.name ?? 'N/A'}`)
    return sa
  } catch {
    return null
  }
}

export function getSelectedSAId(
  userType: 'attendant' | 'sales',
): number | null {
  if (typeof window === 'undefined') return null
  const keys = storageKeys(userType)
  const val = localStorage.getItem(keys.id)
  if (!val) return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

export function clearSelectedSA(userType: 'attendant' | 'sales'): void {
  if (typeof window === 'undefined') return
  const keys = storageKeys(userType)
  localStorage.removeItem(keys.id)
  localStorage.removeItem(keys.data)
}

export function hasSASelected(userType: 'attendant' | 'sales'): boolean {
  return getSelectedSAId(userType) !== null
}

/**
 * Get the SA ID string for inclusion in API headers.
 * Returns null when no SA is selected for the given role.
 */
export function getSAIdForHeaders(userType: 'attendant' | 'sales'): string | null {
  if (typeof window === 'undefined') return null
  const keys = storageKeys(userType)
  return localStorage.getItem(keys.id)
}
