import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type { TagsQuery } from '../types/api';

export interface TagDto {
  id: string;
  slug: string;
  name: string;
  nameAr: string | null;
  category: string;
}

export async function fetchTags(params: TagsQuery = {}) {
  return apiGet<TagDto[]>('/tags', { params });
}

export async function fetchTag(slug: string) {
  return apiGet<TagDto>(`/tags/${slug}`);
}

export function useTags(params: TagsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.tags.list(params),
    queryFn: () => fetchTags(params),
    select: (r) => r.data,
  });
}

export function useTag(slug: string) {
  return useQuery({
    queryKey: queryKeys.tags.detail(slug),
    queryFn: () => fetchTag(slug),
    enabled: Boolean(slug),
    select: (r) => r.data,
  });
}
