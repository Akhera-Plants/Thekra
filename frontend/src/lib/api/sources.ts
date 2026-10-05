import { apiGet } from '@/lib/api-client';
import type { QuoteSourceDto, SourcesQuery } from '@/lib/types/api';

export async function getSources(query: SourcesQuery = {}) {
  return apiGet<QuoteSourceDto[]>('/sources', { params: query });
}

export async function getSource(id: string) {
  return apiGet<QuoteSourceDto>(`/sources/${id}`);
}
