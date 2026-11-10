import { englishProvenance } from '@/lib/format/provenance';
import { formatDigits } from '@/lib/format/digits';

const SAHIHAYN = /^(?:رواه البخاري|رواه مسلم|متفق عليه)$/;
/** Book reference, then who graded it. */
const GRADER_SEPARATOR = ' · ';

/**
 * Book + number first, grader second. Sahihayn keep their short form.
 * SUNAN_TAHQIQ: «Sunan Abi Dawud 5186 · graded sahih by Shu'ayb al-Arna'ut»
 * / «سنن أبي داود، رقم 5186 · صحّحه شعيب الأرنؤوط». The grader is never the book.
 */
export function formatGradeCitation(input: {
  locale: 'ar' | 'en';
  gradeAuthority: string | null | undefined;
  gradeReference: string | null | undefined;
  grade?: string | null;
  /**
   * The source badge shown beside the grade (the raw `hadith.reference`, «صحيح البخاري، رقم 2595»). The source appears
   * once (owner round 7, B4): a book and number the badge already names is left out of the line — «رواه البخاري، رقم
   * 2595» goes, «سنن أبي داود، رقم 5186 · صحّحه شعيب الأرنؤوط» keeps only «صحّحه شعيب الأرنؤوط».
   */
  besideSource?: string | null;
}): string | null {
  const line = composeGradeCitation(input);
  return input.locale === 'en' ? englishPartsOnly(line) : line;
}

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/**
 * English UI shows English only: a part of the line («A — B», «A · B») that is still Arabic
 * after translation (an untranslated edition note, say) is dropped, never shown as is.
 */
function englishPartsOnly(line: string | null): string | null {
  if (!line || !ARABIC_SCRIPT.test(line)) return line;
  const kept = line
    .split(GRADER_SEPARATOR)
    .map((group) =>
      group
        .split(/\s+[—–]\s+/)
        .filter((part) => part.trim() && !ARABIC_SCRIPT.test(part))
        .join(' — '),
    )
    .filter(Boolean);
  return kept.length > 0 ? kept.join(GRADER_SEPARATOR) : null;
}

function composeGradeCitation(input: {
  locale: 'ar' | 'en';
  gradeAuthority: string | null | undefined;
  gradeReference: string | null | undefined;
  grade?: string | null;
  besideSource?: string | null;
}): string | null {
  const authority = input.gradeAuthority?.trim() || null;
  const reference = input.gradeReference?.trim() || null;
  if (!authority && !reference) return null;

  const badge = input.besideSource?.trim() || null;

  if (authority && SAHIHAYN.test(authority)) {
    if (authority !== 'متفق عليه' && repeatsSource(reference ?? authority, badge)) return null;
    const line =
      authority === 'متفق عليه'
        ? [authority, reference].filter(Boolean).join('، ')
        : reference?.match(/\d+/)?.[0]
          ? `${authority}، رقم ${reference.match(/\d+/)?.[0]}`
          : authority;
    return input.locale === 'en' ? (englishProvenance(line) ?? line) : line;
  }

  if (authority && /موسوعة الأحاديث النبوية|HadeethEnc|Hadeeth Encyclopedia/i.test(authority)) {
    const gradeWord =
      input.grade === 'HASAN'
        ? input.locale === 'ar'
          ? 'حسن'
          : 'Good'
        : input.locale === 'ar'
          ? 'صحيح'
          : 'Authentic';
    if (input.locale === 'ar') {
      return reference
        ? `حكم موسوعة الأحاديث النبوية: ${gradeWord} — ${reference}`
        : `حكم موسوعة الأحاديث النبوية: ${gradeWord}`;
    }
    return reference
      ? `Hadeeth Encyclopedia ruling: ${gradeWord} — ${reference}`
      : `Hadeeth Encyclopedia ruling: ${gradeWord}`;
  }

  if (authority && reference) {
    const bookShown = repeatsSource(reference, badge);
    if (input.locale === 'ar') {
      const verb = input.grade === 'HASAN' ? 'حسّنه' : /الأرنؤوط|أرنؤوط/.test(authority) ? 'صحّحه' : 'حكمه';
      return bookShown ? `${verb} ${authority}` : `${reference}${GRADER_SEPARATOR}${verb} ${authority}`;
    }
    const book = formatEnglishBookRef(reference);
    const grader = englishProvenance(authority) ?? authority;
    const verb =
      input.grade === 'HASAN'
        ? 'graded hasan by'
        : /Arna'ut|أرنؤوط/.test(authority) || /Arna'ut/.test(grader)
          ? 'graded sahih by'
          : 'graded by';
    if (bookShown) return `${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${grader}`;
    return `${book}${GRADER_SEPARATOR}${verb} ${grader}`;
  }

  const alone = reference ?? authority;
  if (!alone || repeatsSource(alone, badge)) return null;
  return input.locale === 'en' ? (englishProvenance(alone) ?? alone) : alone;
}

/** Letters only: no harakat, one alif, ة→ه, ى→ي — so «أبي داود» and «ابي داود» compare equal. */
function foldArabic(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Does `part` («رواه البخاري 2595», «البخاري 2595», «سنن ابن ماجه، رقم 4229») name the same book and number as the
 * source badge («صحيح البخاري، رقم 2595»)? Every number of the part is in the badge, and its book words are in it.
 */
export function repeatsSource(part: string | null | undefined, badge: string | null | undefined): boolean {
  if (!part?.trim() || !badge?.trim()) return false;
  const numbers = (value: string): string[] => formatDigits(value).match(/\d+/g) ?? [];
  const partNumbers: string[] = numbers(part);
  const badgeNumbers: string[] = numbers(badge);
  if (partNumbers.length === 0 || !partNumbers.every((n) => badgeNumbers.includes(n))) return false;
  const core = foldArabic(formatDigits(part))
    .replace(/\d+/g, ' ')
    .replace(/(^|\s)(?:رواه|رقم)(?=\s|$)/g, ' ')
    .replace(/[،,:؛()\-–—.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return core.length > 0 && foldArabic(formatDigits(badge)).replace(/[،,:؛()\-–—.]/g, ' ').replace(/\s+/g, ' ').includes(core);
}

/** «سنن أبي داود، رقم 5186» → «Sunan Abi Dawud 5186» */
function formatEnglishBookRef(reference: string): string {
  const translated = englishProvenance(reference) ?? reference;
  return translated
    .replace(/,\s*no\.\s*/gi, ' ')
    .replace(/\s+no\.\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
