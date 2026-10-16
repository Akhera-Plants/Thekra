import { cache } from 'react';
import { getQuotes } from '@/lib/api/quotes';
import { HadithGrade } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';

export interface HeroVerse {
  text: string;
  /** Arabic Uthmani for lang="ar" display. */
  surahNameAr: string;
  /** English surah name for /en citation (e.g. Qaf). */
  surahNameEn: string;
  verseKey: string;
  ayah: number;
  /** Saheeh International (or other stored EN) meaning when present. */
  translationEn: string | null;
}

/**
 * Qaf 50:37 — Arabic from Quran.com; English meaning from the stored quote translation.
 * Returns null when the Arabic API is unreachable so the page does not invent the text.
 */
export const getQafVerse = cache(async (): Promise<HeroVerse | null> => {
  try {
    const [verseResponse, chapterAr, chapterEn, stored] = await Promise.all([
      fetch('https://api.quran.com/api/v4/verses/by_key/50:37?fields=text_uthmani', {
        next: { revalidate: 86_400 },
      }),
      fetch('https://api.quran.com/api/v4/chapters/50?language=ar', {
        next: { revalidate: 86_400 },
      }),
      fetch('https://api.quran.com/api/v4/chapters/50?language=en', {
        next: { revalidate: 86_400 },
      }),
      getQuotes({ surahNumber: 50, ayahNumber: 37, limit: 1, lang: 'en' }).catch(() => null),
    ]);
    if (!verseResponse.ok || !chapterAr.ok) return null;
    const verseBody = (await verseResponse.json()) as {
      verse?: { text_uthmani?: string; verse_key?: string };
    };
    const chapterArBody = (await chapterAr.json()) as {
      chapter?: { name_arabic?: string };
    };
    const chapterEnBody = chapterEn.ok
      ? ((await chapterEn.json()) as { chapter?: { name_simple?: string } })
      : {};
    const text = verseBody.verse?.text_uthmani;
    const surahNameAr = chapterArBody.chapter?.name_arabic;
    if (!text || !surahNameAr) return null;
    return {
      text,
      surahNameAr,
      surahNameEn: chapterEnBody.chapter?.name_simple ?? 'Qaf',
      verseKey: verseBody.verse?.verse_key ?? '50:37',
      ayah: 37,
      translationEn: stored?.data[0]?.translation?.text ?? null,
    };
  } catch {
    return null;
  }
});

/** The branches hadith, searched in the corpus. Null when it is not in the database. */
export const getBranchesHadith = cache(async (lang: 'ar' | 'en' = 'ar'): Promise<QuoteDto | null> => {
  try {
    const result = await getQuotes({
      q: 'بضع وسبعون',
      limit: 1,
      grades: [HadithGrade.SAHIH],
      lang,
    });
    return result.data[0] ?? null;
  } catch {
    return null;
  }
});
