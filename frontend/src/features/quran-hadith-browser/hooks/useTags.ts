import { useQuery } from '@tanstack/react-query';
import { getTags, getTag } from '@/lib/api/tags';
import { queryKeys } from '@/lib/query-keys';
import type { TagsQuery } from '@/lib/types/api';

export function useTags(params: TagsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.tags.list(params),
    queryFn: () => getTags(params),
  });
}

export function useTag(slug: string) {
  return useQuery({
    queryKey: queryKeys.tags.detail(slug),
    queryFn: () => getTag(slug),
    enabled: Boolean(slug),
  });
}
