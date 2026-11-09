import { apiGet } from '@/lib/api-client';
import type { ExplanationRow } from './lib/tabs';

export async function getExplanations(quoteId: string, lang?: 'ar' | 'en') {
  return apiGet<ExplanationRow[]>(`/quotes/${quoteId}/explanations`, {
    params: lang ? { lang } : undefined,
  });
}

/** GET /quotes/:id/reader (round 6, C-13 / C-01n): «وجه التذكير» of a topic link, and the explanations inline. */
export interface QuoteReaderData {
  quoteId: string;
  type: string;
  reminderAngle: { text: string; languageCode: 'ar' | 'en' } | null;
  /** Verses: المختصر، السعدي، ابن عاشور, in that order, each only when the database has it. */
  tafsirs: Array<{
    key: 'mukhtasar' | 'sadi' | 'ibn-ashur';
    source: { id: string; name: string; nameAr: string | null };
    languageCode: string;
    entries: Array<{ id: string; ayahKey: string | null; text: string; reference: string | null }>;
  }>;
  /** Hadith: sharh, fawaid, gharib, long sharh. */
  explanations: ExplanationRow[];
}

export async function getQuoteReader(quoteId: string, lang: 'ar' | 'en', linkId?: string | null) {
  return apiGet<QuoteReaderData>(`/quotes/${quoteId}/reader`, {
    params: linkId ? { lang, linkId } : { lang },
  });
}
