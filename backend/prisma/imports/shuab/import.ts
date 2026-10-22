/**
 * Imports «الجامع لشعب الإيمان» (ط الرشد): the 77 branches as ImanBranch rows and
 * every narration as an UNGRADED Quote, linked ACCEPTED to the branch the author
 * placed it under (owner rule: the book's own structure is the classification).
 */
import { ClassifiedBy, HadithGrade, LinkBasis, LinkReviewStatus, type Prisma } from '@prisma/client';
import { splitMatn } from '../../../src/common/text/matn.js';
import { inTransactionBatches } from '../lib/batch.js';
import { applyLimit, pickRandom, preview, type ImportOptions } from '../lib/cli.js';
import { loadCorpus, provenanceOf, type CorpusSpec } from '../lib/corpus.js';
import { assertArabicText } from '../lib/guard.js';
import { upsertBookQuotes, type BookQuoteRow } from '../lib/quotes.js';
import { formatSummary, recordProgress, withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import { parseShuab, type ShuabBranch, type ShuabNarration } from './parse.js';

const SHUAB_CORPUS: CorpusSpec = {
  repo: '0475AH',
  path: 'data/0458Bayhaqi/0458Bayhaqi.ShucabIman/0458Bayhaqi.ShucabIman.Shamela0010660-ara1',
  commit: 'bb5632fa192ccdc3c0de8cd640faac9ac0415ed1',
  sha256: '5a341285c1c80829b31f8f7c7a383b5e41ede103a5075544261d76b1e2755654',
};

const EDITION = 'rushd';
const LINK_RELEVANCE = 50;

function shuabExternalId(narration: Pick<ShuabNarration, 'number' | 'occurrence'>): string {
  return narration.occurrence === 1
    ? `${EDITION}:${narration.number}`
    : `${EDITION}:${narration.number}-${narration.occurrence}`;
}

function branchSourceReference(branch: ShuabBranch): string {
  const volume = branch.volume === null ? '' : `ج${branch.volume}`;
  const page = branch.page === null ? '' : ` ص${branch.page}`;
  return `${volume}${page} — ${branch.headingText}`.trim();
}

export async function runShuabImport({ prisma, dryRun, limit }: ImportOptions): Promise<void> {
  const work = approvedWork('book:shuab-iman');
  const corpus = await loadCorpus(SHUAB_CORPUS);
  const parsed = parseShuab(corpus.text);
  const guard = assertArabicText(parsed.narrations.map((narration) => narration.textAr));
  const narrations = applyLimit(parsed.narrations, limit);

  console.log(`corpus ${corpus.versionUri}@${SHUAB_CORPUS.commit}`);
  console.log(
    `parsed: ${parsed.narrations.length} narrations, ${parsed.branches.length}/77 branches` +
      ` (unlocated: ${parsed.unlocatedBranches.join(', ') || 'none'}), Arabic ratio ${guard.ratio.toFixed(4)}`,
  );
  console.log(
    `numbers: missing=${parsed.missingNumbers.length} repaired=${parsed.repairs.length}` +
      ` repeated=${parsed.repeatedNumbers.join(',') || 'none'} pageUnknown=${parsed.pageUnknown.join(',') || 'none'}`,
  );
  console.log(`narrations before branch 1 (no link): ${parsed.narrations.filter((n) => n.branchNumber === null).length}`);

  if (dryRun) {
    for (const branch of parsed.branches) {
      console.log(`  branch ${branch.number}: ${branch.titleAr}${branch.reviewNotes.length ? `  [${branch.reviewNotes.join('; ')}]` : ''}`);
    }
    console.log('sample:');
    for (const narration of pickRandom(narrations, 5)) {
      console.log(
        `  #${narration.number} ج${narration.volume ?? '?'} ص${narration.page ?? '?'} branch=${narration.branchNumber ?? '-'} | ${preview(narration.textAr)}`,
      );
    }
    console.log('dry run: nothing written');
    return;
  }

  await ensureSource(prisma, work);
  const provenance = provenanceOf(corpus);

  await withRunLog(prisma, work.id, async (runId) => {
    const branchCounts = await upsertBranches(prisma, parsed.branches, work.id);
    const branchIds = new Map(
      (await prisma.imanBranch.findMany({ select: { id: true, number: true } })).map((branch) => [branch.number, branch.id]),
    );

    const counts = { quotesCreated: 0, quotesUpdated: 0, gradeKept: 0, linksCreated: 0, linksExisting: 0 };
    await inTransactionBatches(
      prisma,
      narrations,
      async (tx, batch) => {
        const rows = batch.map((narration) => toQuoteRow(narration, work.id, work.bookKey, provenance));
        const outcome = await upsertBookQuotes(tx, rows);
        counts.quotesCreated += outcome.created;
        counts.quotesUpdated += outcome.updated;
        counts.gradeKept += outcome.gradeKept;
        const linkCounts = await upsertBranchLinks(tx, batch, outcome.ids, branchIds);
        counts.linksCreated += linkCounts.created;
        counts.linksExisting += linkCounts.existing;
      },
      (written) => recordProgress(prisma, runId, written),
    );

    const { applyBranchTitlesEn } = await import('./branch-titles-en.js');
    const titlesEn = await applyBranchTitlesEn(prisma);

    const allCounts = { ...branchCounts, ...counts, titlesEnUpdated: titlesEn.updated };
    const summary = formatSummary(allCounts, [corpus]);
    console.log(summary);
    return { recordsImported: counts.quotesCreated + counts.quotesUpdated, summary };
  });
}

function toQuoteRow(
  narration: ShuabNarration,
  sourceId: string,
  apiProvider: string,
  provenance: ReturnType<typeof provenanceOf>,
): BookQuoteRow {
  const { matnText } = splitMatn(narration.textAr);
  const matnAr = matnText.trim() || narration.textAr;
  const rawPayload: Prisma.InputJsonObject = {
    ...provenance,
    fullTextAr: narration.textAr,
    chapterTitle: narration.chapterTitle,
    branchNumber: narration.branchNumber,
    corpusLine: narration.line,
    ...(narration.corpusNumber !== narration.number ? { corpusHeadingNumber: narration.corpusNumber } : {}),
    ...(narration.occurrence > 1 ? { occurrence: narration.occurrence } : {}),
  };
  return {
    apiProvider,
    externalId: shuabExternalId(narration),
    sourceId,
    textAr: narration.textAr,
    matnAr,
    referenceNumber: narration.number,
    volume: narration.volume === null ? null : String(narration.volume),
    page: narration.page === null ? null : String(narration.page),
    grade: HadithGrade.UNGRADED,
    gradeAuthority: null,
    gradeReference: null,
    rawPayload,
  };
}

async function upsertBranches(
  prisma: ImportOptions['prisma'],
  branches: readonly ShuabBranch[],
  sourceId: string,
): Promise<{ branchesCreated: number; branchesUpdated: number }> {
  const existing = new Set((await prisma.imanBranch.findMany({ select: { number: true } })).map((row) => row.number));
  let branchesCreated = 0;
  for (const branch of branches) {
    // Importer-owned: the verbatim title and its citation. English title and summaries stay the owner's.
    const fields = { titleAr: branch.titleAr, sourceId, sourceReference: branchSourceReference(branch) };
    await prisma.imanBranch.upsert({
      where: { number: branch.number },
      create: { number: branch.number, ...fields },
      update: fields,
    });
    if (!existing.has(branch.number)) branchesCreated += 1;
  }
  return { branchesCreated, branchesUpdated: branches.length - branchesCreated };
}

async function upsertBranchLinks(
  tx: Prisma.TransactionClient,
  narrations: readonly ShuabNarration[],
  quoteIds: ReadonlyMap<string, string>,
  branchIds: ReadonlyMap<number, string>,
): Promise<{ created: number; existing: number }> {
  const links = narrations.flatMap((narration) => {
    const quoteId = quoteIds.get(shuabExternalId(narration));
    const imanBranchId = narration.branchNumber === null ? undefined : branchIds.get(narration.branchNumber);
    return quoteId && imanBranchId ? [{ quoteId, imanBranchId, branchNumber: narration.branchNumber }] : [];
  });
  const already = await tx.imanBranchQuote.findMany({
    where: { quoteId: { in: links.map((link) => link.quoteId) } },
    select: { quoteId: true, imanBranchId: true },
  });
  const known = new Set(already.map((link) => `${link.imanBranchId}|${link.quoteId}`));
  let created = 0;
  for (const link of links) {
    await tx.imanBranchQuote.upsert({
      where: { imanBranchId_quoteId: { imanBranchId: link.imanBranchId, quoteId: link.quoteId } },
      create: {
        imanBranchId: link.imanBranchId,
        quoteId: link.quoteId,
        relevanceScore: LINK_RELEVANCE,
        note: `من الشعبة ${link.branchNumber} في الكتاب`,
        reviewStatus: LinkReviewStatus.ACCEPTED,
        basis: LinkBasis.CHAPTER,
        classifiedBy: ClassifiedBy.BOOK,
      },
      // A curator may have re-scored, re-noted or rejected the link: never overwrite it.
      update: {},
    });
    if (!known.has(`${link.imanBranchId}|${link.quoteId}`)) created += 1;
  }
  return { created, existing: links.length - created };
}
