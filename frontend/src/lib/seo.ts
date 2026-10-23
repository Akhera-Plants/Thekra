import type { Metadata } from 'next';

/**
 * Canonical URL and language versions of a public page (`path` without the locale prefix,
 * e.g. `/sins/ghibah`). Arabic is the default locale and has no prefix (routing: as-needed).
 * Relative paths resolve against metadataBase (locale layout).
 */
export function localeAlternates(locale: string, path: string): NonNullable<Metadata['alternates']> {
  const ar = path;
  const en = path === '/' ? '/en' : `/en${path}`;
  return {
    canonical: locale === 'en' ? en : ar,
    languages: { ar, en, 'x-default': ar },
  };
}

/** One line for a description tag: whitespace folded, cut on a word boundary. */
export function metaDescription(text: string | null | undefined, max = 155): string | undefined {
  const line = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!line) return undefined;
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trim()}…`;
}
