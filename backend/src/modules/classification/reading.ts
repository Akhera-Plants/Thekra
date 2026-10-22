import { EntityOrigin, type Prisma } from '@prisma/client';
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

export const READING_ORDER = 'ayah,sahihayn,hadith';

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
  quoteId: string;
  quote: {
    type: string;
    sourceId: string | null;
    grade: string | null;
    createdAt: Date;
  };
}

export function visibleOrigins(): Prisma.EnumEntityOriginFilter {
  return { in: [EntityOrigin.CURATED, EntityOrigin.TAXONOMY] };
}

export function readingTier(row: {
  basis: string;
  quote: { type: string; sourceId: string | null };
}): number {
  if (row.basis === 'CHAPTER_AYAH' || row.quote.type === 'QURAN_VERSE') return 0;
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
