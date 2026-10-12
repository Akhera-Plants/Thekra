/**
 * Waqfeya OCR editions (Hugging Face ieasybooks-org/waqfeya-library, MIT).
 * TXT pages are split on PAGE_SEPARATOR. Quran spans are replaced with Uthmani
 * text before any quote is stored. OCR quotes stay unverified.
 */
import { HadithGrade, TextSource, type Prisma } from '@prisma/client';
import { inTransactionBatches } from '../lib/batch.js';
import { applyLimit, preview, type ImportOptions } from '../lib/cli.js';
import type { CorpusFile } from '../lib/corpus.js';
import { assertArabicText } from '../lib/guard.js';
import { upsertBookQuotes, type BookQuoteRow } from '../lib/quotes.js';
import { formatSummary, recordProgress, withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import { printChapterReport, suggestChapterMaps } from './chapters.js';
import { cleanOcrPage, runningHeaderKeys } from './clean.js';
import { WAQFEYA_ROOT, asCorpusFile, assertPageCount, loadWaqfeyaFile, splitPages, type WaqfeyaFile } from './files.js';
import { joinPages, parseRiyad, parseTarghib, parseZuhd, type ParsedChapter, type ParsedNarration } from './parse.js';
import { applyVerseReplacements, detectQuranSpans, keysCovering, loadUthmaniMap } from './quran.js';
import { join } from 'node:path';

const TARGHIB_DIR =
  'txt/2ـ 213.7 (577) باقي مجموعات الحديث/03790ـ صحيح الترغيب والترهيب - ضعيف الترغيب والترهيب --- عبد العظيم بن عبد القوي المنذري زكي الدين.PDF';

const TARGHIB_VOLUMES = [
  { volume: '1', path: `${TARGHIB_DIR}/الجزء 01-1.txt` },
  { volume: '2', path: `${TARGHIB_DIR}/الجزء 01-2.txt` },
  { volume: '3', path: `${TARGHIB_DIR}/الجزء 01-3.txt` },
] as const;

const TARGHIB_COVER = `${TARGHIB_DIR}/الواجهة.txt`;

const RIYAD_PATH =
  'txt/2ـ 213.6 (230) المسانيد الأخرى والجوامع/00680ـ رياض الصالحين من حديث سيد المرسلين (ت_ الحلبي) --- يحي بن شرف النووي الدمشقي أبو زكريا.PDF/الكتاب.txt';

const ZUHD_PATH =
  'txt/4ـ 218.1 (421) التزكية والأخلاق والآداب/01248ـ الزهد والرقائق (ط. المعراج) --- عبد الله بن المبارك المروزي.PDF/الكتاب.txt';

const MINHAJ_PATH =
  'txt/4ـ 218.1 (421) التزكية والأخلاق والآداب/00488ـ مختصر منهاج القاصدين (ت_ العارف) --- أحمد بن محمد بن عبد الرحمن بن قدامة المقدسي.PDF/الكتاب.txt';

interface Prepared {
  file: WaqfeyaFile;
  corpus: CorpusFile;
  pages: Array<{ volume: string; page: number; text: string }>;
}

function prepare(relativePath: string, volume: string): Prepared {
  const file = loadWaqfeyaFile(relativePath);
  const rawPages = splitPages(file.text);
  const headers = runningHeaderKeys(rawPages);
  return {
    file,
    corpus: asCorpusFile(file),
    pages: rawPages.map((text, index) => ({
      volume,
      page: index + 1,
      text: cleanOcrPage(text, headers),
    })),
  };
}

function seededSample<T>(items: readonly T[], count: number, seed: number): T[] {
  let state = seed >>> 0;
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const index = state % pool.length;
    picked.push(pool.splice(index, 1)[0]!);
  }
  return picked;
}

function printSamples(narrations: readonly ParsedNarration[], seed: number): void {
  console.log('samples:');
  for (const narration of seededSample(narrations, 10, seed)) {
    console.log(
      `  ج${narration.volume} ص${narration.page} #${narration.number} ${narration.grade} | ${preview(narration.textAr, 160)}`,
    );
  }
}

function gradeBreakdown(narrations: readonly ParsedNarration[]): string {
  const counts = new Map<string, number>();
  for (const narration of narrations) counts.set(narration.grade, (counts.get(narration.grade) ?? 0) + 1);
  return [...counts].map(([grade, count]) => `${grade}=${count}`).join(' ');
}

