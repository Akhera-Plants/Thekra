import { apiGet, type ApiGetConfig } from '@/lib/api-client';
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

