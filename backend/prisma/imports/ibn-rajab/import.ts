/**
 * Ibn Rajab is a source of SELECTION, never of GRADE and never of whole-book topics.
 * Passages stay OCR/UNGRADED. Topic links come only from taxonomy chapter maps /
 * TAKHRIJ from correctly mapped sections — not from RAJAB_BOOKS.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BookLevel,
  FlagType,
  GradeSource,
  HadithGrade,
  LinkBasis,
  QuoteOrigin,
  QuoteType,
  ReferenceBook,
  SectionItemKind,
  TextSource,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { combinedScore, wordOverlap, STRONG_MATCH_SCORE, MATCH_METHOD } from '../../../src/common/text/match-score.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import type { ImportOptions } from '../lib/cli.js';
import { RAJAB_BOOKS } from './books.js';
import { extractRajabPassages } from './extract.js';


const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/ibn-rajab');
const PROVIDER = 'ibn-rajab';
const AUTHORITY = 'ابن رجب الحنبلي';
const RAJAB_SOURCE_IDS = RAJAB_BOOKS.map((book) => book.id);

interface StoredHadith {
  id: string;
  gradeSource: GradeSource;
  normalized: string;
  words: string[];
}

interface RefEntry {
  id: string;
  book: ReferenceBook;
  number: number;
  normalized: string;
  words: string[];
}

function trigramDice(left: string, right: string): number {
  const grams = (value: string): Set<string> => {
    const padded = `  ${value}  `;
    const set = new Set<string>();
    for (let index = 0; index < padded.length - 2; index += 1) set.add(padded.slice(index, index + 3));
    return set;
  };
  const a = grams(left);
  const b = grams(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

function wordsOf(normalized: string): string[] {
  return [...new Set(normalized.split(' ').filter((word) => word.length >= 4))];
}

function externalId(bookKey: string, normalized: string): string {
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `${bookKey}:${digest}`;
}

function bestMatch(normalized: string, words: string[], index: Map<string, StoredHadith[]>): StoredHadith | null {
  const rare = [...words].sort((a, b) => (index.get(a)?.length ?? 0) - (index.get(b)?.length ?? 0)).slice(0, 4);
  const candidates = new Map<string, StoredHadith>();
  for (const word of rare) {
    for (const row of index.get(word) ?? []) candidates.set(row.id, row);
    if (candidates.size > 80) break;
  }
  let best: StoredHadith | null = null;
  let bestScore = 0;
  const pool = [...candidates.values()];
  if (pool.length === 0) return null;
  for (const row of pool) {
    const overlap = wordOverlap(normalized, row.normalized);
    if (overlap < 0.5) continue;
    const score = combinedScore(trigramDice(normalized, row.normalized), overlap);
    const sameWording = overlap >= 0.9 && Math.min(words.length, row.words.length) >= 6;
    const rank = sameWording ? Math.max(score, STRONG_MATCH_SCORE) : score;
    if (rank > bestScore) {
      bestScore = rank;
      best = row;
    }
  }
  return bestScore >= STRONG_MATCH_SCORE ? best : null;
}

function gradeFromToken(token: string | null | undefined): HadithGrade {
  if (!token) return HadithGrade.UNGRADED;
  if (token.includes('ضعيف')) return HadithGrade.DAIF;
  if (token === 'حسن' || token.startsWith('حسن ')) return HadithGrade.HASAN;
  if (token.includes('صحيح')) return HadithGrade.SAHIH;
  return HadithGrade.UNGRADED;
}

function restoreUpgraded(row: {
  apiProvider: string | null;
  rawPayload: Prisma.JsonValue;
}): { grade: HadithGrade; gradeAuthority: string | null; gradeReference: string | null } {
  const payload = (row.rawPayload && typeof row.rawPayload === 'object' && !Array.isArray(row.rawPayload)
    ? row.rawPayload
    : {}) as Record<string, unknown>;

  if (row.apiProvider === 'book:adab-al-mufrad' && Array.isArray(payload.albani) && payload.albani[0]) {
    const entry = payload.albani[0] as { book?: string; number?: string; ruling?: string };
    const book = entry.book === 'sahih' ? 'صحيح' : 'ضعيف';
    const grade = entry.book === 'sahih'
      ? gradeFromToken(entry.ruling ?? 'صحيح')
      : HadithGrade.DAIF;
    return {
      grade,
      gradeAuthority: 'الألباني',
      gradeReference: `${book} الأدب المفرد ${entry.number ?? ''}`.trim(),
    };
  }

  if (typeof payload.gradeToken === 'string' && payload.gradeToken.length > 0) {
    return { grade: gradeFromToken(payload.gradeToken), gradeAuthority: null, gradeReference: null };
  }

  return { grade: HadithGrade.UNGRADED, gradeAuthority: null, gradeReference: null };
}

/** Demote every former IBN_RAJAB grade. Idempotent. */
async function remediateGrades(prisma: PrismaClient): Promise<{
  rajabBookRows: number;
  restored: Array<{ id: string; apiProvider: string | null; before: string; after: string }>;
  flagsRemoved: number;
}> {
  const flagged = await prisma.quote.findMany({
    where: { gradeSource: GradeSource.IBN_RAJAB },
    select: {
      id: true,
      sourceId: true,
      apiProvider: true,
      grade: true,
      rawPayload: true,
    },
  });

  const rajabRows = flagged.filter((row) => row.sourceId != null && RAJAB_SOURCE_IDS.includes(row.sourceId));
  const upgraded = flagged.filter((row) => row.sourceId == null || !RAJAB_SOURCE_IDS.includes(row.sourceId));
  const restored: Array<{ id: string; apiProvider: string | null; before: string; after: string }> = [];

  if (rajabRows.length > 0) {
    await prisma.quote.updateMany({
      where: { id: { in: rajabRows.map((row) => row.id) } },
      data: {
        grade: HadithGrade.UNGRADED,
        gradeSource: GradeSource.AUTHORITY_LEGACY,
        gradeAuthority: null,
        gradeReference: null,
        textVerifiedAt: null,
      },
    });
  }

  for (const row of upgraded) {
    const next = restoreUpgraded(row);
    restored.push({
      id: row.id,
      apiProvider: row.apiProvider,
      before: `${row.grade}/IBN_RAJAB`,
      after: `${next.grade}/AUTHORITY_LEGACY`,
    });
    await prisma.quote.update({
      where: { id: row.id },
      data: {
        grade: next.grade,
        gradeSource: GradeSource.AUTHORITY_LEGACY,
        gradeAuthority: next.gradeAuthority,
        gradeReference: next.gradeReference,
        textVerifiedAt: null,
      },
    });
  }

  const flagsRemoved = (await prisma.quoteFlag.deleteMany({
    where: {
      type: FlagType.OUTSIDE_SAHIHAYN,
      quoteId: { in: flagged.map((row) => row.id) },
    },
  })).count;

  return { rajabBookRows: rajabRows.length, restored, flagsRemoved };
}

