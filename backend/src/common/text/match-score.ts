/**
 * Strong / weak bands for sahihayn matching.
 * Calibrated on the 50-quote sample in docs/build/IMPORT_REPORT.md
 * («Takhrij — al-Sahihayn»). 0.75 is the lowest cut at which every judged
 * pair was the same narration; 0.72 still accepted «ليلة القدر» as Bukhari 37.
 * A second import run must keep these values.
 */
export const STRONG_MATCH_SCORE = 0.75;
export const WEAK_MATCH_SCORE = 0.48;
export const CANDIDATE_FLOOR = 0.3;
export const MATCH_METHOD = 'trgm+overlap';

/** Overlap coefficient: shared words / size of the smaller set. */
export function wordOverlap(left: string, right: string): number {
  const a = new Set(left.split(/\s+/).filter((word) => word.length >= 2));
  const b = new Set(right.split(/\s+/).filter((word) => word.length >= 2));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
}

/** Trigram similarity and word overlap, each in 0..1, averaged and rounded. */
export function combinedScore(trgm: number, overlap: number): number {
  return Math.round(((trgm + overlap) / 2) * 1000) / 1000;
}