async function withQuran(
  prisma: ImportOptions['prisma'],
  prepared: readonly Prepared[],
): Promise<{ text: string; hits: { start: number; end: number; keys: string[] }[]; spans: number; ayahs: number }> {
  const joined = joinPages(prepared.flatMap((item) => item.pages));
  const spans = detectQuranSpans(joined, join(WAQFEYA_ROOT, 'detector'));
  const uthmani = await loadUthmaniMap(prisma, join(WAQFEYA_ROOT, 'uthmani.json'));
  const replaced = applyVerseReplacements(joined, spans, (surah, ayah) => {
    const text = uthmani.get(`${surah}:${ayah}`);
    if (!text) throw new Error(`No Uthmani text for ${surah}:${ayah}`);
    return text;
  });
  const ayahs = replaced.hits.reduce((sum, hit) => sum + hit.keys.length, 0);
  return { text: replaced.text, hits: replaced.hits, spans: spans.length, ayahs };
}

function externalId(prefix: string, narration: ParsedNarration): string {
  const base = `${prefix}:${narration.volume}:${narration.number}`;
  return narration.occurrence === 1 ? base : `${base}:${narration.occurrence}`;
}

function toRow(
  narration: ParsedNarration,
  hits: { start: number; end: number; keys: string[] }[],
  options: {
    apiProvider: string;
    sourceId: string;
    prefix: string;
    corpus: CorpusFile;
    edition: string;
    gradeAuthority: string | null;
    gradeReference: string | null;
  },
): BookQuoteRow {
  const rawPayload: Prisma.InputJsonObject = {
    corpusUri: options.corpus.corpusUri,
    corpusCommit: options.corpus.spec.commit,
    sha256: options.corpus.spec.sha256,
    edition: options.edition,
    chapterTitle: narration.chapterTitle,
    gradeToken: narration.gradeToken,
    verseKeys: keysCovering(hits, narration.start, narration.end),
  };
  return {
    apiProvider: options.apiProvider,
    externalId: externalId(options.prefix, narration),
    sourceId: options.sourceId,
    textAr: narration.textAr,
    referenceNumber: narration.number,
    volume: narration.volume,
    page: narration.page,
    grade: narration.grade,
    gradeAuthority: options.gradeAuthority,
    gradeReference: options.gradeReference,
    textSource: TextSource.OCR,
    rawPayload,
  };
}

async function writeNarrations(
  options: ImportOptions,
  workKey: 'book:mundhiri-targhib' | 'book:nawawi-riyad' | 'book:ibn-mubarak-zuhd',
  narrations: readonly ParsedNarration[],
  chapters: readonly ParsedChapter[],
  corpora: readonly CorpusFile[],
  rowsFor: (narration: ParsedNarration) => BookQuoteRow,
  linkChapters: boolean,
): Promise<void> {
  const work = approvedWork(workKey);
  const limited = applyLimit(narrations, options.limit);
  const guard = assertArabicText(limited.map((narration) => narration.textAr));
  console.log(`Arabic ratio ${guard.ratio.toFixed(4)} low=${guard.lowRecords.length}`);
  console.log(`grades: ${gradeBreakdown(limited)}`);
  printSamples(limited, workKey.length * 1000);

  const chapterSlice =
    options.limit === null
      ? chapters
      : chapters.filter((chapter) => limited.some((narration) => narration.chapterTitle === chapter.titleAr));
  if (options.dryRun) {
    if (linkChapters) printChapterReport(await suggestChapterMaps(options.prisma, chapterSlice, work.id, false));
    console.log('dry run: nothing written');
    return;
  }

  await ensureSource(options.prisma, work);
  await withRunLog(options.prisma, work.id, async (runId) => {
    const counts = { quotesCreated: 0, quotesUpdated: 0, gradeKept: 0, chapterMapsCreated: 0, chapterMapsExisting: 0 };
    await inTransactionBatches(
      options.prisma,
      limited,
      async (tx, batch) => {
        const outcome = await upsertBookQuotes(tx, batch.map(rowsFor));
        counts.quotesCreated += outcome.created;
        counts.quotesUpdated += outcome.updated;
        counts.gradeKept += outcome.gradeKept;
      },
      (written) => recordProgress(options.prisma, runId, written),
    );
    if (linkChapters) {
      const maps = await suggestChapterMaps(options.prisma, chapterSlice, work.id, true);
      counts.chapterMapsCreated = maps.created;
      counts.chapterMapsExisting = maps.existing;
      printChapterReport(maps);
    }
    const summary = formatSummary(counts, corpora);
    console.log(summary);
    return { recordsImported: counts.quotesCreated + counts.quotesUpdated, summary };
  });
}

function corpusFor(narration: ParsedNarration, prepared: readonly Prepared[]): CorpusFile {
  return prepared.find((item) => item.pages.some((page) => page.volume === narration.volume))?.corpus ?? prepared[0]!.corpus;
}

