/**
 * One verse as stored (content rule §3.1: Quran text comes only from the database). Public and the same for every
 * user, like the website's `getAyah`.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api-client';
import { queryKeys } from '../query-keys';
import type { QuoteDto } from '../types/api';

export async function fetchAyah(surah: number, ayah: number, lang: string) {
  return apiGet<QuoteDto>(`/quran/ayahs/${surah}/${ayah}`, { params: { lang } });
}

export function useAyah(surah: number, ayah: number, lang: string) {
  return useQuery({
    queryKey: queryKeys.quran.ayah(surah, ayah, lang),
    queryFn: () => fetchAyah(surah, ayah, lang),
    select: (r) => r.data,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
