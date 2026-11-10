import { type Prisma } from '@prisma/client';
export declare function basisPriority(basis: string): number;
export declare const READING_ORDER = "ayah,sahihayn,hadith,chapter-ayah";
export declare const READING_SELECT: {
    readonly id: true;
    readonly basis: true;
    readonly relevanceScore: true;
    readonly classifiedBy: true;
    readonly note: true;
    readonly quoteId: true;
    readonly quote: {
        readonly select: {
            readonly type: true;
            readonly sourceId: true;
            readonly grade: true;
            readonly createdAt: true;
        };
    };
};
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
export declare function countsByTypeFromRanked(rows: ReadonlyArray<{
    quoteId: string;
    quote: {
        type: string;
    };
}>): Record<string, number>;
export declare function visibleOrigins(): Prisma.EnumEntityOriginFilter;
export declare function isIncidentalVerse(row: {
    basis: string;
    note?: string | null;
}): boolean;
export declare function readingTier(row: {
    basis: string;
    note?: string | null;
    quote: {
        type: string;
        sourceId: string | null;
    };
}): number;
export declare function compareReading(a: ReadingRow, b: ReadingRow): number;
export declare function pageReadingIds(rows: ReadingRow[], page: number, limit: number): string[];
export declare function firstReadingQuoteId(rows: readonly ReadingRow[]): string | null;
export declare function dedupeReading(rows: ReadingRow[]): ReadingRow[];
export declare function sinHasPublicText(): Prisma.SinWhereInput;
export declare function deedHasPublicText(): Prisma.GoodDeedWhereInput;
export declare function readingHasNext(page: number, limit: number, totals: readonly number[], derivedPageSizes?: readonly number[]): boolean;
