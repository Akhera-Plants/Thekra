import { Prisma } from '@prisma/client';
import { escapeIlikePattern, normalizeArabic } from './arabic-normalizer.js';
export async function findIdsByNormalizedArabic(prisma, table, column, query) {
    const normalized = normalizeArabic(query);
    const escaped = escapeIlikePattern(normalized);
    const rows = await prisma.$queryRaw(Prisma.sql `
      SELECT id
      FROM   ${Prisma.raw(table)}
      WHERE  thekra_normalize_ar(${Prisma.raw(column)}) ILIKE '%' || ${escaped} || '%'
    `);
    return rows.map((r) => r.id);
}
export async function findIdsByNormalizedArabicOrdered(prisma, table, column, query) {
    const normalized = normalizeArabic(query);
    const escaped = escapeIlikePattern(normalized);
    const rows = await prisma.$queryRaw(Prisma.sql `
      SELECT id
      FROM   ${Prisma.raw(table)}
      WHERE  thekra_normalize_ar(${Prisma.raw(column)}) ILIKE '%' || ${escaped} || '%'
      ORDER BY
        CASE WHEN thekra_normalize_ar(${Prisma.raw(column)}) = ${normalized}
             THEN 0 ELSE 1 END ASC
    `);
    return rows.map((r) => r.id);
}
//# sourceMappingURL=arabic-search.js.map