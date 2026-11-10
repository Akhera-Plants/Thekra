import { type Prisma } from '@prisma/client';
import { type ReadingRow } from '../classification/reading.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { type TopicTheme } from './topic-themes.js';
export interface ThemeSides {
    sin?: Prisma.SinQuoteWhereInput;
    deed?: Prisma.GoodDeedQuoteWhereInput;
}
export interface ThemeCount {
    key: string;
    ar: string;
    en: string;
    count: number;
}
export interface PageTheme {
    key: string;
    ar: string;
    en: string;
    keys: string[];
}
export interface KindCounts {
    all: number;
    verse: number;
    hadith: number;
    athar: number;
}
export declare function mergePageThemes(themes: readonly TopicTheme[], sinSlug: string | null): PageTheme[];
export declare function findActiveTheme(pageThemes: readonly PageTheme[], requested: string | undefined): PageTheme | null;
export declare function summariseThemes(prisma: PrismaService, sides: ThemeSides, themes: readonly PageTheme[], active: PageTheme | null): Promise<{
    themes: ThemeCount[];
    countsByKind: KindCounts | null;
}>;
export declare function readThemedPage<TItem>(prisma: PrismaService, sides: ThemeSides, options: {
    page: number;
    limit: number;
    hydrate: (rows: ReadingRow[]) => Promise<unknown[]>;
    present: (row: unknown) => TItem;
}): Promise<{
    items: TItem[];
    total: number;
    countsByType: Record<string, number>;
}>;
