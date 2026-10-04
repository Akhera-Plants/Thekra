import { apiGet } from '@/lib/api-client';
import type {
  GoodDeedDto,
  SinDto,
  SinQuotesQuery,
  SinQuotesResponse,
  SinsQuery,
} from '@/lib/types/api';

export async function getSins(query: SinsQuery = {}) {
  return apiGet<SinDto[]>('/sins', { params: query });
}

export async function getSin(slug: string, lang?: SinsQuery['lang']) {
  return apiGet<SinDto>(`/sins/${slug}`, {
    params: lang ? { lang } : undefined,
  });
}

export async function getSinQuotes(slug: string, query: SinQuotesQuery = {}) {
  return apiGet<SinQuotesResponse>(`/sins/${slug}/quotes`, {
    params: query,
  });
}

export async function getSinAlternatives(
  slug: string,
  query: Pick<SinsQuery, 'page' | 'limit' | 'lang'> = {},
) {
  return apiGet<GoodDeedDto[]>(`/sins/${slug}/good-deeds`, { params: query });
}
