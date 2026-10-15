import { HadithGrade } from '@prisma/client';

/** Printed Arabic name. The edition file's Latin labels never reach a public field. */
export const ARNAUT_NAME = 'شعيب الأرنؤوط';

/**
 * Owner decision: Shu'ayb al-Arna'ut is the only Sunan grader used for publish.
 * Bashar Awad Ma'ruf is not used — the Tirmidhi file's Bashar field often repeats
 * Tirmidhi's own verdict.
 */
export const SUNAN_SCHOLAR_NAMES = {
  'Shuaib Al Arnaut': ARNAUT_NAME,
} as const;

export type SunanScholarKey = keyof typeof SUNAN_SCHOLAR_NAMES;

export const SUNAN_BOOK_TITLES = {
  abudawud: 'سنن أبي داود',
  ibnmajah: 'سنن ابن ماجه',
  tirmidhi: 'سنن الترمذي',
} as const;

export type SunanBookKey = keyof typeof SUNAN_BOOK_TITLES;

/**
 * Grades Arna'ut uses for a prophetic narration that is sahih or hasan.
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

const SCHOLAR_ORDER: readonly SunanScholarKey[] = ['Shuaib Al Arnaut'];
const BOOK_ORDER: readonly SunanBookKey[] = ['abudawud', 'ibnmajah', 'tirmidhi'];

export const OUTSIDE_SAHIHAYN_NOTE = 'ليس من الصحيحين';

/** Strip tashkeel and shadda so OCR variants still match. */
export function stripArabicMarks(text: string): string {
  return text.replace(/[\u064B-\u065F\u0670]/g, '');
}

/**
 * The author already placed the narration in Bukhari, Muslim, or both.
 * Covers «وفى / وفي / في» + optional quotes around «الصحيحين», and
 * خرجه / خرّجاه / أخرجه for each Sahih.
 */
const SAHIHAYN_CITATION = new RegExp([
  'متفق عليه',
  'رواه البخاري',
  'رواه مسلم',
  'في الصحيحين',
  'أخرجاه',
  'وفى\\s*[«"\'"]?\\s*الصحيحين',
  'وفي\\s*[«"\'"]?\\s*الصحيحين',
  'في\\s*[«"\'"]?\\s*الصحيحين',
  'خر[ّ]?جه\\s+البخاري',
  'خر[ّ]?جه\\s+مسلم',
  'خر[ّ]?جاه',
  'خرجهما',
  'أخرجه\\s+البخاري',
  'أخرجه\\s+مسلم',
  'أخرجهما',
].join('|'));

export function citesSahihayn(text: string): boolean {
  return SAHIHAYN_CITATION.test(stripArabicMarks(text));
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
 * is the stronger accepted one, and the citation names only Arna'ut and the
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
