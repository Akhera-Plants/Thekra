import { STRONG_MATCH_SCORE, WEAK_MATCH_SCORE } from '../text/match-score.js';
import { normalizeMatn } from '../text/normalize-matn.js';

export function isWeakMatch(bestScore: number | null): boolean {
  return bestScore !== null && bestScore >= WEAK_MATCH_SCORE && bestScore < STRONG_MATCH_SCORE;
}

export interface GradeGroupRow {
  id: string;
  normalizedMatn: string;
  grade: string | null;
}

/** Quote ids whose shared matn carries more than one grade. Null counts as UNGRADED. */
export function duplicateDifferentGrade(rows: readonly GradeGroupRow[]): string[] {
  const groups = new Map<string, { ids: string[]; grades: Set<string> }>();
  for (const row of rows) {
    if (row.normalizedMatn.length < 40) continue;
    const bucket = groups.get(row.normalizedMatn) ?? { ids: [], grades: new Set<string>() };
    bucket.ids.push(row.id);
    bucket.grades.add(row.grade ?? 'UNGRADED');
    groups.set(row.normalizedMatn, bucket);
  }
  const flagged: string[] = [];
  for (const bucket of groups.values()) {
    if (bucket.grades.size > 1) flagged.push(...bucket.ids);
  }
  return flagged;
}

/** Verse keys whose canonical text is absent from the narration. Unknown keys are skipped. */
export function quranMismatch(
  text: string,
  keys: readonly string[],
  canon: ReadonlyMap<string, string>,
): string[] {
  const haystack = normalizeMatn(text);
  const missed: string[] = [];
  for (const key of keys) {
    const verse = canon.get(key);
    if (!verse) continue;
    const needle = normalizeMatn(verse);
    if (needle.length < 12) continue;
    if (!haystack.includes(needle)) missed.push(key);
  }
  return missed;
}

export interface OcrSignal {
  suspect: boolean;
  arabicRatio: number;
  latin: boolean;
  brokenWords: number;
}

/** OCR text with Latin noise, a low Arabic ratio, or many broken one-letter words. */
export function ocrSuspect(text: string, textSource: string): OcrSignal {
  const letters = text.match(/\p{L}/gu) ?? [];
  const arabic = text.match(/[\u0600-\u06FF]/g) ?? [];
  const arabicRatio = letters.length === 0 ? 0 : arabic.length / letters.length;
  const latin = /[A-Za-z]/.test(text);
  const brokenWords = (text.match(/(?:^|\s)[\u0621-\u064A](?=\s|$)/g) ?? []).length;
  const suspect = textSource === 'OCR' && (arabicRatio < 0.9 || latin || brokenWords >= 8);
  return {
    suspect,
    arabicRatio: Math.round(arabicRatio * 1000) / 1000,
    latin,
    brokenWords,
  };
}

/** A stored Bukhari/Muslim number whose text is not that narration. Null means no claim. */
export function referenceMismatch(similarity: number | null): boolean {
  return similarity !== null && similarity < WEAK_MATCH_SCORE;
}
