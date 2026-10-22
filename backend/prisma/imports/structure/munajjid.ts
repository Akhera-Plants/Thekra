/**
 * «سلسلة أعمال القلوب» is copyrighted. Only citations are imported:
 * Quran keys, a strong Bukhari/Muslim match, and a page-range attribution.
 * His prose is never written to a quote.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, QuoteType, type PrismaClient } from '@prisma/client';
import { combinedScore, wordOverlap, STRONG_MATCH_SCORE } from '../../../src/common/text/match-score.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import { extractCitations } from './citations.js';
import type { ParsedItem, ParsedSection } from './parse.js';

export const MUNAJJID_SOURCE_ID = '10000000-0000-4000-8000-000000000015';
export const MUNAJJID_DATASET = 'ieasybooks-org/prophet-mosque-library';
export const MUNAJJID_COMMIT = 'fc5372ff6258e20d51c4ddf0b4326695675ef12c';
export const MUNAJJID_SHA256 = '61641c5341226ad06f2ca7cb9dae450aba49e2be3442f0410613ece0771245e7';
const MUNAJJID_FILE = 'KTB_0118440.txt';
const ALJAM3_BOOK = 38380;
const ALJAM3_FILE = 71356;

const BUKHARI_SOURCE_ID = '10000000-0000-4000-8000-000000000002';
const MUSLIM_SOURCE_ID = '10000000-0000-4000-8000-000000000003';

/** Printed index. The digitized file's part N is printed page N. */
export const MUNAJJID_CHAPTERS: ReadonlyArray<{ titleAr: string; page: number }> = [
  { titleAr: 'الإخلاص', page: 7 },
  { titleAr: 'الخوف', page: 36 },
  { titleAr: 'الرجاء', page: 68 },
  { titleAr: 'الرضا', page: 91 },
  { titleAr: 'الصبر', page: 122 },
  { titleAr: 'الشكر', page: 153 },
  { titleAr: 'التفكر', page: 177 },
  { titleAr: 'التوكل', page: 200 },
  { titleAr: 'المحبة', page: 233 },
  { titleAr: 'المحاسبة', page: 257 },
  { titleAr: 'التقوى', page: 285 },
  { titleAr: 'الورع', page: 315 },
];

const LAST_PAGE = 333;

export function munajjidAttribution(page: number): string {
  return `ذكره الشيخ محمد صالح المنجد في سلسلة أعمال القلوب، ص ${page}`;
}

const CORPUS = join(import.meta.dirname, '..', '..', '..', '.corpus', 'munajjid', MUNAJJID_FILE);

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function downloadUrl(): string {
  const path = 'txt/4ـ 218.1 التزكية والأخلاق والآداب/00333ـ سلسلة أعمال القلوب - المنجد --- محمد صالح المنجد.PDF/KTB_0118440.txt';
  return `https://huggingface.co/datasets/${MUNAJJID_DATASET}/resolve/${MUNAJJID_COMMIT}/${encodeURI(path)}`;
}

export async function loadMunajjidText(): Promise<string> {
  if (!existsSync(CORPUS)) {
    const response = await fetch(downloadUrl(), { headers: { 'User-Agent': 'thekra-import' } });
    if (!response.ok) throw new Error(`Munajjid download failed (${response.status})`);
    mkdirSync(join(CORPUS, '..'), { recursive: true });
    writeFileSync(CORPUS, Buffer.from(await response.arrayBuffer()));
  }
  const content = readFileSync(CORPUS);
  const actual = sha256(content);
  if (actual !== MUNAJJID_SHA256) {
    throw new Error(`Munajjid checksum mismatch: expected ${MUNAJJID_SHA256}, got ${actual}`);
  }
  return content.toString('utf8');
}

export interface MunajjidChapter {
  titleAr: string;
  pageFrom: number;
  pageTo: number;
  /** Digitized pages of this chapter. Used only to find citations. */
  body: string;
}

