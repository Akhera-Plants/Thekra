import { apiGet } from '@/lib/api-client';
import type { HadithCollectionDto } from '@/lib/types/api';

export async function getHadithCollections() {
  return apiGet<HadithCollectionDto[]>('/hadith/collections');
}
