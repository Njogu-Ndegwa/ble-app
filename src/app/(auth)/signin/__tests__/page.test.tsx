import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/signin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('next/image', () => ({
  default: () => null,
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({ locale: 'en', setLocale: vi.fn(), t: (key: string) => key }),
}))

vi.mock('@/lib/ov-auth', () => ({
  clearSelectedSA: vi.fn(),
  getOdooEmployee: () => ({ name: 'Previous User', email: 'previous@example.test' }),
  getSelectedSA: () => ({ id: 'sa-test', name: 'Oves Togo' }),
  odooEmployeeLogin: vi.fn(),
  saveOdooEmployeeSession: vi.fn(),
}))

vi.mock('@/lib/attendant-auth', () => ({
  clearAllAuth: vi.fn(),
  getMicrosoftAuthUrl: () => 'https://example.test/microsoft',
  saveMicrosoftPendingContext: vi.fn(),
}))

vi.mock('@/components/ui/PhoneInputWithCountry', () => ({
  default: () => <div />,
}))

vi.mock('@/components/ui/ThemeToggle', () => ({
  default: () => <button aria-label="Theme toggle" />,
}))

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  toast: { error: vi.fn() },
}))

import SignInPage from '../page'

describe('sign-in page header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', {})
  })

  it('does not render stale workspace or user controls', () => {
    const html = renderToStaticMarkup(<SignInPage />)

    expect(html).not.toContain('Oves Togo')
    expect(html).not.toContain('app-header-avatar-btn')
  })
})
