'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth-context';
import { useI18n } from '@/i18n';
import Image from 'next/image';
import { Globe } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

const LoginPage = () => {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, loading, error } = useAuth();

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'fr' : locale === 'fr' ? 'zh' : 'en';
    setLocale(nextLocale);
  };

  // Watch for error changes and display toast
  useEffect(() => {
    if (!error) return;

    // Extract back-end message (if any) and map to localized text
    const raw = (
      (error?.graphQLErrors?.[0]?.extensions as any)?.originalError?.error ||
      error?.graphQLErrors?.[0]?.message ||
      error?.message ||
      ''
    ) as string;

    const lc = raw.toLowerCase();
    let message: string | undefined;

    if (lc.includes('bad request')) message = t('auth.error.badRequest');
    else if (lc.includes('unauthorized')) message = t('auth.error.unauthorized');
    else if (lc.includes('invalid credentials') || lc.includes('invalid email') || lc.includes('invalid password')) message = t('auth.error.invalidCredentials');
    else if (lc.includes('user not found') || lc.includes('not found')) message = t('auth.error.userNotFound');

    if (!message) message = t('auth.error.badRequest');

    toast.error(message);
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(t('auth.error.missingCredentials'));
      return;
    }
    const credentials = {
      email: email,
      password: password,
    };
    setIsLoading(true); // Sync local loading state with button
    await signIn(credentials);
    setIsLoading(false);
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToCustomerView = () => {
    try {
      localStorage.setItem('userRole', 'Customer');
      if (typeof AsyncStorage !== 'undefined') {
        AsyncStorage.setItem('userRole', 'Customer');
      }
      router.push('/');
    } catch (error) {
      console.error('Error changing user role:', error);
      toast.error(t('auth.error.switchCustomer'));
    }
  };

  return (
    <>
      {/* Header with Back + Logo on left, Language Toggle on right */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <div className="flow-header-left">
            <button 
              className="flow-header-back" 
              onClick={handleBackToCustomerView}
              aria-label={t('auth.backToCustomer')}
              title={t('auth.backToCustomer')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
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
              aria-label={t('Switch language')}
            >
              <Globe size={16} />
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
              iconTheme: {
                primary: 'var(--color-success)',
                secondary: 'white',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--color-error)',
                secondary: 'white',
              },
            },
          }}
        />

      {/* Header */}
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

      {/* Login Form */}
      <form onSubmit={handleLogin} className="login-form">
        {/* Email Input */}
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
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              disabled={isLoading || loading}
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="form-group">
          <label className="form-label">{t('auth.passwordPlaceholder')}</label>
          <div className="input-with-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
              disabled={isLoading || loading}
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? t('Hide password') : t('Show password')}
              disabled={isLoading || loading}
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

        {/* Sign In Button */}
        <button
          type="submit"
          className="btn btn-primary login-btn"
          disabled={isLoading || loading || !email.trim() || !password.trim()}
        >
          {(isLoading || loading) ? (
            <>
              <div className="loading-spinner" style={{ width: 18, height: 18, marginBottom: 0, borderWidth: 2 }}></div>
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
  );
};

export default LoginPage;