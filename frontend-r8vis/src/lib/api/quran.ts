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

/** One verse as stored (Quran text comes only from the database, content rule §3.1). */
export async function getAyah(surahNumber: number, ayahNumber: number, query: { lang?: SurahAyahsQuery['lang'] } = {}) {
  return apiGet<QuoteDto>(`/quran/ayahs/${surahNumber}/${ayahNumber}`, { params: query });
}
