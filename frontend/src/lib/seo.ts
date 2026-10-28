import type { Metadata } from 'next';

/**
 * Canonical URL and language versions of a public page (`path` without the locale prefix,
 * e.g. `/sins/ghibah`). Arabic is the default locale and has no prefix (routing: as-needed).
 * Relative paths resolve against metadataBase (locale layout).
 */
export function localeAlternates(locale: string, path: string): NonNullable<Metadata['alternates']> {
  const ar = localePath('ar', path);
  const en = localePath('en', path);
  return {
    canonical: locale === 'en' ? en : ar,
    languages: { ar, en, 'x-default': ar },
  };
}

/** The canonical path of a public page in one locale: Arabic unprefixed, English under `/en`. */
export function localePath(locale: string, path: string): string {
  if (locale !== 'en') return path;
  return path === '/' ? '/en' : `/en${path}`;
}

/**
 * Absolute canonical URL of a public page on `origin` (share links). Same path as the page's
 * `alternates.canonical`, so a shared link is the page's canonical address.
 */
export function canonicalUrl(locale: string, path: string, origin: string): string {
  return new URL(localePath(locale, path), origin).toString();
}

/** One line for a description tag: whitespace folded, cut on a word boundary. */
export function metaDescription(text: string | null | undefined, max = 155): string | undefined {
  const line = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!line) return undefined;
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trim()}…`;
}
