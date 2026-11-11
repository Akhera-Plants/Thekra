/** Public «مجموعات التذكير»: published sets with their texts (reader gate, the shared quote serializer). */
import { apiGet } from '@/lib/api-client';
import type { ReminderSetDto } from '@/lib/types/api';

export async function getReminderSets(): Promise<ReminderSetDto[]> {
  return (await apiGet<ReminderSetDto[]>('/reminder-sets')).data;
}
