import { apiGet, type ApiGetConfig } from '@/lib/api-client';
import type {
  GoodDeedDto,
  GoodDeedQuotesQuery,
  GoodDeedQuotesResponse,
  GoodDeedsQuery,
  SinDto,
} from '@/lib/types/api';

export async function getGoodDeeds(query: GoodDeedsQuery = {}) {
  return apiGet<GoodDeedDto[]>('/good-deeds', { params: query });
}

export async function getGoodDeed(
  slug: string,
  lang?: GoodDeedsQuery['lang'],
) {
  return apiGet<GoodDeedDto>(`/good-deeds/${slug}`, {
    params: lang ? { lang } : undefined,
  });
}

export async function getGoodDeedQuotes(
  slug: string,
  query: GoodDeedQuotesQuery = {},
  config?: Pick<ApiGetConfig, 'signal' | 'revalidate'>,
) {
  return apiGet<GoodDeedQuotesResponse>(`/good-deeds/${slug}/quotes`, {
    ...config,
    params: query,
  });
}

export async function getGoodDeedOppositeSin(slug: string) {
  return apiGet<Pick<SinDto, 'id' | 'slug' | 'name' | 'nameAr'>>(
    `/good-deeds/${slug}/opposite-sin`,
  );
}
