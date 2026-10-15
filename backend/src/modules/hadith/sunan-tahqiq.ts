import { HadithGrade } from '@prisma/client';

/** Printed Arabic names. The edition file's Latin labels never reach a public field. */
export const ARNAUT_NAME = 'شعيب الأرنؤوط';
export const BASHAR_NAME = 'بشار عواد معروف';

export const SUNAN_SCHOLAR_NAMES = {
  'Shuaib Al Arnaut': ARNAUT_NAME,
  'Bashar Awad Maarouf': BASHAR_NAME,
} as const;

export type SunanScholarKey = keyof typeof SUNAN_SCHOLAR_NAMES;

export const SUNAN_BOOK_TITLES = {
  abudawud: 'سنن أبي داود',
  ibnmajah: 'سنن ابن ماجه',
  tirmidhi: 'سنن الترمذي',
} as const;

export type SunanBookKey = keyof typeof SUNAN_BOOK_TITLES;

/**
 * Grades these two scholars use for a prophetic narration that is sahih or hasan.
 * «Sahih Muquf» and «Hasan Maqtu» contain those words and are refused: they are
 * not a prophetic grade. Weak, fabricated, and isnad-only labels are refused too.
 */
const APPROPRIATE: Record<string, HadithGrade> = {
  sahih: HadithGrade.SAHIH,
  'sahih lighairihi': HadithGrade.SAHIH,
  hasan: HadithGrade.HASAN,
  'hasan sahih': HadithGrade.HASAN,
  'hasan lighairihi': HadithGrade.HASAN,
};

const SCHOLAR_ORDER: readonly SunanScholarKey[] = ['Shuaib Al Arnaut', 'Bashar Awad Maarouf'];
const BOOK_ORDER: readonly SunanBookKey[] = ['abudawud', 'ibnmajah', 'tirmidhi'];

export const OUTSIDE_SAHIHAYN_NOTE = 'ليس من الصحيحين';

/** The author already placed the narration in Bukhari, Muslim, or both. */
const SAHIHAYN_CITATION = /متفق عليه|رواه البخاري|رواه مسلم|في الصحيحين|أخرجاه/;

export function citesSahihayn(text: string): boolean {
  return SAHIHAYN_CITATION.test(text);
}

export function foldGradeLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Sahih or hasan. Anything else, including an unrecognised label, is not publishable. */
export function appropriateGrade(raw: string): HadithGrade | null {
  return APPROPRIATE[foldGradeLabel(raw)] ?? null;
}

export interface SunanHit {
  scholar: SunanScholarKey;
  book: SunanBookKey;
  number: number;
  rawGrade: string;
}

export interface SunanRuling {
  grade: HadithGrade;
  gradeAuthority: string;
  gradeReference: string;
  scholars: string[];
  references: string[];
  rawGrades: string[];
}

/**
 * Close narrations often differ by a few words and carry different grades.
 * A da'if or mawquf hit does not cancel a sahih or hasan hit. The stored grade
 * is the stronger accepted one, and the citation names only the scholars and
 * books that gave that grade.
 */
export function decideSunanRuling(hits: readonly SunanHit[]): SunanRuling | null {
  const accepted = hits.flatMap((hit) => {
    const grade = appropriateGrade(hit.rawGrade);
    return grade ? [{ hit, grade }] : [];
  });
  if (accepted.length === 0) return null;
  const grade = accepted.some((row) => row.grade === HadithGrade.SAHIH)
    ? HadithGrade.SAHIH
    : HadithGrade.HASAN;
  const chosen = accepted.filter((row) => row.grade === grade).map((row) => row.hit);
  const scholars = SCHOLAR_ORDER
    .filter((key) => chosen.some((hit) => hit.scholar === key))
    .map((key) => SUNAN_SCHOLAR_NAMES[key]);
  const references = BOOK_ORDER.flatMap((book) => {
    const numbers = [...new Set(chosen.filter((hit) => hit.book === book).map((hit) => hit.number))].sort((a, b) => a - b);
    return numbers.map((number) => `${SUNAN_BOOK_TITLES[book]}، رقم ${number}`);
  });
  const rawGrades = [...new Set(chosen.map((hit) => hit.rawGrade))].sort();
  return {
    grade,
    gradeAuthority: scholars.join('، و'),
    gradeReference: references.join('، '),
    scholars,
    references,
    rawGrades,
  };
}
