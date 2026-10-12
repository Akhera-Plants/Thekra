import { cache } from 'react';
import { getQuotes } from '@/lib/api/quotes';
import { HadithGrade } from '@/lib/types/enums';
import type { QuoteDto } from '@/lib/types/api';

export interface HeroVerse {
  text: string;
  surahName: string;
  verseKey: string;
  ayah: number;
}

/**
 * Qaf 50:37 from Quran.com. The verse is never typed into the UI.
 * Returns null when the API is unreachable so the page does not invent the text.
 */
export const getQafVerse = cache(async (): Promise<HeroVerse | null> => {
  try {
    const [verseResponse, chapterResponse] = await Promise.all([
      fetch('https://api.quran.com/api/v4/verses/by_key/50:37?fields=text_uthmani', {
        next: { revalidate: 86_400 },
      }),
      fetch('https://api.quran.com/api/v4/chapters/50?language=ar', {
        next: { revalidate: 86_400 },
      }),
    ]);
    if (!verseResponse.ok || !chapterResponse.ok) return null;
    const verseBody = (await verseResponse.json()) as {
      verse?: { text_uthmani?: string; verse_key?: string };
    };
    const chapterBody = (await chapterResponse.json()) as {
      chapter?: { name_arabic?: string };
    };
    const text = verseBody.verse?.text_uthmani;
    const surahName = chapterBody.chapter?.name_arabic;
    if (!text || !surahName) return null;
    return {
      text,
      surahName,
      verseKey: verseBody.verse?.verse_key ?? '50:37',
      ayah: 37,
    };
  } catch {
    return null;
  }
});

/** The branches hadith, searched in the corpus. Null when it is not in the database. */
export const getBranchesHadith = cache(async (): Promise<QuoteDto | null> => {
  try {
    const result = await getQuotes({
      q: 'بضع وسبعون',
      limit: 1,
      grades: [HadithGrade.SAHIH],
    });
    return result.data[0] ?? null;
  } catch {
    return null;
  }
});
