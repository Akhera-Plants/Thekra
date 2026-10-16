import { englishProvenance } from '@/lib/format/provenance';

const SAHIHAYN = /^(?:رواه البخاري|رواه مسلم|متفق عليه)$/;

/**
 * Book + number first, grader second. Sahihayn keep their short form.
 * SUNAN_TAHQIQ: «Sunan Abi Dawud 5186 — graded sahih by Shu'ayb al-Arna'ut»
 * / «سنن أبي داود، رقم 5186 — صحّحه شعيب الأرنؤوط».
 */
export function formatGradeCitation(input: {
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

  if (authority && reference) {
    if (input.locale === 'ar') {
      const verb = input.grade === 'HASAN' ? 'حسّنه' : /الأرنؤوط|أرنؤوط/.test(authority) ? 'صحّحه' : 'حكمه';
      return `${reference} — ${verb} ${authority}`;
    }
    const book = formatEnglishBookRef(reference);
    const grader = englishProvenance(authority) ?? authority;
    const verb =
      input.grade === 'HASAN'
        ? 'graded hasan by'
        : /Arna'ut|أرنؤوط/.test(authority) || /Arna'ut/.test(grader)
          ? 'graded sahih by'
          : 'graded by';
    return `${book} — ${verb} ${grader}`;
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
