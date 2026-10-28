/**
 * Where to go after signing in or up: the page's `?next=` (a practice page links here with its own path), when it
 * is a path on this site. Anything else (absolute URLs, `//host`, backslashes) falls back, so the parameter cannot
 * send the visitor to another site.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}

/** Reads `?next=` at submit time (no `useSearchParams`, so the auth pages stay static). */
export function nextPathFromLocation(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback;
  return safeNextPath(new URLSearchParams(window.location.search).get('next'), fallback);
}
