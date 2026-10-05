import { useQuery } from '@tanstack/react-query';
import { getTags } from '@/lib/api/tags';
import { queryKeys } from '@/lib/query-keys';
import { TagCategory } from '@/lib/types/enums';

export function useEmotionTags() {
  return useQuery({
    queryKey: queryKeys.tags.list({ category: TagCategory.EMOTION }),
    queryFn: () => getTags({ category: TagCategory.EMOTION }),
  });
}
