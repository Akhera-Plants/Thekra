/**
 * «التفسير» / «الشرح»: which reading tabs a quote has and which explanation rows each tab shows. Ported rule for
 * rule from the website (frontend/src/features/study-panel/lib/tabs.ts and lib/quranic-spans.tsx); change a rule
 * there first, then here, so the site and the app pick the same rows.
 */

import { QuoteType } from '../types/enums';

export type StudyTabId = 'mukhtasar' | 'sadi' | 'ashur' | 'sharh' | 'fawaid' | 'gharib' | 'fath' | 'nawawi';

/** One row of `GET /v1/quotes/:id/explanations`. */
export interface ExplanationRow {
  id: string;
  kind: string;
  languageCode: string;
  text: string;
  reference: string | null;
  source: { name: string; nameAr: string | null };
}

/** A piece of explanation text; `quran` marks a quoted verse ({…} or ﴿…﴾), drawn in the Quran face. */
export interface ExplanationSegment {
  start: number;
  text: string;
  quran: boolean;
}

/** Texts longer than this open folded, with «اقرأ المزيد». */
export const LONG_PREVIEW_CHARS = 1200;

const ARABIC_LETTER = /[؀-ۿ]/;
const SPAN_RE = /(\{[^}]+\}|﴿[^﴾]+﴾)/g;

function sourceMatches(row: ExplanationRow, needles: RegExp): boolean {
  return needles.test(row.source.name) || needles.test(row.source.nameAr ?? '');
}

export function pickTabRows(rows: ExplanationRow[], tab: StudyTabId, locale: string): ExplanationRow[] {
  const langFilter = (row: ExplanationRow) =>
    locale === 'en' ? row.languageCode === 'en' : row.languageCode === 'ar' || row.languageCode === locale;

  const base = rows.filter(langFilter);

  switch (tab) {
    case 'mukhtasar':
      return base.filter((row) => row.kind === 'TAFSIR' && sourceMatches(row, /mukhtasar|مختصر/i));
    case 'sadi':
      return base.filter((row) => row.kind === 'TAFSIR' && sourceMatches(row, /sa'?di|سعدي/i));
    case 'ashur':
      return base.filter((row) => row.kind === 'TAFSIR' && sourceMatches(row, /tahrir|تحرير|عاشور|ashur/i));
    case 'sharh':
      return base.filter(
        (row) => row.kind === 'SHARH' && sourceMatches(row, /hadeethenc|موسوعة الأحاديث|hadith encyclopedia/i),
      );
    case 'fawaid':
      return base.filter((row) => row.kind === 'FAWAID');
    case 'gharib':
      return base.filter((row) => row.kind === 'GHARIB');
    case 'fath':
      return base.filter((row) => row.kind === 'SHARH_LONG' && sourceMatches(row, /fath|فتح الباري|hajar/i));
    case 'nawawi':
      return base.filter((row) => row.kind === 'SHARH_LONG' && sourceMatches(row, /nawawi|نووي|minhaj/i));
    default:
      return [];
  }
}

export function verseTabsForLocale(locale: string): StudyTabId[] {
  return locale === 'en' ? ['mukhtasar'] : ['mukhtasar', 'sadi', 'ashur'];
}

export function hadithTabsForLocale(locale: string): StudyTabId[] {
  return locale === 'en' ? ['sharh', 'fawaid', 'gharib'] : ['sharh', 'fawaid', 'gharib', 'fath', 'nawawi'];
}

/** The tabs this quote type can have: verses get tafsir, hadith get sharh, other texts none. */
export function studyTabsForQuote(type: QuoteType, locale: string): StudyTabId[] {
  if (type === QuoteType.QURAN_VERSE) return verseTabsForLocale(locale);
  if (type === QuoteType.HADITH) return hadithTabsForLocale(locale);
  return [];
}

/** Only the tabs that have rows, in the site's order. */
export function availableStudyTabs(rows: ExplanationRow[], type: QuoteType, locale: string): StudyTabId[] {
  return studyTabsForQuote(type, locale).filter((tab) => pickTabRows(rows, tab, locale).length > 0);
}

export function hasArabicLetters(text: string): boolean {
  return ARABIC_LETTER.test(text);
}

/** Arabic rows (and rows written in Arabic) read right to left, as on the site. */
export function isArabicRow(row: ExplanationRow): boolean {
  return row.languageCode === 'ar' || hasArabicLetters(row.text);
}

/** The line under a reading: the source name and the reference, without repeating a name the reference holds. */
export function studyCaption(row: ExplanationRow, arabic: boolean): string {
  const name = (arabic ? row.source.nameAr || row.source.name : row.source.name || row.source.nameAr)?.trim() ?? '';
  const reference = row.reference?.trim() ?? '';
  if (!reference) return name;
  if (!name || reference.includes(name)) return reference;
  return `${name} · ${reference}`;
}

/** Splits a text on its quoted verses ({…} and ﴿…﴾); the brackets themselves are dropped. */
export function explanationSegments(text: string): ExplanationSegment[] {
  const segments: ExplanationSegment[] = [];
  let start = 0;
  for (const part of text.split(SPAN_RE)) {
    if (part) {
      const quran = (part.startsWith('{') && part.endsWith('}')) || (part.startsWith('﴿') && part.endsWith('﴾'));
      segments.push({ start, text: quran ? part.slice(1, -1) : part, quran });
    }
    start += part.length;
  }
  return segments;
}

/** The text as shown while folded: cut at LONG_PREVIEW_CHARS with an ellipsis. */
export function foldedText(text: string): string {
  return text.length > LONG_PREVIEW_CHARS ? `${text.slice(0, LONG_PREVIEW_CHARS).trimEnd()}…` : text;
}

/** The card's «لماذا هذه الآية؟» shows at most this much of the tafsir or sharh. */
export const EXCERPT_MAX_CHARS = 350;
export const EXCERPT_MAX_SENTENCES = 3;

/** A sentence end (Latin or Arabic mark, closing quotes after it) followed by a space or the end of the text. */
const SENTENCE_END = /[.!?؟۔]+["'»”)\]]*(?=\s|$)/g;

/** True when the text opens a quoted verse ({ or ﴿) that it does not close. */
function insideVerse(text: string): boolean {
  const count = (char: string) => text.split(char).length - 1;
  return count('{') > count('}') || count('﴿') > count('﴾');
}

/**
 * A short excerpt for the card: whole sentences, at most EXCERPT_MAX_SENTENCES and EXCERPT_MAX_CHARS. When even the
 * first sentence is longer, it is cut at a word with an ellipsis. Never cuts inside a quoted verse.
 */
export function studyExcerpt(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  let cut = 0;
  let sentences = 0;
  for (const match of clean.matchAll(SENTENCE_END)) {
    const end = (match.index ?? 0) + match[0].length;
    if (end > EXCERPT_MAX_CHARS) break;
    if (insideVerse(clean.slice(0, end))) continue;
    cut = end;
    sentences += 1;
    if (sentences === EXCERPT_MAX_SENTENCES) break;
  }
  if (clean.length <= EXCERPT_MAX_CHARS && (sentences < EXCERPT_MAX_SENTENCES || cut === clean.length)) return clean;
  if (cut > 0) return clean.slice(0, cut);

  let head = clean.slice(0, EXCERPT_MAX_CHARS);
  const space = head.lastIndexOf(' ');
  if (space > 0) head = head.slice(0, space);
  if (insideVerse(head)) {
    const open = Math.max(head.lastIndexOf('{'), head.lastIndexOf('﴿'));
    if (open > 0) head = head.slice(0, open);
  }
  return `${head.trimEnd()}…`;
}
