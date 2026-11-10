import { EntityOrigin } from '@prisma/client';
import { publicAcceptedLinkWhere } from './public-taxonomy.js';
const BUKHARI_SOURCE_ID = '10000000-0000-4000-8000-000000000002';
const MUSLIM_SOURCE_ID = '10000000-0000-4000-8000-000000000003';
const SAHIHAYN = new Set([BUKHARI_SOURCE_ID, MUSLIM_SOURCE_ID]);
const GRADE_RANK = {
    SAHIH: 0,
    HASAN: 1,
    DAIF: 2,
    MAWDU: 3,
    UNGRADED: 4,
};
const BASIS_PRIORITY = {
    REVIEWER_SECTION: 0,
    MANUAL: 1,
    CHAPTER: 2,
    TAKHRIJ: 3,
    AUTHOR_CITATION: 4,
    AI_ITEM: 5,
    KEYWORD_PROPOSAL: 6,
    CHAPTER_AYAH: 7,
};
export function basisPriority(basis) {
    return BASIS_PRIORITY[basis] ?? BASIS_PRIORITY.KEYWORD_PROPOSAL;
}
export const READING_ORDER = 'ayah,sahihayn,hadith,chapter-ayah';
export const READING_SELECT = {
    id: true,
    basis: true,
    relevanceScore: true,
    classifiedBy: true,
    note: true,
    quoteId: true,
    quote: { select: { type: true, sourceId: true, grade: true, createdAt: true } },
};
export function countsByTypeFromRanked(rows) {
    const result = { QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0 };
    const seen = new Set();
    for (const row of rows) {
        if (seen.has(row.quoteId))
            continue;
        seen.add(row.quoteId);
        result[row.quote.type] = (result[row.quote.type] ?? 0) + 1;
    }
    return result;
}
export function visibleOrigins() {
    return { in: [EntityOrigin.CURATED, EntityOrigin.TAXONOMY] };
}
const TARGHIB_NOTE = 'الترغيب والترهيب';
export function isIncidentalVerse(row) {
    return row.basis === 'CHAPTER_AYAH' && (row.note ?? '').includes(TARGHIB_NOTE);
}
export function readingTier(row) {
    if (isIncidentalVerse(row))
        return 2;
    if (row.quote.type === 'QURAN_VERSE')
        return 0;
    if (row.basis === 'TAKHRIJ'
        || (row.quote.type === 'HADITH' && row.quote.sourceId != null && SAHIHAYN.has(row.quote.sourceId))) {
        return 1;
    }
    return 2;
}
export function compareReading(a, b) {
    const tier = readingTier(a) - readingTier(b);
    if (tier !== 0)
        return tier;
    const basis = basisPriority(a.basis) - basisPriority(b.basis);
    if (basis !== 0)
        return basis;
    if (a.relevanceScore == null && b.relevanceScore != null)
        return 1;
    if (a.relevanceScore != null && b.relevanceScore == null)
        return -1;
    if (a.relevanceScore != null && b.relevanceScore != null && a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
    }
    const gradeA = a.quote.grade == null ? 9 : GRADE_RANK[a.quote.grade] ?? 9;
    const gradeB = b.quote.grade == null ? 9 : GRADE_RANK[b.quote.grade] ?? 9;
    if (gradeA !== gradeB)
        return gradeA - gradeB;
    const time = b.quote.createdAt.getTime() - a.quote.createdAt.getTime();
    if (time !== 0)
        return time;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export function pageReadingIds(rows, page, limit) {
    return [...rows].sort(compareReading).slice((page - 1) * limit, page * limit).map((row) => row.id);
}
export function firstReadingQuoteId(rows) {
    let first = null;
    for (const row of rows)
        if (first == null || compareReading(row, first) < 0)
            first = row;
    return first?.quoteId ?? null;
}
export function dedupeReading(rows) {
    const sorted = [...rows].sort(compareReading);
    const seen = new Set();
    return sorted.filter((row) => {
        if (seen.has(row.quoteId))
            return false;
        seen.add(row.quoteId);
        return true;
    });
}
export function sinHasPublicText() {
    const linkWhere = publicAcceptedLinkWhere();
    return {
        OR: [
            { quotes: { some: linkWhere } },
            {
                isContemporary: true,
                derivationsFrom: {
                    some: {
                        OR: [
                            { toSin: { isHidden: false, quotes: { some: linkWhere } } },
                            { toGoodDeed: { quotes: { some: linkWhere } } },
                        ],
                    },
                },
            },
        ],
    };
}
export function deedHasPublicText() {
    const linkWhere = publicAcceptedLinkWhere();
    return {
        OR: [
            { quotes: { some: linkWhere } },
            {
                isContemporary: true,
                derivationsFrom: {
                    some: {
                        OR: [
                            { toSin: { isHidden: false, quotes: { some: linkWhere } } },
                            { toGoodDeed: { quotes: { some: linkWhere } } },
                        ],
                    },
                },
            },
        ],
    };
}
export function readingHasNext(page, limit, totals, derivedPageSizes = []) {
    return totals.some((total) => page * limit < total) || derivedPageSizes.some((size) => size >= limit);
}
//# sourceMappingURL=reading.js.map