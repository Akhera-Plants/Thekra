import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
// The shared navigation map has no imports, so the config loader can read it from source.
import { NAV_FEATURES, WEB_REDIRECTS } from '../packages/practice-core/src/nav-map';
import { webRedirectRules } from './src/lib/nav/redirects';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

/** Origin of the Nest API the browser calls (React Query / axios). */
function apiOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const api = apiOrigin();
const apiIsHttps = api?.startsWith('https://') ?? false;

/**
 * Content-Security-Policy without nonces, so pages stay statically rendered.
 * - Fonts are self-hosted by next/font; there are no external images/scripts.
 * - script-src needs 'unsafe-inline' for Next's inline RSC/bootstrap scripts and
 *   the next-themes no-flash script (a nonce would force dynamic rendering).
 * - 'unsafe-eval' and the HMR websocket are allowed only by `next dev`.
 * - upgrade-insecure-requests only when the API is https (a local production
 *   build talks to http://localhost:3001).
 * - connect-src allows https://api.aladhan.com: the browser fetches the prayer times of the city the user chose
 *   (redesign §4.6, prayer-time anchors). No credentials are sent there.
 * - media-src allows https://everyayah.com: the verse cards' recitation button streams one ayah's file from there
 *   (owner round 5, F-03 a). Same origin as RECITATION_BASE_URL in src/lib/quran/recitation.ts — change both together.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' https://everyayah.com",
  ['connect-src', "'self'", api, 'https://api.aladhan.com', isDev ? 'ws: wss:' : null].filter(Boolean).join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
  ...(apiIsHttps ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Browsers ignore HSTS over plain http, so this is inert on localhost.
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  // Playwright and local tooling hit 127.0.0.1; without this, Next 16 blocks
  // /_next/* (and HMR) as cross-origin from that host vs localhost.
  allowedDevOrigins: ['127.0.0.1'],
  // Workspace engine shipped as TypeScript source (`exports` → src/index.ts, `.js` relative specifiers).
  // Compile it with the app in dev and build instead of loading it as untouched runtime code.
  transpilePackages: ['@thekra/practice-core'],
  turbopack: {
    rules: {
      // Turbopack does not resolve the package's `./x.js` specifiers to `./x.ts`; see the loader's header.
      '*.ts': {
        condition: { path: /^packages\/practice-core\/src\// },
        loaders: [require.resolve('./scripts/practice-core-specifiers.cjs')],
        as: '*.ts',
      },
    },
  },
  poweredByHeader: false,
  // Old paths of the round-5 information architecture (practice-core `WEB_REDIRECTS`), Arabic and English.
  async redirects() {
    return webRedirectRules(WEB_REDIRECTS, NAV_FEATURES.map((feature) => feature.web));
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // The service worker must never be served stale, or a fix would not reach installed copies.
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
