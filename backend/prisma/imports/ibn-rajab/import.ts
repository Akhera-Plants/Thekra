/**
 * Ibn Rajab is a source of SELECTION and topic links, never of GRADE.
 * Passages stay OCR/UNGRADED. A strong Sahihayn match (0.75) links the
 * Bukhari/Muslim quote to the same topics — that is the only public path.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BookLevel,
  ClassifiedBy,
  FlagType,
  GradeSource,
  HadithGrade,
  LinkBasis,
  LinkReviewStatus,
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
import { extractRajabPassages, type RajabTopic } from './extract.js';

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

async function linkTopic(
  prisma: PrismaClient,
  quoteId: string,
  topic: RajabTopic,
  topicIds: { sins: Map<string, string>; deeds: Map<string, string> },
  note: string,
  basis: LinkBasis,
  sectionId: string | null,
): Promise<boolean> {
  const id = (topic.side === 'sin' ? topicIds.sins : topicIds.deeds).get(topic.slug);
  if (!id) throw new Error(`Missing topic ${topic.slug}`);
  if (topic.side === 'sin') {
    const have = await prisma.sinQuote.findUnique({
      where: { sinId_quoteId: { sinId: id, quoteId } },
      select: { id: true },
    });
    if (have) return false;
    await prisma.sinQuote.create({
      data: {
        sinId: id,
        quoteId,
        note,
        reviewStatus: LinkReviewStatus.ACCEPTED,
        basis,
        classifiedBy: ClassifiedBy.REVIEWER,
        sectionId,
      },
    });
    return true;
  }
  const have = await prisma.goodDeedQuote.findUnique({
    where: { goodDeedId_quoteId: { goodDeedId: id, quoteId } },
    select: { id: true },
  });
  if (have) return false;
  await prisma.goodDeedQuote.create({
    data: {
      goodDeedId: id,
      quoteId,
      note,
      reviewStatus: LinkReviewStatus.ACCEPTED,
      basis,
      classifiedBy: ClassifiedBy.REVIEWER,
      sectionId,
    },
  });
  return true;
}

/** Strong Sahihayn matches → link the published Bukhari/Muslim quote to the same topics. */
async function linkSahihaynViaTakhrij(
  prisma: PrismaClient,
  topicIds: { sins: Map<string, string>; deeds: Map<string, string> },
): Promise<{ matches: number; linked: number; samples: Array<{ rajabId: string; sahihaynId: string; book: string; number: number; score: number }> }> {
  const rajabQuotes = await prisma.quote.findMany({
    where: { apiProvider: PROVIDER },
    select: {
      id: true,
      textAr: true,
      bookTitle: true,
      sinLinks: { select: { sin: { select: { slug: true } }, sectionId: true } },
      goodDeedLinks: { select: { goodDeed: { select: { slug: true } }, sectionId: true } },
    },
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

  const sahihayn = await prisma.quote.findMany({
    where: { apiProvider: 'sahihayn', gradeSource: GradeSource.SAHIHAYN },
    select: { id: true, externalId: true },
  });
  const sahihaynByKey = new Map(sahihayn.map((row) => [row.externalId, row.id]));

  let matches = 0;
  let linked = 0;
  const samples: Array<{ rajabId: string; sahihaynId: string; book: string; number: number; score: number }> = [];

  for (const quote of rajabQuotes) {
    const topics: Array<{ topic: RajabTopic; sectionId: string | null }> = [
      ...quote.sinLinks.map((link) => ({
        topic: { slug: link.sin.slug, side: 'sin' as const },
        sectionId: link.sectionId,
      })),
      ...quote.goodDeedLinks.map((link) => ({
        topic: { slug: link.goodDeed.slug, side: 'deed' as const },
        sectionId: link.sectionId,
      })),
    ];
    if (topics.length === 0) continue;

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

    const key = `${best.entry.book}:${best.entry.number}`;
    const sahihaynId = sahihaynByKey.get(key);
    if (!sahihaynId) continue;

    const bookName = best.entry.book === ReferenceBook.BUKHARI ? 'البخاري' : 'مسلم';
    const rajabBook = quote.bookTitle ?? 'كتب ابن رجب';
    const note = `رواه ${bookName} (${best.entry.number}) — أورده ابن رجب في ${rajabBook}`;

    for (const { topic, sectionId } of topics) {
      const made = await linkTopic(
        prisma,
        sahihaynId,
        topic,
        topicIds,
        note,
        LinkBasis.TAKHRIJ,
        sectionId,
      );
      if (made) linked += 1;
    }
    if (samples.length < 12) {
      samples.push({
        rajabId: quote.id,
        sahihaynId,
        book: best.entry.book,
        number: best.entry.number,
        score: best.score,
      });
    }
  }

  return { matches, linked, samples };
}

export async function runIbnRajab(options: ImportOptions): Promise<void> {
  const remediation = options.dryRun
    ? { rajabBookRows: 0, restored: [], flagsRemoved: 0 }
    : await remediateGrades(options.prisma);

  const sins = new Map((await options.prisma.sin.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]));
  const deeds = new Map((await options.prisma.goodDeed.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]));
  const topicIds = { sins, deeds };
  const topicId = (topic: RajabTopic): string => {
    const id = (topic.side === 'sin' ? sins : deeds).get(topic.slug);
    if (!id) throw new Error(`Missing topic ${topic.slug}`);
    return id;
  };
  void topicId;

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
  let linked = 0;
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
    const passages = extractRajabPassages(book.key, bytes.toString('utf8'), book.topics);
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
          // Reuse any existing narration for topic selection. Never change its grade.
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

      for (const topic of passage.topics) {
        if (options.dryRun) {
          linked += 1;
          continue;
        }
        const note = `من كتاب ${book.nameAr}`;
        const made = await linkTopic(
          options.prisma,
          quote.id,
          topic,
          topicIds,
          note,
          LinkBasis.REVIEWER_SECTION,
          section.id,
        );
        if (made) linked += 1;
      }
    }
  }

  const takhrij = options.dryRun
    ? { matches: 0, linked: 0, samples: [] }
    : await linkSahihaynViaTakhrij(options.prisma, topicIds);

  const remainingIbn = await options.prisma.quote.count({ where: { gradeSource: GradeSource.IBN_RAJAB } });

  console.log(JSON.stringify({
    created,
    reused,
    linked,
    byBook,
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
