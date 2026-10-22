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

export const env = {
  NEXT_PUBLIC_API_URL: requirePublicUrl(
    process.env.NEXT_PUBLIC_API_URL,
    'NEXT_PUBLIC_API_URL',
  ),
} as const;
