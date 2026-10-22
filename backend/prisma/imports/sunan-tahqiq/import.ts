/**
 * Publishes a hadith that already sits on an accepted topic when Shu'ayb
 * al-Arna'ut graded that narration sahih or hasan.
 * Sahihayn and manual grades are left alone. A low OUTSIDE_SAHIHAYN flag
 * marks the row as outside the two Sahihs. Re-running writes nothing when
 * the grade and the flag are already in place. Never stamps textVerifiedAt.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  FlagSeverity,
  FlagType,
  GradeSource,
  HadithGrade,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { STRONG_MATCH_SCORE, combinedScore, wordOverlap } from '../../../src/common/text/match-score.js';
import { splitMatn } from '../../../src/common/text/matn.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import { clearUnapprovedOcrVerification } from '../lib/ocr-gate.js';
import {
  OUTSIDE_SAHIHAYN_NOTE,
  SUNAN_SCHOLAR_NAMES,
  citesSahihayn,
  decideSunanRuling,
  type SunanBookKey,
  type SunanHit,
  type SunanRuling,
  type SunanScholarKey,
} from '../../../src/modules/hadith/sunan-tahqiq.js';
import { applyLimit, type ImportOptions } from '../lib/cli.js';
import { SUNAN_EDITIONS, editionUrl } from './files.js';

const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/sunan-tahqiq');

interface EditionHadith {
  hadithnumber: number;
  text: string;
  grades?: Array<{ name?: string; grade?: string }>;
}

interface CorpusRow {
  book: SunanBookKey;
  number: number;
  scholar: SunanScholarKey;
  rawGrade: string;
  normalized: string;
  words: string[];
}

interface QuoteRow {
  id: string;
  textAr: string;
  grade: HadithGrade | null;
  gradeSource: GradeSource;
  gradeAuthority: string | null;
  gradeReference: string | null;
  legacyGrade: HadithGrade | null;
  legacyGradeAuthority: string | null;
  legacyGradeReference: string | null;
  textSource: string;
  textVerifiedAt: Date | null;
  sourceNameAr: string | null;
  matn: string;
}

interface FlagRow {
  id: string;
  quoteId: string;
  status: string;
  note: string | null;
  details: Prisma.JsonValue;
}

function matnWords(text: string): string[] {
  return [...new Set(text.split(/\s+/).filter((word) => word.length >= 3))];
}

function proposeIndexes(
  words: readonly string[],
  postings: ReadonlyMap<string, number[]>,
  documentFrequency: ReadonlyMap<string, number>,
): number[] {
  const rare = [...words]
    .sort((a, b) => (documentFrequency.get(a) ?? 1_000_000) - (documentFrequency.get(b) ?? 1_000_000))
    .slice(0, 5);
  const hits = new Map<number, number>();
  for (const word of rare) {
    const list = postings.get(word);
    if (!list || list.length > 500) continue;
    for (const index of list) hits.set(index, (hits.get(index) ?? 0) + 1);
  }
  if (hits.size === 0 && rare[0]) {
    for (const index of (postings.get(rare[0]) ?? []).slice(0, 40)) hits.set(index, 1);
  }
  return [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([index]) => index);
}

async function ensureEdition(file: string, sha256: string): Promise<string> {
  mkdirSync(CORPUS_DIR, { recursive: true });
  const path = join(CORPUS_DIR, file);
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    const response = await fetch(editionUrl(file));
    if (!response.ok) throw new Error(`Failed to download ${file}: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(path, bytes);
  }
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha256) throw new Error(`Hash mismatch for ${file}`);
  return path;
}

function loadCorpus(): CorpusRow[] {
  const scholarKeys = new Set(Object.keys(SUNAN_SCHOLAR_NAMES));
  const rows: CorpusRow[] = [];
  for (const edition of SUNAN_EDITIONS) {
    const path = join(CORPUS_DIR, edition.file);
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { hadiths?: EditionHadith[] };
    for (const hadith of parsed.hadiths ?? []) {
      if (!Number.isInteger(hadith.hadithnumber) || typeof hadith.text !== 'string') continue;
      const matn = normalizeMatn(splitMatn(hadith.text).matnText || hadith.text);
      if (matn.length < 25) continue;
      for (const grade of hadith.grades ?? []) {
        if (!grade.name || !scholarKeys.has(grade.name) || !grade.grade) continue;
        rows.push({
          book: edition.book,
          number: hadith.hadithnumber,
          scholar: grade.name as SunanScholarKey,
          rawGrade: grade.grade,
          normalized: matn,
          words: matnWords(matn),
        });
      }
    }
  }
  return rows;
}

async function trigramScores(
  prisma: PrismaClient,
  pairs: Array<{ quoteId: string; corpusIndex: number; left: string; right: string }>,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const chunkSize = 400;
  for (let offset = 0; offset < pairs.length; offset += chunkSize) {
    const chunk = pairs.slice(offset, offset + chunkSize);
    const values = Prisma.join(chunk.map((row) => Prisma.sql`(
      ${row.quoteId}::text, ${String(row.corpusIndex)}::text, ${row.left}::text, ${row.right}::text
    )`));
    const found = await prisma.$queryRaw<Array<{ quoteId: string; corpusIndex: string; trgm: number }>>`
      SELECT qid AS "quoteId", cid AS "corpusIndex", similarity(left_text, right_text) AS trgm
      FROM (VALUES ${values}) AS t(qid, cid, left_text, right_text)
    `;
    for (const row of found) scores.set(`${row.quoteId}:${row.corpusIndex}`, Number(row.trgm));
    if (offset > 0 && offset % 8_000 === 0) console.log(`trigram ${offset} / ${pairs.length}`);
  }
  return scores;
}

function flagDetails(ruling: SunanRuling): Prisma.InputJsonObject {
  return {
    grade: ruling.grade,
    scholars: ruling.scholars,
    references: ruling.references,
    rawGrades: ruling.rawGrades,
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameDetails(stored: Prisma.JsonValue, ruling: SunanRuling): boolean {
  return canonical(stored) === canonical(flagDetails(ruling));
}

function sameRuling(quote: QuoteRow, ruling: SunanRuling): boolean {
  return quote.grade === ruling.grade
    && quote.gradeSource === GradeSource.SUNAN_TAHQIQ
    && quote.gradeAuthority === ruling.gradeAuthority
    && quote.gradeReference === ruling.gradeReference;
}

export async function runSunanTahqiq(options: ImportOptions): Promise<void> {
  for (const edition of SUNAN_EDITIONS) await ensureEdition(edition.file, edition.sha256);
  const corpus = loadCorpus();
  console.log(`corpus rows ${corpus.length}`);

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

  const stored = await options.prisma.quote.findMany({
    where: {
      type: 'HADITH',
      gradeSource: { in: [GradeSource.AUTHORITY_LEGACY, GradeSource.SUNAN_TAHQIQ] },
      OR: [
        { sinLinks: { some: { reviewStatus: 'ACCEPTED' } } },
        { goodDeedLinks: { some: { reviewStatus: 'ACCEPTED' } } },
        { imanBranchLinks: { some: { reviewStatus: 'ACCEPTED' } } },
      ],
    },
    select: {
      id: true,
      textAr: true,
      matnAr: true,
      grade: true,
      gradeSource: true,
      gradeAuthority: true,
      gradeReference: true,
      legacyGrade: true,
      legacyGradeAuthority: true,
      legacyGradeReference: true,
      textSource: true,
      textVerifiedAt: true,
      source: { select: { nameAr: true } },
    },
  });
  const quotes: QuoteRow[] = applyLimit(stored, options.limit).map((row) => ({
    ...row,
    sourceNameAr: row.source.nameAr,
    matn: normalizeMatn(
      (row.matnAr && row.matnAr.trim()) || splitMatn(row.textAr).matnText || row.textAr,
    ),
  }));
  console.log(`linked quotes ${quotes.length}`);
  const sahihaynQuoteIds = new Set((quotes.length === 0
    ? []
    : await options.prisma.hadithMatch.findMany({
      where: {
        quoteId: { in: quotes.map((quote) => quote.id) },
        decision: { not: 'REJECTED' },
        OR: [
          { score: { gte: STRONG_MATCH_SCORE } },
          { decision: 'CONFIRMED' },
        ],
      },
      select: { quoteId: true },
    })).map((row) => row.quoteId));

  const pendingPairs: Array<{ quoteId: string; corpusIndex: number; left: string; right: string }> = [];
  for (const quote of quotes) {
    if (quote.matn.length < 25) continue;
    const indexes = proposeIndexes(matnWords(quote.matn), postings, documentFrequency);
    for (const index of indexes) {
      const row = corpus[index];
      if (!row || wordOverlap(quote.matn, row.normalized) < 0.5) continue;
      pendingPairs.push({ quoteId: quote.id, corpusIndex: index, left: quote.matn, right: row.normalized });
    }
  }
  console.log(`scoring ${pendingPairs.length} pairs`);
  const trgm = await trigramScores(options.prisma, pendingPairs);

  const strong = new Map<string, Map<string, { score: number; hit: SunanHit }>>();
  for (const pair of pendingPairs) {
    const row = corpus[pair.corpusIndex];
    if (!row) continue;
    const score = combinedScore(trgm.get(`${pair.quoteId}:${pair.corpusIndex}`) ?? 0, wordOverlap(pair.left, pair.right));
    if (score < STRONG_MATCH_SCORE) continue;
    const perQuote = strong.get(pair.quoteId) ?? new Map();
    const key = `${row.book}:${row.number}:${row.scholar}`;
    const current = perQuote.get(key);
    if (!current || score > current.score) {
      perQuote.set(key, {
        score,
        hit: { scholar: row.scholar, book: row.book, number: row.number, rawGrade: row.rawGrade },
      });
    }
    strong.set(pair.quoteId, perQuote);
  }

  const publish: Array<{ quote: QuoteRow; ruling: SunanRuling; score: number }> = [];
  const vetoed: Array<{ quote: QuoteRow; score: number; rawGrade: string }> = [];
  for (const quote of quotes) {
    const hits = [...(strong.get(quote.id)?.values() ?? [])];
    if (hits.length === 0) continue;
    if (sahihaynQuoteIds.has(quote.id) || citesSahihayn(quote.textAr)) continue;
    const best = hits.reduce((winner, row) => (row.score > winner.score ? row : winner));
    const ruling = decideSunanRuling(hits.map((row) => row.hit));
    if (!ruling) {
      vetoed.push({
        quote,
        score: best.score,
        rawGrade: hits.map((row) => row.hit.rawGrade).join(' | '),
      });
      continue;
    }
    publish.push({ quote, ruling, score: best.score });
  }

  const existingFlags = quotes.length === 0
    ? []
    : await options.prisma.quoteFlag.findMany({
      where: { type: FlagType.OUTSIDE_SAHIHAYN, quoteId: { in: quotes.map((quote) => quote.id) } },
      select: { id: true, quoteId: true, status: true, note: true, details: true },
    });
  const flagsByQuote = new Map<string, FlagRow[]>();
  for (const flag of existingFlags) {
    const list = flagsByQuote.get(flag.quoteId) ?? [];
    list.push(flag);
    flagsByQuote.set(flag.quoteId, list);
  }

  const publishIds = new Set(publish.map((row) => row.quote.id));
  const revert = quotes.filter((quote) => quote.gradeSource === GradeSource.SUNAN_TAHQIQ && !publishIds.has(quote.id));

  let graded = 0;
  let flagged = 0;
  let unchanged = 0;
  const samples: Array<{ id: string; grade: string; authority: string; reference: string; score: number; text: string }> = [];

  if (!options.dryRun) {
    for (const row of publish) {
      const flags = flagsByQuote.get(row.quote.id) ?? [];
      const open = flags.find((flag) => flag.status === 'OPEN');
      const closed = flags.some((flag) => flag.status !== 'OPEN');
      const flagReady = open
        ? open.note === OUTSIDE_SAHIHAYN_NOTE && sameDetails(open.details, row.ruling)
        : closed;
      if (sameRuling(row.quote, row.ruling) && flagReady) {
        unchanged += 1;
        continue;
      }
      if (!sameRuling(row.quote, row.ruling)) {
        await options.prisma.quote.update({
          where: { id: row.quote.id },
          data: {
            grade: row.ruling.grade,
            gradeSource: GradeSource.SUNAN_TAHQIQ,
            gradeAuthority: row.ruling.gradeAuthority,
            gradeReference: row.ruling.gradeReference,
            ...(row.quote.gradeSource === GradeSource.AUTHORITY_LEGACY
              ? {
                  legacyGrade: row.quote.legacyGrade ?? row.quote.grade,
                  legacyGradeAuthority: row.quote.legacyGradeAuthority ?? row.quote.gradeAuthority,
                  legacyGradeReference: row.quote.legacyGradeReference ?? row.quote.gradeReference,
                }
              : {}),
          },
        });
        graded += 1;
      }
      if (!flagReady && !closed) {
        if (open) {
          await options.prisma.quoteFlag.update({
            where: { id: open.id },
            data: {
              note: OUTSIDE_SAHIHAYN_NOTE,
              details: flagDetails(row.ruling),
              severity: FlagSeverity.LOW,
            },
          });
        } else {
          await options.prisma.quoteFlag.create({
            data: {
              id: randomUUID(),
              quoteId: row.quote.id,
              type: FlagType.OUTSIDE_SAHIHAYN,
              severity: FlagSeverity.LOW,
              source: 'AUTO',
              note: OUTSIDE_SAHIHAYN_NOTE,
              details: flagDetails(row.ruling),
              updatedAt: new Date(),
            },
          });
        }
        flagged += 1;
      }
    }

    if (revert.length > 0) {
      await options.prisma.quoteFlag.deleteMany({
        where: { quoteId: { in: revert.map((quote) => quote.id) }, type: FlagType.OUTSIDE_SAHIHAYN },
      });
      for (const quote of revert) {
        await options.prisma.quote.update({
          where: { id: quote.id },
          data: {
            grade: quote.legacyGrade,
            gradeAuthority: quote.legacyGradeAuthority,
            gradeReference: quote.legacyGradeReference,
            gradeSource: GradeSource.AUTHORITY_LEGACY,
          },
        });
      }
    }
  }

  for (const row of publish.slice(0, 8)) {
    samples.push({
      id: row.quote.id,
      grade: row.ruling.grade,
      authority: row.ruling.gradeAuthority,
      reference: row.ruling.gradeReference,
      score: row.score,
      text: row.quote.textAr.replace(/\s+/g, ' ').slice(0, 140),
    });
  }

  const clearedOcr = options.dryRun ? 0 : await clearUnapprovedOcrVerification(options.prisma);
  const hiddenOcr = publish.filter((row) => (
    row.quote.textSource === 'OCR'
    && row.quote.textVerifiedAt === null
  )).length;
  const byGrade: Record<string, number> = {};
  const byScholar: Record<string, number> = {};
  for (const row of publish) {
    byGrade[row.ruling.grade] = (byGrade[row.ruling.grade] ?? 0) + 1;
    for (const scholar of row.ruling.scholars) byScholar[scholar] = (byScholar[scholar] ?? 0) + 1;
  }

  console.log(JSON.stringify({
    dryRun: options.dryRun,
    corpus: corpus.length,
    linkedQuotes: quotes.length,
    publish: publish.length,
    vetoed: vetoed.length,
    revert: revert.length,
    graded,
    flagged,
    unchanged,
    hiddenOcr,
    revealedOcr: 0,
    clearedOcr,
    byGrade,
    byScholar,
    samples,
    vetoSamples: vetoed.slice(0, 5).map((row) => ({
      id: row.quote.id,
      score: row.score,
      rawGrade: row.rawGrade,
      text: row.quote.textAr.replace(/\s+/g, ' ').slice(0, 120),
    })),
  }, null, 2));
}
