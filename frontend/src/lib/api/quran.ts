import { apiGet } from '@/lib/api-client';
import type { QuoteDto, SurahAyahsQuery, SurahDto } from '@/lib/types/api';

export async function getSurahs() {
  return apiGet<SurahDto[]>('/quran/surahs');
}

export async function getSurahAyahs(
  surahNumber: number,
  query: SurahAyahsQuery = {},
) {
  return apiGet<QuoteDto[]>(`/quran/surahs/${surahNumber}/ayahs`, {
    params: query,
  });
}
