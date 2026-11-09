/**
 * Share text for one quote, as the QuoteCard shows it: the displayed text, the attribution lines, the
 * «أثر، وليس حديثًا» line for an athar, and the public page link. Mirrors the web's
 * frontend/src/lib/share/share-text.ts rules (roadmap §6, PROJECT_GUIDE §3):
 * - the text is never shortened and never machine-translated (a translation is shared only when the card
 *   shows the sourced one);
 * - an athar is never shared without its label;
 * - Western digits in attribution lines;
 * - nothing about the user (plans, progress, sin program) is ever part of a share.
 *
 * Link: the web's canonical quote page is `/quotes/<id>` (frontend/src/app/[locale]/quotes/[id], the path the
 * web ShareButton uses); `/hadith/<id>` exists only for HADITH rows (a study page that 404s for verses).
 * Arabic is unprefixed, English is under `/en`.
 */

import type { QuoteDto } from '../types/api';
import { HadithGrade, QuoteType } from '../types/enums';
import { SITE_URL } from '../site';

export type ShareLocale = 'ar' | 'en';

export interface QuoteShareLabels {
  /** «أثر، وليس حديثًا» / its English wording. */
  atharNotice: string;
  /** The closing line before the link (round 6, C-08): «بواسطة تطبيق ذكرى» / "via the Thekra app". */
  sharedVia?: string;
  /** «رواه {{speaker}}» */
  atharNarrated: (speaker: string) => string;
  /** Grade words keyed by HadithGrade (SAHIH, HASAN, …). */
  grade: Partial<Record<string, string>>;
}

const SEPARATOR = ' · ';

export function toWesternDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

export function quotePageUrl(id: string, locale: ShareLocale): string {
  const path = `/quotes/${encodeURIComponent(id)}`;
  return locale === 'en' ? `${SITE_URL}/en${path}` : `${SITE_URL}${path}`;
}

/** The provenance line the card shows (surah:ayah, hadith reference or book title). */
export function quoteProvenance(quote: QuoteDto): string | null {
  if (quote.type === QuoteType.QURAN_VERSE && quote.quran) {
    const { surahNameAr, surahNumber, ayahNumber } = quote.quran;
    if (surahNameAr && surahNumber && ayahNumber) return `${surahNameAr} (${surahNumber}:${ayahNumber})`;
    return null;
  }
  if (quote.type === QuoteType.HADITH) return quote.hadith?.reference?.trim() || null;
  if (quote.type === QuoteType.BOOK_EXCERPT) return quote.book?.bookTitle?.trim() || null;
  return null;
}

/** The athar speaker line («— X» or «رواه X»), or null. */
export function atharSpeakerLine(quote: QuoteDto, labels: Pick<QuoteShareLabels, 'atharNarrated'>): string | null {
  const speaker = quote.isAthar ? quote.atharSpeakerAr?.trim() : null;
  if (!speaker) return null;
  return quote.atharAttributionKind === 'NARRATED' ? labels.atharNarrated(speaker) : `— ${speaker}`;
}

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/**
 * The grade line the web QuoteCard shows from `citation` (frontend/src/lib/format/grade-citation.ts), for
 * rows that carry a `gradeReference`: «<gradeReference> · حكمه <gradeAuthority>» («حسّنه» for a hasan grade).
 * This is how a hadith retold by the lecturer is marked («رواه بمعناه…» / «أورده بلفظه…»), so it is never
 * shown as the Prophet's ﷺ exact wording without that line (PROJECT_GUIDE §3.12).
 * English UI: parts that are Arabic-only text are dropped; when nothing English is left, no line.
 * An athar never gets a grade line (rule 4).
 */
export function gradeCitationLine(quote: QuoteDto, locale: ShareLocale): string | null {
  if (quote.isAthar) return null;
  const reference = quote.citation?.gradeReference?.trim() || null;
  if (!reference) return null;
  const authority = quote.citation?.gradeAuthority?.trim() || null;
  const verb = quote.hadith?.grade === HadithGrade.HASAN ? 'حسّنه' : 'حكمه';
  const line = authority ? `${reference}${SEPARATOR}${verb} ${authority}` : reference;
  if (locale === 'ar') return toWesternDigits(line);
  if (!ARABIC_SCRIPT.test(line)) return line;
  const kept = [reference, authority].filter((part): part is string => Boolean(part) && !ARABIC_SCRIPT.test(part!));
  return kept.length > 0 ? kept.join(SEPARATOR) : null;
}

export function quoteAttribution(quote: QuoteDto, labels: QuoteShareLabels, locale: ShareLocale = 'ar'): string[] {
  const lines: string[] = [];
  const source = (quote.source.nameAr ?? quote.source.name)?.trim() || null;
  const provenance = quoteProvenance(quote);
  const grade =
    quote.type === QuoteType.HADITH && !quote.isAthar && quote.hadith?.grade && quote.hadith.grade !== HadithGrade.UNGRADED
      ? labels.grade[quote.hadith.grade] ?? null
      : null;
  const main = [source, provenance && provenance !== source ? provenance : null, grade].filter(Boolean).join(SEPARATOR);
  if (main) lines.push(main);
  const gradeLine = gradeCitationLine(quote, locale);
  if (gradeLine) lines.push(gradeLine);
  const speaker = atharSpeakerLine(quote, labels);
  if (speaker) lines.push(speaker);
  if (quote.isAthar) lines.push(labels.atharNotice);
  return lines.map(toWesternDigits);
}

/**
 * One paragraph of running text (round 6, C-08: «معمولله راب»): the line breaks and runs of spaces a stored text may
 * carry (verse ends, OCR columns) become single spaces, so the messaging app wraps it naturally. Letters, marks and
 * punctuation are untouched.
 */
export function flowingText(text: string): string {
  return text.replace(/\s*\n+\s*/g, ' ').replace(/[ \t\u00a0]{2,}/g, ' ').trim();
}

/** The text between its own marks: ﴿…﴾ for a verse, «…» for the rest, unless the stored text already has them. */
function quoted(quote: QuoteDto): string {
  const text = flowingText(quote.textAr);
  if (quote.type === QuoteType.QURAN_VERSE) return /^﴿[\s\S]*﴾$/.test(text) ? text : `﴿${text}﴾`;
  return /^[«"“][\s\S]*[»"”]$/.test(text) ? text : `«${text}»`;
}

/**
 * The shared text (round 6, C-08): the text as one flowing paragraph in its marks, the translation when the card shows
 * the sourced one, the attribution lines, then «بواسطة تطبيق ذكرى» and the link on the line under it. Nothing else.
 */
export function quoteShareText(
  quote: QuoteDto,
  options: { locale: ShareLocale; showTranslation: boolean; labels: QuoteShareLabels },
): string {
  const parts = [quoted(quote)];
  const translation = options.showTranslation ? quote.translation?.text?.trim() : null;
  if (translation) parts.push(flowingText(translation));
  const attribution = quoteAttribution(quote, options.labels, options.locale);
  if (attribution.length > 0) parts.push(attribution.join('\n'));
  const link = quotePageUrl(quote.id, options.locale);
  parts.push(options.labels.sharedVia ? `${options.labels.sharedVia}\n${link}` : link);
  return parts.join('\n\n');
}
