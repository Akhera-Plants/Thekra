import { apiGet } from '@/lib/api-client';
import type { TopicThemeIndexEntry } from '@/lib/types/api';

/** Theme labels of every public topic, for the catalogue search. */
export async function getTopicThemes() {
  return apiGet<TopicThemeIndexEntry[]>('/topic-themes');
}
