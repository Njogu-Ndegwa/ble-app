'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { useI18n } from '@/i18n'
import AppHeader from '@/components/AppHeader'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import { odooEmployeeLogin, saveOdooEmployeeSession } from '@/lib/ov-auth'
import { getMicrosoftAuthUrl, saveMicrosoftPendingContext } from '@/lib/attendant-auth'

type LoginMethod = 'email' | 'phone'

const LoginPage = () => {
  const router = useRouter()
  const { t, locale } = useI18n()

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const identifier = loginMethod === 'phone' ? phone : email
    if (!identifier.trim() || !password) {
      toast.error(t('auth.error.missingCredentials'))
      return
    }

    setIsLoading(true)
    try {
      const data = await odooEmployeeLogin(identifier, password, loginMethod)

      console.info('[SignIn] Raw backend response:', JSON.stringify(data, null, 2))

      if (data.success && data.session) {
        const session = data.session

        // Some backend builds return service_accounts at the top level of the
        // login response rather than nested inside `session`.  Merge them in so
        // saveOdooEmployeeSession always has the full account list.
        const raw = data as any
        if (
          (!Array.isArray(session.service_accounts) || session.service_accounts.length === 0) &&
          Array.isArray(raw.service_accounts) &&
          raw.service_accounts.length > 0
        ) {
          console.info('[SignIn] service_accounts found at response root — merging into session')
          session.service_accounts = raw.service_accounts
        }

        console.info('[SignIn] Login SUCCESS — employee:', session.employee?.name,
          '| SAs:', session.service_accounts?.length ?? 0,
          '| auto_selected:', session.auto_selected)

        saveOdooEmployeeSession(session)
        router.replace('/')
      } else {
        const rawMsg = (data.error || data.message || '').toLowerCase()
        console.warn('[SignIn] Login FAILED or session missing:', data.error || data.message)
        let msg: string
        if (
          rawMsg.includes('invalid') || rawMsg.includes('wrong') ||
          rawMsg.includes('incorrect') || rawMsg.includes('not found') ||
          rawMsg.includes('password') || rawMsg.includes('credentials') ||
          rawMsg.includes('unauthorized') || rawMsg.includes('unauthenticated') ||
          rawMsg.includes('401') || rawMsg.includes('403') || rawMsg === ''
        ) {
          msg = t('auth.error.wrongCredentials') || 'Incorrect email or password. Please try again.'
        } else {
          msg = t('auth.error.serverError') || 'Something went wrong. Please try again.'
        }
        toast.error(msg)
      }
    } catch (err: any) {
      console.error('[SignIn] login error:', err)
      const errMsg = (err?.message || '').toLowerCase()
      if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('timeout')) {
        toast.error(t('auth.error.networkError') || 'Connection failed. Please check your network and try again.')
      } else {
        toast.error(t('auth.error.serverError') || 'Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    if (!navigator.onLine) {
      toast.error('No internet connection. Please check your network and try again.');
      return;
    }

    const authUrl = getMicrosoftAuthUrl()
    saveMicrosoftPendingContext('/', 'sales')

    // Unregister service workers so the Odoo redirect is not intercepted by a stale cache
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        await reg.unregister()
      }
    }

    window.location.href = authUrl
  }

  return (
    <>
      <AppHeader />

      <div className="login-container">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--toast-bg)',
              color: 'var(--toast-text)',
              padding: '16px',
              borderRadius: '8px',
            },
            success: {
              iconTheme: { primary: 'var(--color-success)', secondary: 'white' },
            },
            error: {
              iconTheme: { primary: 'var(--color-error)', secondary: 'white' },
            },
          }}
        />

        <div className="login-header">
          <div className="login-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h1 className="login-title">{t('auth.appTitle')}</h1>
          <p className="login-subtitle">{t('auth.appSubtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {/* Email / Phone toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            borderRadius: 8,
            padding: 3,
            marginBottom: 16,
            gap: 2,
          }}>
            {(['email', 'phone'] as LoginMethod[]).map(method => (
              <button
                key={method}
                type="button"
                onClick={() => setLoginMethod(method)}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: loginMethod === method ? 600 : 400,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: loginMethod === method ? 'var(--color-brand, #00e5e5)' : 'transparent',
                  color: loginMethod === method ? '#0a0a0a' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {method === 'email' ? t('auth.emailPlaceholder') : t('auth.phoneNumber')}
              </button>
            ))}
          </div>

          {/* Email input */}
          {loginMethod === 'email' && (
            <div className="form-group">
              <label className="form-label">{t('auth.emailPlaceholder')}</label>
              <div className="input-with-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          {/* Phone input */}
          {loginMethod === 'phone' && (
            <div className="form-group">
              <PhoneInputWithCountry
                label={t('auth.phoneNumber')}
                value={phone}
                onChange={setPhone}
                locale={locale}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Password */}
          <div className="form-group">
            <label className="form-label">{t('auth.passwordPlaceholder')}</label>
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
                disabled={isLoading}
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Primary sign-in button */}
          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={isLoading || !(loginMethod === 'phone' ? phone.trim() : email.trim()) || !password.trim()}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }} />
                <span>{t('auth.signingIn')}</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                <span>{t('auth.signIn')}</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0 10px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ padding: '0 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('auth.orSignInWith')}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Microsoft sign-in — full width, below form, matches attendant login pattern */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleMicrosoftSignIn}
            disabled={isLoading}
            style={{ width: '100%' }}
          >
            <svg width="16" height="16" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8, flexShrink: 0 }}>
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            <span>{t('auth.signInWithMicrosoft')}</span>
          </button>

          {/* Keypad public access */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0 10px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ padding: '0 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/keypad/keypad')}
            style={{ width: '100%' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ marginRight: 8, flexShrink: 0 }}>
              <rect x="2" y="3" width="20" height="18" rx="2"/>
              <line x1="8" y1="9" x2="8" y2="9.01"/>
              <line x1="12" y1="9" x2="12" y2="9.01"/>
              <line x1="16" y1="9" x2="16" y2="9.01"/>
              <line x1="8" y1="13" x2="8" y2="13.01"/>
              <line x1="12" y1="13" x2="12" y2="13.01"/>
              <line x1="16" y1="13" x2="16" y2="13.01"/>
              <line x1="8" y1="17" x2="16" y2="17"/>
            </svg>
            <span>{t('role.keypad') || 'Keypad'} — {t('auth.noSignInRequired') || 'No sign-in required'}</span>
          </button>

        </form>
      </div>
    </>
  )
}

export default LoginPage
