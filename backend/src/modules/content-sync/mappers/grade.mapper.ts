/**
 * grade.mapper.ts
 *
 * Single pure function that normalises provider-supplied grade strings into the
 * `HadithGrade` enum.  This is the one place where the app could
 * misrepresent authenticity — see content-pipeline-plan §2.6.
 *
 * Rules:
 *   - Case-insensitive, diacritic-insensitive substring match.
 *   - When multiple grades are passed, take the **weakest** (most conservative).
 *   - Every unrecognised string is logged externally as `unmappedGrades` and
 *     maps to UNGRADED here (the caller handles the warning).
 *
 * Ordering (weakest → strongest): MAWDU < DAIF < UNGRADED < HASAN < SAHIH
 * When there is a disagreement, the weaker grade wins.
 */

import { HadithGrade } from '@prisma/client';

// ─── Normalisation helpers ────────────────────────────────────────────────────

/** Strip Arabic diacritics (tashkeel) for comparison. */
function stripDiacritics(s: string): string {
  return s
    .replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

// Numeric weight per grade: higher = weaker (more conservative / less authentic).
const GRADE_WEIGHT: Record<HadithGrade, number> = {
  [HadithGrade.SAHIH]: 1,
  [HadithGrade.HASAN]: 2,
  [HadithGrade.UNGRADED]: 3,
  [HadithGrade.DAIF]: 4,
  [HadithGrade.MAWDU]: 5,
};

// ─── Matching tables (each entry: [normalised-needle, grade]) ─────────────────

// Sort by normalised needle length descending so longer (more specific) patterns
// are checked before shorter ones. For example: 'hasan sahih' must match before
// 'sahih' catches it; 'حسن صحيح' must match before 'صحيح' does.
const GRADE_TABLE: [string, HadithGrade][] = ([
  // SAHIH
  ['sahih li ghairih', HadithGrade.SAHIH],
  ['sahih lighayrih', HadithGrade.SAHIH],
  ['muttafaqun alayh', HadithGrade.SAHIH],
  ['متفق عليه', HadithGrade.SAHIH],
  ['صحيح لغيره', HadithGrade.SAHIH],
  ['authentic', HadithGrade.SAHIH],
  ['sahih', HadithGrade.SAHIH],
  ['صحيح', HadithGrade.SAHIH],

  // HASAN — must come before 'sahih'/'صحيح' because 'hasan sahih'/'حسن صحيح' contain them
  ['hasan sahih', HadithGrade.HASAN],
  ['حسن صحيح', HadithGrade.HASAN],
  ['hasan li ghairih', HadithGrade.HASAN],
  ['حسن لغيره', HadithGrade.HASAN],
  ['good', HadithGrade.HASAN],
  ['hasan', HadithGrade.HASAN],
  ['حسن', HadithGrade.HASAN],

  // DAIF
  ["da'if", HadithGrade.DAIF],
  ['daif', HadithGrade.DAIF],
  ['dhaeef', HadithGrade.DAIF],
  ['ضعيف', HadithGrade.DAIF],
  ['munkar', HadithGrade.DAIF],
  ['منكر', HadithGrade.DAIF],
  ['shadh', HadithGrade.DAIF],
  ['شاذ', HadithGrade.DAIF],
  ['weak', HadithGrade.DAIF],

  // MAWDU
  ['mawdu', HadithGrade.MAWDU],
  ['موضوع', HadithGrade.MAWDU],
  ['fabricated', HadithGrade.MAWDU],
  ['batil', HadithGrade.MAWDU],
  ['باطل', HadithGrade.MAWDU],
  ['la asla lahu', HadithGrade.MAWDU],
  ['لا اصل له', HadithGrade.MAWDU], // normalised form of لا أصل له
] as [string, HadithGrade][]).sort(
  (a, b) => stripDiacritics(b[0]).length - stripDiacritics(a[0]).length,
);

/**
 * Map a raw grade string to `HadithGrade`.
 * Returns `UNGRADED` for null/empty/unrecognised input.
 * Returns `true` as the second element if the string was unrecognised (so the
 * caller can log it as an `unmappedGrade`).
 */
export function normalizeGrade(
  raw: string | null | undefined,
): { grade: HadithGrade; unmapped: boolean } {
  if (!raw || raw.trim() === '') {
    return { grade: HadithGrade.UNGRADED, unmapped: false };
  }

  const normalised = stripDiacritics(raw);

  // Longer needles before shorter ones so "sahih li ghairih" matches before "sahih".
  for (const [needle, grade] of GRADE_TABLE) {
    if (normalised.includes(stripDiacritics(needle))) {
      return { grade, unmapped: false };
    }
  }

  return { grade: HadithGrade.UNGRADED, unmapped: true };
}

/**
 * When a record carries multiple grade entries (e.g. sunnah.com's `grades[]`),
 * take the most conservative (weakest) grade across all of them.
 * If any entry maps to an unmapped string, that individual entry is UNGRADED.
 */
export function resolveWeakestGrade(raws: (string | null | undefined)[]): {
  grade: HadithGrade;
  unmappedStrings: string[];
} {
  // Start with weight -1 so ANY real grade (even SAHIH = weight 1) replaces it.
  // The initial grade UNGRADED is only returned when raws is empty.
  let weakestWeight = -1;
  let weakest: HadithGrade = HadithGrade.UNGRADED;
  const unmappedStrings: string[] = [];

  for (const raw of raws) {
    const { grade, unmapped } = normalizeGrade(raw);
    if (unmapped && raw) unmappedStrings.push(raw);
    const weight = GRADE_WEIGHT[grade];
    if (weight > weakestWeight) {
      weakestWeight = weight;
      weakest = grade;
    }
  }

  return { grade: weakest, unmappedStrings };
}
