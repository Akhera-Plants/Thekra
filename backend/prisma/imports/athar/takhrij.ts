/**
 * A kept athar story that matches a Bukhari, Muslim, Sunan (al-Arna'ut),
 * or HadeethEnc matn at the strong-match cut is prophetic, not athar.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, type PrismaClient } from '@prisma/client';
import { STRONG_MATCH_SCORE, combinedScore, wordOverlap } from '../../../src/common/text/match-score.js';
import { splitMatn } from '../../../src/common/text/matn.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import { SUNAN_EDITIONS } from '../sunan-tahqiq/files.js';

const HADEETHENC = 'hadeethenc.com';
const SUNAN_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/sunan-tahqiq');

export interface MatnHit {
  label: string;
  score: number;
}

interface CorpusMatn {
  label: string;
  normalized: string;
  words: string[];
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

function loadSunan(): CorpusMatn[] {
  const rows: CorpusMatn[] = [];
  const seen = new Set<string>();
  for (const edition of SUNAN_EDITIONS) {
    const parsed = JSON.parse(readFileSync(join(SUNAN_DIR, edition.file), 'utf8')) as {
      hadiths?: Array<{ hadithnumber?: number; text?: string }>;
    };
    for (const hadith of parsed.hadiths ?? []) {
      if (!Number.isInteger(hadith.hadithnumber) || typeof hadith.text !== 'string') continue;
      const key = `${edition.book}:${hadith.hadithnumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const matn = normalizeMatn(splitMatn(hadith.text).matnText || hadith.text);
      if (matn.length < 25) continue;
      rows.push({ label: `SUNAN ${edition.book} ${hadith.hadithnumber}`, normalized: matn, words: matnWords(matn) });
    }
  }
  return rows;
}

async function loadCorpus(prisma: PrismaClient): Promise<CorpusMatn[]> {
  const refs = await prisma.referenceHadith.findMany({
    select: { book: true, number: true, normalizedMatn: true },
  });
  const hadeethenc = await prisma.quote.findMany({
    where: { apiProvider: HADEETHENC },
    select: { referenceNumber: true, externalId: true, matnAr: true, textAr: true },
  });
  const corpus: CorpusMatn[] = [];
  for (const row of refs) {
    const normalized = row.normalizedMatn.trim();
    if (normalized.length < 25) continue;
    corpus.push({
      label: `${row.book} ${row.number}`,
      normalized,
      words: matnWords(normalized),
    });
  }
  for (const row of hadeethenc) {
    const matn = normalizeMatn((row.matnAr && row.matnAr.trim()) || splitMatn(row.textAr).matnText || row.textAr);
    if (matn.length < 25) continue;
    corpus.push({
      label: `HADEETHENC ${row.referenceNumber ?? row.externalId ?? ''}`,
      normalized: matn,
      words: matnWords(matn),
    });
  }
  corpus.push(...loadSunan());
  return corpus;
}

async function trigramScores(
  prisma: PrismaClient,
  pairs: Array<{ key: string; left: string; right: string }>,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const chunkSize = 300;
  for (let offset = 0; offset < pairs.length; offset += chunkSize) {
    const chunk = pairs.slice(offset, offset + chunkSize);
    const values = Prisma.join(
      chunk.map((row) => Prisma.sql`(${row.key}::text, ${row.left}::text, ${row.right}::text)`),
    );
    const rows = await prisma.$queryRaw<Array<{ key: string; trgm: number }>>`
      SELECT pair_key AS "key", similarity(left_text, right_text) AS trgm
      FROM (VALUES ${values}) AS t(pair_key, left_text, right_text)
    `;
    for (const row of rows) scores.set(row.key, Number(row.trgm));
  }
  return scores;
}

/**
 * Best strong matn hit for each story, keyed by the caller's id.
 * A pair below the overlap floor cannot reach 0.75 even with trigram 1.
 */
export async function strongMatnHits(
  prisma: PrismaClient,
  stories: readonly { id: string; text: string }[],
): Promise<Map<string, MatnHit>> {
  const corpus = await loadCorpus(prisma);
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

  const normalized = stories.map((story) => ({
    id: story.id,
    text: normalizeMatn(story.text),
    words: matnWords(normalizeMatn(story.text)),
  }));
  const pairs: Array<{ key: string; left: string; right: string; storyId: string; label: string }> = [];
  for (const story of normalized) {
    if (story.text.length < 25) continue;
    for (const index of proposeIndexes(story.words, postings, documentFrequency)) {
      const candidate = corpus[index];
      if (!candidate) continue;
      if (wordOverlap(story.text, candidate.normalized) < 0.5) continue;
      pairs.push({
        key: `${story.id}:${index}`,
        left: story.text,
        right: candidate.normalized,
        storyId: story.id,
        label: candidate.label,
      });
    }
  }

  const trgm = pairs.length === 0 ? new Map<string, number>() : await trigramScores(prisma, pairs);
  const best = new Map<string, MatnHit>();
  for (const pair of pairs) {
    const score = combinedScore(trgm.get(pair.key) ?? 0, wordOverlap(pair.left, pair.right));
    if (score < STRONG_MATCH_SCORE) continue;
    const current = best.get(pair.storyId);
    if (!current || score > current.score) best.set(pair.storyId, { label: pair.label, score });
  }
  console.log(`athar takhrij corpus=${corpus.length} pairs=${pairs.length} strong=${best.size}`);
  return best;
}
