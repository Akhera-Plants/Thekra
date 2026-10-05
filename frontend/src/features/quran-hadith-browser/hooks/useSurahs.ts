import { useQuery } from '@tanstack/react-query';
import { getSurahs, getSurahAyahs } from '@/lib/api/quran';
import { queryKeys } from '@/lib/query-keys';
import type { SurahAyahsQuery } from '@/lib/types/api';

export function useSurahs() {
  return useQuery({
    queryKey: queryKeys.surahs.all,
    queryFn: getSurahs,
    staleTime: 24 * 60 * 60 * 1000, // Surahs list rarely changes
  });
}

export function useSurahAyahs(
  surahNumber: number,
  params: SurahAyahsQuery = {},
) {
  return useQuery({
    queryKey: queryKeys.surahs.ayahs(surahNumber, params),
    queryFn: () => getSurahAyahs(surahNumber, params),
    enabled: surahNumber > 0,
  });
}
