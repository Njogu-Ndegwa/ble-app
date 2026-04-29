export type SARoleCode = 'admin' | 'staff' | 'agent'
export type SAMembershipState = 'active' | 'suspended' | 'revoked'

export interface SAPartner {
  id: number
  name: string
  email: string | null
  phone: string | null
}

export interface ServiceAccount {
  id: number
  name: string
  account_code: string | null
  account_class: string
  state: string
  is_root: boolean
  note: string | null
  member_count: number
  child_count: number
  company_id: number | false
  company_name: string | false
  parent: number | null
  partner: SAPartner | null
  created_at: string
  updated_at: string
  my_role: SARoleCode
  my_scope_policy: boolean
  applets: string[]
  // legacy fields kept for backwards compatibility
  membership_state?: SAMembershipState
  scope_policy?: string
}

export interface OdooEmployee {
  id: number
  name: string
  email: string
  company_id: number
  user_type: string
}

export interface OdooEmployeeSession {
  token: string
  expires_at: string
  employee: OdooEmployee
  partner_id: number
  service_accounts: ServiceAccount[]
  total: number
  auto_selected: boolean
}

export interface OdooLoginResponse {
  success: boolean
  message?: string
  session?: OdooEmployeeSession
  error?: string
}

export interface MyServiceAccountsResponse {
  success: boolean
  count: number
  auto_selected: boolean
  service_accounts: ServiceAccount[]
}
