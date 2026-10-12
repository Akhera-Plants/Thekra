/**
 * Loads Sahih al-Bukhari and Sahih Muslim as a matching corpus, then links
 * every HADITH quote to that corpus. A strong match may set grade SAHIH with
 * gradeSource AUTO_SAHIHAYN. A MANUAL grade is never overwritten.
 *
 * Re-running inserts nothing when the corpus, matches, and flags are unchanged.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FlagSeverity,
  FlagType,
  GradeSource,
  HadithGrade,
  Prisma,
  QuoteType,
  ReferenceBook,
  type PrismaClient,
} from '@prisma/client';
import { duplicateDifferentGrade, isWeakMatch, ocrSuspect, quranMismatch, referenceMismatch } from '../../../src/common/flags/checks.js';
import { splitMatn } from '../../../src/common/text/matn.js';
import { CANDIDATE_FLOOR, MATCH_METHOD, STRONG_MATCH_SCORE, WEAK_MATCH_SCORE, combinedScore, wordOverlap } from '../../../src/common/text/match-score.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import { applyLimit, type ImportOptions } from '../lib/cli.js';
import { loadCorpus } from '../lib/corpus.js';
import { loadUthmaniMap } from '../waqfeya/quran.js';
import { BUKHARI_CORPUS, MUSLIM_CORPUS } from './files.js';
import { parseSahihayn, type SahihParseResult } from './parse.js';

const AUTHORITY = {
  BUKHARI: 'رواه البخاري',
  MUSLIM: 'رواه مسلم',
  BOTH: 'متفق عليه',
} as const;

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
  hadithReference: string | null;
  textSource: string;
  rawPayload: Prisma.JsonValue;
  sourceName: string;
  sourceNameAr: string | null;
  matn: string;
}

interface Candidate {
  quoteId: string;
  referenceId: string;
  book: ReferenceBook;
  number: number;
  score: number;
  normalized: string;
}

function citation(book: ReferenceBook, number: number): string {
  return book === ReferenceBook.BUKHARI ? `البخاري ${number}` : `مسلم ${number}`;
}

function verseKeysOf(raw: Prisma.JsonValue): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const keys = (raw as { verseKeys?: unknown }).verseKeys;
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : [];
}

function claimsOf(row: QuoteRow): Array<{ book: ReferenceBook; number: number }> {
  const blob = `${row.hadithReference ?? ''}\n${row.gradeReference ?? ''}`;
  const claims: Array<{ book: ReferenceBook; number: number }> = [];
  for (const match of blob.matchAll(/(?:Bukhari|البخاري)\s*[،,]?\s*(?:رقم\s*)?(\d+)/gi)) {
    claims.push({ book: ReferenceBook.BUKHARI, number: Number(match[1]) });
  }
  for (const match of blob.matchAll(/(?:Muslim|(?<![\u0600-\u06FF])مسلم(?![\u0600-\u06FF]))\s*[،,]?\s*(?:رقم\s*)?(\d+)/gi)) {
    claims.push({ book: ReferenceBook.MUSLIM, number: Number(match[1]) });
  }
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.book}:${claim.number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function upsertCorpus(
  prisma: PrismaClient,
  book: ReferenceBook,
  parsed: SahihParseResult,
): Promise<{ created: number; unchanged: number }> {
  const existing = await prisma.referenceHadith.findMany({
    where: { book },
    select: { id: true, number: true, matnText: true, isnadText: true, kitab: true, bab: true, normalizedMatn: true },
  });
  const byNumber = new Map(existing.map((row) => [row.number, row]));
  let created = 0;
  let unchanged = 0;
  const pending: Prisma.ReferenceHadithCreateManyInput[] = [];
  for (const narration of parsed.narrations) {
    const split = splitMatn(narration.text);
    const matnText = split.matnText || narration.text;
    const normalized = normalizeMatn(matnText);
    const previous = byNumber.get(narration.number);
    if (!previous) {
      pending.push({
        id: randomUUID(),
        book,
        number: narration.number,
        kitab: narration.kitab,
        bab: narration.bab,
        isnadText: split.isnadText,
        matnText,
        normalizedMatn: normalized,
        updatedAt: new Date(),
      });
      continue;
    }
    const same = previous.matnText === matnText
      && previous.isnadText === split.isnadText
      && previous.kitab === narration.kitab
      && previous.bab === narration.bab
      && previous.normalizedMatn === normalized;
    if (same) {
      unchanged += 1;
      continue;
    }
    await prisma.referenceHadith.update({
      where: { id: previous.id },
      data: {
        kitab: narration.kitab,
        bab: narration.bab,
        isnadText: split.isnadText,
        matnText,
        normalizedMatn: normalized,
      },
    });
  }
  if (pending.length > 0) {
    await prisma.referenceHadith.createMany({ data: pending });
    created = pending.length;
  }
  return { created, unchanged };
}

interface RefEntry {
  id: string;
  book: ReferenceBook;
  number: number;
  normalized: string;
  words: string[];
}

function matnWords(text: string): string[] {
  return [...new Set(text.split(/\s+/).filter((word) => word.length >= 3))];
}

/**
 * Rare-word postings propose a short list. pg_trgm then scores only those
 * pairs, which is the same similarity the GIN index would compute without
 * scanning it once per quote.
 */
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

