import { englishProvenance } from '@/lib/format/provenance';

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
}): string | null {
  const authority = input.gradeAuthority?.trim() || null;
  const reference = input.gradeReference?.trim() || null;
  if (!authority && !reference) return null;

  if (authority && SAHIHAYN.test(authority)) {
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
    if (input.locale === 'ar') {
      const verb = input.grade === 'HASAN' ? 'حسّنه' : /الأرنؤوط|أرنؤوط/.test(authority) ? 'صحّحه' : 'حكمه';
      return `${reference}${GRADER_SEPARATOR}${verb} ${authority}`;
    }
    const book = formatEnglishBookRef(reference);
    const grader = englishProvenance(authority) ?? authority;
    const verb =
      input.grade === 'HASAN'
        ? 'graded hasan by'
        : /Arna'ut|أرنؤوط/.test(authority) || /Arna'ut/.test(grader)
          ? 'graded sahih by'
          : 'graded by';
    return `${book}${GRADER_SEPARATOR}${verb} ${grader}`;
  }

  const alone = reference ?? authority;
  if (!alone) return null;
  return input.locale === 'en' ? (englishProvenance(alone) ?? alone) : alone;
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
