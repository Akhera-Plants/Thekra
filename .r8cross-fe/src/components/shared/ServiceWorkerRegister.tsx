'use client';

import { useEffect } from 'react';
import { env } from '@/lib/env';

/**
 * Registers public/sw.js (offline pages and assets) in production builds. The API origin is
 * passed in the URL so the worker caches public API reads from it and nothing else.
 * Development never registers it: a cached page would hide code changes.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const url = `/sw.js?api=${encodeURIComponent(new URL(env.NEXT_PUBLIC_API_URL).origin)}`;
    const register = () => {
      navigator.serviceWorker.register(url, { scope: '/', updateViaCache: 'none' }).catch(() => {
        // No worker means no offline copies; the site works the same online.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