async function trigramScores(
  prisma: PrismaClient,
  pairs: Array<{ quoteId: string; referenceId: string; left: string; right: string }>,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const chunkSize = 400;
  for (let offset = 0; offset < pairs.length; offset += chunkSize) {
    const chunk = pairs.slice(offset, offset + chunkSize);
    const values = Prisma.join(chunk.map((row) => Prisma.sql`(
      ${row.quoteId}::text, ${row.referenceId}::text, ${row.left}::text, ${row.right}::text
    )`));
    const rows = await prisma.$queryRaw<Array<{ quoteId: string; referenceId: string; trgm: number }>>`
      SELECT qid AS "quoteId", rid AS "referenceId", similarity(left_text, right_text) AS trgm
      FROM (VALUES ${values}) AS t(qid, rid, left_text, right_text)
    `;
    for (const row of rows) scores.set(`${row.quoteId}:${row.referenceId}`, Number(row.trgm));
    if (offset % 4_000 === 0) console.log(`trigram ${Math.min(offset + chunkSize, pairs.length)} / ${pairs.length}`);
  }
  return scores;
}

async function storeMatches(prisma: PrismaClient, candidates: readonly Candidate[]): Promise<number> {
  const before = await prisma.hadithMatch.count();
  const chunkSize = 400;
  for (let offset = 0; offset < candidates.length; offset += chunkSize) {
    const chunk = candidates.slice(offset, offset + chunkSize);
    const values = Prisma.join(chunk.map((row) => Prisma.sql`(
      ${randomUUID()}::text,
      ${row.quoteId}::text,
      ${row.referenceId}::text,
      ${row.score}::float8,
      ${MATCH_METHOD}::text,
      'CANDIDATE'::"MatchDecision",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )`));
    await prisma.$executeRaw`
      INSERT INTO "HadithMatch"
        ("id", "quoteId", "referenceHadithId", "score", "method", "decision", "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("quoteId", "referenceHadithId") DO UPDATE
      SET "score" = EXCLUDED."score",
          "method" = EXCLUDED."method",
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "HadithMatch"."decision" = 'CANDIDATE'
        AND (
          "HadithMatch"."score" IS DISTINCT FROM EXCLUDED."score"
          OR "HadithMatch"."method" IS DISTINCT FROM EXCLUDED."method"
        )
    `;
  }
  const after = await prisma.hadithMatch.count();
  return after - before;
}

function bestByBook(rows: readonly Candidate[]): Map<ReferenceBook, Candidate> {
  const best = new Map<ReferenceBook, Candidate>();
  for (const row of rows) {
    const current = best.get(row.book);
    if (!current || row.score > current.score) best.set(row.book, row);
  }
  return best;
}

