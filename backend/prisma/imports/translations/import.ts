/**
 * English for narrations whose soundness is already confirmed, and for the
 * stored verses. The hadith wording comes from the English edition of the
 * same six-book file, found by the printed number the citation names and
 * checked against the stored Arabic (match.ts). The verse wording comes from
 * Quran.com resource 131, the translation that provider already requests.
 * Re-running writes nothing when the stored English is unchanged.
 *
 * An English row this importer wrote earlier (its text is an edition entry)
 * is replaced or removed when it no longer belongs to the narration; English
 * from other sources (HadeethEnc) is left alone. Every change is written to a
 * report with the previous text, so it can be reviewed and reverted.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QuoteType } from '@prisma/client';
import { PUBLISHABLE_GRADE_SOURCES } from '../../../src/modules/hadith/grade-policy.js';
import { applyLimit, type ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { citedEditions, plainEnglish, type EnglishBook } from './citation.js';
import {
  ARABIC_EDITIONS,
  ENGLISH_EDITIONS,
  QURAN_EN_FILE,
  QURAN_EN_SHA256,
  QURAN_EN_URL,
  hadithEditionUrl,
} from './files.js';
import { CORPUS_DIR, editionRows, ensureFile } from './editions.js';
import { arabicWords, indexByPrintedNumber, pickEntry, type EditionEntry } from './match.js';

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

function englishFor(
  reference: string | null,
  arabic: string,
  editions: ReadonlyMap<EnglishBook, Map<number, EditionEntry[]>>,
): string | null {
  const stored = arabicWords(arabic);
  for (const cite of citedEditions(reference)) {
    const pick = pickEntry(stored, editions.get(cite.book)?.get(cite.number) ?? []);
    if (pick) return pick.entry.english;
  }
  return null;
}

export async function runTranslations(options: ImportOptions): Promise<void> {
  const editions = new Map<EnglishBook, Map<number, EditionEntry[]>>();
  // Every English text of the editions: a stored row with one of these texts was written here.
  const editionTexts = new Set<string>();
  for (const edition of ENGLISH_EDITIONS) {
    const arabicFile = ARABIC_EDITIONS.find((row) => row.book === edition.book);
    if (!arabicFile) throw new Error(`No Arabic edition for ${edition.book}`);
    const english = editionRows(await ensureFile(edition.file, edition.sha256, hadithEditionUrl(edition.file)));
    const arabic = editionRows(await ensureFile(arabicFile.file, arabicFile.sha256, hadithEditionUrl(arabicFile.file)));
    const arabicByRunning = new Map(arabic.map((row) => [Number(row.hadithnumber), row.text ?? '']));
    for (const row of english) editionTexts.add(plainEnglish(row.text ?? ''));
    editions.set(edition.book, indexByPrintedNumber(english, arabicByRunning, plainEnglish));
  }
  const quran = await loadQuranEnglish();

  const hadiths = applyLimit(await options.prisma.quote.findMany({
    where: { type: QuoteType.HADITH, gradeSource: { in: [...PUBLISHABLE_GRADE_SOURCES] } },
    select: { id: true, gradeReference: true, textAr: true, matnAr: true },
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
    const text = englishFor(row.gradeReference, row.matnAr || row.textAr, editions);
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

  // Existing English of every hadith in scope (not only the matched ones), so a wrong row can be removed.
  const ids = [...new Set([...hadiths.map((row) => row.id), ...desired.keys()])];
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
  const removals: Array<{ id: string }> = [];
  const report: Array<{ quoteId: string; action: 'create' | 'update' | 'delete'; before: string | null; after: string | null }> = [];
  for (const [quoteId, text] of desired) {
    const row = have.get(quoteId);
    if (!row) {
      creates.push({ quoteId, languageCode: 'en', text });
      report.push({ quoteId, action: 'create', before: null, after: text });
    } else if (row.text !== text && editionTexts.has(row.text)) {
      updates.push({ id: row.id, text });
      report.push({ quoteId, action: 'update', before: row.text, after: text });
    }
  }
  for (const row of existing) {
    if (desired.has(row.quoteId) || !editionTexts.has(row.text)) continue;
    removals.push({ id: row.id });
    report.push({ quoteId: row.quoteId, action: 'delete', before: row.text, after: null });
  }

  const reportPath = join(CORPUS_DIR, `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  mkdirSync(CORPUS_DIR, { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ dryRun: options.dryRun, changes: report }, null, 1));

  console.log(JSON.stringify({
    hadiths: hadiths.length,
    translatedHadiths: hadiths.length - hadithMiss,
    hadithMiss,
    verses: verses.length,
    verseMiss,
    create: creates.length,
    update: updates.length,
    delete: removals.length,
    unchanged: desired.size - creates.length - updates.length,
    report: reportPath,
    dryRun: options.dryRun,
  }));
  if (options.dryRun) return;

  await inTransactionBatches(options.prisma, creates, async (tx, batch) => {
    await tx.translation.createMany({ data: [...batch], skipDuplicates: true });
  });
  await inTransactionBatches(options.prisma, updates, async (tx, batch) => {
    for (const row of batch) await tx.translation.update({ where: { id: row.id }, data: { text: row.text } });
  }, undefined, 100);
  await inTransactionBatches(options.prisma, removals, async (tx, batch) => {
    await tx.translation.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } });
  });
}
