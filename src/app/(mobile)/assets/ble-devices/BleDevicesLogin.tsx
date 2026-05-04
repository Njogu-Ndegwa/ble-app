"use client";

import React, { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useMutation } from '@apollo/client';
import { useI18n } from '@/i18n';
import { SIGN_IN_USER } from '@/app/(auth)/mutations';

// sessionStorage keys scoped to this applet
export const BLE_DM_TOKEN_KEY = 'ble-dm-token';
export const BLE_DM_USER_KEY = 'ble-dm-user';

interface BleDevicesLoginProps {
  onLoginSuccess: (token: string) => void;
}

const BleDevicesLogin: React.FC<BleDevicesLoginProps> = ({ onLoginSuccess }) => {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [signInUser, { loading }] = useMutation(SIGN_IN_USER, {
    onCompleted: (data) => {
      const { accessToken, refreshToken, _id, name, email: userEmail } = data.signInUser;

      // Persist the fresh token in sessionStorage so the BLE applet gate can
      // verify it and clear it automatically when the WebView session ends.
      sessionStorage.setItem(BLE_DM_TOKEN_KEY, accessToken);
      sessionStorage.setItem(
        BLE_DM_USER_KEY,
        JSON.stringify({ id: _id, name, email: userEmail }),
      );

      // Mirror into localStorage so Apollo client auth-link and any existing
      // applet code that reads access_token / distributorId / user continues
      // to work with this fresh token.
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('distributorId', _id);
      localStorage.setItem('user', JSON.stringify({ name }));

      onLoginSuccess(accessToken);
    },
    onError: (err) => {
      console.warn('[BleDevicesLogin] onError full error:', JSON.stringify({
        message: err.message,
        graphQLErrors: err.graphQLErrors ?? null,
        networkError: err.networkError ? String(err.networkError) : null,
      }));
      const raw = (err.graphQLErrors?.[0]?.message ?? err.message ?? '').toLowerCase();
      console.warn('[BleDevicesLogin] onError raw message used for matching:', raw);
      let msg: string;
      if (
        raw.includes('unauthorized') || raw.includes('invalid') ||
        raw.includes('wrong') || raw.includes('incorrect') ||
        raw.includes('not found') || raw.includes('password') ||
        raw.includes('credentials') || raw.includes('unauthenticated') ||
        raw.includes('forbidden') || raw.includes('401') || raw.includes('403')
      ) {
        msg = t('auth.error.wrongCredentials') || 'Incorrect email or password. Please try again.';
      } else if (
        raw.includes('network') || raw.includes('fetch') ||
        raw.includes('failed to fetch') || raw.includes('timeout') || raw.includes('econnrefused')
      ) {
        msg = t('auth.error.networkError') || 'Connection failed. Please check your network and try again.';
      } else {
        msg = t('auth.error.serverError') || 'Something went wrong. Please try again.';
      }
      console.warn('[BleDevicesLogin] onError showing toast:', msg);
      toast.error(msg);
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.warn('[BleDevicesLogin] handleLogin fired — email:', email.trim(), '| password length:', password.length);
    if (!email.trim() || !password) {
      console.warn('[BleDevicesLogin] handleLogin — missing credentials, showing toast');
      toast.error(t('auth.error.missingCredentials'));
      return;
    }
    console.warn('[BleDevicesLogin] calling signInUser mutation');
    signInUser({ variables: { signInCredentials: { email: email.trim(), password } } });
  };

  return (
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
          <h1 className="login-title">{t('ble.profile.toolName') || 'BLE Device Manager'}</h1>
          <p className="login-subtitle">{t('ble.loginSubtitle') || 'Device Management System — separate credentials required'}</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {/* Email */}
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
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

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
                disabled={loading}
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                disabled={loading}
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

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? (
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
        </form>
    </div>
  );
};

export default BleDevicesLogin;
