import { apiGet, type ApiGetConfig } from '@/lib/api-client';
import { env } from '@/lib/env';
import type { QuoteDto } from '@/lib/types/api';
import type { OccasionDate, OccasionsQuery, PracticeCatalog } from '@/lib/types/practice';

type ClientConfig = Pick<ApiGetConfig, 'signal'>;

/** Habits, sunnah occasions and sin programs. The same answer for every visitor. */
export async function getPracticeCatalog(config?: ClientConfig) {
  return apiGet<PracticeCatalog>('/practice/catalog', config);
}

/** Published quotes by id (unpublished ids are left out by the API). */
export async function getPracticeEvidence(ids: readonly string[], config?: ClientConfig) {
  return apiGet<QuoteDto[]>('/practice/evidence', { ...config, params: { ids: ids.join(',') } });
}

export async function getCalendarOccasions(query: OccasionsQuery, config?: ClientConfig) {
  return apiGet<OccasionDate[]>('/calendar/occasions', { ...config, params: query });
}


/**
 * The public `.ics` feed of the coming occasions (the same file for everyone, no personal data). `webcal:` makes a
 * calendar app subscribe (it re-reads the feed daily); `https:` downloads the file once.
 */
export function occasionsIcsUrl(lang: 'ar' | 'en', scheme: 'https' | 'webcal'): string {
  const url = new URL(`${env.NEXT_PUBLIC_API_URL}/v1/calendar/occasions.ics`);
  url.searchParams.set('lang', lang);
  url.searchParams.set('months', '12');
  const href = url.toString();
  return scheme === 'webcal' ? href.replace(/^https?:/, 'webcal:') : href;
}
