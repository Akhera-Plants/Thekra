/**
 * Publishes the numbered Sahihayn corpus as public Quotes.
 * The matn is the quote text. The isnad stays in rawPayload, and a match
 * points at the ReferenceHadith row so the two are one narration.
 */
import {
  GradeSource,
  HadithGrade,
  MatchDecision,
  QuoteOrigin,
  QuoteType,
  ReferenceBook,
  TextSource,
  type Prisma,
} from '@prisma/client';
import type { ImportOptions } from '../lib/cli.js';
import { applyLimit } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { formatSummary, withRunLog } from '../lib/run-log.js';
import { BUKHARI_CORPUS, MUSLIM_CORPUS } from './files.js';

const PROVIDER = 'sahihayn';
const SRC_BUKHARI = '10000000-0000-4000-8000-000000000002';
const SRC_MUSLIM = '10000000-0000-4000-8000-000000000003';

const BOOKS = [
  {
    book: ReferenceBook.BUKHARI,
    sourceId: SRC_BUKHARI,
    authority: 'رواه البخاري',
    label: (number: number) => `البخاري ${number}`,
    corpus: BUKHARI_CORPUS,
    versionUri: '0256Bukhari.Sahih.Shamela0001681-ara1',
  },
  {
    book: ReferenceBook.MUSLIM,
    sourceId: SRC_MUSLIM,
    authority: 'رواه مسلم',
    label: (number: number) => `مسلم ${number}`,
    corpus: MUSLIM_CORPUS,
    versionUri: '0261Muslim.Sahih.JK000109-ara1',
  },
] as const;

interface Stored {
  id: string;
  externalId: string | null;
  textAr: string;
  referenceNumber: number | null;
  bookTitle: string | null;
  pageOrChapter: string | null;
  grade: HadithGrade | null;
  gradeSource: GradeSource;
  gradeAuthority: string | null;
  gradeReference: string | null;
  textSource: TextSource;
  rawPayload: Prisma.JsonValue;
}

function payloadOf(row: { id: string; isnadText: string; kitab: string | null; bab: string | null }): Prisma.InputJsonObject {
  return {
    isnadText: row.isnadText,
    kitab: row.kitab,
    bab: row.bab,
    referenceHadithId: row.id,
  };
}

function unchanged(existing: Stored, row: {
  matnText: string;
  number: number;
  kitab: string | null;
  bab: string | null;
  id: string;
  isnadText: string;
}, authority: string, gradeReference: string): boolean {
  const payload = existing.rawPayload;
  const stored = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  return existing.textAr === row.matnText
    && existing.referenceNumber === row.number
    && existing.bookTitle === row.kitab
    && existing.pageOrChapter === row.bab
    && existing.grade === HadithGrade.SAHIH
    && existing.gradeSource === GradeSource.SAHIHAYN
    && existing.gradeAuthority === authority
    && existing.gradeReference === gradeReference
    && existing.textSource === TextSource.DIGITAL
    && stored.isnadText === row.isnadText
    && stored.referenceHadithId === row.id;
}

export async function publishSahihayn(options: ImportOptions): Promise<void> {
  for (const book of BOOKS) {
    const references = applyLimit(
      await options.prisma.referenceHadith.findMany({
        where: { book: book.book },
        orderBy: { number: 'asc' },
      }),
      options.limit,
    );
    const externalIds = references.map((row) => `${book.book}:${row.number}`);
    const existing = await options.prisma.quote.findMany({
      where: { apiProvider: PROVIDER, externalId: { in: [...externalIds] } },
    });
    const byExternal = new Map(existing.map((row) => [row.externalId, row]));
    const quoteIds = existing.map((row) => row.id);
    const links = quoteIds.length === 0
      ? []
      : await options.prisma.hadithMatch.findMany({
        where: { quoteId: { in: quoteIds }, method: 'identity' },
        select: { quoteId: true, referenceHadithId: true, decision: true, score: true },
      });
    const linked = new Set(links.filter((row) => row.decision === MatchDecision.CONFIRMED && row.score === 1).map((row) => row.quoteId));

    let created = 0;
    let updated = 0;
    const writes: Array<(typeof references)[number]> = [];
    for (const row of references) {
      const current = byExternal.get(`${book.book}:${row.number}`);
      if (!current) {
        created += 1;
        writes.push(row);
        continue;
      }
      if (!unchanged(current, row, book.authority, book.label(row.number)) || !linked.has(current.id)) {
        updated += 1;
        writes.push(row);
      }
    }

    const summary = formatSummary(
      { created, updated, unchanged: references.length - created - updated },
      [{
        spec: book.corpus,
        versionUri: book.versionUri,
        corpusUri: `OpenITI/${book.corpus.repo}/${book.corpus.path}`,
        text: '',
      }],
    );
    if (options.dryRun) {
      console.log(`${book.book} ${summary}`);
      continue;
    }

    await withRunLog(options.prisma, book.sourceId, async () => {
      await inTransactionBatches(options.prisma, writes, async (tx, batch) => {
        for (const row of batch) {
          const externalId = `${book.book}:${row.number}`;
          const data = {
            type: QuoteType.HADITH,
            origin: QuoteOrigin.LOCAL,
            textAr: row.matnText,
            sourceId: book.sourceId,
            referenceNumber: row.number,
            bookTitle: row.kitab,
            pageOrChapter: row.bab,
            grade: HadithGrade.SAHIH,
            gradeSource: GradeSource.SAHIHAYN,
            gradeAuthority: book.authority,
            gradeReference: book.label(row.number),
            textSource: TextSource.DIGITAL,
            rawPayload: payloadOf(row),
          };
          const saved = await tx.quote.upsert({
            where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId } },
            create: { ...data, apiProvider: PROVIDER, externalId },
            update: data,
            select: { id: true },
          });
          await tx.hadithMatch.upsert({
            where: { quoteId_referenceHadithId: { quoteId: saved.id, referenceHadithId: row.id } },
            create: {
              quoteId: saved.id,
              referenceHadithId: row.id,
              score: 1,
              method: 'identity',
              decision: MatchDecision.CONFIRMED,
            },
            update: { score: 1, method: 'identity', decision: MatchDecision.CONFIRMED },
          });
        }
      });
      return { recordsImported: created, summary };
    });
    console.log(`${book.book} ${summary}`);
  }
}
