export type SARoleCode = 'admin' | 'staff' | 'agent'
export type SAMembershipState = 'active' | 'suspended' | 'revoked'

export interface ServiceAccount {
  id: number
  name: string
  account_class: string
  my_role: SARoleCode
  membership_state: SAMembershipState
  scope_policy: string
}

export interface MyServiceAccountsResponse {
  success: boolean
  count: number
  auto_selected: boolean
  service_accounts: ServiceAccount[]
}
