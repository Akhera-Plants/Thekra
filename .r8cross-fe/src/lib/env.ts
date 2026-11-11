/**
 * Validated public env access. Components must never read `process.env` directly.
 */

function requirePublicUrl(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  try {
    // Validate shape; trailing slash stripped so baseURL joins are predictable.
    const url = new URL(value);
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`Invalid URL for environment variable: ${name}`);
  }
}

/**
 * Origin for absolute metadata URLs (metadataBase, og:url). Optional, so a
 * missing or malformed value falls back instead of failing the build:
 * NEXT_PUBLIC_SITE_URL, then the Vercel production host, then local dev.
 */
function siteOrigin(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      return new URL(raw).origin;
    } catch {
      // Try the next candidate.
    }
  }
  return 'http://localhost:3000';
}

/**
 * The configured public origin (NEXT_PUBLIC_SITE_URL), or null. Unlike SITE_ORIGIN it has no
 * server-only fallback, so browser code (share links) can fall back to `window.location.origin`.
 */
function publicSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export const env = {
  NEXT_PUBLIC_API_URL: requirePublicUrl(
    process.env.NEXT_PUBLIC_API_URL,
    'NEXT_PUBLIC_API_URL',
  ),
  SITE_ORIGIN: siteOrigin(),
  PUBLIC_SITE_ORIGIN: publicSiteOrigin(),
} as const;