/**
 * Delete every SinQuote/GoodDeedQuote whose note starts with «من كتاب » and
 * whose basis is REVIEWER_SECTION (the whole-book linking error).
 */
export async function removeWholeBookLinks(prisma: PrismaClient): Promise<{
  before: number;
  deletedSin: number;
  deletedDeed: number;
  after: number;
}> {
  const sinWhere = { basis: LinkBasis.REVIEWER_SECTION, note: { startsWith: 'من كتاب ' } };
  const deedWhere = { basis: LinkBasis.REVIEWER_SECTION, note: { startsWith: 'من كتاب ' } };
  const before =
    (await prisma.sinQuote.count({ where: sinWhere })) +
    (await prisma.goodDeedQuote.count({ where: deedWhere }));
  const deletedSin = (await prisma.sinQuote.deleteMany({ where: sinWhere })).count;
  const deletedDeed = (await prisma.goodDeedQuote.deleteMany({ where: deedWhere })).count;
  const after =
    (await prisma.sinQuote.count({ where: sinWhere })) +
    (await prisma.goodDeedQuote.count({ where: deedWhere }));
  console.log(
    JSON.stringify({
      wholeBookLinks: { before, deletedSin, deletedDeed, after },
    }),
  );
  return { before, deletedSin, deletedDeed, after };
}

