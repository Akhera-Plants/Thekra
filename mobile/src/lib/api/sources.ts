import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type { SourceListDto } from '../types/api';
import type { LocaleCode } from '../types/enums';

/** The ~90 sources fit one page (the API caps a page at 100). */
const SOURCE_PAGE = 1;
const SOURCE_LIMIT = 100;
const MAX_LABEL_LENGTH = 80;

/** Shown when the API cannot answer, as on the site (frontend/src/lib/api/source-strip.ts): each has published texts. */
export const FALLBACK_SOURCE_NAMES: Record<LocaleCode, readonly string[]> = {
  ar: ['القرآن الكريم', 'صحيح البخاري', 'صحيح مسلم', 'رياض الصالحين'],
  en: ['The Noble Quran', 'Sahih al-Bukhari', 'Sahih Muslim', 'Riyad as-Salihin'],
};

type SourceNameRow = Pick<SourceListDto, 'name' | 'nameAr' | 'publishedQuoteCount'>;

function cleanLabel(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
}

/**
 * The site's `rankSourceNames`: published sources, most published first, one entry per name. Each language uses only
 * its own name, so a source without an Arabic name is left out of the Arabic strip rather than shown in Latin.
 */
export function rankSourceNames(rows: readonly SourceNameRow[], locale: LocaleCode): string[] {
  const ranked = rows
    .filter((row) => row.publishedQuoteCount > 0)
    .map((row) => ({ label: cleanLabel(locale === 'en' ? row.name : row.nameAr), count: row.publishedQuoteCount }))
    .filter((row) => row.label.length > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));
  return [...new Set(ranked.map((row) => row.label))];
}

export async function fetchSources(page: number, limit: number) {
  return apiGet<SourceListDto[]>('/sources', { params: { page, limit } });
}

/** Names for the home «تذكير تعرف مصدره» strip in the UI language. */
export function useSourceStripNames() {
  const { i18n } = useTranslation();
  const lang: LocaleCode = i18n.language === 'en' ? 'en' : 'ar';
  return useQuery({
    queryKey: queryKeys.sources.list(SOURCE_PAGE, SOURCE_LIMIT),
    queryFn: () => fetchSources(SOURCE_PAGE, SOURCE_LIMIT),
    select: (r) => rankSourceNames(r.data, lang),
  });
}
