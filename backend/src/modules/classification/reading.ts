import { EntityOrigin, type LinkBasis, type Prisma } from '@prisma/client';
import { publicAcceptedLinkWhere } from './public-taxonomy.js';

const BUKHARI_SOURCE_ID = '10000000-0000-4000-8000-000000000002';
const MUSLIM_SOURCE_ID = '10000000-0000-4000-8000-000000000003';
const SAHIHAYN = new Set([BUKHARI_SOURCE_ID, MUSLIM_SOURCE_ID]);

const GRADE_RANK: Record<string, number> = {
  SAHIH: 0,
  HASAN: 1,
  DAIF: 2,
  MAWDU: 3,
  UNGRADED: 4,
};

/**
 * Inside a reading band, links whose basis says more about the topic come first (lower first). Reviewer and hand
 * links lead, then the book chapter's own texts, their Sahihayn copies, author citations and AI items.
 * CHAPTER_AYAH is always last. The taxonomy importer gives that basis to every verse found in a mapped chapter.
 * That includes a verse quoted inside one of the chapter's hadith: the structure import adds each verse a Targhib
 * hadith mentions (`expandTarghibAyahs`). No reviewer checked these verses one by one; the ayah review covered
 * Zuhd, Minhaj and Munajjid only. Owner, 2026-11-01: al-Falaq 113:4, from a hadith in al-Mundhiri's chapter on
 * qiyam al-layl, opened «النوافل وقيام الليل».
 */
const BASIS_PRIORITY: Record<LinkBasis, number> = {
  REVIEWER_SECTION: 0,
  MANUAL: 1,
  CHAPTER: 2,
  TAKHRIJ: 3,
  AUTHOR_CITATION: 4,
  AI_ITEM: 5,
  KEYWORD_PROPOSAL: 6,
  CHAPTER_AYAH: 7,
};

export function basisPriority(basis: string): number {
  return (BASIS_PRIORITY as Record<string, number>)[basis] ?? BASIS_PRIORITY.KEYWORD_PROPOSAL;
}

/**
 * The public reading order of a topic's texts (`meta.ordering`): verses, then Sahihayn hadith, then the other texts,
 * with CHAPTER_AYAH verses at the very end. Inside each band: basis priority, relevanceScore (nulls last), grade,
 * newest text, link id. Every topic list and «الميزان» (the first text of the list) use this order.
 */
export const READING_ORDER = 'ayah,sahihayn,hadith,chapter-ayah';

export const READING_SELECT = {
  id: true,
  basis: true,
  relevanceScore: true,
  classifiedBy: true,
  note: true,
  quoteId: true,
  quote: { select: { type: true, sourceId: true, grade: true, createdAt: true } },
} as const;

export interface ReadingRow {
  id: string;
  basis: string;
  relevanceScore: number | null;
  classifiedBy: string;
  note: string | null;
  quoteId: string;
  quote: {
    type: string;
    sourceId: string | null;
    grade: string | null;
    createdAt: Date;
  };
}

/** `countsByType` from ranked link rows: distinct texts per type (what a groupBy over the links gave). */
export function countsByTypeFromRanked(rows: ReadonlyArray<{ quoteId: string; quote: { type: string } }>): Record<string, number> {
  const result: Record<string, number> = { QURAN_VERSE: 0, HADITH: 0, SCHOLAR_QUOTE: 0, BOOK_EXCERPT: 0 };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.quoteId)) continue;
    seen.add(row.quoteId);
    result[row.quote.type] = (result[row.quote.type] ?? 0) + 1;
  }
  return result;
}

export function visibleOrigins(): Prisma.EnumEntityOriginFilter {
  return { in: [EntityOrigin.CURATED, EntityOrigin.TAXONOMY] };
}

/** The structure import's note on a Targhib link («… — صحيح الترغيب والترهيب»). */
const TARGHIB_NOTE = 'الترغيب والترهيب';

