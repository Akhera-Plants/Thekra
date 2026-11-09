import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../api-client';
import { queryKeys } from '../query-keys';
import type { ExplanationRow } from '../study/tabs';
import type { QuoteDetailDto, QuoteDto, QuotesQuery, PageMeta } from '../types/api';

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function fetchQuote(id: string, lang?: string) {
  return apiGet<QuoteDetailDto>(`/quotes/${id}`, {
    params: lang ? { lang, includeAllTranslations: true } : { includeAllTranslations: true },
  });
}

export async function fetchQuotes(params: QuotesQuery = {}) {
  return apiGet<QuoteDetailDto[]>('/quotes', { params });
}

/** Tafsir and sharh rows of a quote. With `lang=en` the API also returns the Arabic rows. */
export async function fetchQuoteExplanations(id: string, lang: 'ar' | 'en') {
  return apiGet<ExplanationRow[]>(`/quotes/${id}/explanations`, { params: { lang } });
}

/** The site's «تذكرة مختارة»: one published sahih or hasan text, the same for everyone on a UTC day; null when none. */
export async function fetchReminderOfTheDay(lang: 'ar' | 'en') {
  return apiGet<QuoteDto | null>('/quotes/today', { params: { lang } });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useQuote(id: string, params: { lang?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.quotes.detail(id),
    queryFn: () => fetchQuote(id, params.lang),
    enabled: Boolean(id),
    select: (r) => r.data,
  });
}

/**
 * «التفسير» / «الشرح» of a quote in the UI language (the site's useExplanations). `enabled: false` waits (the card's
 * «لماذا هذه الآية؟» asks only when it is first opened); the key is the same, so the study sheet reuses the rows.
 */
export function useQuoteExplanations(quoteId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  return useQuery({
    queryKey: queryKeys.quotes.explanations(quoteId, lang),
    queryFn: () => fetchQuoteExplanations(quoteId, lang),
    enabled: enabled && Boolean(quoteId),
    select: (r) => r.data,
  });
}

/** Today's reminder in the UI language. The UTC day is in the key, so a new day reads a new text. */
export function useReminderOfTheDay() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const utcDay = Math.floor(Date.now() / DAY_MS);
  return useQuery({
    queryKey: queryKeys.quotes.today(lang, utcDay),
    queryFn: () => fetchReminderOfTheDay(lang),
    select: (r) => r.data,
  });
}

export function useQuotes(params: QuotesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.quotes.list(params),
    queryFn: () => fetchQuotes(params),
    select: (r) => r,
  });
}

export function useQuotesInfinite(baseParams: QuotesQuery = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.quotes.list(baseParams),
    queryFn: ({ pageParam = 1 }) => fetchQuotes({ ...baseParams, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta as PageMeta | undefined;
      return meta?.hasNext ? (meta.page ?? 1) + 1 : undefined;
    },
  });
}

// ── Reader (round 6, C-13 / C-01n) ────────────────────────────────────────────

export interface ReaderSource {
  id: string;
  name: string;
  nameAr: string | null;
  type: string;
  author: string | null;
  authorAr: string | null;
}

export interface QuoteReaderDto {
  quoteId: string;
  type: string;
  /** «وجه التذكير» of the topic link, editorial; null when not written yet (no section then). Never generated. */
  reminderAngle: { text: string; languageCode: 'ar' | 'en' } | null;
  /** Verses: المختصر، السعدي، ابن عاشور, in that order, each only when the database has it. */
  tafsirs: Array<{
    key: 'mukhtasar' | 'sadi' | 'ibn-ashur';
    source: ReaderSource;
    languageCode: string;
    entries: Array<{ id: string; ayahKey: string | null; text: string; reference: string | null }>;
  }>;
  /** Hadith and other texts: sharh, fawaid, gharib…, as the explanations endpoint. */
  explanations: Array<ExplanationRow & { source: ReaderSource }>;
}

/** `GET /quotes/:id/reader?lang=&linkId=`: the reader's text sections in one request. */
export async function fetchQuoteReader(id: string, lang: 'ar' | 'en', linkId?: string) {
  return apiGet<QuoteReaderDto>(`/quotes/${id}/reader`, { params: linkId ? { lang, linkId } : { lang } });
}

const LINK_ID = /^[0-9a-f-]{36}$/i;

export function useQuoteReader(quoteId: string, linkId?: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const link = linkId && LINK_ID.test(linkId) ? linkId : undefined;
  return useQuery({
    queryKey: ['quotes', 'reader', quoteId, lang, link ?? null],
    queryFn: () => fetchQuoteReader(quoteId, lang, link),
    enabled: Boolean(quoteId),
    select: (r) => r.data,
  });
}

// ── «أبلغ عن خطأ» (round 6, C-01s) ─────────────────────────────────────────────

export const REPORT_REASONS = ['TEXT', 'ISNAD', 'GRADE', 'CLASSIFICATION', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
/** The API's note limit (ReportQuoteDto). */
export const REPORT_NOTE_MAX = 400;

export async function reportQuote(id: string, reason: ReportReason, note?: string) {
  return apiPost<unknown>(`/quotes/${id}/reports`, { reason, note: note?.trim() || undefined });
}
