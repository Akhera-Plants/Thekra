import { apiGet, type ApiGetConfig } from '@/lib/api-client';
import type {
  GoodDeedDto,
  SinDto,
  SinQuotesQuery,
  SinQuotesResponse,
  SinsQuery,
} from '@/lib/types/api';

export async function getSins(query: SinsQuery = {}, config?: Pick<ApiGetConfig, 'signal'>) {
  return apiGet<SinDto[]>('/sins', { ...config, params: query });
}

export async function getSin(slug: string, lang?: SinsQuery['lang']) {
  return apiGet<SinDto>(`/sins/${slug}`, {
    params: lang ? { lang } : undefined,
  });
}

export async function getSinQuotes(
  slug: string,
  query: SinQuotesQuery = {},
  config?: Pick<ApiGetConfig, 'signal' | 'revalidate'>,
) {
  return apiGet<SinQuotesResponse>(`/sins/${slug}/quotes`, {
    ...config,
    params: query,
  });
}

export async function getSinAlternatives(
  slug: string,
  query: Pick<SinsQuery, 'page' | 'limit' | 'lang'> = {},
) {
  return apiGet<GoodDeedDto[]>(`/sins/${slug}/good-deeds`, { params: query });
}