/** Strong Sahihayn matches → record HadithMatch only (no topic links from the book). */
async function matchSahihayn(
  prisma: PrismaClient,
): Promise<{ matches: number; samples: Array<{ rajabId: string; book: string; number: number; score: number }> }> {
  const rajabQuotes = await prisma.quote.findMany({
    where: { apiProvider: PROVIDER },
    select: { id: true, textAr: true },
  });

  const refs = await prisma.referenceHadith.findMany({
    where: { book: { in: [ReferenceBook.BUKHARI, ReferenceBook.MUSLIM] } },
    select: { id: true, book: true, number: true, normalizedMatn: true },
  });
  const entries: RefEntry[] = refs.map((row) => ({
    id: row.id,
    book: row.book,
    number: row.number,
    normalized: row.normalizedMatn,
    words: wordsOf(row.normalizedMatn),
  }));
  const byWord = new Map<string, RefEntry[]>();
  for (const entry of entries) {
    for (const word of entry.words) {
      const bucket = byWord.get(word) ?? [];
      if (bucket.length < 400) bucket.push(entry);
      byWord.set(word, bucket);
    }
  }

  let matches = 0;
  const samples: Array<{ rajabId: string; book: string; number: number; score: number }> = [];

  for (const quote of rajabQuotes) {
    const normalized = normalizeMatn(quote.textAr);
    if (normalized.length < 25) continue;
    const words = wordsOf(normalized);
    const rare = [...words].sort((a, b) => (byWord.get(a)?.length ?? 0) - (byWord.get(b)?.length ?? 0)).slice(0, 5);
    const candidates = new Map<string, RefEntry>();
    for (const word of rare) {
      for (const entry of byWord.get(word) ?? []) candidates.set(entry.id, entry);
      if (candidates.size > 120) break;
    }

    let best: { entry: RefEntry; score: number } | null = null;
    for (const entry of candidates.values()) {
      const overlap = wordOverlap(normalized, entry.normalized);
      if (overlap < 0.45) continue;
      const score = combinedScore(trigramDice(normalized, entry.normalized), overlap);
      if (!best || score > best.score) best = { entry, score };
    }
    if (!best || best.score < STRONG_MATCH_SCORE) continue;

    await prisma.hadithMatch.upsert({
      where: {
        quoteId_referenceHadithId: { quoteId: quote.id, referenceHadithId: best.entry.id },
      },
      create: {
        quoteId: quote.id,
        referenceHadithId: best.entry.id,
        score: best.score,
        method: MATCH_METHOD,
        decision: 'CANDIDATE',
      },
      update: { score: best.score, method: MATCH_METHOD },
    });
    matches += 1;
    if (samples.length < 12) {
      samples.push({
        rajabId: quote.id,
        book: best.entry.book,
        number: best.entry.number,
        score: best.score,
      });
    }
  }

  return { matches, samples };
}

