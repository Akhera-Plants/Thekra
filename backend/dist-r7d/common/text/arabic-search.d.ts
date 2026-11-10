import type { PrismaService } from '../../prisma/prisma.service.js';
export type ArabicSearchTable = '"Sin"' | '"GoodDeed"' | '"Tag"' | '"Quote"' | '"ImanBranch"';
export type ArabicSearchColumn = '"nameAr"' | '"textAr"' | '"narratorAr"' | '"titleAr"';
export declare function findIdsByNormalizedArabic(prisma: PrismaService, table: ArabicSearchTable, column: ArabicSearchColumn, query: string): Promise<string[]>;
export declare function findIdsByNormalizedArabicOrdered(prisma: PrismaService, table: ArabicSearchTable, column: ArabicSearchColumn, query: string): Promise<string[]>;