export function munajjidChapters(text: string): MunajjidChapter[] {
  const parts = text.split('PAGE_SEPARATOR');
  return MUNAJJID_CHAPTERS.map((chapter, index) => {
    const next = MUNAJJID_CHAPTERS[index + 1]?.page ?? (LAST_PAGE + 1);
    const pageTo = next - 1;
    // The file's part 0 is the cover; part (page - 1) is the printed page.
    const body = parts.slice(chapter.page - 1, next - 1).join('\n');
    return { titleAr: chapter.titleAr, pageFrom: chapter.page, pageTo, body };
  });
}

interface CitationHit {
  offset: number;
  item: ParsedItem;
}

function verseItems(body: string, line: number): CitationHit[] {
  const hits: CitationHit[] = [];
  const pattern = /\[[^\[\]\d:]{1,40}?\s*:\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,3}(?:\s*(?:[-–—]|إلى|الى|إلي)\s*[0-9\u0660-\u0669\u06F0-\u06F9]{1,3})?\s*\]/g;
  for (const match of body.matchAll(pattern)) {
    const cites = extractCitations(match[0] ?? '');
    for (const cite of cites) {
      const surah = Number(cite.from.split(':')[0]);
      const start = Number(cite.from.split(':')[1]);
      const end = Number(cite.to.split(':')[1]);
      for (let ayah = start; ayah <= end; ayah += 1) {
        const key = `${surah}:${ayah}`;
        hits.push({
          offset: match.index ?? 0,
          item: { kind: 'AYAH', line, hadithNumber: null, text: null, ayahFrom: key, ayahTo: key },
        });
      }
    }
  }
  return hits;
}

/** Quoted reports. The wording stays in memory for the matcher and is not stored. */
export function citedMatns(body: string): Array<{ offset: number; matn: string }> {
  const found: Array<{ offset: number; matn: string }> = [];
  const pattern = /«([^»]{12,700})»/g;
  for (const match of body.matchAll(pattern)) {
    const matn = (match[1] ?? '').replace(/\s+/g, ' ').trim();
    if ((matn.match(/[\u0621-\u064A]/g) ?? []).length < 12) continue;
    found.push({ offset: match.index ?? 0, matn });
  }
  return found;
}

interface ReferenceRow {
  book: 'BUKHARI' | 'MUSLIM';
  number: number;
  normalized: string;
  words: Set<string>;
}

function wordsOf(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter((word) => word.length >= 2));
}

function overlap(matn: string, words: Set<string>): number {
  return wordOverlap(normalizeMatn(matn), [...words].join(' '));
}

