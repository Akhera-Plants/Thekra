/**
 * Shared Quote upsert for book importers (vision v2 §5.3–5.4, owner decision V9 = A):
 * `origin = LOCAL`, keyed on `@@unique([apiProvider, externalId])` with a
 * `book:`-namespaced provider.
 *
 * Re-import never destroys curation: `narrator` is never written, and the grade
 * fields are written only while the row is still ungraded by anyone
 * (grade null, or UNGRADED with no gradeAuthority).
 */
import { HadithGrade, QuoteOrigin, QuoteType, TextSource, type Prisma } from '@prisma/client';

export interface BookQuoteRow {
  apiProvider: string;
  externalId: string;
  sourceId: string;
  textAr: string;
  /** Matn only when the importer stripped an isnad. */
  matnAr?: string | null;
  referenceNumber: number | null;
  referenceLabel?: string | null;
  volume: string | null;
  page: string | null;
  grade: HadithGrade;
  gradeAuthority: string | null;
  gradeReference: string | null;
  rawPayload: Prisma.InputJsonValue;
  /** OpenITI rows are DIGITAL. Waqfeya OCR rows pass OCR. Re-import never writes textVerifiedAt. */
  textSource?: TextSource;
  /** Book prose is a BOOK_EXCERPT. Narrations stay HADITH. */
  type?: QuoteType;
  isAthar?: boolean;
  atharSpeakerKey?: string | null;
}

export interface UpsertOutcome {
  /** externalId → Quote.id */
  ids: Map<string, string>;
  created: number;
  updated: number;
  /** Rows whose existing curator grade was left untouched. */
  gradeKept: number;
}

function isGradeWritable(existing: { grade: HadithGrade | null; gradeAuthority: string | null }): boolean {
  return existing.grade === null || (existing.grade === HadithGrade.UNGRADED && existing.gradeAuthority === null);
}

export async function upsertBookQuotes(
  tx: Prisma.TransactionClient,
  rows: readonly BookQuoteRow[],
): Promise<UpsertOutcome> {
  const outcome: UpsertOutcome = { ids: new Map(), created: 0, updated: 0, gradeKept: 0 };
  const providers = [...new Set(rows.map((row) => row.apiProvider))];
  const existingRows = await tx.quote.findMany({
    where: { apiProvider: { in: providers }, externalId: { in: rows.map((row) => row.externalId) } },
    select: { apiProvider: true, externalId: true, grade: true, gradeAuthority: true },
  });
  const existing = new Map(existingRows.map((row) => [`${row.apiProvider}|${row.externalId}`, row]));

  for (const row of rows) {
    const previous = existing.get(`${row.apiProvider}|${row.externalId}`);
    const gradeFields = { grade: row.grade, gradeAuthority: row.gradeAuthority, gradeReference: row.gradeReference };
    const importerFields = {
      type: row.type ?? QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr: row.textAr,
      matnAr: row.matnAr ?? null,
      isAthar: row.isAthar ?? false,
      atharSpeakerKey: row.atharSpeakerKey ?? null,
      sourceId: row.sourceId,
      referenceNumber: row.referenceNumber,
      referenceLabel: row.referenceLabel ?? null,
      volume: row.volume,
      page: row.page,
      rawPayload: row.rawPayload,
      textSource: row.textSource ?? TextSource.DIGITAL,
    };
    const writeGrade = !previous || isGradeWritable(previous);
    if (previous && !writeGrade) outcome.gradeKept += 1;

    const saved = await tx.quote.upsert({
      where: { apiProvider_externalId: { apiProvider: row.apiProvider, externalId: row.externalId } },
      create: { ...importerFields, ...gradeFields, apiProvider: row.apiProvider, externalId: row.externalId },
      update: writeGrade ? { ...importerFields, ...gradeFields } : importerFields,
      select: { id: true },
    });
    outcome.ids.set(row.externalId, saved.id);
    if (previous) outcome.updated += 1;
    else outcome.created += 1;
  }
  return outcome;
}
