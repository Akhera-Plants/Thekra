/**
 * What a share sends for one public text (verse, hadith, athar): the text exactly as the page
 * shows it, the attribution lines exactly as the quote card shows them, and the canonical URL.
 *
 * Content rules (docs/guide/PROJECT_GUIDE.md §3):
 * - no machine translation: English is shared only when the card shows a sourced translation,
 *   otherwise the Arabic text is shared as is;
 * - an athar always carries its «أثر، وليس حديثًا» line (English UI: its English label);
 * - Western digits in every attribution line.
 *
 * Pure: no DOM, no React. The UI passes localized labels in.
 */

import { formatDigits } from '@/lib/format/digits';
import { formatGradeCitation } from '@/lib/format/grade-citation';
import { englishProvenance } from '@/lib/format/provenance';
import type { QuoteDto } from '@/lib/types/api';
import { HadithGrade, QuoteType } from '@/lib/types/enums';

export type ShareLocale = 'ar' | 'en';

/** Which face the image draws the body in (matches QuoteBody: Quran face for verses). */
export type ShareBodyFace = 'quran' | 'arabic' | 'english';

export type ShareTypeKey = 'quran' | 'hadith' | 'athar' | 'scholar' | 'book';

export interface ShareLabels {
  /** `app.name` */
  siteName: string;
  /** `quote.narrator` */
  narrator: string;
  /** `quote.type.*` */
  type: Record<ShareTypeKey, string>;
  /** `quote.grade.*` (lower-case grade keys) */
  grade: Record<'sahih' | 'hasan' | 'daif' | 'mawdu', string>;
  /** `quote.weakNotice` */
  weakNotice: string;
  /** `quote.outsideSahihayn` */
  outsideSahihayn: string;
  /** «أثر، وليس حديثًا» / «A saying, not a hadith» — the card's own wording. */
  atharNotice: string;
  /** «رواه X» / «Narrated by X» */
  atharNarrated: (speaker: string) => string;
}

export interface SharePayload {
  /** Title for the native share sheet (the site name). */
  title: string;
  /** Type label shown at the top of the image («حديث نبوي», «أثر», …). */
  heading: string;
  /** The text exactly as displayed. Never shortened. */
  body: string;
  bodyLang: ShareLocale;
  bodyFace: ShareBodyFace;
  /** Attribution lines as the card shows them, Western digits. */
  attribution: string[];
  isAthar: boolean;
}

export interface QuoteShareOptions {
  locale: ShareLocale;
  labels: ShareLabels;
  /**
   * A surface that shows the text or its attribution differently from the quote card (the home
   * featured reminder) passes what it shows. The athar line is still enforced.
   */
  display?: {
    body: string;
    bodyLang: ShareLocale;
    attribution: string[];
  };
}

const ARABIC_SCRIPT = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;
const SEPARATOR = ' · ';

/** Mirrors QuoteCard's `visibleArabic`: the Arabic UI hides a value that carries Latin letters. */
function visible(value: string | null | undefined, arabic: boolean): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (arabic && LATIN.test(trimmed)) return null;
  return trimmed;
}

function typeKeyOf(quote: QuoteDto): ShareTypeKey {
  if (quote.isAthar) return 'athar';
  switch (quote.type) {
    case QuoteType.QURAN_VERSE:
      return 'quran';
    case QuoteType.HADITH:
      return 'hadith';
    case QuoteType.SCHOLAR_QUOTE:
      return 'scholar';
    default:
      return 'book';
  }
}

/** The body QuoteBody shows: a sourced English translation on /en for scripture, else the Arabic. */
export function displayedBody(
  quote: Pick<QuoteDto, 'type' | 'textAr' | 'translation'>,
  locale: ShareLocale,
): { body: string; bodyLang: ShareLocale } {
  const scripture = quote.type === QuoteType.HADITH || quote.type === QuoteType.QURAN_VERSE;
  const english = locale === 'en' && scripture ? quote.translation?.text?.trim() : null;
  if (english) return { body: english, bodyLang: 'en' };
  return { body: quote.textAr.trim(), bodyLang: 'ar' };
}

/** The athar line exactly as QuoteCard writes it. */
function atharLine(labels: ShareLabels, hadithRef: string | null): string {
  return `${labels.atharNotice}${hadithRef ? `${SEPARATOR}${hadithRef}` : ''}`;
}

