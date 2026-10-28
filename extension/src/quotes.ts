/**
 * Evidence texts for notifications. Content rules (docs/guide/PROJECT_GUIDE.md §3, roadmap §0.3):
 *   - every text comes from GET /v1/practice/evidence, which applies the site's publishing gate; nothing is
 *     typed here, nothing is machine translated (English shows the API's own source translation, else Arabic);
 *   - an athar always carries «أثر، وليس حديثًا»; a hadith is shown only with its reference, a verse only
 *     with its surah and ayah; any other kind of quote is skipped;
 *   - a text is never cut: a quote longer than the notification budget is skipped, and with no quote the
 *     notification shows no text at all (also when offline and nothing is cached).
 */
import { UUID } from './catalog.js';
import type { Lang } from './state.js';

export type QuoteKind = 'QURAN_VERSE' | 'HADITH' | 'SCHOLAR_QUOTE' | 'BOOK_EXCERPT';

/** The only quote fields the extension keeps (a subset of the API's QuoteDto). */
export interface QuoteLite {
  id: string;
  type: QuoteKind;
  textAr: string;
  /** Source-supplied English translation from the API (`translation.text` when `languageCode` is en). */
  translationEn: string | null;
  /** `hadith.reference`, e.g. «صحيح البخاري 6464». */
  reference: string | null;
  surahNameAr: string | null;
  surahName: string | null;
  ayahNumber: number | null;
  isAthar: boolean;
  atharSpeakerAr: string | null;
  /** The lecturer retold it in his own words (`citation.gradeReference` starts with «رواه بمعناه»). */
  paraphrase: boolean;
}

/** Longest quote text a notification shows (characters). Longer quotes are skipped, never truncated. */
export const MAX_QUOTE_CHARS = 200;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);

/** Copies the known fields of one QuoteDto. `null` when the id, type or Arabic text is missing. */
export function toQuoteLite(raw: unknown): QuoteLite | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  const type = raw.type;
  if (type !== 'QURAN_VERSE' && type !== 'HADITH' && type !== 'SCHOLAR_QUOTE' && type !== 'BOOK_EXCERPT') return null;
  const textAr = text(raw.textAr);
  if (!textAr) return null;
  const hadith = isRecord(raw.hadith) ? raw.hadith : {};
  const quran = isRecord(raw.quran) ? raw.quran : {};
  const tr = isRecord(raw.translation) ? raw.translation : {};
  const lc = typeof tr.languageCode === 'string' ? tr.languageCode.toLowerCase() : '';
  const ayah = quran.ayahNumber;
  const citation = isRecord(raw.citation) ? raw.citation : {};
  return {
    id: id.toLowerCase(),
    type,
    textAr,
    translationEn: lc === 'en' || lc.startsWith('en-') ? text(tr.text) : null,
    reference: text(hadith.reference),
    surahNameAr: text(quran.surahNameAr),
    surahName: text(quran.surahName),
    ayahNumber: typeof ayah === 'number' && Number.isInteger(ayah) && ayah > 0 ? ayah : null,
    isAthar: raw.isAthar === true,
    atharSpeakerAr: text(raw.atharSpeakerAr),
    paraphrase: (text(citation.gradeReference) ?? '').startsWith('رواه بمعناه'),
  };
}

export type Translate = (key: string, ...subs: string[]) => string;

export interface QuoteDisplay {
  /** The text, already wrapped in ﴿…﴾ (verse) or «…» (hadith, athar). */
  text: string;
  /** Reference line; for an athar it starts with the athar label. */
  source: string;
}

/** How a quote is shown, or `null` when it cannot be shown with its required label or reference. */
export function quoteDisplay(q: QuoteLite, lang: Lang, t: Translate): QuoteDisplay | null {
  const body = lang === 'en' && q.translationEn ? q.translationEn : q.textAr;
  if (q.isAthar) {
    const label = t('atharLabel');
    return { text: `«${body}»`, source: q.atharSpeakerAr ? `${label} — ${q.atharSpeakerAr}` : label };
  }
  if (q.type === 'QURAN_VERSE') {
    const surah = lang === 'en' ? (q.surahName ?? q.surahNameAr) : q.surahNameAr;
    if (!surah || q.ayahNumber === null) return null;
    return { text: `﴿${body}﴾`, source: `${surah}: ${q.ayahNumber}` };
  }
  if (q.type === 'HADITH') {
    if (!q.reference) return null;
    return { text: `«${body}»`, source: q.paraphrase ? `${t('paraphraseLabel')} — ${q.reference}` : q.reference };
  }
  return null;
}

/** The first evidence quote (catalog order) that can be shown whole within {@link MAX_QUOTE_CHARS}. */
export function pickQuote(
  evidenceIds: readonly string[],
  quotes: Readonly<Record<string, QuoteLite>>,
  lang: Lang,
  t: Translate,
  maxChars = MAX_QUOTE_CHARS,
): QuoteDisplay | null {
  for (const id of evidenceIds) {
    const q = quotes[id.toLowerCase()];
    if (!q) continue;
    const shown = quoteDisplay(q, lang, t);
    if (shown && shown.text.length - 2 <= maxChars) return shown;
  }
  return null;
}

export interface NotificationText {
  title: string;
  message: string;
}

/**
 * Title = the habit title; message = today's required amount, then the quote and its reference line when a
 * published quote is available. The reference (and the athar label) is in `message` itself, not in
 * `contextMessage`, because some platforms drop the context line.
 */
export function buildNotification(input: { title: string; amountText: string; quote: QuoteDisplay | null; t: Translate }): NotificationText {
  const lines = [input.t('notifRequired', input.amountText)];
  if (input.quote) lines.push(input.quote.text, input.quote.source);
  return { title: input.title, message: lines.join('\n') };
}
