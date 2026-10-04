/**
 * Raw-SQL Arabic search helper.
 *
 * The fundamental problem with Prisma's `contains` + `mode: 'insensitive'` for
 * Arabic is that ILIKE operates on the *stored* text as-is.  If a stored value
 * contains tashkeel or uses ة while the user typed ه (or vice-versa), the
 * match fails even though the strings are semantically identical.
 *
 * Fix: push normalisation into the database via `thekra_normalize_ar()` (see
 * migration `add_arabic_normalize_fn`) and match against the normalised form of
 * both sides.  Latin-script fields continue to use Prisma's built-in ILIKE.
 *
 * Future: backend-plan §4.4 Phase 5 will add a GIN trigram index on
 * `thekra_normalize_ar("textAr")` to make these scans fast on large tables.
 */

import { Prisma } from '@prisma/client';
import { escapeIlikePattern, normalizeArabic } from './arabic-normalizer.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/** Tables that have Arabic fields searched via this helper. */
export type ArabicSearchTable = '"Sin"' | '"GoodDeed"' | '"Tag"' | '"Quote"';

/** Arabic columns that can be searched via this helper. */
export type ArabicSearchColumn = '"nameAr"' | '"textAr"' | '"narratorAr"';

/**
 * Returns the `id` values of rows in `table` whose `column` – after applying
 * `thekra_normalize_ar()` in Postgres – contains the normalised form of `query`.
 *
 * Security notes:
 *  - `table` and `column` are constrained to a closed union – never user input.
 *  - `escapedPattern` is passed as a parameterised bind value; Prisma renders it
 *    as `$1` so there is no SQL-injection surface.
 *  - The `ILIKE` special characters (`%`, `_`, `\`) in the *query* are escaped
 *    by `escapeIlikePattern` before the bind so that they are treated as literals.
 */
export async function findIdsByNormalizedArabic(
  prisma: PrismaService,
  table: ArabicSearchTable,
  column: ArabicSearchColumn,
  query: string,
): Promise<string[]> {
  const normalized = normalizeArabic(query);
  const escaped = escapeIlikePattern(normalized);

  // Prisma.raw is safe here because table/column come from a closed union type.
  // The user-supplied value (`escaped`) travels as a parameterised $1 bind.
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id
      FROM   ${Prisma.raw(table)}
      WHERE  thekra_normalize_ar(${Prisma.raw(column)}) ILIKE '%' || ${escaped} || '%'
    `,
  );

  return rows.map((r) => r.id);
}

/**
 * P2-10: Like `findIdsByNormalizedArabic` but returns IDs in relevance order:
 * exact-normalised matches first (CASE rank 0), then partial matches (rank 1).
 *
 * Used for `sort=relevance` as a cheap pre-Phase-5 proxy for real ranking.
 * Phase 5 will replace this with a GIN trigram similarity score.
 *
 * The ORDER BY CASE is evaluated server-side in a single SQL scan — no extra
 * round trips versus `findIdsByNormalizedArabic`.
 */
export async function findIdsByNormalizedArabicOrdered(
  prisma: PrismaService,
  table: ArabicSearchTable,
  column: ArabicSearchColumn,
  query: string,
): Promise<string[]> {
  const normalized = normalizeArabic(query);
  const escaped = escapeIlikePattern(normalized);

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id
      FROM   ${Prisma.raw(table)}
      WHERE  thekra_normalize_ar(${Prisma.raw(column)}) ILIKE '%' || ${escaped} || '%'
      ORDER BY
        CASE WHEN thekra_normalize_ar(${Prisma.raw(column)}) = ${normalized}
             THEN 0 ELSE 1 END ASC
    `,
  );

  return rows.map((r) => r.id);
}
