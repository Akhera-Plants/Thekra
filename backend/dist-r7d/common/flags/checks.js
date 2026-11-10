import { STRONG_MATCH_SCORE, WEAK_MATCH_SCORE } from '../text/match-score.js';
import { normalizeMatn } from '../text/normalize-matn.js';
export function isWeakMatch(bestScore) {
    return bestScore !== null && bestScore >= WEAK_MATCH_SCORE && bestScore < STRONG_MATCH_SCORE;
}
export function duplicateDifferentGrade(rows) {
    const groups = new Map();
    for (const row of rows) {
        if (row.normalizedMatn.length < 40)
            continue;
        const bucket = groups.get(row.normalizedMatn) ?? { ids: [], grades: new Set() };
        bucket.ids.push(row.id);
        bucket.grades.add(row.grade ?? 'UNGRADED');
        groups.set(row.normalizedMatn, bucket);
    }
    const flagged = [];
    for (const bucket of groups.values()) {
        if (bucket.grades.size > 1)
            flagged.push(...bucket.ids);
    }
    return flagged;
}
export function quranMismatch(text, keys, canon) {
    const haystack = normalizeMatn(text);
    const missed = [];
    for (const key of keys) {
        const verse = canon.get(key);
        if (!verse)
            continue;
        const needle = normalizeMatn(verse);
        if (needle.length < 12)
            continue;
        if (!haystack.includes(needle))
            missed.push(key);
    }
    return missed;
}
export function ocrSuspect(text, textSource) {
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
export function referenceMismatch(similarity) {
    return similarity !== null && similarity < WEAK_MATCH_SCORE;
}
//# sourceMappingURL=checks.js.map