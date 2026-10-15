/**
 * Imports prophetic reports from eight books of Ibn Rajab onto the topics
 * the owner named. Inclusion is treated as sahih. A report he marks weak
 * in the same place is not published. A strong match to a narration already
 * stored is reused instead of copied.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BookLevel,
  ClassifiedBy,
  FlagSeverity,
  FlagType,
  GradeSource,
  HadithGrade,
  LinkBasis,
  LinkReviewStatus,
  QuoteOrigin,
  QuoteType,
  SectionItemKind,
  TextSource,
  type PrismaClient,
} from '@prisma/client';
import { combinedScore, wordOverlap, STRONG_MATCH_SCORE } from '../../../src/common/text/match-score.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import { OUTSIDE_SAHIHAYN_NOTE, citesSahihayn } from '../../../src/modules/hadith/sunan-tahqiq.js';
import type { ImportOptions } from '../lib/cli.js';
import { RAJAB_BOOKS } from './books.js';
import { extractRajabPassages, type RajabTopic } from './extract.js';

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/ibn-rajab');
const PROVIDER = 'ibn-rajab';
const AUTHORITY = 'ابن رجب الحنبلي';
const SHOWN_AT = new Date('2026-10-14T20:00:00.000Z');

interface StoredHadith {
  id: string;
  gradeSource: GradeSource;
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

export async function runIbnRajab(options: ImportOptions): Promise<void> {
  const sins = new Map((await options.prisma.sin.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]));
  const deeds = new Map((await options.prisma.goodDeed.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]));
  const topicId = (topic: RajabTopic): string => {
    const id = (topic.side === 'sin' ? sins : deeds).get(topic.slug);
    if (!id) throw new Error(`Missing topic ${topic.slug}`);
    return id;
  };

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
  let flagged = 0;
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
        if (match && match.gradeSource !== GradeSource.AUTHORITY_LEGACY) {
          quote = { id: match.id, gradeSource: match.gradeSource };
          reused += 1;
        } else if (match) {
          if (!options.dryRun) {
            await options.prisma.quote.update({
              where: { id: match.id },
              data: {
                grade: HadithGrade.SAHIH,
                gradeSource: GradeSource.IBN_RAJAB,
                gradeAuthority: AUTHORITY,
                gradeReference: book.nameAr,
                textVerifiedAt: SHOWN_AT,
              },
            });
          }
          quote = { id: match.id, gradeSource: GradeSource.IBN_RAJAB };
          match.gradeSource = GradeSource.IBN_RAJAB;
          created += 1;
        } else if (!options.dryRun) {
          const made = await options.prisma.quote.create({
            data: {
              type: QuoteType.HADITH,
              origin: QuoteOrigin.LOCAL,
              textAr: passage.text,
              sourceId: book.id,
              apiProvider: PROVIDER,
              externalId: key,
              grade: HadithGrade.SAHIH,
              gradeSource: GradeSource.IBN_RAJAB,
              gradeAuthority: AUTHORITY,
              gradeReference: book.nameAr,
              textSource: TextSource.OCR,
              textVerifiedAt: SHOWN_AT,
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

      if (!options.dryRun && quote.gradeSource === GradeSource.IBN_RAJAB && !citesSahihayn(passage.text)) {
        const existingFlag = await options.prisma.quoteFlag.findFirst({
          where: { quoteId: quote.id, type: FlagType.OUTSIDE_SAHIHAYN },
          select: { id: true },
        });
        if (!existingFlag) {
          await options.prisma.quoteFlag.create({
            data: {
              quoteId: quote.id,
              type: FlagType.OUTSIDE_SAHIHAYN,
              severity: FlagSeverity.LOW,
              source: 'AUTO',
              note: OUTSIDE_SAHIHAYN_NOTE,
              details: { book: book.nameAr },
            },
          });
          flagged += 1;
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
        const id = topicId(topic);
        const note = `من كتاب ${book.nameAr}`;
        if (topic.side === 'sin') {
          const have = await options.prisma.sinQuote.findUnique({
            where: { sinId_quoteId: { sinId: id, quoteId: quote.id } },
            select: { id: true },
          });
          if (have || options.dryRun) {
            if (!have) linked += 1;
            continue;
          }
          await options.prisma.sinQuote.create({
            data: {
              sinId: id,
              quoteId: quote.id,
              note,
              reviewStatus: LinkReviewStatus.ACCEPTED,
              basis: LinkBasis.REVIEWER_SECTION,
              classifiedBy: ClassifiedBy.REVIEWER,
              sectionId: section.id,
            },
          });
        } else {
          const have = await options.prisma.goodDeedQuote.findUnique({
            where: { goodDeedId_quoteId: { goodDeedId: id, quoteId: quote.id } },
            select: { id: true },
          });
          if (have || options.dryRun) {
            if (!have) linked += 1;
            continue;
          }
          await options.prisma.goodDeedQuote.create({
            data: {
              goodDeedId: id,
              quoteId: quote.id,
              note,
              reviewStatus: LinkReviewStatus.ACCEPTED,
              basis: LinkBasis.REVIEWER_SECTION,
              classifiedBy: ClassifiedBy.REVIEWER,
              sectionId: section.id,
            },
          });
        }
        linked += 1;
      }
    }
  }

  console.log(JSON.stringify({ created, reused, linked, flagged, byBook, dryRun: options.dryRun }));
}
