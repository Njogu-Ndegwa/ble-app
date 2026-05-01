'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called once when the error count exceeds the auto-recovery threshold (3rd+ crash). */
  onCriticalError?: () => void;
}

interface State {
  hasError: boolean;
  errorCount: number;
  error: Error | null;
}

/**
 * ErrorBoundary — catches React render/lifecycle errors without killing the app.
 *
 * Recovery strategy (keeps UX clean on transient failures):
 *  1. First two errors  → show a toast, then automatically clear the error
 *     state after a short pause so the subtree re-mounts (fast self-healing).
 *  2. Third+ errors     → the component is genuinely broken; show a minimal,
 *     non-intrusive inline prompt so the user can reload without the entire
 *     screen looking like a hard crash.
 *
 * In both cases the app never shows the raw Next.js / browser error page.
 */
export class ErrorBoundary extends Component<Props, State> {
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error.message, errorInfo.componentStack);

    const nextCount = this.state.errorCount + 1;
    this.setState({ errorCount: nextCount });

    if (nextCount <= 2) {
      toast.error('Something went wrong — recovering…', { duration: 3000, id: 'eb-recovery' });
      this.recoveryTimer = setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 1200);
    } else {
      toast.error('A persistent error occurred. Please reload the app.', {
        duration: 5000,
        id: 'eb-persistent',
      });
      this.props.onCriticalError?.();
    }
  }

  componentWillUnmount() {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    // Transient error — neutral loading screen while auto-recovering.
    // We render our own Toaster here because the page's Toaster may have
    // unmounted along with the crashed subtree.
    if (this.state.errorCount <= 2) {
      return (
        <>
          <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-primary, #0a0f0f)',
              zIndex: 9999,
            }}
          >
            <div className="loading-spinner" />
          </div>
        </>
      );
    }

    // Persistent error — minimal recovery UI, no scary stack traces.
    return (
      <>
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'var(--bg-primary, #0a0f0f)',
            gap: '12px',
            zIndex: 9999,
          }}
        >
          <p
            style={{
              color: 'var(--text-secondary, #9ca3af)',
              fontSize: '14px',
              textAlign: 'center',
              maxWidth: '280px',
              margin: 0,
            }}
          >
            Something went wrong. Try again or reload the app.
          </p>

          <button
            onClick={this.handleRetry}
            style={{
              padding: '10px 24px',
              background: 'var(--accent, #14b8a6)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>

          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              color: 'var(--text-muted, #6b7280)',
              border: 'none',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      </>
    );
  }
}

export default ErrorBoundary;
