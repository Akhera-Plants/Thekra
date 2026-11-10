export const STRONG_MATCH_SCORE = 0.75;
export const WEAK_MATCH_SCORE = 0.48;
export const CANDIDATE_FLOOR = 0.3;
export const MATCH_METHOD = 'trgm+overlap';
export function wordOverlap(left, right) {
    const a = new Set(left.split(/\s+/).filter((word) => word.length >= 2));
    const b = new Set(right.split(/\s+/).filter((word) => word.length >= 2));
    if (a.size === 0 || b.size === 0)
        return 0;
    let shared = 0;
    for (const word of a) {
        if (b.has(word))
            shared += 1;
    }
    return shared / Math.min(a.size, b.size);
}
export function combinedScore(trgm, overlap) {
    return Math.round(((trgm + overlap) / 2) * 1000) / 1000;
}
//# sourceMappingURL=match-score.js.map