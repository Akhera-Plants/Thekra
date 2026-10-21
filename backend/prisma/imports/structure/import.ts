/**
 * Writes BookSection and SectionItem from the pinned corpora.
 * A second run inserts nothing. It does not classify and does not link sins.
 */
import { randomUUID } from 'node:crypto';
import {
  HadithGrade,
  QuoteOrigin,
  QuoteType,
  TextSource,
  type BookLevel,
  type Prisma,
  type PrismaClient,
  type SectionItemKind,
} from '@prisma/client';
import { normalizeArabic } from '../../../src/common/text/arabic-normalizer.js';
import { wordOverlap } from '../../../src/common/text/match-score.js';
import { stripPageMarkers } from '../../../src/common/text/strip-page-markers.js';
import { inTransactionBatches } from '../lib/batch.js';
import type { ImportOptions } from '../lib/cli.js';
import { loadCorpus, type CorpusFile, type CorpusSpec } from '../lib/corpus.js';
import { formatSummary, withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource, type BookKey } from '../lib/source.js';
import { BUKHARI_CORPUS, MUSLIM_CORPUS } from '../sahihayn/files.js';
import { parseShuab } from '../shuab/parse.js';
import { asCorpusFile, loadWaqfeyaFile, splitPages } from '../waqfeya/files.js';
import { cleanOcrPage, runningHeaderKeys } from '../waqfeya/clean.js';
import { joinPages } from '../waqfeya/parse.js';
import {
  parseMuslimBook,
  parseOpenitiBook,
  parseTarghibStructure,
  type OpenitiBook,
  type ParsedItem,
  type ParsedSection,
} from './parse.js';
import { writeStructureDocs, type BookReport } from './report.js';
import { resolveKabairBraces } from './kabair.js';
import {
  loadMunajjidText,
  MUNAJJID_COMMIT,
  MUNAJJID_DATASET,
  MUNAJJID_SHA256,
  MUNAJJID_SOURCE_ID,
  munajjidAttribution,
  munajjidProvenance,
  MUNAJJID_CHAPTERS,
  parseMunajjid,
} from './munajjid.js';
import { absorbOrphans, deleteIbnQayyim, type Leftover } from './repair.js';

const QURAN_SOURCE_ID = '10000000-0000-4000-8000-000000000001';
const BUKHARI_SOURCE_ID = '10000000-0000-4000-8000-000000000002';
const MUSLIM_SOURCE_ID = '10000000-0000-4000-8000-000000000003';
const AUTHOR_PROVIDER = 'book-structure';
const RIYAD_SOURCE_ID = '10000000-0000-4000-8000-000000000009';

const TARGHIB_DIR =
  'txt/2ـ 213.7 (577) باقي مجموعات الحديث/03790ـ صحيح الترغيب والترهيب - ضعيف الترغيب والترهيب --- عبد العظيم بن عبد القوي المنذري زكي الدين.PDF';

const OPENITI: Record<string, CorpusSpec> = {
  riyad: {
    repo: '0700AH',
    path: 'data/0676Nawawi/0676Nawawi.RiyadSalihin/0676Nawawi.RiyadSalihin.Shamela0002348-ara5',
    commit: '6dca5e250b9e4405b93c4a5e73cfffdef5d7fef7',
    sha256: 'a601cbcb6b1846c00f10e9fb38377bb1609fe664d90fe01f1506aa9c10d5d88e',
  },
  zuhd: {
    repo: '0200AH',
    path: 'data/0181IbnMubarak/0181IbnMubarak.Zuhd/0181IbnMubarak.Zuhd.Shamela0013028-ara1',
    commit: '62b3ebfde6886b17b0ad6c346d7fc79f8ac0fcd8',
    sha256: '0c2b26f6bf959f301467a493af0714debb8c0350597df465eadaf2fcce46da3a',
  },
  minhaj: {
    repo: '0700AH',
    path: 'data/0689AhmadIbnCabdRahmanIbnQudama/0689AhmadIbnCabdRahmanIbnQudama.MukhtasarMinhajQasidin/0689AhmadIbnCabdRahmanIbnQudama.MukhtasarMinhajQasidin.Shamela0098087-ara1',
    commit: '6dca5e250b9e4405b93c4a5e73cfffdef5d7fef7',
    sha256: '68939b45c8c8a60b3dbf145a0c0bc17e9fccbfc05a2278b30757160bad556ed3',
  },
  kabair: {
    repo: '0750AH',
    path: 'data/0748Dhahabi/0748Dhahabi.Kabair/0748Dhahabi.Kabair.Shamela0006848-ara1',
    commit: '9168f4a124537948de88cba6adfacf560bc35d35',
    sha256: '4cccf7f3de5da10fcc52f78422f5a03dfc6ea4fd29ac15da72935be169783b1a',
  },
  adab: {
    repo: '0275AH',
    path: 'data/0256Bukhari/0256Bukhari.AdabMufrad/0256Bukhari.AdabMufrad.Shamela0012991-ara1',
    commit: '47dfd28db9e158c7101c7df1162d4dc99bb70303',
    sha256: 'f0e9b0abb516b935a0185886a0c435fc87f3f8110753212517d9b9f87d553514',
  },
  shuab: {
    repo: '0475AH',
    path: 'data/0458Bayhaqi/0458Bayhaqi.ShucabIman/0458Bayhaqi.ShucabIman.Shamela0010660-ara1',
    commit: 'bb5632fa192ccdc3c0de8cd640faac9ac0415ed1',
    sha256: '5a341285c1c80829b31f8f7c7a383b5e41ede103a5075544261d76b1e2755654',
  },
};

