'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import Image from 'next/image'
import { Globe, Eye, EyeOff, ArrowLeft, ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { odooEmployeeLogin, saveOdooEmployeeSession } from '@/lib/ov-auth'

const LoginPage = () => {
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en'
    setLocale(nextLocale)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim() || !password) {
      toast.error(t('auth.error.missingCredentials'))
      return
    }

    setIsLoading(true)
    try {
      const data = await odooEmployeeLogin(email, password)

      if (data.success && data.session) {
        saveOdooEmployeeSession(data.session)
        // Root page reads auth state and routes to SA picker or applet grid
        router.replace('/')
      } else {
        const msg = data.error || data.message || t('auth.error.badRequest')
        toast.error(msg)
      }
    } catch (err: any) {
      console.error('[SignIn] login error:', err)
      toast.error(t('auth.error.badRequest'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button
              className="flow-header-back"
              onClick={() => router.replace('/')}
              aria-label={t('auth.backToCustomer')}
              title={t('auth.backToCustomer')}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flow-header-logo">
              <Image
                src="/assets/Logo-Oves.png"
                alt="Omnivoltaic"
                width={100}
                height={28}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <div className="flow-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button
              className="flow-header-lang"
              onClick={toggleLocale}
              aria-label="Switch language"
            >
              <Globe size={14} />
              <span className="flow-header-lang-label">{locale.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </header>

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
          <h1 className="login-title">{t('auth.title')}</h1>
          <p className="login-subtitle">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={isLoading || !email.trim() || !password.trim()}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }} />
                <span>{t('auth.signingIn')}</span>
              </>
            ) : (
              <>
                <ArrowRight size={18} />
                <span>{t('auth.signIn')}</span>
              </>
            )}
          </button>

          <p className="login-help">
            {t('auth.noAccount')}{' '}
            <a href="#" className="text-brand hover:text-brand-light">
              {t('auth.contactSupport')}
            </a>
          </p>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          <p>{t('common.version', { version: '1.2.5' })}</p>
        </div>
      </div>
    </>
  )
}

export default LoginPage
