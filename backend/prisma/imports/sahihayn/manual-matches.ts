/**
 * Same-matn near matches below STRONG_MATCH_SCORE (0.75) that a human
 * confirmed against Bukhari. The auto threshold is unchanged; these rows
 * are graded AUTO_SAHIHAYN via a CONFIRMED HadithMatch (method «manual»).
 *
 * Source: docs/review/sunan-near-matches.json
 */
import { randomUUID } from 'node:crypto';
import {
  FlagType,
  GradeSource,
  HadithGrade,
  MatchDecision,
  ReferenceBook,
  type PrismaClient,
} from '@prisma/client';
import { isArnautGradeSource } from '../../../src/modules/hadith/grade-policy.js';

export const MANUAL_MATCH_METHOD = 'manual';

export interface ManualSahihaynMatch {
  quoteId: string;
  book: typeof ReferenceBook.BUKHARI | typeof ReferenceBook.MUSLIM;
  number: number;
  /** Recorded pg_trgm/combined score from the near-match audit (not raised to 0.75). */
  score: number;
}

/** All four near-match rows share the Bukhari matn; upgrade every one. */
export const MANUAL_SAHIHAYN_MATCHES: readonly ManualSahihaynMatch[] = [
  {
    quoteId: '5a5caabf-9db3-47bd-8d4b-45a60cc33333',
    book: ReferenceBook.BUKHARI,
    number: 7080,
    score: 0.6630435,
  },
  {
    quoteId: '479248e3-bfaa-49c2-b7bd-a2ccb1531c1f',
    book: ReferenceBook.BUKHARI,
    number: 6796,
    score: 0.6052632,
  },
  {
    quoteId: '51e8997c-114a-4db0-a4b9-0e5fbc4f14f0',
    book: ReferenceBook.BUKHARI,
    number: 1152,
    score: 0.65294117,
  },
  {
    quoteId: 'ecd877fd-5807-4db9-9002-23d01fc55d0f',
    book: ReferenceBook.BUKHARI,
    number: 1152,
    score: 0.65294117,
  },
];

const AUTHORITY = {
  BUKHARI: 'رواه البخاري',
  MUSLIM: 'رواه مسلم',
} as const;

function citation(book: ReferenceBook, number: number): string {
  return book === ReferenceBook.BUKHARI ? `البخاري ${number}` : `مسلم ${number}`;
}

/**
 * Upserts a CONFIRMED manual HadithMatch, sets AUTO_SAHIHAYN with the Sahihayn
 * citation first and the prior Sunan ruling as a second citation, and closes
 * OUTSIDE_SAHIHAYN. Idempotent.
 */
export async function applyManualSahihaynMatches(
  prisma: PrismaClient,
): Promise<{ applied: number; unchanged: number; missing: string[] }> {
  let applied = 0;
  let unchanged = 0;
  const missing: string[] = [];

  for (const row of MANUAL_SAHIHAYN_MATCHES) {
    const reference = await prisma.referenceHadith.findUnique({
      where: { book_number: { book: row.book, number: row.number } },
      select: { id: true },
    });
    if (!reference) {
      missing.push(`${row.book}:${row.number}`);
      continue;
    }

    const quote = await prisma.quote.findUnique({
      where: { id: row.quoteId },
      select: {
        id: true,
        grade: true,
        gradeSource: true,
        gradeAuthority: true,
        gradeReference: true,
        legacyGrade: true,
        legacyGradeAuthority: true,
        legacyGradeReference: true,
      },
    });
    if (!quote) {
      missing.push(row.quoteId);
      continue;
    }

    await prisma.hadithMatch.upsert({
      where: {
        quoteId_referenceHadithId: {
          quoteId: row.quoteId,
          referenceHadithId: reference.id,
        },
      },
      create: {
        id: randomUUID(),
        quoteId: row.quoteId,
        referenceHadithId: reference.id,
        score: row.score,
        method: MANUAL_MATCH_METHOD,
        decision: MatchDecision.CONFIRMED,
      },
      update: {
        score: row.score,
        method: MANUAL_MATCH_METHOD,
        decision: MatchDecision.CONFIRMED,
      },
    });

    const sahihaynRef = citation(row.book, row.number);
    const sunanRef =
      isArnautGradeSource(quote.gradeSource)
        ? quote.gradeReference
        : quote.legacyGradeReference ?? quote.gradeReference;
    const gradeReference = sunanRef && !sunanRef.includes(sahihaynRef)
      ? `${sahihaynRef}، ${sunanRef}`
      : sahihaynRef;
    const gradeAuthority = row.book === ReferenceBook.BUKHARI ? AUTHORITY.BUKHARI : AUTHORITY.MUSLIM;

    const already =
      quote.grade === HadithGrade.SAHIH
      && quote.gradeSource === GradeSource.AUTO_SAHIHAYN
      && quote.gradeAuthority === gradeAuthority
      && quote.gradeReference === gradeReference;

    if (!already) {
      await prisma.quote.update({
        where: { id: row.quoteId },
        data: {
          grade: HadithGrade.SAHIH,
          gradeSource: GradeSource.AUTO_SAHIHAYN,
          gradeAuthority,
          gradeReference,
          legacyGrade: quote.legacyGrade ?? quote.grade,
          legacyGradeAuthority: quote.legacyGradeAuthority ?? quote.gradeAuthority,
          legacyGradeReference: quote.legacyGradeReference ?? quote.gradeReference,
        },
      });
      applied += 1;
    } else {
      unchanged += 1;
    }

    await prisma.quoteFlag.deleteMany({
      where: { quoteId: row.quoteId, type: FlagType.OUTSIDE_SAHIHAYN },
    });
  }

  return { applied, unchanged, missing: [...new Set(missing)] };
}
