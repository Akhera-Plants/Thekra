/** Public «مجموعات التذكير» (`GET /v1/reminder-sets`): published sets with their texts (reader gate). */
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type { QuoteDto } from '../types/api';

export interface ReminderSetDto {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  sortOrder: number;
  itemCount: number;
  items: QuoteDto[];
}

export async function fetchReminderSets() {
  return apiGet<ReminderSetDto[]>('/reminder-sets');
}

export function useReminderSets() {
  return useQuery({
    queryKey: queryKeys.reminderSets.all,
    queryFn: fetchReminderSets,
    select: (r) => r.data,
    networkMode: 'offlineFirst',
    staleTime: 6 * 60 * 60 * 1000,
  });
}
