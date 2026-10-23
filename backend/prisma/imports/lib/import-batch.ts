/**
 * Import batches: every quote a batch changes carries `Quote.importBatch`, and
 * `ImportChange` keeps the grade fields it replaced. `revertBatch` puts them
 * back and clears the batch, so a doubtful import can be undone in one step.
 */
import { Prisma, type GradeSource, type HadithGrade, type PrismaClient } from '@prisma/client';

/** The fields a grading batch may change, as stored before and after. */
export interface GradeFields {
  grade: HadithGrade | null;
  gradeSource: GradeSource;
  gradeAuthority: string | null;
  gradeReference: string | null;
  legacyGrade: HadithGrade | null;
  legacyGradeAuthority: string | null;
  legacyGradeReference: string | null;
  importBatch: string | null;
}

export const GRADE_FIELDS_SELECT = {
  grade: true,
  gradeSource: true,
  gradeAuthority: true,
  gradeReference: true,
  legacyGrade: true,
  legacyGradeAuthority: true,
  legacyGradeReference: true,
  importBatch: true,
} as const;

export function gradeFieldsOf(row: GradeFields): GradeFields {
  return {
    grade: row.grade,
    gradeSource: row.gradeSource,
    gradeAuthority: row.gradeAuthority,
    gradeReference: row.gradeReference,
    legacyGrade: row.legacyGrade,
    legacyGradeAuthority: row.legacyGradeAuthority,
    legacyGradeReference: row.legacyGradeReference,
    importBatch: row.importBatch,
  };
}

/**
 * Write `after` to the quote and record the change. The first `before` of a quote in a batch is
 * kept on later runs, so a revert always returns to the state before the batch ever touched it.
 */
export async function applyBatchChange(
  prisma: PrismaClient,
  batch: string,
  quoteId: string,
  before: GradeFields,
  after: GradeFields,
): Promise<void> {
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { ...after } }),
    prisma.importChange.upsert({
      where: { batch_quoteId: { batch, quoteId } },
      create: {
        batch,
        quoteId,
        before: before as unknown as Prisma.InputJsonObject,
        after: after as unknown as Prisma.InputJsonObject,
      },
      update: { after: after as unknown as Prisma.InputJsonObject },
    }),
  ]);
}

/** Restore one quote to its state before the batch and forget the change. */
export async function revertQuote(prisma: PrismaClient, batch: string, quoteId: string): Promise<boolean> {
  const change = await prisma.importChange.findUnique({ where: { batch_quoteId: { batch, quoteId } } });
  if (!change) return false;
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { ...(change.before as unknown as GradeFields) } }),
    prisma.importChange.delete({ where: { id: change.id } }),
  ]);
  return true;
}

/** Undo a whole batch. Returns how many quotes were restored. */
export async function revertBatch(prisma: PrismaClient, batch: string, dryRun: boolean): Promise<number> {
  const changes = await prisma.importChange.findMany({ where: { batch }, select: { quoteId: true } });
  if (dryRun) return changes.length;
  let restored = 0;
  for (const change of changes) {
    if (await revertQuote(prisma, batch, change.quoteId)) restored += 1;
  }
  return restored;
}