export async function matchSahihayn(
  prisma: PrismaClient,
  matns: readonly string[],
): Promise<Map<string, string>> {
  const linked = new Map<string, string>();
  if (matns.length === 0) return linked;
  const references = await prisma.referenceHadith.findMany({
    select: { book: true, number: true, normalizedMatn: true },
  });
  const rows: ReferenceRow[] = references.map((row) => ({
    book: row.book,
    number: row.number,
    normalized: row.normalizedMatn,
    words: wordsOf(row.normalizedMatn),
  }));
  const quotes = await prisma.quote.findMany({
    where: {
      type: QuoteType.HADITH,
      sourceId: { in: [BUKHARI_SOURCE_ID, MUSLIM_SOURCE_ID] },
      referenceNumber: { not: null },
    },
    select: { id: true, sourceId: true, referenceNumber: true, textSource: true },
    orderBy: { id: 'asc' },
  });
  const byKey = new Map<string, string>();
  for (const quote of quotes) {
    const book = quote.sourceId === BUKHARI_SOURCE_ID ? 'BUKHARI' : 'MUSLIM';
    const key = `${book}:${quote.referenceNumber}`;
    const current = byKey.get(key);
    if (!current || quote.textSource === 'DIGITAL') byKey.set(key, quote.id);
  }

  const pending: Array<{ matn: string; normalized: string; candidates: Array<{ book: 'BUKHARI' | 'MUSLIM'; number: number; overlap: number }> }> = [];
  for (const matn of matns) {
    const normalized = normalizeMatn(matn);
    const ranked: Array<{ book: 'BUKHARI' | 'MUSLIM'; number: number; overlap: number }> = [];
    for (const row of rows) {
      const next = overlap(matn, row.words);
      if (next < 0.45) continue;
      ranked.push({ book: row.book, number: row.number, overlap: next });
    }
    ranked.sort((left, right) => right.overlap - left.overlap);
    const candidates = ranked.slice(0, 8);
    if (candidates.length > 0) pending.push({ matn, normalized, candidates });
  }

  const flat = pending.flatMap((row) => row.candidates.map((candidate) => ({ ...row, ...candidate })));
  const trgm = new Map<string, number>();
  const chunkSize = 200;
  for (let start = 0; start < flat.length; start += chunkSize) {
    const chunk = flat.slice(start, start + chunkSize);
    const values = Prisma.join(chunk.map((row) => Prisma.sql`(${row.book}, ${row.number}, ${row.normalized})`));
    const scored = await prisma.$queryRaw<Array<{ book: string; number: number; matn: string; trgm: number }>>`
      SELECT r.book::text AS book, r.number, v.matn, similarity(r."normalizedMatn", v.matn) AS trgm
      FROM "ReferenceHadith" r
      JOIN (VALUES ${values}) AS v(book, number, matn)
        ON r.book::text = v.book AND r.number = v.number::int
    `;
    for (const row of scored) trgm.set(`${row.matn}|${row.book}:${row.number}`, Number(row.trgm));
  }
  for (const row of pending) {
    let bestQuote: string | null = null;
    let bestScore = 0;
    for (const candidate of row.candidates) {
      const similarity = trgm.get(`${row.normalized}|${candidate.book}:${candidate.number}`) ?? 0;
      const score = combinedScore(similarity, candidate.overlap);
      if (score < STRONG_MATCH_SCORE || score < bestScore) continue;
      const quoteId = byKey.get(`${candidate.book}:${candidate.number}`);
      if (!quoteId) continue;
      bestScore = score;
      bestQuote = quoteId;
    }
    if (bestQuote) linked.set(row.matn, bestQuote);
  }
  return linked;
}

export async function parseMunajjid(prisma: PrismaClient, text: string): Promise<ParsedSection[]> {
  const chapters = munajjidChapters(text);
  const matns = [...new Set(chapters.flatMap((chapter) => citedMatns(chapter.body).map((hit) => hit.matn)))];
  const matches = await matchSahihayn(prisma, matns);
  return chapters.map((chapter, index) => {
    const hits: CitationHit[] = verseItems(chapter.body, index + 1);
    const seen = new Set<string>();
    for (const hit of citedMatns(chapter.body)) {
      const quoteId = matches.get(hit.matn);
      if (!quoteId || seen.has(quoteId)) continue;
      seen.add(quoteId);
      hits.push({
        offset: hit.offset,
        item: {
          kind: 'HADITH',
          line: index + 1,
          hadithNumber: null,
          text: null,
          ayahFrom: null,
          ayahTo: null,
          quoteId,
        },
      });
    }
    hits.sort((left, right) => left.offset - right.offset);
    const items = hits.map((hit) => hit.item);
    items.push({
      kind: 'AUTHOR_TEXT',
      line: index + 1,
      hadithNumber: null,
      text: '',
      ayahFrom: null,
      ayahTo: null,
      quoteId: null,
    });
    const section: ParsedSection = {
      level: 'KITAB',
      number: String(chapter.pageFrom),
      titleAr: chapter.titleAr,
      line: index + 1,
      volume: null,
      page: String(chapter.pageFrom),
      parentIndex: null,
      rank: 1,
      items,
    };
    return section;
  });
}

export function munajjidProvenance(): { aljam3Book: number; aljam3File: number; dataset: string; commit: string; sha256: string } {
  return {
    aljam3Book: ALJAM3_BOOK,
    aljam3File: ALJAM3_FILE,
    dataset: MUNAJJID_DATASET,
    commit: MUNAJJID_COMMIT,
    sha256: MUNAJJID_SHA256,
  };
}
