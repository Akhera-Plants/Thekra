import { apiGet } from '@/lib/api-client';
import type { QuoteTagDto, TagsQuery } from '@/lib/types/api';

export async function getTags(query: TagsQuery = {}) {
  return apiGet<QuoteTagDto[]>('/tags', { params: query });
}

export async function getTag(slug: string) {
  return apiGet<QuoteTagDto>(`/tags/${slug}`);
}
