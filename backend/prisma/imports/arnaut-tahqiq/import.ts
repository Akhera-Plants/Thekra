/**
 * Publishes a hadith that already sits on an accepted topic when Shu'ayb
 * al-Arna'ut graded the matching narration of Musnad Ahmad or Sahih Ibn Hibban
 * sahih or hasan (his own word, arnaut-grade.ts). Same matching as the Sunan
 * tahqiq; only AUTHORITY_LEGACY rows are touched, athar never.
 *
 * Every change carries Quote.importBatch = ARNAUT_BATCH and an ImportChange row
 * with the previous grade, so `import:book revert-arnaut-tahqiq` undoes it all.
 * A re-run writes nothing when the grades are already in place, and returns a
 * row the corpus no longer supports to its previous grade.
 *
 *   pnpm --filter backend import:book arnaut-tahqiq --dry-run
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GradeSource, HadithGrade } from '@prisma/client';
import { STRONG_MATCH_SCORE, combinedScore, wordOverlap } from '../../../src/common/text/match-score.js';
import { splitMatn } from '../../../src/common/text/matn.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import { arnautArabicGrade, firstClause } from '../../../src/modules/hadith/arnaut-grade.js';
import { ARNAUT_NAME, citesSahihayn } from '../../../src/modules/hadith/sunan-tahqiq.js';
import { applyLimit, type ImportOptions } from '../lib/cli.js';
import { loadCorpus } from '../lib/corpus.js';
import {
  GRADE_FIELDS_SELECT,
  applyBatchChange,
  gradeFieldsOf,
  revertBatch,
  revertQuote,
  type GradeFields,
} from '../lib/import-batch.js';
import { matnWords, proposeIndexes, trigramScores } from '../sunan-tahqiq/import.js';
import { IHSAN_CORPUS, MUSNAD_CORPUS } from './files.js';
import { parseIhsan, parseMusnad } from './parse.js';

export const ARNAUT_BATCH = '2026-10-arnaut-tahqiq';

const REPORT_TSV = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy', 'arnaut-tahqiq-report.tsv');

type Book = 'ahmad' | 'ibnhibban';

const BOOK: Record<Book, { source: GradeSource; reference: (n: number) => string }> = {
  ahmad: { source: GradeSource.AHMAD_TAHQIQ, reference: (n) => `مسند أحمد (ط. قرطبة)، رقم ${n}` },
  ibnhibban: { source: GradeSource.IBN_HIBBAN_TAHQIQ, reference: (n) => `صحيح ابن حبان، رقم ${n}` },
};

interface CorpusRow {
  book: Book;
  number: number;
  grade: HadithGrade;
  verdict: string;
  normalized: string;
  words: string[];
}

interface Hit {
  book: Book;
  number: number;
  grade: HadithGrade;
  verdict: string;
  score: number;
}

export interface ArnautRuling {
  grade: HadithGrade;
  gradeSource: GradeSource;
  gradeReference: string;
  verdicts: string[];
}

/**
 * The stronger accepted grade wins; Musnad Ahmad is cited before Ibn Hibban, at most three
 * numbers per book. A weak hit does not cancel a sahih or hasan one (close narrations differ).
 */
export function decideArnautRuling(hits: readonly Hit[]): ArnautRuling | null {
  if (hits.length === 0) return null;
  const grade = hits.some((hit) => hit.grade === HadithGrade.SAHIH) ? HadithGrade.SAHIH : HadithGrade.HASAN;
  const chosen = hits.filter((hit) => hit.grade === grade);
  const books: Book[] = (['ahmad', 'ibnhibban'] as const).filter((book) => chosen.some((hit) => hit.book === book));
  const references = books.flatMap((book) =>
    [...new Set(chosen.filter((hit) => hit.book === book).map((hit) => hit.number))]
      .sort((a, b) => a - b)
      .slice(0, 3)
      .map((number) => BOOK[book].reference(number)),
  );
  return {
    grade,
    gradeSource: BOOK[books[0]!].source,
    gradeReference: references.join('، '),
    verdicts: [...new Set(chosen.map((hit) => hit.verdict))].sort(),
  };
}

