'use client';

import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';

const AppLoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      flexDirection: 'column',
      gap: 16,
      background: 'var(--bg-primary, #0a0a0a)',
    }}
  >
    <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
  </div>
);

const TicketingApp = dynamic(() => import('./TicketingApp'), {
  loading: AppLoadingFallback,
  ssr: false,
});

export default function TicketingPage() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            fontSize: '13px',
            fontFamily: "'Outfit', sans-serif",
          },
          success: { iconTheme: { primary: 'var(--color-success)', secondary: 'white' } },
          error: { iconTheme: { primary: 'var(--color-error)', secondary: 'white' } },
        }}
      />
      <TicketingApp />
    </>
  );
}
