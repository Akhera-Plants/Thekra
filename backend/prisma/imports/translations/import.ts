/**
 * English for narrations whose soundness is already confirmed, and for the
 * stored verses. The hadith wording comes from the English edition of the
 * same six-book file. The verse wording comes from Quran.com resource 131,
 * the translation that provider already requests. Re-running writes nothing
 * when the stored English is unchanged.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuoteType } from '@prisma/client';
import { PUBLISHABLE_GRADE_SOURCES } from '../../../src/modules/hadith/grade-policy.js';
import { applyLimit, type ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { citedEditions, plainEnglish, type EnglishBook } from './citation.js';
import { ENGLISH_EDITIONS, QURAN_EN_FILE, QURAN_EN_SHA256, QURAN_EN_URL, hadithEditionUrl } from './files.js';

const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/translations');

interface EditionHadith {
  hadithnumber: number | string;
  text?: string;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function ensureFile(file: string, expected: string, url: string | null): Promise<Buffer> {
  if (!expected) throw new Error(`Missing pinned hash for ${file}`);
  const path = join(CORPUS_DIR, file);
  let bytes: Buffer;
  if (existsSync(path)) {
    bytes = readFileSync(path);
  } else if (url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'thekra-import' } });
    if (!response.ok) throw new Error(`${file} download failed (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
    mkdirSync(CORPUS_DIR, { recursive: true });
    writeFileSync(path, bytes);
  } else {
    throw new Error(`Missing corpus file ${file}`);
  }
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`Hash mismatch for ${file}: expected ${expected}, got ${actual}`);
  return bytes;
}

function indexEdition(bytes: Buffer): Map<number, string> {
  const parsed = JSON.parse(bytes.toString('utf8')) as { hadiths?: EditionHadith[] };
  const index = new Map<number, string>();
  for (const row of parsed.hadiths ?? []) {
    const number = Number(row.hadithnumber);
    const text = plainEnglish(row.text ?? '');
    if (!Number.isInteger(number) || number < 1 || text.length < 8 || index.has(number)) continue;
    index.set(number, text);
  }
  return index;
}

async function loadQuranEnglish(): Promise<Map<string, string>> {
  const bytes = await ensureFile(QURAN_EN_FILE, QURAN_EN_SHA256, QURAN_EN_URL);
  const parsed = JSON.parse(bytes.toString('utf8')) as { quran?: Array<{ chapter: number; verse: number; text: string }> };
  const index = new Map<string, string>();
  for (const row of parsed.quran ?? []) {
    const text = plainEnglish(row.text ?? '');
    if (row.chapter >= 1 && row.verse >= 1 && text.length > 0) index.set(`${row.chapter}:${row.verse}`, text);
  }
  if (index.size !== 6236) throw new Error(`Quran English has ${index.size} verses, expected 6236`);
  return index;
}

function englishFor(reference: string | null, editions: ReadonlyMap<EnglishBook, Map<number, string>>): string | null {
  for (const cite of citedEditions(reference)) {
    const text = editions.get(cite.book)?.get(cite.number);
    if (text) return text;
  }
  return null;
}

export async function runTranslations(options: ImportOptions): Promise<void> {
  const editions = new Map<EnglishBook, Map<number, string>>();
  for (const edition of ENGLISH_EDITIONS) {
    const bytes = await ensureFile(edition.file, edition.sha256, hadithEditionUrl(edition.file));
    editions.set(edition.book, indexEdition(bytes));
  }
  const quran = await loadQuranEnglish();

  const hadiths = applyLimit(await options.prisma.quote.findMany({
    where: { type: QuoteType.HADITH, gradeSource: { in: [...PUBLISHABLE_GRADE_SOURCES] } },
    select: { id: true, gradeReference: true },
    orderBy: { id: 'asc' },
  }), options.limit);
  const verses = options.limit === null
    ? await options.prisma.quote.findMany({
      where: { type: QuoteType.QURAN_VERSE, surahNumber: { not: null }, ayahNumber: { not: null } },
      select: { id: true, surahNumber: true, ayahNumber: true },
    })
    : [];

  const desired = new Map<string, string>();
  let hadithMiss = 0;
  for (const row of hadiths) {
    const text = englishFor(row.gradeReference, editions);
    if (!text) {
      hadithMiss += 1;
      continue;
    }
    desired.set(row.id, text);
  }
  let verseMiss = 0;
  for (const row of verses) {
    const text = quran.get(`${row.surahNumber}:${row.ayahNumber}`);
    if (!text) {
      verseMiss += 1;
      continue;
    }
    desired.set(row.id, text);
  }

  const ids = [...desired.keys()];
  const existing: Array<{ id: string; quoteId: string; text: string }> = [];
  for (let start = 0; start < ids.length; start += 1000) {
    existing.push(...await options.prisma.translation.findMany({
      where: { languageCode: 'en', quoteId: { in: ids.slice(start, start + 1000) } },
      select: { id: true, quoteId: true, text: true },
    }));
  }
  const have = new Map(existing.map((row) => [row.quoteId, row]));
  const creates: Array<{ quoteId: string; languageCode: string; text: string }> = [];
  const updates: Array<{ id: string; text: string }> = [];
  for (const [quoteId, text] of desired) {
    const row = have.get(quoteId);
    if (!row) creates.push({ quoteId, languageCode: 'en', text });
    else if (row.text !== text) updates.push({ id: row.id, text });
  }

  console.log(JSON.stringify({
    hadiths: hadiths.length,
    translatedHadiths: hadiths.length - hadithMiss,
    hadithMiss,
    verses: verses.length,
    verseMiss,
    create: creates.length,
    update: updates.length,
    unchanged: desired.size - creates.length - updates.length,
    dryRun: options.dryRun,
  }));
  if (options.dryRun) return;

  await inTransactionBatches(options.prisma, creates, async (tx, batch) => {
    await tx.translation.createMany({ data: batch, skipDuplicates: true });
  });
  await inTransactionBatches(options.prisma, updates, async (tx, batch) => {
    for (const row of batch) await tx.translation.update({ where: { id: row.id }, data: { text: row.text } });
  }, undefined, 100);
}