interface BookJob {
  key: string;
  titleAr: string;
  sourceId: string;
  bookKey: BookKey | null;
  load: () => Promise<{ sections: ParsedSection[]; corpus: CorpusFile }>;
  /** Fill a null bab title on the narration quote. */
  restoreBab: boolean;
}

interface StoredQuote {
  id: string;
  referenceNumber: number | null;
  externalId: string | null;
  textSource: TextSource;
  textAr: string;
  page: string | null;
  volume: string | null;
  pageOrChapter: string | null;
  bookTitle: string | null;
  referenceLabel: string | null;
}

interface PlannedItem {
  kind: SectionItemKind;
  quoteId: string | null;
  ayahFrom: string | null;
  ayahTo: string | null;
  line: number;
  text: string | null;
  hadithNumber: number | null;
  externalId?: string;
}

function arabicLetters(text: string): number {
  return (text.match(/[\u0621-\u064A]/g) ?? []).length;
}

function fold(text: string): string {
  return normalizeArabic(text).replace(/[^\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function overlap(left: string, right: string): number {
  return wordOverlap(fold(left), fold(right));
}

function compact(sections: readonly ParsedSection[]): ParsedSection[] {
  const kept: ParsedSection[] = [];
  const remap = new Map<number, number>();
  sections.forEach((section, index) => {
    if (section.titleAr === 'صدر الكتاب' && section.items.length === 0) return;
    remap.set(index, kept.length);
    kept.push({ ...section, items: section.items.slice() });
  });
  for (const section of kept) {
    section.parentIndex = section.parentIndex == null ? null : remap.get(section.parentIndex) ?? null;
  }
  return kept;
}

function jobs(prisma: PrismaClient): BookJob[] {
  const openiti = (key: OpenitiBook, titleAr: string, sourceId: string, bookKey: BookKey | null, spec: CorpusSpec): BookJob => ({
    key,
    titleAr,
    sourceId,
    bookKey,
    restoreBab: key === 'bukhari',
    load: async () => {
      const corpus = await loadCorpus(spec);
      const branches = key === 'shuab'
        ? parseShuab(corpus.text).branches.map((branch) => ({
          line: branch.line,
          number: String(branch.number),
          title: branch.headingText,
        }))
        : [];
      const sections = compact(parseOpenitiBook(corpus.text, key, branches));
      return { sections: key === 'kabair' ? resolveKabairBraces(sections) : sections, corpus };
    },
  });

  return [
    openiti('adab', 'الأدب المفرد', approvedWork('book:adab-al-mufrad').id, 'book:adab-al-mufrad', OPENITI.adab!),
    openiti('riyad', 'رياض الصالحين', RIYAD_SOURCE_ID, 'book:nawawi-riyad', OPENITI.riyad!),
    {
      key: 'targhib',
      titleAr: 'صحيح الترغيب والترهيب',
      sourceId: approvedWork('book:mundhiri-targhib').id,
      bookKey: 'book:mundhiri-targhib',
      restoreBab: false,
      load: async () => {
        const volumes = ['1', '2', '3'].map((volume) => {
          const file = loadWaqfeyaFile(`${TARGHIB_DIR}/الجزء 01-${volume}.txt`);
          const pages = splitPages(file.text);
          return {
            file,
            pages: pages.map((text, index) => ({
              volume,
              page: index + 1,
              text: cleanOcrPage(text, runningHeaderKeys(pages)),
            })),
          };
        });
        const joined = joinPages(volumes.flatMap((volume) => volume.pages));
        return {
          sections: compact(parseTarghibStructure(joined)),
          corpus: asCorpusFile(volumes[0]!.file),
        };
      },
    },
    openiti('kabair', 'الكبائر', approvedWork('book:dhahabi-kabair').id, 'book:dhahabi-kabair', OPENITI.kabair!),
    openiti('minhaj', 'مختصر منهاج القاصدين', approvedWork('book:ibn-qudama-minhaj').id, 'book:ibn-qudama-minhaj', OPENITI.minhaj!),
    openiti('zuhd', 'الزهد والرقائق', approvedWork('book:ibn-mubarak-zuhd').id, 'book:ibn-mubarak-zuhd', OPENITI.zuhd!),
    openiti('shuab', 'الجامع لشعب الإيمان', approvedWork('book:shuab-iman').id, 'book:shuab-iman', OPENITI.shuab!),
    openiti('bukhari', 'صحيح البخاري', BUKHARI_SOURCE_ID, null, BUKHARI_CORPUS),
    {
      key: 'muslim',
      titleAr: 'صحيح مسلم',
      sourceId: MUSLIM_SOURCE_ID,
      bookKey: null,
      restoreBab: true,
      load: async () => {
        const corpus = await loadCorpus(MUSLIM_CORPUS);
        return { sections: compact(parseMuslimBook(corpus.text)), corpus };
      },
    },
    {
      key: 'munajjid',
      titleAr: 'سلسلة أعمال القلوب',
      sourceId: MUNAJJID_SOURCE_ID,
      bookKey: 'book:munajjid-qulub',
      restoreBab: false,
      load: async () => {
        const text = await loadMunajjidText();
        const corpus: CorpusFile = {
          spec: {
            repo: MUNAJJID_DATASET,
            path: 'aljam3/38380/71356',
            commit: MUNAJJID_COMMIT,
            sha256: MUNAJJID_SHA256,
          },
          versionUri: 'KTB_0118440.txt',
          corpusUri: `huggingface/${MUNAJJID_DATASET}`,
          text: '',
        };
        return { sections: await parseMunajjid(prisma, text), corpus };
      },
    },
  ];
}

async function loadQuotes(prisma: PrismaClient, sourceId: string): Promise<StoredQuote[]> {
  return prisma.quote.findMany({
    where: { sourceId },
    select: {
      id: true,
      referenceNumber: true,
      externalId: true,
      textSource: true,
      textAr: true,
      page: true,
      volume: true,
      pageOrChapter: true,
      bookTitle: true,
      referenceLabel: true,
    },
  });
}

function byNumber(quotes: readonly StoredQuote[]): Map<number, StoredQuote[]> {
  const map = new Map<number, StoredQuote[]>();
  for (const quote of quotes) {
    if (quote.referenceNumber == null) continue;
    const list = map.get(quote.referenceNumber) ?? [];
    list.push(quote);
    map.set(quote.referenceNumber, list);
  }
  return map;
}

function pickNumbered(
  group: readonly StoredQuote[] | undefined,
  text: string | null,
  requireOverlap: boolean,
): StoredQuote | null {
  if (!group?.length) return null;
  const digital = group.filter((quote) => quote.textSource === TextSource.DIGITAL);
  const pool = digital.length > 0 ? digital : [...group];
  const ranked = pool.slice().sort((left, right) => {
    const score = text ? overlap(text, right.textAr) - overlap(text, left.textAr) : 0;
    if (score !== 0) return score;
    return left.id < right.id ? -1 : 1;
  });
  const best = ranked[0];
  if (!best) return null;
  // A long narration that does not overlap the numbered row is a different hadith.
  if (requireOverlap && text && arabicLetters(text) >= 80) {
    const score = overlap(text, best.textAr);
    const ratio = lengthRatio(text, wordsOf(best.textAr));
    if (score < 0.55 || ratio > 2.2) return null;
  }
  return best;
}

interface IndexedQuote extends StoredQuote {
  words: Set<string>;
}

function wordsOf(text: string): Set<string> {
  return new Set(fold(text).split(' ').filter((word) => word.length >= 2));
}

function overlapWords(text: string, words: Set<string>): number {
  const mine = wordsOf(text);
  if (mine.size === 0 || words.size === 0) return 0;
  let shared = 0;
  for (const word of mine) {
    if (words.has(word)) shared += 1;
  }
  return shared / Math.min(mine.size, words.size);
}

function lengthRatio(text: string, words: Set<string>): number {
  const mine = wordsOf(text).size;
  if (mine === 0 || words.size === 0) return Number.POSITIVE_INFINITY;
  return Math.max(mine, words.size) / Math.min(mine, words.size);
}

function pickByText(quotes: readonly IndexedQuote[], text: string, strict: boolean): StoredQuote | null {
  let best: StoredQuote | null = null;
  let score = 0;
  for (const quote of quotes) {
    if (strict && lengthRatio(text, quote.words) > 2.2) continue;
    const next = overlapWords(text, quote.words);
    if (next > score || (next === score && score > 0 && best && quote.id < best.id)) {
      score = next;
      best = quote;
    }
  }
  return score >= 0.55 ? best : null;
}

/** One OpenITI narration keeps the Waqfeya PDF page. The OCR duplicate is removed. */
async function mergeRiyadOcr(
  prisma: PrismaClient,
  sections: readonly ParsedSection[],
  quotes: StoredQuote[],
): Promise<{ deleted: number; repaired1519: boolean }> {
  const narrations = sections.flatMap((section) => section.items).filter((item) => item.kind === 'HADITH' && item.hadithNumber != null);
  const numbered = byNumber(quotes);
  let deleted = 0;
  let repaired1519 = false;

  const survivorOf = (item: ParsedItem): StoredQuote | null => pickNumbered(numbered.get(item.hadithNumber!), item.text, true);

  const repair = survivorOf(narrations.find((item) => item.hadithNumber === 1519) ?? { kind: 'HADITH', hadithNumber: 1519, text: null, line: 0, ayahFrom: null, ayahTo: null });
  const narration1519 = narrations.find((item) => item.hadithNumber === 1519);
  const wrongVerse = normalizeArabic('فإذا بلغن أجلهن');
  if (
    repair
    && narration1519?.text
    && normalizeArabic(repair.textAr).includes(wrongVerse)
    && !normalizeArabic(narration1519.text).includes(wrongVerse)
  ) {
    await prisma.quote.update({ where: { id: repair.id }, data: { textAr: narration1519.text } });
    repair.textAr = narration1519.text;
    repaired1519 = true;
  }

  const ocr = quotes.filter((quote) => quote.textSource === TextSource.OCR);
  const drop = new Set<string>();
  for (const quote of ocr) {
    let best: ParsedItem | null = null;
    let score = 0;
    for (const narration of narrations) {
      const next = overlap(quote.textAr, narration.text ?? '');
      if (next > score) {
        score = next;
        best = narration;
      }
    }
    if (!best || score < 0.55) continue;
    const survivor = survivorOf(best);
    if (!survivor || survivor.id === quote.id) continue;
    const label = `waqfeya:${quote.volume ?? ''}/${quote.page ?? ''}`;
    await prisma.quote.update({
      where: { id: survivor.id },
      data: {
        page: survivor.page ?? quote.page,
        volume: survivor.volume ?? quote.volume,
        referenceLabel: survivor.referenceLabel?.includes('waqfeya') ? survivor.referenceLabel : label,
      },
    });
    survivor.page = survivor.page ?? quote.page;
    drop.add(quote.id);
  }
  if (drop.size > 0) {
    await prisma.quote.deleteMany({ where: { id: { in: [...drop] } } });
    deleted = drop.size;
  }
  return { deleted, repaired1519 };
}

async function verseIds(prisma: PrismaClient): Promise<Map<string, string>> {
  const rows = await prisma.quote.findMany({
    where: { sourceId: QURAN_SOURCE_ID, type: QuoteType.QURAN_VERSE },
    select: { id: true, surahNumber: true, ayahNumber: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.surahNumber != null && row.ayahNumber != null) map.set(`${row.surahNumber}:${row.ayahNumber}`, row.id);
  }
  return map;
}

async function ensureQuotes(
  prisma: PrismaClient,
  rows: Array<{ externalId: string; textAr: string; type: QuoteType; textSource: TextSource; referenceNumber: number | null; sourceId: string; apiProvider: string }>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (rows.length === 0) return ids;
  const existing: Array<{ id: string; apiProvider: string | null; externalId: string | null; textAr: string }> = [];
  for (let start = 0; start < rows.length; start += 200) {
    const slice = rows.slice(start, start + 200);
    existing.push(...await prisma.quote.findMany({
      where: { OR: slice.map((row) => ({ apiProvider: row.apiProvider, externalId: row.externalId })) },
      select: { id: true, apiProvider: true, externalId: true, textAr: true },
    }));
  }
  const have = new Map(existing.map((row) => [`${row.apiProvider}|${row.externalId}`, row]));
  const missing = rows.filter((row) => !have.has(`${row.apiProvider}|${row.externalId}`));
  await inTransactionBatches(prisma, missing, async (tx, batch) => {
    await tx.quote.createMany({
      data: batch.map((row) => ({
        type: row.type,
        origin: QuoteOrigin.LOCAL,
        textAr: row.textAr,
        sourceId: row.sourceId,
        apiProvider: row.apiProvider,
        externalId: row.externalId,
        referenceNumber: row.referenceNumber,
        textSource: row.textSource,
        grade: row.type === QuoteType.HADITH ? HadithGrade.UNGRADED : null,
        gradeSource: 'AUTHORITY_LEGACY',
      })),
      skipDuplicates: true,
    });
  }, undefined, 100);
  const created: Array<{ id: string; apiProvider: string | null; externalId: string | null }> = [];
  for (let start = 0; start < missing.length; start += 200) {
    const slice = missing.slice(start, start + 200);
    created.push(...await prisma.quote.findMany({
      where: { OR: slice.map((row) => ({ apiProvider: row.apiProvider, externalId: row.externalId })) },
      select: { id: true, apiProvider: true, externalId: true },
    }));
  }
  for (const row of existing) ids.set(`${row.apiProvider}|${row.externalId}`, row.id);
  for (const row of created) ids.set(`${row.apiProvider}|${row.externalId}`, row.id);
  return ids;
}

function ancestorTitle(sections: readonly ParsedSection[], index: number, level: BookLevel): string | null {
  let cursor: number | null = index;
  const seen = new Set<number>();
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor);
    const section: ParsedSection | undefined = sections[cursor];
    if (!section) return null;
    if (section.level === level) return section.titleAr;
    cursor = section.parentIndex;
  }
  return null;
}

async function restoreBabTitles(
  prisma: PrismaClient,
  sections: readonly ParsedSection[],
  planned: readonly PlannedItem[][],
): Promise<number> {
  const updates: Array<{ id: string; bab: string; kitab: string | null }> = [];
  sections.forEach((section, index) => {
    const bab = section.level === 'BAB' ? section.titleAr : ancestorTitle(sections, index, 'BAB');
    if (!bab) return;
    const kitab = ancestorTitle(sections, index, 'KITAB');
    for (const item of planned[index] ?? []) {
      if (item.kind !== 'HADITH' || !item.quoteId) continue;
      updates.push({ id: item.quoteId, bab, kitab });
    }
  });
  const unique = new Map<string, { id: string; bab: string; kitab: string | null }>();
  for (const update of updates) unique.set(update.id, update);
  const rows = [...unique.values()];
  const current: Array<{ id: string; pageOrChapter: string | null; bookTitle: string | null }> = [];
  const ids = rows.map((row) => row.id);
  for (let start = 0; start < ids.length; start += 1000) {
    current.push(...await prisma.quote.findMany({
      where: { id: { in: ids.slice(start, start + 1000) } },
      select: { id: true, pageOrChapter: true, bookTitle: true },
    }));
  }
  const have = new Map(current.map((row) => [row.id, row]));
  const changed = rows.filter((row) => {
    const quote = have.get(row.id);
    if (!quote) return false;
    return quote.pageOrChapter == null || (quote.bookTitle == null && row.kitab != null);
  });
  await inTransactionBatches(prisma, changed, async (tx, batch) => {
    for (const row of batch) {
      const quote = have.get(row.id);
      await tx.quote.update({
        where: { id: row.id },
        data: {
          ...(quote?.pageOrChapter == null ? { pageOrChapter: row.bab } : {}),
          ...(quote?.bookTitle == null && row.kitab ? { bookTitle: row.kitab } : {}),
        },
      });
    }
  }, undefined, 80);
  return changed.length;
}

async function persist(
  prisma: PrismaClient,
  sourceId: string,
  sections: readonly ParsedSection[],
  planned: readonly PlannedItem[][],
): Promise<{ sectionIds: string[]; createdSections: number; createdItems: number }> {
  const existing = await prisma.bookSection.findMany({
    where: { sourceId },
    orderBy: { order: 'asc' },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  const byOrder = new Map(existing.map((section) => [section.order, section]));
  const sectionIds: string[] = [];
  let createdSections = 0;
  let createdItems = 0;
  const pendingSections: Prisma.BookSectionCreateManyInput[] = [];
  const pendingItems: Prisma.SectionItemCreateManyInput[] = [];

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index]!;
    const order = index + 1;
    const parentOrder = section.parentIndex == null ? null : section.parentIndex + 1;
    const parentId = parentOrder == null ? null : sectionIds[parentOrder - 1] ?? null;
    const found = byOrder.get(order);
    const items = planned[index] ?? [];
    const same = found
      && found.level === section.level
      && (found.number ?? null) === section.number
      && found.titleAr === section.titleAr
      && (found.parentId ?? null) === parentId
      && (found.volume ?? null) === (section.volume ?? null)
      && (found.page ?? null) === (section.page ?? null)
      && found.items.length === items.length
      && found.items.every((item, itemIndex) => {
        const plannedItem = items[itemIndex];
        return plannedItem
          && item.kind === plannedItem.kind
          && (item.quoteId ?? null) === plannedItem.quoteId
          && (item.ayahFrom ?? null) === plannedItem.ayahFrom
          && (item.ayahTo ?? null) === plannedItem.ayahTo;
      });
    if (found && same) {
      sectionIds.push(found.id);
      continue;
    }
    const id = found?.id ?? randomUUID();
    sectionIds.push(id);
    if (!found) {
      pendingSections.push({
        id,
        sourceId,
        parentId,
        level: section.level,
        number: section.number,
        titleAr: section.titleAr,
        order,
        volume: section.volume,
        page: section.page,
      });
      createdSections += 1;
    } else {
      await prisma.bookSection.update({
        where: { id },
        data: {
          parentId,
          level: section.level,
          number: section.number,
          titleAr: section.titleAr,
          volume: section.volume,
          page: section.page,
        },
      });
      await prisma.sectionItem.deleteMany({ where: { sectionId: id } });
    }
    items.forEach((item, itemIndex) => {
      pendingItems.push({
        id: randomUUID(),
        sectionId: id,
        order: itemIndex + 1,
        kind: item.kind,
        quoteId: item.quoteId,
        ayahFrom: item.ayahFrom,
        ayahTo: item.ayahTo,
      });
      createdItems += 1;
    });
  }

  await inTransactionBatches(prisma, pendingSections, async (tx, batch) => {
    for (const row of batch) await tx.bookSection.create({ data: row });
  }, undefined, 40);
  await inTransactionBatches(prisma, pendingItems, async (tx, batch) => {
    await tx.sectionItem.createMany({ data: [...batch], skipDuplicates: true });
  }, undefined, 400);
  await prisma.bookSection.deleteMany({ where: { sourceId, order: { gt: sections.length } } });
  return { sectionIds, createdSections, createdItems };
}

function verseKeyList(raw: Prisma.JsonValue | null): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const keys = (raw as { verseKeys?: unknown }).verseKeys;
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string' && /^\d+:\d+$/.test(key)) : [];
}

async function expandTarghibAyahs(
  prisma: PrismaClient,
  planned: PlannedItem[][],
  verses: Map<string, string>,
): Promise<PlannedItem[][]> {
  const ids = [...new Set(planned.flat().flatMap((item) => (item.quoteId ? [item.quoteId] : [])))];
  const rows: Array<{ id: string; rawPayload: Prisma.JsonValue | null }> = [];
  for (let start = 0; start < ids.length; start += 500) {
    rows.push(...await prisma.quote.findMany({
      where: { id: { in: ids.slice(start, start + 500) } },
      select: { id: true, rawPayload: true },
    }));
  }
  const keysOf = new Map(rows.map((row) => [row.id, verseKeyList(row.rawPayload)]));
  return planned.map((items) => items.flatMap((item) => {
    const keys = item.kind === 'HADITH' && item.quoteId ? keysOf.get(item.quoteId) ?? [] : [];
    return [
      item,
      ...keys.map((key): PlannedItem => ({
        kind: 'AYAH',
        quoteId: verses.get(key) ?? null,
        ayahFrom: key,
        ayahTo: key,
        line: item.line,
        text: null,
        hadithNumber: null,
      })),
    ];
  }));
}

async function stampMunajjid(prisma: PrismaClient, planned: PlannedItem[][]): Promise<void> {
  for (let index = 0; index < planned.length; index += 1) {
    const chapter = MUNAJJID_CHAPTERS[index];
    const item = planned[index]?.find((row) => row.kind === 'AUTHOR_TEXT' && row.quoteId);
    if (!chapter || !item?.quoteId) continue;
    const pageTo = (MUNAJJID_CHAPTERS[index + 1]?.page ?? 334) - 1;
    await prisma.quote.update({
      where: { id: item.quoteId },
      data: {
        textAr: '',
        rawPayload: {
          pageFrom: chapter.page,
          pageTo,
          attribution: munajjidAttribution(chapter.page),
          ...munajjidProvenance(),
        },
      },
    });
  }
}

function leftoverLines(title: string, rows: readonly Leftover[]): string[] {
  if (rows.length === 0) return [`- ${title}: 0`];
  const counts = new Map<string, Array<number | null>>();
  for (const row of rows) {
    const list = counts.get(row.reason) ?? [];
    list.push(row.referenceNumber);
    counts.set(row.reason, list);
  }
  const lines = [`- ${title}: ${rows.length}`];
  for (const [reason, numbers] of counts) {
    const shown = numbers.slice(0, 15).map((number) => (number == null ? 'بلا رقم' : String(number))).join('، ');
    const more = numbers.length > 15 ? '، …' : '';
    lines.push(`  - ${numbers.length} — ${reason} (${shown}${more})`);
  }
  return lines;
}

export async function runStructureImport({ prisma }: ImportOptions): Promise<void> {
  const removedQayyim = await deleteIbnQayyim(prisma);
  console.log(`ابن القيم: deletedQuotes=${removedQayyim}`);
  const verses = await verseIds(prisma);
  const reports: BookReport[] = [];
  const leftoverNotes: string[] = [];
  for (const job of jobs(prisma)) {
    if (job.bookKey) await ensureSource(prisma, approvedWork(job.bookKey));
    const loaded = await job.load();
    const sections = loaded.sections;
    let quotes = await loadQuotes(prisma, job.sourceId);
    let deleted = 0;
    let repaired1519 = false;
    if (job.key === 'riyad') {
      const merged = await mergeRiyadOcr(prisma, sections, quotes);
      deleted = merged.deleted;
      repaired1519 = merged.repaired1519;
      quotes = await loadQuotes(prisma, job.sourceId);
    }
    const numbered = byNumber(quotes);
    const byExternal = new Map(quotes.filter((quote) => quote.externalId).map((quote) => [quote.externalId as string, quote]));
    const indexed = quotes
      .filter((quote) => quote.textSource !== TextSource.OCR)
      .map((quote) => ({ ...quote, words: wordsOf(quote.textAr) }));
    const fresh: Array<{ externalId: string; textAr: string; type: QuoteType; textSource: TextSource; referenceNumber: number | null; sourceId: string; apiProvider: string }> = [];
    const planned: PlannedItem[][] = sections.map((section, sectionIndex) => section.items.map((item, itemIndex) => {
      if (item.kind === 'AYAH') {
        const key = item.ayahFrom ?? '';
        return {
          kind: 'AYAH',
          quoteId: verses.get(key) ?? null,
          ayahFrom: item.ayahFrom,
          ayahTo: item.ayahTo,
          line: item.line,
          text: null,
          hadithNumber: null,
        };
      }
      if (item.kind === 'HADITH') {
        if (item.quoteId) {
          return {
            kind: 'HADITH',
            quoteId: item.quoteId,
            ayahFrom: null,
            ayahTo: null,
            line: item.line,
            text: null,
            hadithNumber: item.hadithNumber,
          };
        }
        const strict = job.key === 'riyad' || job.key === 'shuab';
        const numberedQuote = item.hadithNumber != null
          ? pickNumbered(numbered.get(item.hadithNumber), item.text, strict)
          : null;
        const createdEarlier = strict && item.hadithNumber != null
          ? byExternal.get(`openiti:${item.hadithNumber}`) ?? null
          : null;
        const found = numberedQuote
          ?? createdEarlier
          ?? (item.hadithNumber == null && item.text ? pickByText(indexed, item.text, job.key === 'kabair') : null);
        if (found) {
          return {
            kind: 'HADITH',
            quoteId: found.id,
            ayahFrom: null,
            ayahTo: null,
            line: item.line,
            text: item.text,
            hadithNumber: item.hadithNumber,
          };
        }
        const externalId = item.hadithNumber != null
          ? `openiti:${item.hadithNumber}`
          : `openiti:${sectionIndex + 1}:${itemIndex + 1}`;
        fresh.push({
          externalId,
          textAr: stripPageMarkers(item.text ?? '—'),
          type: QuoteType.HADITH,
          textSource: TextSource.DIGITAL,
          referenceNumber: item.hadithNumber,
          sourceId: job.sourceId,
          apiProvider: job.bookKey ?? `book:${job.key}`,
        });
        return {
          kind: 'HADITH',
          quoteId: null,
          ayahFrom: null,
          ayahTo: null,
          line: item.line,
          text: item.text,
          hadithNumber: item.hadithNumber,
          externalId,
        };
      }
      const externalId = item.kind === 'AUTHOR_TEXT' && job.key === 'munajjid'
        ? `author:munajjid:${sectionIndex + 1}:attribution`
        : `author:${job.key}:${sectionIndex + 1}:${itemIndex + 1}`;
      fresh.push({
        externalId,
        textAr: stripPageMarkers(item.text ?? '—'),
        type: QuoteType.BOOK_EXCERPT,
        textSource: TextSource.DIGITAL,
        referenceNumber: null,
        sourceId: job.sourceId,
        apiProvider: AUTHOR_PROVIDER,
      });
      return {
        kind: 'AUTHOR_TEXT',
        quoteId: null,
        ayahFrom: null,
        ayahTo: null,
        line: item.line,
        text: item.text,
        hadithNumber: null,
        externalId,
      };
    }));

    const made = await ensureQuotes(prisma, fresh);
    for (const items of planned) {
      for (const item of items) {
        if (item.quoteId || !('externalId' in item) || !item.externalId) continue;
        const provider = item.kind === 'AUTHOR_TEXT' ? AUTHOR_PROVIDER : (job.bookKey ?? `book:${job.key}`);
        item.quoteId = made.get(`${provider}|${item.externalId}`) ?? null;
      }
    }
    if (job.key === 'munajjid') await stampMunajjid(prisma, planned);
    const expanded = job.key === 'targhib' ? await expandTarghibAyahs(prisma, planned, verses) : planned;
    const plain: PlannedItem[][] = expanded.map((items) => items.map((item) => ({
      kind: item.kind,
      quoteId: item.quoteId,
      ayahFrom: item.ayahFrom,
      ayahTo: item.ayahTo,
      line: item.line,
      text: item.text,
      hadithNumber: item.hadithNumber,
    })));

    let babUpdates = 0;
    if (job.restoreBab) babUpdates = await restoreBabTitles(prisma, sections, plain);
    if (job.key === 'targhib') {
      plain.forEach((items, index) => {
        const section = sections[index];
        if (!section) return;
        section.items = items.map((item) => ({
          kind: item.kind,
          line: item.line,
          hadithNumber: item.hadithNumber,
          text: item.text,
          ayahFrom: item.ayahFrom,
          ayahTo: item.ayahTo,
        }));
      });
    }

    const outcome = await withRunLog(prisma, job.sourceId, async () => {
      const written = await persist(prisma, job.sourceId, sections, plain);
      const summary = formatSummary(
        {
          sections: sections.length,
          createdSections: written.createdSections,
          createdItems: written.createdItems,
          deletedQuotes: deleted,
          babTitles: babUpdates,
          repaired1519: repaired1519 ? 1 : 0,
        },
        [loaded.corpus],
      );
      console.log(`${job.titleAr}: ${summary}`);
      return { recordsImported: written.createdSections + written.createdItems, summary, sectionIds: written.sectionIds };
    });
    reports.push({
      key: job.key,
      titleAr: job.titleAr,
      sections: sections.map((section, index) => ({ id: outcome.sectionIds[index] ?? '', parsed: section })),
    });
    const left = await absorbOrphans(prisma, job.sourceId, job.key);
    leftoverNotes.push(...leftoverLines(job.titleAr, left));
    console.log(`${job.titleAr}: leftovers=${left.length}`);
  }
  writeStructureDocs(reports, leftoverNotes);
}