async function applyGrades(
  prisma: PrismaClient,
  quotes: readonly QuoteRow[],
  byQuote: Map<string, Candidate[]>,
): Promise<{ graded: number; keptManual: number; bukhari: number; muslim: number; both: number; bySource: Record<string, { bukhari: number; muslim: number; both: number }> }> {
  let graded = 0;
  let keptManual = 0;
  let bukhari = 0;
  let muslim = 0;
  let both = 0;
  const bySource: Record<string, { bukhari: number; muslim: number; both: number }> = {};
  for (const quote of quotes) {
    const candidates = byQuote.get(quote.id) ?? [];
    const perBook = bestByBook(candidates);
    const strong = [...perBook.values()].filter((row) => row.score >= STRONG_MATCH_SCORE);
    const sourceKey = quote.sourceNameAr ?? quote.sourceName;
    if (quote.gradeSource === GradeSource.MANUAL) {
      if (strong.length > 0) keptManual += 1;
      continue;
    }
    if (strong.length === 0) {
      if (quote.gradeSource === GradeSource.AUTO_SAHIHAYN) {
        await prisma.quote.update({
          where: { id: quote.id },
          data: {
            grade: quote.legacyGrade,
            gradeAuthority: quote.legacyGradeAuthority,
            gradeReference: quote.legacyGradeReference,
            gradeSource: GradeSource.AUTHORITY_LEGACY,
          },
        });
        quote.grade = quote.legacyGrade;
        quote.gradeAuthority = quote.legacyGradeAuthority;
        quote.gradeReference = quote.legacyGradeReference;
        quote.gradeSource = GradeSource.AUTHORITY_LEGACY;
      }
      continue;
    }
    const hasBukhari = strong.some((row) => row.book === ReferenceBook.BUKHARI);
    const hasMuslim = strong.some((row) => row.book === ReferenceBook.MUSLIM);
    const gradeAuthority = hasBukhari && hasMuslim ? AUTHORITY.BOTH : hasBukhari ? AUTHORITY.BUKHARI : AUTHORITY.MUSLIM;
    const gradeReference = strong
      .sort((a, b) => a.book.localeCompare(b.book))
      .map((row) => citation(row.book, row.number))
      .join('، ');
    const unchanged = quote.grade === HadithGrade.SAHIH
      && quote.gradeSource === GradeSource.AUTO_SAHIHAYN
      && quote.gradeAuthority === gradeAuthority
      && quote.gradeReference === gradeReference;
    if (!unchanged) {
      await prisma.quote.update({
        where: { id: quote.id },
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
      graded += 1;
    }
    quote.grade = HadithGrade.SAHIH;
    quote.gradeSource = GradeSource.AUTO_SAHIHAYN;
    const bucket = bySource[sourceKey] ?? { bukhari: 0, muslim: 0, both: 0 };
    if (hasBukhari && hasMuslim) {
      both += 1;
      bucket.both += 1;
    } else if (hasBukhari) {
      bukhari += 1;
      bucket.bukhari += 1;
    } else {
      muslim += 1;
      bucket.muslim += 1;
    }
    bySource[sourceKey] = bucket;
  }
  return { graded, keptManual, bukhari, muslim, both, bySource };
}

async function applyFlags(
  prisma: PrismaClient,
  quotes: readonly QuoteRow[],
  byQuote: Map<string, Candidate[]>,
  canon: ReadonlyMap<string, string>,
): Promise<Record<string, number>> {
  const existing = await prisma.quoteFlag.findMany({
    where: { source: 'AUTO', status: 'OPEN' },
    select: { quoteId: true, type: true },
  });
  const have = new Set(existing.map((flag) => `${flag.quoteId}:${flag.type}`));
  const pending: Prisma.QuoteFlagCreateManyInput[] = [];
  const push = (quoteId: string, type: FlagType, severity: FlagSeverity, details: Prisma.InputJsonValue): void => {
    const key = `${quoteId}:${type}`;
    if (have.has(key)) return;
    have.add(key);
    pending.push({
      id: randomUUID(),
      quoteId,
      type,
      severity,
      source: 'AUTO',
      details,
      updatedAt: new Date(),
    });
  };

  for (const quote of quotes) {
    const candidates = byQuote.get(quote.id) ?? [];
    const best = candidates.reduce<Candidate | null>((winner, row) => (!winner || row.score > winner.score ? row : winner), null);
    if (isWeakMatch(best?.score ?? null) && best) {
      push(quote.id, FlagType.WEAK_MATCH, FlagSeverity.MEDIUM, {
        score: best.score,
        book: best.book,
        number: best.number,
        referenceHadithId: best.referenceId,
      });
    }
    const noise = ocrSuspect(quote.textAr, quote.textSource);
    if (noise.suspect) {
      push(quote.id, FlagType.OCR_SUSPECT, FlagSeverity.MEDIUM, {
        arabicRatio: noise.arabicRatio,
        latin: noise.latin,
        brokenWords: noise.brokenWords,
      });
    }
    const missed = quranMismatch(quote.textAr, verseKeysOf(quote.rawPayload), canon);
    if (missed.length > 0) {
      push(quote.id, FlagType.QURAN_MISMATCH, FlagSeverity.HIGH, { keys: missed });
    }
  }

  const claimInputs: Array<{ quoteId: string; matn: string; book: ReferenceBook; number: number }> = [];
  for (const quote of quotes) {
    for (const claim of claimsOf(quote)) {
      claimInputs.push({ quoteId: quote.id, matn: quote.matn, book: claim.book, number: claim.number });
    }
  }
  const worstClaim = new Map<string, number>();
  for (let offset = 0; offset < claimInputs.length; offset += 200) {
    const batch = claimInputs.slice(offset, offset + 200);
    const values = Prisma.join(batch.map((row) => Prisma.sql`(
      ${row.quoteId}::text, ${row.matn}::text, ${row.book}::text, ${row.number}::int
    )`));
    const rows = await prisma.$queryRaw<Array<{ quoteId: string; trgm: number; normalized: string; matn: string }>>`
      SELECT i."quoteId", i.matn, r."normalizedMatn" AS normalized, similarity(r."normalizedMatn", i.matn) AS trgm
      FROM (VALUES ${values}) AS i("quoteId", matn, book, number)
      JOIN "ReferenceHadith" r ON r.book::text = i.book AND r.number = i.number
    `;
    for (const row of rows) {
      const score = combinedScore(Number(row.trgm), wordOverlap(row.matn, row.normalized));
      const current = worstClaim.get(row.quoteId);
      if (current === undefined || score < current) worstClaim.set(row.quoteId, score);
    }
  }
  for (const [quoteId, score] of worstClaim) {
    if (referenceMismatch(score)) {
      push(quoteId, FlagType.REFERENCE_MISMATCH, FlagSeverity.HIGH, { score });
    }
  }

  const duplicateIds = new Set(duplicateDifferentGrade(quotes.map((quote) => ({
    id: quote.id,
    normalizedMatn: quote.matn,
    grade: quote.grade,
  }))));
  for (const id of duplicateIds) {
    push(id, FlagType.DUPLICATE_DIFFERENT_GRADE, FlagSeverity.HIGH, { normalizedMatnLength: quotes.find((quote) => quote.id === id)?.matn.length ?? 0 });
  }

  if (pending.length > 0) await prisma.quoteFlag.createMany({ data: pending });
  const grouped = await prisma.quoteFlag.groupBy({
    by: ['type', 'severity'],
    _count: { _all: true },
  });
  const counts: Record<string, number> = { created: pending.length };
  for (const row of grouped) counts[`${row.type}:${row.severity}`] = row._count._all;
  return counts;
}

function parseReport(label: string, parsed: SahihParseResult, cited: number) {
  return {
    label,
    parsed: parsed.narrations.length,
    maxNumber: parsed.maxNumber,
    missing: parsed.missing.length,
    missingNumbers: parsed.missing.slice(0, 40),
    duplicateNumbers: parsed.duplicateNumbers.length,
    duplicateNumberSample: parsed.duplicateNumbers.slice(0, 12),
    citedTotal: cited,
  };
}

function samplePairs(quotes: readonly QuoteRow[], byQuote: Map<string, Candidate[]>): unknown[] {
  const ranked = quotes
    .map((quote) => {
      const best = (byQuote.get(quote.id) ?? []).reduce<Candidate | null>((winner, row) => (!winner || row.score > winner.score ? row : winner), null);
      return best ? { quote, best } : null;
    })
    .filter((row): row is { quote: QuoteRow; best: Candidate } => row !== null)
    .sort((a, b) => b.best.score - a.best.score);
  const high = ranked.filter((row) => row.best.score >= STRONG_MATCH_SCORE).slice(0, 20);
  const mid = ranked.filter((row) => row.best.score >= WEAK_MATCH_SCORE && row.best.score < STRONG_MATCH_SCORE).slice(0, 20);
  const low = ranked.filter((row) => row.best.score >= 0.3 && row.best.score < 0.48).slice(0, 10);
  return [...high, ...mid, ...low].map((row) => ({
    quoteId: row.quote.id,
    source: row.quote.sourceNameAr,
    score: row.best.score,
    book: row.best.book,
    number: row.best.number,
    ours: row.quote.matn.slice(0, 280),
    referenceId: row.best.referenceId,
  }));
}

export async function runTakhrij(options: ImportOptions): Promise<void> {
  const bukhariFile = await loadCorpus(BUKHARI_CORPUS);
  const muslimFile = await loadCorpus(MUSLIM_CORPUS);
  const bukhari = parseSahihayn(bukhariFile.text);
  const muslim = parseSahihayn(muslimFile.text);
  console.log(JSON.stringify({
    bukhari: parseReport('Sahih al-Bukhari', bukhari, 7563),
    muslim: parseReport('Sahih Muslim', muslim, 3033),
  }, null, 2));
  if (options.dryRun) return;

  const corpus = {
    bukhari: await upsertCorpus(options.prisma, ReferenceBook.BUKHARI, bukhari),
    muslim: await upsertCorpus(options.prisma, ReferenceBook.MUSLIM, muslim),
  };

  const outDir = join(import.meta.dirname, '..', '..', '..', '.corpus');
  mkdirSync(outDir, { recursive: true });
  const hiddenBefore = await options.prisma.quote.count({
    where: {
      type: QuoteType.HADITH,
      grade: { in: [HadithGrade.SAHIH, HadithGrade.HASAN] },
      gradeSource: GradeSource.AUTHORITY_LEGACY,
      OR: [{ textSource: { not: 'OCR' } }, { textVerifiedAt: { not: null } }],
    },
  });
  const policyPath = join(outDir, 'takhrij-policy-count.json');
  if (!existsSync(policyPath)) {
    writeFileSync(policyPath, JSON.stringify({ stoppedBeingPublic: hiddenBefore }));
  }

  const rawQuotes = await options.prisma.quote.findMany({
    where: { type: QuoteType.HADITH },
    select: {
      id: true,
      textAr: true,
      grade: true,
      gradeSource: true,
      gradeAuthority: true,
      gradeReference: true,
      legacyGrade: true,
      legacyGradeAuthority: true,
      legacyGradeReference: true,
      hadithReference: true,
      textSource: true,
      rawPayload: true,
      source: { select: { name: true, nameAr: true } },
    },
    orderBy: { id: 'asc' },
  });
  const limited = applyLimit(rawQuotes, options.limit);
  const quotes: QuoteRow[] = limited.map((row) => ({
    id: row.id,
    textAr: row.textAr,
    grade: row.grade,
    gradeSource: row.gradeSource,
    gradeAuthority: row.gradeAuthority,
    gradeReference: row.gradeReference,
    legacyGrade: row.legacyGrade,
    legacyGradeAuthority: row.legacyGradeAuthority,
    legacyGradeReference: row.legacyGradeReference,
    hadithReference: row.hadithReference,
    textSource: row.textSource,
    rawPayload: row.rawPayload,
    sourceName: row.source.name,
    sourceNameAr: row.source.nameAr,
    matn: normalizeMatn(splitMatn(row.textAr).matnText || row.textAr),
  }));

  const references = await options.prisma.referenceHadith.findMany({
    select: { id: true, book: true, number: true, matnText: true, normalizedMatn: true },
  });
  const referenceMatn = new Map(references.map((row) => [row.id, row.matnText]));
  const refs: RefEntry[] = references.map((row) => ({
    id: row.id,
    book: row.book,
    number: row.number,
    normalized: row.normalizedMatn,
    words: matnWords(row.normalizedMatn),
  }));
  const postings = new Map<string, number[]>();
  const documentFrequency = new Map<string, number>();
  refs.forEach((ref, index) => {
    for (const word of ref.words) {
      const list = postings.get(word);
      if (list) list.push(index);
      else postings.set(word, [index]);
      documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
    }
  });
  const byKey = new Map(refs.map((ref, index) => [`${ref.book}:${ref.number}`, index]));

  const byQuote = new Map<string, Candidate[]>();
  const matchable = quotes.filter((quote) => quote.matn.length >= 25);
  const pendingPairs: Array<{ quoteId: string; referenceId: string; left: string; right: string; ref: RefEntry }> = [];
  for (const quote of matchable) {
    const words = matnWords(quote.matn);
    const chosen = new Set(proposeIndexes(words, postings, documentFrequency));
    const claims = claimsOf(quote);
    for (const claim of claims) {
      const claimed = byKey.get(`${claim.book}:${claim.number}`);
      if (claimed !== undefined) chosen.add(claimed);
    }
    for (const index of chosen) {
      const ref = refs[index];
      if (!ref) continue;
      const claimed = claims.some((claim) => claim.book === ref.book && claim.number === ref.number);
      if (!claimed && wordOverlap(quote.matn, ref.normalized) < 0.2) continue;
      pendingPairs.push({ quoteId: quote.id, referenceId: ref.id, left: quote.matn, right: ref.normalized, ref });
    }
  }
  console.log(`scoring ${pendingPairs.length} pairs across ${matchable.length} quotes`);
  const trgm = await trigramScores(options.prisma, pendingPairs);
  for (const pair of pendingPairs) {
    const score = combinedScore(trgm.get(`${pair.quoteId}:${pair.referenceId}`) ?? 0, wordOverlap(pair.left, pair.right));
    if (score < CANDIDATE_FLOOR) continue;
    const list = byQuote.get(pair.quoteId) ?? [];
    list.push({
      quoteId: pair.quoteId,
      referenceId: pair.referenceId,
      book: pair.ref.book,
      number: pair.ref.number,
      score,
      normalized: pair.right,
    });
    byQuote.set(pair.quoteId, list);
  }

  const flat: Candidate[] = [];
  for (const list of byQuote.values()) {
    list.sort((a, b) => b.score - a.score);
    flat.push(...list.slice(0, 5));
  }
  const matchesCreated = await storeMatches(options.prisma, flat);
  const grades = await applyGrades(options.prisma, quotes, byQuote);
  const uthmani = await loadUthmaniMap(options.prisma, join(import.meta.dirname, '..', '..', '..', '.corpus', 'waqfeya', 'uthmani.json'));
  const flags = await applyFlags(options.prisma, quotes, byQuote, uthmani);

  const sample = samplePairs(quotes, byQuote).map((row) => {
    const item = row as { referenceId: string };
    return { ...item, reference: (referenceMatn.get(item.referenceId) ?? '').slice(0, 280) };
  });
  writeFileSync(join(outDir, 'takhrij-summary.json'), JSON.stringify({
    thresholds: { strong: STRONG_MATCH_SCORE, weak: WEAK_MATCH_SCORE },
    corpus,
    hiddenBefore,
    quotes: quotes.length,
    matchesCreated,
    grades,
    flags,
    sample,
  }, null, 2));
  console.log(JSON.stringify({ corpus, hiddenBefore, matchesCreated, grades, flags }, null, 2));
}
