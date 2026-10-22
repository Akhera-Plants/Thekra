/**
 * Folds a quote that sits outside every section into the sectioned quote
 * that is the same narration, then deletes the duplicate.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { wordOverlap } from '../../../src/common/text/match-score.js';
import { normalizeArabic } from '../../../src/common/text/arabic-normalizer.js';

const IBN_QAYYIM_SOURCE_ID = '10000000-0000-4000-8000-000000000004';

export interface Leftover {
  referenceNumber: number | null;
  reason: string;
}

interface QuoteRow {
  id: string;
  referenceNumber: number | null;
  textAr: string;
  page: string | null;
  volume: string | null;
  apiProvider: string | null;
  externalId: string | null;
  words: Set<string>;
}

interface Pair {
  orphan: string;
  survivor: string;
}

function fold(text: string): string {
  return normalizeArabic(text).replace(/[^\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordsOf(text: string): Set<string> {
  return new Set(fold(text).split(' ').filter((word) => word.length >= 2));
}

function lengthRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return Number.POSITIVE_INFINITY;
  return Math.max(left.size, right.size) / Math.min(left.size, right.size);
}

export async function deleteIbnQayyim(prisma: PrismaClient): Promise<number> {
  const source = await prisma.source.findUnique({ where: { id: IBN_QAYYIM_SOURCE_ID }, select: { id: true } });
  if (!source) return 0;
  const deleted = await prisma.quote.deleteMany({ where: { sourceId: IBN_QAYYIM_SOURCE_ID } });
  await prisma.source.delete({ where: { id: IBN_QAYYIM_SOURCE_ID } });
  return deleted.count;
}

async function retarget(
  prisma: PrismaClient,
  table: string,
  conflictColumn: string | null,
  pairs: readonly Pair[],
): Promise<void> {
  if (pairs.length === 0) return;
  const values = Prisma.join(pairs.map((pair) => Prisma.sql`(${pair.orphan}, ${pair.survivor})`));
  const quoted = Prisma.raw(`"${table}"`);
  if (!conflictColumn) {
    await prisma.$executeRaw`
      UPDATE ${quoted} AS row
      SET "quoteId" = m.survivor
      FROM (VALUES ${values}) AS m(orphan, survivor)
      WHERE row."quoteId" = m.orphan
    `;
    return;
  }
  const column = Prisma.raw(`"${conflictColumn}"`);
  await prisma.$executeRaw`
    DELETE FROM ${quoted} AS row
    USING (VALUES ${values}) AS m(orphan, survivor)
    WHERE row."quoteId" = m.orphan
      AND EXISTS (
        SELECT 1 FROM ${quoted} AS other
        WHERE other.${column} = row.${column}
          AND other."quoteId" = m.survivor
      )
  `;
  await prisma.$executeRaw`
    DELETE FROM ${quoted} AS row
    WHERE row.id IN (
      SELECT id FROM (
        SELECT ranked.id
        FROM (
          SELECT row.id,
            row_number() OVER (PARTITION BY m.survivor, row.${column} ORDER BY row.id) AS n
          FROM ${quoted} AS row
          JOIN (VALUES ${values}) AS m(orphan, survivor) ON row."quoteId" = m.orphan
        ) AS ranked
        WHERE ranked.n > 1
      ) AS drop
    )
  `;
  await prisma.$executeRaw`
    UPDATE ${quoted} AS row
    SET "quoteId" = m.survivor
    FROM (VALUES ${values}) AS m(orphan, survivor)
    WHERE row."quoteId" = m.orphan
  `;
}

async function movePairs(prisma: PrismaClient, pairs: readonly Pair[]): Promise<void> {
  const chunkSize = 150;
  for (let start = 0; start < pairs.length; start += chunkSize) {
    const chunk = pairs.slice(start, start + chunkSize);
    await retarget(prisma, 'Favorite', 'userId', chunk);
    await retarget(prisma, 'SinQuote', 'sinId', chunk);
    await retarget(prisma, 'GoodDeedQuote', 'goodDeedId', chunk);
    await retarget(prisma, 'ImanBranchQuote', 'imanBranchId', chunk);
    await retarget(prisma, 'QuoteTag', 'tagId', chunk);
    await retarget(prisma, 'Translation', 'languageCode', chunk);
    await retarget(prisma, 'HadithMatch', 'referenceHadithId', chunk);
    await retarget(prisma, 'QuoteFlag', null, chunk);
    await retarget(prisma, 'Explanation', null, chunk);
    await retarget(prisma, 'SectionItem', null, chunk);
    const values = Prisma.join(chunk.map((pair) => Prisma.sql`(${pair.orphan}, ${pair.survivor})`));
    await prisma.$executeRaw`
      UPDATE "Quote" AS survivor
      SET "rawPayload" = jsonb_strip_nulls(
        COALESCE(survivor."rawPayload", '{}'::jsonb) ||
        jsonb_strip_nulls(jsonb_build_object('waqfeyaPage', orphan.page, 'waqfeyaVolume', orphan.volume))
      )
      FROM "Quote" AS orphan
      JOIN (VALUES ${values}) AS m(orphan, survivor) ON orphan.id = m.orphan
      WHERE survivor.id = m.survivor
        AND (orphan.page IS NOT NULL OR orphan.volume IS NOT NULL)
    `;
    await prisma.$executeRaw`
      DELETE FROM "Quote" AS orphan
      USING (VALUES ${values}) AS m(orphan, survivor)
      WHERE orphan.id = m.orphan
    `;
  }
}

function reasonFor(bookKey: string, quote: QuoteRow): string {
  if (bookKey === 'riyad' && (quote.referenceNumber ?? 0) > 1896) {
    return 'Waqfeya number is past the OpenITI edition, which ends at 1896, and the wording does not match a sectioned narration';
  }
  if (
    bookKey === 'kabair'
    && (quote.externalId?.startsWith('author:kabair:') || quote.externalId?.startsWith('digital:kabair') || quote.apiProvider === 'book:dhahabi-kabair')
  ) {
    return 'superseded when the kabira was split into the author\'s prose, verse keys, and prophetic reports';
  }
  return 'no sectioned quote shares its number or its wording';
}

export async function absorbOrphans(prisma: PrismaClient, sourceId: string, bookKey: string): Promise<Leftover[]> {
  const quotes = await prisma.quote.findMany({
    where: { sourceId },
    select: {
      id: true,
      referenceNumber: true,
      textAr: true,
      page: true,
      volume: true,
      apiProvider: true,
      externalId: true,
    },
  });
  const linked = new Set(
    (await prisma.sectionItem.findMany({
      where: { quoteId: { not: null }, section: { sourceId } },
      select: { quoteId: true },
    })).map((item) => item.quoteId as string),
  );
  const rows: QuoteRow[] = quotes.map((quote) => ({ ...quote, words: wordsOf(quote.textAr) }));
  const sectioned = rows.filter((quote) => linked.has(quote.id));
  const orphans = rows.filter((quote) => !linked.has(quote.id));
  const byNumber = new Map<number, QuoteRow[]>();
  for (const quote of sectioned) {
    if (quote.referenceNumber == null) continue;
    const list = byNumber.get(quote.referenceNumber) ?? [];
    list.push(quote);
    byNumber.set(quote.referenceNumber, list);
  }

  const pairs: Pair[] = [];
  const left: Leftover[] = [];
  const blank: string[] = [];
  for (const orphan of orphans) {
    if (bookKey === 'munajjid' && orphan.textAr.trim() === '') {
      blank.push(orphan.id);
      continue;
    }
    const numbered = orphan.referenceNumber == null ? [] : (byNumber.get(orphan.referenceNumber) ?? []);
    let survivor = numbered[0] ?? null;
    if (numbered.length > 1) {
      survivor = numbered.slice().sort((leftQuote, rightQuote) => {
        const score = wordOverlap(fold(orphan.textAr), fold(rightQuote.textAr)) - wordOverlap(fold(orphan.textAr), fold(leftQuote.textAr));
        return score !== 0 ? score : (leftQuote.id < rightQuote.id ? -1 : 1);
      })[0] ?? null;
    }
    if (!survivor && orphan.words.size >= 8) {
      let best: QuoteRow | null = null;
      let score = 0;
      for (const candidate of sectioned) {
        const ratio = lengthRatio(orphan.words, candidate.words);
        if (ratio > 1.8) continue;
        const next = wordOverlap(fold(orphan.textAr), fold(candidate.textAr));
        if (next > score) {
          score = next;
          best = candidate;
        }
      }
      if (best && score >= 0.85) survivor = best;
    }
    if (!survivor || survivor.id === orphan.id) {
      left.push({ referenceNumber: orphan.referenceNumber, reason: reasonFor(bookKey, orphan) });
      continue;
    }
    pairs.push({ orphan: orphan.id, survivor: survivor.id });
  }
  if (blank.length > 0) await prisma.quote.deleteMany({ where: { id: { in: blank } } });
  await movePairs(prisma, pairs);
  return left;
}