export async function runIbnRajab(options: ImportOptions): Promise<void> {
  const remediation = options.dryRun
    ? { rajabBookRows: 0, restored: [], flagsRemoved: 0 }
    : await remediateGrades(options.prisma);

  const wholeBook = options.dryRun
    ? { before: 0, deletedSin: 0, deletedDeed: 0, after: 0 }
    : await removeWholeBookLinks(options.prisma);

  const stored = await options.prisma.quote.findMany({
    where: { type: QuoteType.HADITH },
    select: { id: true, textAr: true, gradeSource: true },
  });
  const rows: StoredHadith[] = [];
  const byWord = new Map<string, StoredHadith[]>();
  for (const row of stored) {
    const normalized = normalizeMatn(row.textAr);
    if (normalized.length < 25) continue;
    const words = wordsOf(normalized);
    const item = { id: row.id, gradeSource: row.gradeSource, normalized, words };
    rows.push(item);
    for (const word of words) {
      const bucket = byWord.get(word) ?? [];
      if (bucket.length < 500) bucket.push(item);
      byWord.set(word, bucket);
    }
  }

  let created = 0;
  let reused = 0;
  const linked = 0;
  const byBook: Record<string, number> = {};

  for (const book of RAJAB_BOOKS) {
    const path = join(CORPUS, book.file);
    const bytes = readFileSync(path);
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== book.sha256) throw new Error(`Hash mismatch for ${book.file}`);
    await options.prisma.source.upsert({
      where: { id: book.id },
      create: {
        id: book.id,
        name: book.name,
        nameAr: book.nameAr,
        type: 'BOOK',
        author: 'Ibn Rajab',
        authorAr: AUTHORITY,
        isExternalApi: false,
        apiProvider: PROVIDER,
      },
      update: { name: book.name, nameAr: book.nameAr, authorAr: AUTHORITY },
    });
    const section = await options.prisma.bookSection.upsert({
      where: { sourceId_order: { sourceId: book.id, order: 1 } },
      create: { sourceId: book.id, level: BookLevel.BAB, titleAr: book.nameAr, order: 1 },
      update: { titleAr: book.nameAr },
    });
    const passages = extractRajabPassages(book.key, bytes.toString('utf8'));
    const limited = options.limit === null ? passages : passages.slice(0, options.limit);
    byBook[book.key] = limited.length;
    const last = await options.prisma.sectionItem.findFirst({
      where: { sectionId: section.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    let order = last?.order ?? 0;

    for (const passage of limited) {
      const normalized = normalizeMatn(passage.text);
      if (normalized.length < 25) continue;
      const key = externalId(book.key, normalized);
      let quote = await options.prisma.quote.findUnique({
        where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId: key } },
        select: { id: true, gradeSource: true },
      });
      if (quote) reused += 1;
      else {
        const match = bestMatch(normalized, wordsOf(normalized), byWord);
        if (match) {
          // Reuse any existing narration. Never change its grade.
          quote = { id: match.id, gradeSource: match.gradeSource };
          reused += 1;
        } else if (!options.dryRun) {
          const made = await options.prisma.quote.create({
            data: {
              type: QuoteType.HADITH,
              origin: QuoteOrigin.LOCAL,
              textAr: passage.text,
              sourceId: book.id,
              apiProvider: PROVIDER,
              externalId: key,
              grade: HadithGrade.UNGRADED,
              gradeSource: GradeSource.AUTHORITY_LEGACY,
              gradeAuthority: null,
              gradeReference: null,
              textSource: TextSource.OCR,
              textVerifiedAt: null,
              page: String(passage.page),
              author: AUTHORITY,
              bookTitle: book.nameAr,
            },
            select: { id: true, gradeSource: true },
          });
          quote = made;
          const item = { id: made.id, gradeSource: made.gradeSource, normalized, words: wordsOf(normalized) };
          rows.push(item);
          for (const word of item.words) {
            const bucket = byWord.get(word) ?? [];
            if (bucket.length < 500) bucket.push(item);
            byWord.set(word, bucket);
          }
          created += 1;
        } else {
          created += 1;
          continue;
        }
      }

      if (!options.dryRun) {
        const placed = await options.prisma.sectionItem.findFirst({
          where: { sectionId: section.id, quoteId: quote.id },
          select: { id: true },
        });
        if (!placed) {
          order += 1;
          await options.prisma.sectionItem.create({
            data: { sectionId: section.id, order, kind: SectionItemKind.HADITH, quoteId: quote.id },
          });
        }
      }
    }
  }

  const takhrij = options.dryRun
    ? { matches: 0, samples: [] }
    : await matchSahihayn(options.prisma);

  const remainingIbn = await options.prisma.quote.count({ where: { gradeSource: GradeSource.IBN_RAJAB } });

  console.log(JSON.stringify({
    created,
    reused,
    linked,
    byBook,
    wholeBookLinks: wholeBook,
    remediation: {
      rajabBookRows: remediation.rajabBookRows,
      restored: remediation.restored.length,
      restoredSample: remediation.restored.slice(0, 20),
      flagsRemoved: remediation.flagsRemoved,
      remainingIbnRajabGrades: remainingIbn,
    },
    takhrij,
    dryRun: options.dryRun,
  }));
}
