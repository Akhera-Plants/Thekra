import { HadithGrade, QuoteType, type Prisma } from '@prisma/client';
import { GradePolicy } from '../hadith/grade-policy.js';

/**
 * «مجموعات التذكير»: which texts a set may hold. Plain TypeScript (no decorators), shared by the service and the
 * `reminder-sets:import` command, which loads it with Node's type stripping.
 *
 * Only published Quran verses and sahih/hasan hadith (owner rule: texts from the DB by id, sahih/hasan only). Athar,
 * scholars' words and book excerpts are refused even when published elsewhere.
 */
export const REMINDER_SET_MAX_ITEMS = 60;

export function eligibleQuoteClause(ids: readonly string[]): Prisma.QuoteWhereInput {
  return {
    AND: [
      { id: { in: [...ids] } },
      { isAthar: false },
      {
        OR: [
          { type: QuoteType.QURAN_VERSE },
          { type: QuoteType.HADITH, grade: { in: [HadithGrade.SAHIH, HadithGrade.HASAN] } },
        ],
      },
      GradePolicy.readerClause(),
    ],
  };
}