/** Attribution lines in the order QuoteCard shows them. */
export function quoteCardAttribution(
  quote: QuoteDto,
  locale: ShareLocale,
  labels: ShareLabels,
): string[] {
  const arabic = locale === 'ar';
  const isAthar = Boolean(quote.isAthar);
  const isQuran = quote.type === QuoteType.QURAN_VERSE;
  const isHadith = quote.type === QuoteType.HADITH;
  const lines: string[] = [];

  const sourceName = arabic
    ? quote.source?.nameAr
    : (quote.source?.name || quote.source?.nameAr);
  const quietSource = visible(sourceName, arabic);
  const hadithRefRaw = quote.hadith?.reference?.trim() || null;
  const hadithRef =
    hadithRefRaw && !(arabic && LATIN.test(hadithRefRaw))
      ? (arabic ? hadithRefRaw : (englishProvenance(hadithRefRaw) ?? hadithRefRaw))
      : null;

  if (isQuran && quote.quran) {
    const surahName = arabic
      ? quote.quran.surahNameAr
      : (quote.quran.surahName || quote.quran.surahNameAr);
    const { surahNumber, ayahNumber } = quote.quran;
    const verseRef = surahNumber && ayahNumber ? `${surahNumber}:${ayahNumber}` : null;
    const capsule = [surahName?.trim() || null, verseRef].filter(Boolean).join(' ');
    const line = [capsule || null, quietSource].filter(Boolean).join(SEPARATOR);
    if (line) lines.push(line);
  }

  if (isHadith) {
    const refAlreadyNamesSource = Boolean(quietSource && hadithRef && hadithRef.includes(quietSource));
    const grade = quote.hadith?.grade;
    const gradeLabel =
      grade && grade !== HadithGrade.UNGRADED && !isAthar
        ? labels.grade[grade.toLowerCase() as keyof ShareLabels['grade']]
        : null;
    const capsule = [
      quietSource && !refAlreadyNamesSource ? quietSource : null,
      hadithRef,
      gradeLabel,
    ].filter(Boolean);
    if (capsule.length > 0) lines.push(capsule.join(SEPARATOR));

    const narratorRaw = arabic
      ? quote.hadith?.narratorAr
      : (quote.hadith?.narrator || quote.hadith?.narratorAr);
    const narrator = narratorRaw?.trim()
      ? (arabic ? narratorRaw.trim() : (englishProvenance(narratorRaw) ?? narratorRaw.trim()))
      : null;
    if (narrator) lines.push(`${labels.narrator}: ${narrator}`);

    if (!isAthar) {
      const gradeLine = formatGradeCitation({
        locale,
        gradeAuthority: quote.citation?.gradeAuthority,
        gradeReference: quote.citation?.gradeReference,
        grade: quote.hadith?.grade,
      });
      if (gradeLine) lines.push(gradeLine);
    }

    const alsoIn = quote.citation?.alsoIn?.trim();
    if (alsoIn) lines.push(alsoIn);

    if (isAthar && quote.atharSpeakerAr?.trim()) {
      const speaker = quote.atharSpeakerAr.trim();
      lines.push(
        quote.atharAttributionKind === 'NARRATED' ? labels.atharNarrated(speaker) : `— ${speaker}`,
      );
    }
    if (isAthar) lines.push(atharLine(labels, hadithRef));

    if (grade === HadithGrade.DAIF || grade === HadithGrade.MAWDU) lines.push(labels.weakNotice);
    if (quote.hadith?.outsideSahihayn) lines.push(labels.outsideSahihayn);
  }

  if (!isQuran && !isHadith) {
    const fallback = quietSource ?? visible(quote.book?.bookTitle, arabic);
    if (fallback) lines.push(fallback);
  }

  // An athar is never shared without its label, whatever its stored type.
  if (isAthar && !lines.some((line) => line.includes(labels.atharNotice))) {
    lines.push(atharLine(labels, hadithRef));
  }

  return lines.map((line) => formatDigits(line));
}

/** Everything a share needs for one quote, in the page language. */
export function quoteSharePayload(quote: QuoteDto, options: QuoteShareOptions): SharePayload {
  const { locale, labels, display } = options;
  const isAthar = Boolean(quote.isAthar);
  const { body, bodyLang } = display
    ? { body: display.body.trim(), bodyLang: display.bodyLang }
    : displayedBody(quote, locale);
  let attribution = display
    ? display.attribution.map((line) => formatDigits(line.trim())).filter(Boolean)
    : quoteCardAttribution(quote, locale, labels);
  if (isAthar && !attribution.some((line) => line.includes(labels.atharNotice))) {
    attribution = [...attribution, labels.atharNotice];
  }
  const bodyFace: ShareBodyFace =
    bodyLang === 'en'
      ? 'english'
      : quote.type === QuoteType.QURAN_VERSE
        ? 'quran'
        : 'arabic';
  return {
    title: labels.siteName,
    heading: labels.type[typeKeyOf(quote)],
    body,
    bodyLang,
    bodyFace,
    attribution,
    isAthar,
  };
}

/**
 * The shared text: body, a blank line, the attribution lines, and (for targets that take one
 * string, such as WhatsApp or the clipboard) a blank line and the URL.
 */
export function shareText(payload: SharePayload, url?: string): string {
  const parts = [payload.body];
  if (payload.attribution.length > 0) parts.push(payload.attribution.join('\n'));
  if (url) parts.push(url);
  return parts.join('\n\n');
}

export interface ShareIntents {
  whatsapp: string;
  telegram: string;
  x: string;
  facebook: string;
}

/** Plain intent URLs; no SDKs. Targets with their own URL field get the text without it. */
export function shareIntents(payload: SharePayload, url: string): ShareIntents {
  const enc = encodeURIComponent;
  const text = shareText(payload);
  return {
    whatsapp: `https://wa.me/?text=${enc(shareText(payload, url))}`,
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
    x: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  };
}

/** True when a line is written in Arabic script (used to pick a line's direction). */
export function isArabicLine(line: string): boolean {
  return ARABIC_SCRIPT.test(line) && !LATIN.test(line);
}
