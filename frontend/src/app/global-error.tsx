'use client';

import { useEffect } from 'react';
import { feedback as feedbackAr } from '../../messages/ar.json';
import { feedback as feedbackEn } from '../../messages/en.json';
import { reportFailure } from '@/lib/errors';
import './globals.css';
import './feedback.css';

/**
 * Last resort: the root layout itself failed, so there is no provider, no fonts and no
 * locale param. It renders its own document; the language comes from the URL (`/en/...`).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const english = typeof window !== 'undefined' && /^\/en(\/|$)/.test(window.location.pathname);
  const copy = (english ? feedbackEn : feedbackAr).global;

  useEffect(() => {
    reportFailure(`root layout${error.digest ? ` (digest ${error.digest})` : ''}`, error);
  }, [error]);

  return (
    <html lang={english ? 'en' : 'ar'} dir={english ? 'ltr' : 'rtl'}>
      <body
        style={{
          margin: 0,
          minBlockSize: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem',
          textAlign: 'center',
          background: 'var(--background)',
          color: 'var(--foreground)',
          fontFamily: 'system-ui, "Segoe UI", Tahoma, sans-serif',
        }}
      >
        <main role="alert" style={{ maxInlineSize: '28rem' }}>
          <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden style={{ marginBlockEnd: '1rem' }}>
            <rect width="48" height="48" rx="12" fill="#326C59" />
            <g fill="none" stroke="#FFF5EE" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M24 37V18M24 30C13 30 11 23 12 15c8 0 12 5 12 15Zm0 0c11 0 13-7 12-15-8 0-12 5-12 15Zm0-12c-5-5-5-8 0-13 5 5 5 8 0 13Z" />
            </g>
          </svg>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{copy.title}</h1>
          <p style={{ margin: '0 0 1.5rem', lineHeight: 1.8, color: 'var(--muted-foreground)' }}>{copy.body}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minBlockSize: '2.75rem',
              paddingInline: '1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid #326C59',
              background: '#326C59',
              color: '#fff',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