export async function runTarghibImport(options: ImportOptions): Promise<void> {
  const prepared = TARGHIB_VOLUMES.map((volume) => prepare(volume.path, volume.volume));
  const cover = loadWaqfeyaFile(TARGHIB_COVER);
  const pages = prepared.reduce((sum, item) => sum + item.pages.length, 0) + splitPages(cover.text).length;
  assertPageCount('صحيح الترغيب (three Ma\'arif volumes + cover)', pages, 2352);
  console.log(`pages: ${prepared.map((item) => item.pages.length).join('+')}+cover ${splitPages(cover.text).length} = ${pages}`);
  const quran = await withQuran(options.prisma, prepared);
  console.log(`quran-detector: spans=${quran.spans} ayahs=${quran.ayahs}`);
  const parsed = parseTarghib(quran.text);
  console.log(`parsed: ${parsed.narrations.length} narrations, ${parsed.chapters.length} chapters`);
  const corpora = [...prepared.map((item) => item.corpus), asCorpusFile(cover)];
  await writeNarrations(
    options,
    'book:mundhiri-targhib',
    parsed.narrations,
    parsed.chapters,
    corpora,
    (narration) =>
      toRow({ ...narration, grade: HadithGrade.UNGRADED }, quran.hits, {
        apiProvider: 'book:mundhiri-targhib',
        sourceId: approvedWork('book:mundhiri-targhib').id,
        prefix: 'sahih-targhib',
        corpus: corpusFor(narration, prepared),
        edition: 'maktabat-al-maarif',
        gradeAuthority: null,
        gradeReference: null,
      }),
    true,
  );
}

export async function runRiyadImport(options: ImportOptions): Promise<void> {
  const prepared = [prepare(RIYAD_PATH, '1')];
  assertPageCount('رياض الصالحين', prepared[0]!.pages.length, 680);
  console.log(`pages: ${prepared[0]!.pages.length}`);
  const quran = await withQuran(options.prisma, prepared);
  console.log(`quran-detector: spans=${quran.spans} ayahs=${quran.ayahs}`);
  const parsed = parseRiyad(quran.text);
  console.log(`parsed: ${parsed.narrations.length} narrations, ${parsed.chapters.length} chapters`);
  await writeNarrations(
    options,
    'book:nawawi-riyad',
    parsed.narrations,
    parsed.chapters,
    prepared.map((item) => item.corpus),
    (narration) =>
      toRow(narration, quran.hits, {
        apiProvider: 'book:nawawi-riyad',
        sourceId: approvedWork('book:nawawi-riyad').id,
        prefix: 'riyad',
        corpus: prepared[0]!.corpus,
        edition: 'halabi',
        gradeAuthority: narration.grade === HadithGrade.UNGRADED ? null : 'الصحيحان',
        gradeReference:
          narration.grade === HadithGrade.UNGRADED
            ? null
            : `رياض الصالحين ${narration.number} — ${narration.takhrij ?? narration.gradeToken ?? ''}`.trim(),
      }),
    true,
  );
}

export async function runZuhdImport(options: ImportOptions): Promise<void> {
  const prepared = [prepare(ZUHD_PATH, '1')];
  assertPageCount('الزهد والرقائق', prepared[0]!.pages.length, 1248);
  console.log(`pages: ${prepared[0]!.pages.length}`);
  const quran = await withQuran(options.prisma, prepared);
  console.log(`quran-detector: spans=${quran.spans} ayahs=${quran.ayahs}`);
  const parsed = parseZuhd(quran.text);
  console.log(`parsed: ${parsed.narrations.length} narrations, chapters=0 (no links)`);
  await writeNarrations(
    options,
    'book:ibn-mubarak-zuhd',
    parsed.narrations,
    [],
    prepared.map((item) => item.corpus),
    (narration) =>
      toRow(narration, quran.hits, {
        apiProvider: 'book:ibn-mubarak-zuhd',
        sourceId: approvedWork('book:ibn-mubarak-zuhd').id,
        prefix: 'zuhd',
        corpus: prepared[0]!.corpus,
        edition: 'dar-al-miraj',
        gradeAuthority: null,
        gradeReference: null,
      }),
    false,
  );
}

/** Source and file provenance only. No public quotes. */
export async function runMinhajImport({ prisma, dryRun }: ImportOptions): Promise<void> {
  const file = loadWaqfeyaFile(MINHAJ_PATH);
  const pages = splitPages(file.text).length;
  assertPageCount('مختصر منهاج القاصدين', pages, 488);
  const corpus = asCorpusFile(file);
  console.log(`pages: ${pages}; quotes: 0 (prose, source record only)`);
  if (dryRun) {
    console.log('dry run: nothing written');
    return;
  }
  const work = approvedWork('book:ibn-qudama-minhaj');
  await ensureSource(prisma, work);
  await withRunLog(prisma, work.id, async () => {
    const summary = formatSummary({ quotesCreated: 0, pages }, [corpus]);
    console.log(summary);
    return { recordsImported: 0, summary };
  });
}
