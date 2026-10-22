/**
 * Imports «الأدب المفرد» (ت عبد الباقي) narrations, graded per narration from
 * al-Albani's Sahih / Da'if split — only where the entry's original number is
 * confirmed by its text — and suggests chapter → sin/deed maps (reviewed = false).
 * Never writes SinQuote / GoodDeedQuote.
 */
import { ChapterMapTarget, HadithGrade, type Prisma, type PrismaClient } from '@prisma/client';
import { inTransactionBatches } from '../lib/batch.js';
import { applyLimit, pickRandom, preview, type ImportOptions } from '../lib/cli.js';
import { loadCorpus, provenanceOf, type CorpusFile, type CorpusSpec } from '../lib/corpus.js';
import { assertArabicText } from '../lib/guard.js';
import { upsertBookQuotes, type BookQuoteRow } from '../lib/quotes.js';
import { formatSummary, recordProgress, withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import {
  adabExternalId,
  gradeClassOf,
  gradeFromRuling,
  isAcceptanceDispute,
  matchChapterTitle,
  overlapScore,
  parseAdabMufrad,
  parseAlbaniSplit,
  resolveGrade,
  verifyAlbaniEntries,
  type AdabChapter,
  type AdabNarration,
  type AlbaniEntry,
  type NamedEntity,
  type ResolvedGrade,
  type VerifiedEntry,
} from './parse.js';

const ADAB_CORPUS: CorpusSpec = {
  repo: '0275AH',
  path: 'data/0256Bukhari/0256Bukhari.AdabMufrad/0256Bukhari.AdabMufrad.Shamela0012991-ara1',
  commit: '47dfd28db9e158c7101c7df1162d4dc99bb70303',
  sha256: 'f0e9b0abb516b935a0185886a0c435fc87f3f8110753212517d9b9f87d553514',
};

const ALBANI_SAHIH_CORPUS: CorpusSpec = {
  repo: '1425AH',
  path: 'data/1420MuhammadNasirDinAlbani/1420MuhammadNasirDinAlbani.SahihAdabMufrad/1420MuhammadNasirDinAlbani.SahihAdabMufrad.Shamela0001341-ara1',
  commit: 'de4dd4fced3776f61738ceca2d9c89c4ae5f49af',
  sha256: 'ef658e6685c26b950fa306a3bf1c210a62dbffb7309e10d56242a5ed5abf6aae',
};

const ALBANI_DAIF_CORPUS: CorpusSpec = {
  repo: '1425AH',
  path: 'data/1420MuhammadNasirDinAlbani/1420MuhammadNasirDinAlbani.DacifAdabMufrad/1420MuhammadNasirDinAlbani.DacifAdabMufrad.Shamela0001346-ara1',
  commit: 'de4dd4fced3776f61738ceca2d9c89c4ae5f49af',
  sha256: '2c9c8eb7af72bf3d526fd42f7ac45d28f5cd09aebcd3f8ea43806bb4e457832c',
};

const GRADE_AUTHORITY = 'الألباني';
/** Above this share of unconfirmed Albani numbers, no grade is applied at all. */
const MAX_UNCONFIRMED_NUMBER_RATE = 0.02;
/** An unconfirmed entry whose text is clearly elsewhere (score ≥ this) has a wrong number. */
const WRONG_NUMBER_SCORE = 0.9;

interface GradePlan {
  grades: Map<string, ResolvedGrade>;
  /** Narrations whose split grade and printed ruling disagree on acceptance (left UNGRADED). */
  disputed: Set<string>;
  verified: VerifiedEntry[];
  wrongNumberRate: number;
  gradesApplied: boolean;
}

export async function runAdabMufradImport({ prisma, dryRun, limit }: ImportOptions): Promise<void> {
  const work = approvedWork('book:adab-al-mufrad');
  const [text, sahihFile, daifFile] = await Promise.all([
    loadCorpus(ADAB_CORPUS),
    loadCorpus(ALBANI_SAHIH_CORPUS),
    loadCorpus(ALBANI_DAIF_CORPUS),
  ]);
  const parsed = parseAdabMufrad(text.text);
  const guard = assertArabicText(parsed.narrations.map((narration) => narration.textAr));
  const sahih = parseAlbaniSplit(sahihFile.text, 'sahih');
  const daif = parseAlbaniSplit(daifFile.text, 'daif');
  const plan = planGrades([...sahih.entries, ...daif.entries], parsed.narrations);
  const narrations = applyLimit(parsed.narrations, limit);

  printParseReport(parsed, sahih.entries.length, daif.entries.length, [...sahih.unparsed, ...daif.unparsed].length, plan);
  console.log(`Arabic ratio ${guard.ratio.toFixed(4)}`);

  if (dryRun) {
    console.log('sample:');
    for (const narration of pickRandom(narrations, 5)) {
      const grade = plan.grades.get(adabExternalId(narration));
      console.log(
        `  #${narration.number} ص${narration.page ?? '?'} ${grade?.grade ?? HadithGrade.UNGRADED} (${grade?.gradeReference ?? '-'}) | ${preview(narration.textAr)}`,
      );
    }
    console.log('dry run: nothing written');
    return;
  }

  await ensureSource(prisma, work);
  const corpora = [text, sahihFile, daifFile];

  await withRunLog(prisma, work.id, async (runId) => {
    const counts = { quotesCreated: 0, quotesUpdated: 0, gradeKept: 0, chapterMapsCreated: 0, chapterMapsExisting: 0 };
    await inTransactionBatches(
      prisma,
      narrations,
      async (tx, batch) => {
        const rows = batch.map((narration) => toQuoteRow(narration, plan, work.id, work.bookKey, corpora));
        const outcome = await upsertBookQuotes(tx, rows);
        counts.quotesCreated += outcome.created;
        counts.quotesUpdated += outcome.updated;
        counts.gradeKept += outcome.gradeKept;
      },
      (written) => recordProgress(prisma, runId, written),
    );

    const chapters = limit === null ? parsed.chapters : parsed.chapters.filter((chapter) => narrations.some((n) => n.chapterKey === chapter.key));
    const mapCounts = await upsertChapterMaps(prisma, chapters, work.id);
    counts.chapterMapsCreated = mapCounts.created;
    counts.chapterMapsExisting = mapCounts.existing;

    const summary = formatSummary(counts, corpora);
    console.log(summary);
    return { recordsImported: counts.quotesCreated + counts.quotesUpdated, summary };
  });
}

function planGrades(entries: readonly AlbaniEntry[], narrations: readonly AdabNarration[]): GradePlan {
  const verified = verifyAlbaniEntries(entries, narrations);
  const wrongNumbers = verified.filter(
    (item) => item.externalId === null && item.score < WRONG_NUMBER_SCORE && bestScoreElsewhere(item, narrations) >= WRONG_NUMBER_SCORE,
  ).length;
  const wrongNumberRate = verified.length === 0 ? 1 : wrongNumbers / verified.length;
  const gradesApplied = wrongNumberRate <= MAX_UNCONFIRMED_NUMBER_RATE;

  const byNarration = new Map<string, AlbaniEntry[]>();
  for (const item of verified) {
    if (!item.externalId) continue;
    byNarration.set(item.externalId, [...(byNarration.get(item.externalId) ?? []), item.entry]);
  }
  const embedded = new Map(narrations.map((narration) => [adabExternalId(narration), narration.embeddedRuling]));
  const grades = new Map<string, ResolvedGrade>();
  const disputed = new Set<string>();
  if (gradesApplied) {
    for (const [externalId, list] of byNarration) {
      const resolved = resolveGrade(list);
      if (isAcceptanceDispute(resolved.grade, embedded.get(externalId) ?? null)) {
        disputed.add(externalId);
        grades.set(externalId, { ...resolved, grade: HadithGrade.UNGRADED, gradeReference: null });
      } else {
        grades.set(externalId, resolved);
      }
    }
  }
  return { grades, disputed, verified, wrongNumberRate, gradesApplied };
}

function bestScoreElsewhere(item: VerifiedEntry, narrations: readonly AdabNarration[]): number {
  let best = 0;
  for (const narration of narrations) {
    if (narration.number !== item.entry.originalNumber) best = Math.max(best, overlapScore(item.entry.text, narration.textAr));
  }
  return best;
}

function toQuoteRow(
  narration: AdabNarration,
  plan: GradePlan,
  sourceId: string,
  apiProvider: string,
  corpora: readonly CorpusFile[],
): BookQuoteRow {
  const [text, sahih, daif] = corpora as [CorpusFile, CorpusFile, CorpusFile];
  const externalId = adabExternalId(narration);
  const resolved = plan.grades.get(externalId);
  const graded = resolved !== undefined && resolved.grade !== HadithGrade.UNGRADED;
  const rawPayload: Prisma.InputJsonObject = {
    ...provenanceOf(text),
    chapterTitle: narration.chapterTitle,
    chapterKey: narration.chapterKey,
    corpusLine: narration.line,
    ...(narration.occurrence > 1 ? { occurrence: narration.occurrence } : {}),
    embeddedAlbaniRuling: narration.embeddedRuling,
    albani: (resolved?.entries ?? []).map((entry) => ({
      book: entry.book,
      number: entry.albaniLabel,
      ruling: entry.ruling,
      ...provenanceOf(entry.book === 'sahih' ? sahih : daif),
    })),
    ...(resolved?.conflict ? { gradeConflict: "listed in both the Sahih and the Da'if book" } : {}),
    ...(plan.disputed.has(externalId) ? { gradeConflict: 'split grade and printed ruling disagree on acceptance' } : {}),
  };
  return {
    apiProvider,
    externalId,
    sourceId,
    textAr: narration.textAr,
    referenceNumber: narration.number,
    volume: null,
    page: narration.page === null ? null : String(narration.page),
    grade: graded ? resolved.grade : HadithGrade.UNGRADED,
    gradeAuthority: graded ? GRADE_AUTHORITY : null,
    gradeReference: graded ? resolved.gradeReference : null,
    rawPayload,
  };
}

async function loadEntities(prisma: PrismaClient): Promise<NamedEntity[]> {
  // Test fixtures (slug test-*) are not real vocabulary.
  const where = { NOT: { slug: { startsWith: 'test-' } } };
  const [sins, deeds] = await Promise.all([
    prisma.sin.findMany({ where, select: { id: true, slug: true, nameAr: true } }),
    prisma.goodDeed.findMany({ where, select: { id: true, slug: true, nameAr: true } }),
  ]);
  return [
    ...sins.map((sin) => ({ ...sin, kind: 'SIN' as const })),
    ...deeds.map((deed) => ({ ...deed, kind: 'GOOD_DEED' as const })),
  ];
}

/** ChapterEntityMap has no unique key: find-or-create on (source, chapter, target). */
async function upsertChapterMaps(
  prisma: PrismaClient,
  chapters: readonly AdabChapter[],
  sourceId: string,
): Promise<{ created: number; existing: number }> {
  const entities = await loadEntities(prisma);
  let created = 0;
  let existing = 0;
  for (const chapter of chapters) {
    for (const match of matchChapterTitle(chapter.titleAr, entities)) {
      if (match.kind !== 'match') continue;
      const target =
        match.entity.kind === 'SIN'
          ? { targetType: ChapterMapTarget.SIN, sinId: match.entity.id }
          : { targetType: ChapterMapTarget.GOOD_DEED, goodDeedId: match.entity.id };
      const found = await prisma.chapterEntityMap.findFirst({ where: { sourceId, chapterKey: chapter.key, ...target } });
      if (found) {
        existing += 1;
        continue;
      }
      await prisma.chapterEntityMap.create({
        data: { sourceId, chapterKey: chapter.key, chapterTitleAr: chapter.titleAr, reviewed: false, ...target },
      });
      created += 1;
    }
  }
  return { created, existing };
}

function printParseReport(
  parsed: ReturnType<typeof parseAdabMufrad>,
  sahihCount: number,
  daifCount: number,
  unparsedCount: number,
  plan: GradePlan,
): void {
  const confirmed = plan.verified.filter((item) => item.externalId !== null).length;
  console.log(
    `parsed: ${parsed.narrations.length} narrations, ${parsed.chapters.length} chapters,` +
      ` missing=${parsed.missingNumbers.join(',') || 'none'} repeated=${parsed.repeatedNumbers.length}`,
  );
  console.log(
    `albani: sahih=${sahihCount} daif=${daifCount} unparsed=${unparsedCount};` +
      ` numbers confirmed by text=${confirmed}/${plan.verified.length};` +
      ` wrong-number rate=${(plan.wrongNumberRate * 100).toFixed(2)}% → grades ${plan.gradesApplied ? 'APPLIED' : 'NOT APPLIED'}`,
  );
  const breakdown = new Map<string, number>();
  let agree = 0;
  let disagree = 0;
  for (const narration of parsed.narrations) {
    const resolved = plan.grades.get(adabExternalId(narration));
    const grade = resolved?.grade ?? HadithGrade.UNGRADED;
    breakdown.set(grade, (breakdown.get(grade) ?? 0) + 1);
    const embedded = gradeClassOf(narration.embeddedRuling);
    if (grade !== HadithGrade.UNGRADED && embedded) {
      if (embedded === grade) agree += 1;
      else disagree += 1;
    }
  }
  console.log(`grades: ${[...breakdown].map(([grade, count]) => `${grade}=${count}`).join(' ')}`);
  const conflicts = [...plan.grades.values()].filter((grade) => grade.conflict).length;
  console.log(
    `cross-check with rulings printed in the Abd al-Baqi file: agree=${agree} disagree(sahih/hasan only)=${disagree}` +
      ` acceptance-disputes→UNGRADED=${plan.disputed.size}; in both books→UNGRADED=${conflicts}`,
  );
  const bases = new Map<string, number>();
  for (const item of plan.verified) {
    if (!item.externalId) continue;
    const basis = gradeFromRuling(item.entry.book, item.entry.ruling).basis;
    bases.set(basis, (bases.get(basis) ?? 0) + 1);
  }
  console.log(`entry basis (confirmed entries): ${[...bases].map(([basis, count]) => `${basis}=${count}`).join(' ')}`);
}