function corpusRows(book: Book, entries: ReturnType<typeof parseMusnad>): CorpusRow[] {
  const rows: CorpusRow[] = [];
  for (const entry of entries) {
    if (!entry.verdict) continue;
    const grade = arnautArabicGrade(entry.verdict);
    if (!grade) continue;
    const normalized = normalizeMatn(splitMatn(entry.text).matnText || entry.text);
    if (normalized.length < 25) continue;
    rows.push({ book, number: entry.number, grade, verdict: firstClause(entry.verdict), normalized, words: matnWords(normalized) });
  }
  return rows;
}

function sameGrade(row: GradeFields, ruling: ArnautRuling): boolean {
  return row.grade === ruling.grade
    && row.gradeSource === ruling.gradeSource
    && row.gradeAuthority === ARNAUT_NAME
    && row.gradeReference === ruling.gradeReference
    && row.importBatch === ARNAUT_BATCH;
}

function tsv(value: string | number): string {
  return String(value).replace(/[\t\n\r]+/g, ' ');
}

export async function runArnautTahqiq(options: ImportOptions): Promise<void> {
  const corpus = [
    ...corpusRows('ahmad', parseMusnad((await loadCorpus(MUSNAD_CORPUS)).text)),
    ...corpusRows('ibnhibban', parseIhsan((await loadCorpus(IHSAN_CORPUS)).text)),
  ];
  console.log(`corpus rows ${corpus.length} (accepted verdicts only)`);

  const postings = new Map<string, number[]>();
  const documentFrequency = new Map<string, number>();
  corpus.forEach((row, index) => {
    for (const word of row.words) {
      const list = postings.get(word);
      if (list) list.push(index);
      else postings.set(word, [index]);
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    }
  });

  const accepted = { some: { reviewStatus: 'ACCEPTED' as const } };
  const stored = await options.prisma.quote.findMany({
    where: {
      type: 'HADITH',
      isAthar: false,
      OR: [
        {
          gradeSource: GradeSource.AUTHORITY_LEGACY,
          OR: [{ sinLinks: accepted }, { goodDeedLinks: accepted }, { imanBranchLinks: accepted }],
        },
        { importBatch: ARNAUT_BATCH },
      ],
    },
    select: { id: true, textAr: true, matnAr: true, ...GRADE_FIELDS_SELECT },
  });
  const quotes = applyLimit(stored, options.limit).map((row) => ({
    ...row,
    matn: normalizeMatn((row.matnAr && row.matnAr.trim()) || splitMatn(row.textAr).matnText || row.textAr),
  }));
  console.log(`candidate quotes ${quotes.length}`);

  // A narration the Sahihayn pipeline already matched (or the author cites) is graded there, not here.
  const sahihaynQuoteIds = new Set((quotes.length === 0
    ? []
    : await options.prisma.hadithMatch.findMany({
      where: {
        quoteId: { in: quotes.map((quote) => quote.id) },
        decision: { not: 'REJECTED' },
        OR: [{ score: { gte: STRONG_MATCH_SCORE } }, { decision: 'CONFIRMED' }],
      },
      select: { quoteId: true },
    })).map((row) => row.quoteId));

  const pendingPairs: Array<{ quoteId: string; corpusIndex: number; left: string; right: string }> = [];
  for (const quote of quotes) {
    if (quote.matn.length < 25) continue;
    for (const index of proposeIndexes(matnWords(quote.matn), postings, documentFrequency)) {
      const row = corpus[index];
      if (!row || wordOverlap(quote.matn, row.normalized) < 0.5) continue;
      pendingPairs.push({ quoteId: quote.id, corpusIndex: index, left: quote.matn, right: row.normalized });
    }
  }
  console.log(`scoring ${pendingPairs.length} pairs`);
  const trgm = await trigramScores(options.prisma, pendingPairs);

  const hitsByQuote = new Map<string, Hit[]>();
  for (const pair of pendingPairs) {
    const row = corpus[pair.corpusIndex]!;
    const score = combinedScore(trgm.get(`${pair.quoteId}:${pair.corpusIndex}`) ?? 0, wordOverlap(pair.left, pair.right));
    if (score < STRONG_MATCH_SCORE) continue;
    const list = hitsByQuote.get(pair.quoteId) ?? [];
    list.push({ book: row.book, number: row.number, grade: row.grade, verdict: row.verdict, score });
    hitsByQuote.set(pair.quoteId, list);
  }

  const publish: Array<{ quote: (typeof quotes)[number]; ruling: ArnautRuling; score: number }> = [];
  for (const quote of quotes) {
    const hits = hitsByQuote.get(quote.id) ?? [];
    if (hits.length === 0 || sahihaynQuoteIds.has(quote.id) || citesSahihayn(quote.textAr)) continue;
    const ruling = decideArnautRuling(hits);
    if (ruling) publish.push({ quote, ruling, score: Math.max(...hits.map((hit) => hit.score)) });
  }
  const publishIds = new Set(publish.map((row) => row.quote.id));
  const stale = quotes.filter((quote) => quote.importBatch === ARNAUT_BATCH && !publishIds.has(quote.id));

  let graded = 0;
  let unchanged = 0;
  let reverted = 0;
  if (!options.dryRun) {
    for (const row of publish) {
      const before = gradeFieldsOf(row.quote);
      if (sameGrade(before, row.ruling)) {
        unchanged += 1;
        continue;
      }
      await applyBatchChange(options.prisma, ARNAUT_BATCH, row.quote.id, before, {
        grade: row.ruling.grade,
        gradeSource: row.ruling.gradeSource,
        gradeAuthority: ARNAUT_NAME,
        gradeReference: row.ruling.gradeReference,
        // The grade it had before (al-Albani, an editor…) stays stored and hidden, as for the Sunan.
        legacyGrade: before.legacyGrade ?? before.grade,
        legacyGradeAuthority: before.legacyGradeAuthority ?? before.gradeAuthority,
        legacyGradeReference: before.legacyGradeReference ?? before.gradeReference,
        importBatch: ARNAUT_BATCH,
      });
      graded += 1;
    }
    for (const quote of stale) {
      if (await revertQuote(options.prisma, ARNAUT_BATCH, quote.id)) reverted += 1;
    }
  }

  // One line per published narration, for the sheikh to review (committed with the code).
  mkdirSync(dirname(REPORT_TSV), { recursive: true });
  writeFileSync(REPORT_TSV, [
    'quote_id\tgrade\tsource\treference\tverdict\tscore\ttext',
    ...publish
      .toSorted((a, b) => a.quote.id.localeCompare(b.quote.id))
      .map((row) => [
        row.quote.id,
        row.ruling.grade,
        row.ruling.gradeSource,
        row.ruling.gradeReference,
        row.ruling.verdicts.join(' | '),
        row.score.toFixed(3),
        row.quote.matn.slice(0, 160),
      ].map(tsv).join('\t')),
  ].join('\n') + '\n');

  const bySource: Record<string, number> = {};
  const byGrade: Record<string, number> = {};
  for (const row of publish) {
    bySource[row.ruling.gradeSource] = (bySource[row.ruling.gradeSource] ?? 0) + 1;
    byGrade[row.ruling.grade] = (byGrade[row.ruling.grade] ?? 0) + 1;
  }
  console.log(JSON.stringify({
    dryRun: options.dryRun,
    batch: ARNAUT_BATCH,
    corpus: corpus.length,
    candidates: quotes.length,
    publish: publish.length,
    bySource,
    byGrade,
    graded,
    unchanged,
    stale: stale.length,
    reverted,
    report: REPORT_TSV,
  }, null, 2));
}

/** `import:book revert-arnaut-tahqiq`: every quote of the batch back to its previous grade. */
export async function runRevertArnautTahqiq(options: ImportOptions): Promise<void> {
  const restored = await revertBatch(options.prisma, ARNAUT_BATCH, options.dryRun);
  console.log(JSON.stringify({ dryRun: options.dryRun, batch: ARNAUT_BATCH, restored }));
}
