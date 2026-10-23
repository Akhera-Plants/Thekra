import type { TopicThemeIndexEntry } from '@/lib/types/api';

/** Same folding as the backend theme matcher (tashkeel, hamza seats, ta marbuta, punctuation). */
export function foldArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/[()[\]{}«»"'.,،؛;:!?؟\-–—_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether a folded query (foldArabic) sits inside any of the names, folded the same way. */
export function namesMatch(names: readonly string[], foldedQuery: string): boolean {
  if (!foldedQuery) return true;
  return names.some((name) => foldArabic(name).includes(foldedQuery));
}

/** Words that carry no topic on their own («من باب …», "the …"). */
const STOP = new Set(['من', 'في', 'علي', 'عن', 'الي', 'او', 'و', 'ما', 'the', 'of', 'and', 'a', 'to', 'in']);

export interface ThemeSearchHit {
  key: string;
  label: string;
  pageTitle: string;
  /** Locale-free path, e.g. /sins/tark-as-salah?theme=tark-jumua */
  href: string;
}

/**
 * Themes whose label (either language) or chapter phrases hold every word of
 * the query. Only themes shown on a page of `catalog` are returned; a paired
 * opposite's theme opens on this catalogue's page of the pair.
 */
export function searchTopicThemes(
  index: readonly TopicThemeIndexEntry[],
  query: string,
  catalog: 'sins' | 'good-deeds',
  locale: string,
  limit = 8,
): ThemeSearchHit[] {
  const words = foldArabic(query).split(' ').filter((word) => word.length > 1 && !STOP.has(word));
  if (words.length === 0) return [];
  const hits: ThemeSearchHit[] = [];
  for (const entry of index) {
    const slug = catalog === 'sins' ? entry.pages.sins : entry.pages.goodDeeds;
    if (!slug) continue;
    const haystack = ` ${foldArabic([entry.ar, entry.en, ...entry.terms].join(' | '))} `;
    if (!words.every((word) => haystack.includes(word))) continue;
    hits.push({
      key: entry.key,
      label: locale === 'en' ? entry.en : entry.ar,
      pageTitle: locale === 'en' ? entry.pageTitleEn : entry.pageTitleAr,
      href: `/${catalog}/${slug}?theme=${encodeURIComponent(entry.key)}`,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Theme keys are lowercase slugs (backend THEME_KEY_PATTERN); anything else is dropped. */
export function parseThemeParam(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw.length > 64) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw) ? raw : null;
}
