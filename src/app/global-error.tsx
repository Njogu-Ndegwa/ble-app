'use client';

/**
 * Next.js App Router global error boundary.
 *
 * This file is the last line of defence — it only activates when an error
 * escapes the root layout itself (e.g. a provider throws during SSR/hydration).
 * It must render its own <html> and <body> because the root layout is bypassed.
 *
 * Keep this UI minimal: the user just needs a way to get back into the app.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#0a0f0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
          boxSizing: 'border-box',
          gap: '12px',
        }}
      >
        <p
          style={{
            color: '#9ca3af',
            fontSize: '14px',
            textAlign: 'center',
            maxWidth: '280px',
            margin: 0,
          }}
        >
          Something went wrong. Please try again.
        </p>

        <button
          onClick={reset}
          style={{
            padding: '10px 24px',
            background: '#14b8a6',
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
          onClick={() => { window.location.href = '/'; }}
          style={{
            padding: '10px 24px',
            background: 'transparent',
            color: '#6b7280',
            border: 'none',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Go to Home
        </button>
      </body>
    </html>
  );
}
