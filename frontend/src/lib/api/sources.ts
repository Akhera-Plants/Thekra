import { apiGet } from '@/lib/api-client';
import type { QuoteSourceDto, SourcesQuery } from '@/lib/types/api';

export interface CatalogSource extends QuoteSourceDto {
  author: string | null;
  authorAr: string | null;
  publishedQuoteCount: number;
}

export async function getSources(query: SourcesQuery = {}) {
  return apiGet<QuoteSourceDto[]>('/sources', { params: query });
}

export async function getCatalogSources(query: SourcesQuery = {}) {
  return apiGet<CatalogSource[]>('/sources', { params: query });
}

export async function getSource(id: string) {
  return apiGet<QuoteSourceDto>(`/sources/${id}`);
}