/**
 * A verse that only appears inside one of the chapter's hadith: a CHAPTER_AYAH link from al-Mundhiri's Sahih
 * al-Targhib, where the importer adds every verse a hadith mentions (`expandTarghibAyahs`; e.g. al-Falaq 113:4 in
 * «الترغيب في قيام الليل»). The opening verses al-Nawawi, al-Dhahabi, Ibn Qudama and Ibn al-Mubarak chose for a
 * chapter are CHAPTER_AYAH too, but they are the chapter's own: they stay with the verses (owner, 2026-11-01:
 * checked on production, 113 topics opened with a verse; the Targhib ones were the unrelated ones).
 */
export function isIncidentalVerse(row: { basis: string; note?: string | null }): boolean {
  return row.basis === 'CHAPTER_AYAH' && (row.note ?? '').includes(TARGHIB_NOTE);
}

/**
 * Reading band (`link.band`): 0 «ayah», 1 «sahihayn», 2 «other». An incidental verse ({@link isIncidentalVerse})
 * sits in the last band and, with the lowest basis priority, at the end of it, so the bands still only go up.
 */
export function readingTier(row: {
  basis: string;
  note?: string | null;
  quote: { type: string; sourceId: string | null };
}): number {
  if (isIncidentalVerse(row)) return 2;
  if (row.quote.type === 'QURAN_VERSE') return 0;
  if (
    row.basis === 'TAKHRIJ'
    || (row.quote.type === 'HADITH' && row.quote.sourceId != null && SAHIHAYN.has(row.quote.sourceId))
  ) {
    return 1;
  }
  return 2;
}

export function compareReading(a: ReadingRow, b: ReadingRow): number {
  const tier = readingTier(a) - readingTier(b);
  if (tier !== 0) return tier;
  const basis = basisPriority(a.basis) - basisPriority(b.basis);
  if (basis !== 0) return basis;
  if (a.relevanceScore == null && b.relevanceScore != null) return 1;
  if (a.relevanceScore != null && b.relevanceScore == null) return -1;
  if (a.relevanceScore != null && b.relevanceScore != null && a.relevanceScore !== b.relevanceScore) {
    return b.relevanceScore - a.relevanceScore;
  }
  const gradeA = a.quote.grade == null ? 9 : GRADE_RANK[a.quote.grade] ?? 9;
  const gradeB = b.quote.grade == null ? 9 : GRADE_RANK[b.quote.grade] ?? 9;
  if (gradeA !== gradeB) return gradeA - gradeB;
  const time = b.quote.createdAt.getTime() - a.quote.createdAt.getTime();
  if (time !== 0) return time;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function pageReadingIds(rows: ReadingRow[], page: number, limit: number): string[] {
  return [...rows].sort(compareReading).slice((page - 1) * limit, page * limit).map((row) => row.id);
}

/**
 * The text that opens a topic list in reading order («الميزان» `source: 'top'`), or null when there is none.
 * An incidental verse is chosen only when the topic has no other text that passes the same reader filter.
 */
export function firstReadingQuoteId(rows: readonly ReadingRow[]): string | null {
  let first: ReadingRow | null = null;
  for (const row of rows) if (first == null || compareReading(row, first) < 0) first = row;
  return first?.quoteId ?? null;
}

export function dedupeReading(rows: ReadingRow[]): ReadingRow[] {
  const sorted = [...rows].sort(compareReading);
  const seen = new Set<string>();
  return sorted.filter((row) => {
    if (seen.has(row.quoteId)) return false;
    seen.add(row.quoteId);
    return true;
  });
}

export function sinHasPublicText(): Prisma.SinWhereInput {
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

export function deedHasPublicText(): Prisma.GoodDeedWhereInput {
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

/**
 * A topic page has more texts when any of its lists does: the topic's own links, the paired
 * topic's texts (companion), or a derived group that filled this page. meta.total counts only
 * the first, so a paired page whose other side is longer used to stop at page 1.
 */
export function readingHasNext(
  page: number,
  limit: number,
  totals: readonly number[],
  derivedPageSizes: readonly number[] = [],
): boolean {
  return totals.some((total) => page * limit < total) || derivedPageSizes.some((size) => size >= limit);
}
