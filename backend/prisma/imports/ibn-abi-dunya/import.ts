/**
 * Ibn Abi al-Dunya — structure-only import (OpenITI 0300AH / 0281IbnAbiDunya).
 *
 * Creates one Source per work, BookSection / SectionItem tree, and Quote rows for
 * numbered narrations (HADITH) and author paragraphs (BOOK_EXCERPT). AYAH items
 * link to the canonical Quran source. Does NOT create topic / sin / deed links.
 *
 * After structure: callers should run `athar` (classifier already includes
 * book:ibn-abi-dunya*) and `takhrij` (matn match). A second run inserts nothing.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GradeSource,
  HadithGrade,
  QuoteOrigin,
  QuoteType,
  SourceType,
  TextSource,
  type Prisma,
  type PrismaClient,
  type SectionItemKind,
} from '@prisma/client';
import { splitMatn } from '../../../src/common/text/matn.js';
import { inTransactionBatches } from '../lib/batch.js';
import type { ImportOptions } from '../lib/cli.js';
import { loadCorpus, provenanceOf } from '../lib/corpus.js';
import { formatSummary, withRunLog } from '../lib/run-log.js';
import type { ParsedItem, ParsedSection } from '../structure/parse.js';
import { sectionTsv, type BookReport, type WrittenSection } from '../structure/report.js';
import { assertDunyaCatalog, DUNYA_BOOKS, type DunyaBook } from './books.js';
import { parseDunyaBook } from './parse.js';

const QURAN_SOURCE_ID = '10000000-0000-4000-8000-000000000001';
const AUTHOR_PROVIDER = 'book-structure';
const DOCS = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy', 'sections', 'ibn-abi-dunya');

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

async function ensureDunyaSource(prisma: PrismaClient, book: DunyaBook): Promise<void> {
  const fields = {
    name: book.titleEn,
    nameAr: book.titleAr,
    type: SourceType.BOOK,
    author: 'Ibn Abi al-Dunya',
    authorAr: 'ابن أبي الدنيا',
    isExternalApi: false,
    apiProvider: book.apiProvider,
  };
  await prisma.source.upsert({
    where: { id: book.id },
    create: { id: book.id, ...fields },
    update: fields,
  });
}

async function verseIds(prisma: PrismaClient): Promise<Map<string, string>> {
  const rows = await prisma.quote.findMany({
    where: { sourceId: QURAN_SOURCE_ID, type: QuoteType.QURAN_VERSE },
    select: { id: true, surahNumber: true, ayahNumber: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.surahNumber != null && row.ayahNumber != null) {
      map.set(`${row.surahNumber}:${row.ayahNumber}`, row.id);
    }
  }
  return map;
}

async function ensureQuotes(
  prisma: PrismaClient,
  rows: Array<{
    externalId: string;
    textAr: string;
    matnAr: string | null;
    type: QuoteType;
    textSource: TextSource;
    referenceNumber: number | null;
    sourceId: string;
    apiProvider: string;
    rawPayload: Prisma.InputJsonValue;
  }>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (rows.length === 0) return ids;
  const existing: Array<{ id: string; apiProvider: string | null; externalId: string | null }> = [];
  for (let start = 0; start < rows.length; start += 200) {
    const slice = rows.slice(start, start + 200);
    existing.push(
      ...(await prisma.quote.findMany({
        where: { OR: slice.map((row) => ({ apiProvider: row.apiProvider, externalId: row.externalId })) },
        select: { id: true, apiProvider: true, externalId: true },
      })),
    );
  }
  const have = new Map(existing.map((row) => [`${row.apiProvider}|${row.externalId}`, row.id]));
  const missing = rows.filter((row) => !have.has(`${row.apiProvider}|${row.externalId}`));
  await inTransactionBatches(prisma, missing, async (tx, batch) => {
    await tx.quote.createMany({
      data: batch.map((row) => ({
        type: row.type,
        origin: QuoteOrigin.LOCAL,
        textAr: row.textAr,
        matnAr: row.matnAr,
        sourceId: row.sourceId,
        apiProvider: row.apiProvider,
        externalId: row.externalId,
        referenceNumber: row.referenceNumber,
        textSource: row.textSource,
        grade: row.type === QuoteType.HADITH ? HadithGrade.UNGRADED : null,
        gradeSource: GradeSource.AUTHORITY_LEGACY,
        rawPayload: row.rawPayload,
      })),
      skipDuplicates: true,
    });
  }, undefined, 80);
  const created: Array<{ id: string; apiProvider: string | null; externalId: string | null }> = [];
  for (let start = 0; start < missing.length; start += 200) {
    const slice = missing.slice(start, start + 200);
    created.push(
      ...(await prisma.quote.findMany({
        where: { OR: slice.map((row) => ({ apiProvider: row.apiProvider, externalId: row.externalId })) },
        select: { id: true, apiProvider: true, externalId: true },
      })),
    );
  }
  for (const [key, id] of have) ids.set(key, id);
  for (const row of created) ids.set(`${row.apiProvider}|${row.externalId}`, row.id);
  return ids;
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
    const same =
      found &&
      found.level === section.level &&
      (found.number ?? null) === section.number &&
      found.titleAr === section.titleAr &&
      (found.parentId ?? null) === parentId &&
      (found.volume ?? null) === (section.volume ?? null) &&
      (found.page ?? null) === (section.page ?? null) &&
      found.items.length === items.length &&
      found.items.every((item, itemIndex) => {
        const plannedItem = items[itemIndex];
        return (
          plannedItem &&
          item.kind === plannedItem.kind &&
          (item.quoteId ?? null) === plannedItem.quoteId &&
          (item.ayahFrom ?? null) === plannedItem.ayahFrom &&
          (item.ayahTo ?? null) === plannedItem.ayahTo
        );
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

function planBook(
  book: DunyaBook,
  sections: readonly ParsedSection[],
  verses: Map<string, string>,
  provenance: Prisma.InputJsonValue,
): {
  fresh: Array<{
    externalId: string;
    textAr: string;
    matnAr: string | null;
    type: QuoteType;
    textSource: TextSource;
    referenceNumber: number | null;
    sourceId: string;
    apiProvider: string;
    rawPayload: Prisma.InputJsonValue;
  }>;
  planned: PlannedItem[][];
} {
  const fresh: Array<{
    externalId: string;
    textAr: string;
    matnAr: string | null;
    type: QuoteType;
    textSource: TextSource;
    referenceNumber: number | null;
    sourceId: string;
    apiProvider: string;
    rawPayload: Prisma.InputJsonValue;
  }> = [];
  const planned: PlannedItem[][] = sections.map((section, sectionIndex) =>
    section.items.map((item: ParsedItem, itemIndex: number) => {
      if (item.kind === 'AYAH') {
        const key = item.ayahFrom ?? '';
        return {
          kind: 'AYAH' as const,
          quoteId: verses.get(key) ?? null,
          ayahFrom: item.ayahFrom,
          ayahTo: item.ayahTo,
          line: item.line,
          text: null,
          hadithNumber: null,
        };
      }
      if (item.kind === 'HADITH') {
        const externalId =
          item.hadithNumber != null
            ? `openiti:${item.hadithNumber}`
            : `openiti:${sectionIndex + 1}:${itemIndex + 1}`;
        const textAr = (item.text ?? '—').trim() || '—';
        const matn = splitMatn(textAr).matnText?.trim() || null;
        fresh.push({
          externalId,
          textAr,
          matnAr: matn || textAr,
          type: QuoteType.HADITH,
          textSource: TextSource.DIGITAL,
          referenceNumber: item.hadithNumber,
          sourceId: book.id,
          apiProvider: book.apiProvider,
          rawPayload: { fullTextAr: textAr, ...((provenance as object) ?? {}) },
        });
        return {
          kind: 'HADITH' as const,
          quoteId: null,
          ayahFrom: null,
          ayahTo: null,
          line: item.line,
          text: item.text,
          hadithNumber: item.hadithNumber,
          externalId,
        };
      }
      const externalId = `author:${book.key}:${sectionIndex + 1}:${itemIndex + 1}`;
      const textAr = (item.text ?? '—').trim() || '—';
      fresh.push({
        externalId,
        textAr,
        matnAr: null,
        type: QuoteType.BOOK_EXCERPT,
        textSource: TextSource.DIGITAL,
        referenceNumber: null,
        sourceId: book.id,
        apiProvider: AUTHOR_PROVIDER,
        rawPayload: provenance,
      });
      return {
        kind: 'AUTHOR_TEXT' as const,
        quoteId: null,
        ayahFrom: null,
        ayahTo: null,
        line: item.line,
        text: item.text,
        hadithNumber: null,
        externalId,
      };
    }),
  );
  return { fresh, planned };
}

function writeDunyaDocs(books: readonly BookReport[]): void {
  mkdirSync(DOCS, { recursive: true });
  for (const book of books) {
    writeFileSync(join(DOCS, `${book.key}.tsv`), sectionTsv(book));
  }
  const index = [
    'key\ttitleAr\tsections\tayah\thadith\tauthor',
    ...books.map((book) => {
      let ayah = 0;
      let hadith = 0;
      let author = 0;
      for (const section of book.sections) {
        for (const item of section.parsed.items) {
          if (item.kind === 'AYAH') ayah += 1;
          else if (item.kind === 'HADITH') hadith += 1;
          else author += 1;
        }
      }
      return `${book.key}\t${book.titleAr}\t${book.sections.length}\t${ayah}\t${hadith}\t${author}`;
    }),
    '',
  ].join('\n');
  writeFileSync(join(DOCS, '_index.tsv'), index);
}

export async function runIbnAbiDunyaImport({ prisma, dryRun }: ImportOptions): Promise<void> {
  assertDunyaCatalog();
  const verses = await verseIds(prisma);
  const reports: BookReport[] = [];
  let totalCreatedSections = 0;
  let totalCreatedItems = 0;
  let totalQuotes = 0;

  for (const book of DUNYA_BOOKS) {
    if (!dryRun) await ensureDunyaSource(prisma, book);
    const corpus = await loadCorpus(book.corpus);
    const sections = parseDunyaBook(corpus.text);
    const provenance = provenanceOf(corpus) as unknown as Prisma.InputJsonValue;
    const { fresh, planned } = planBook(book, sections, verses, provenance);

    if (dryRun) {
      console.log(
        `${book.titleAr}: dry-run sections=${sections.length} narrations=${fresh.filter((r) => r.type === QuoteType.HADITH).length} author=${fresh.filter((r) => r.type === QuoteType.BOOK_EXCERPT).length}`,
      );
      reports.push({
        key: book.key,
        titleAr: book.titleAr,
        sections: sections.map((section) => ({ id: '', parsed: section })),
      });
      continue;
    }

    const made = await ensureQuotes(prisma, fresh);
    totalQuotes += fresh.length;
    for (const items of planned) {
      for (const item of items) {
        if (item.quoteId || !item.externalId) continue;
        const provider = item.kind === 'AUTHOR_TEXT' ? AUTHOR_PROVIDER : book.apiProvider;
        item.quoteId = made.get(`${provider}|${item.externalId}`) ?? null;
      }
    }

    const plain: PlannedItem[][] = planned.map((items) =>
      items.map((item) => ({
        kind: item.kind,
        quoteId: item.quoteId,
        ayahFrom: item.ayahFrom,
        ayahTo: item.ayahTo,
        line: item.line,
        text: item.text,
        hadithNumber: item.hadithNumber,
      })),
    );

    const outcome = await withRunLog(prisma, book.id, async () => {
      const written = await persist(prisma, book.id, sections, plain);
      totalCreatedSections += written.createdSections;
      totalCreatedItems += written.createdItems;
      const summary = formatSummary(
        {
          sections: sections.length,
          createdSections: written.createdSections,
          createdItems: written.createdItems,
          quotes: fresh.length,
        },
        [corpus],
      );
      console.log(`${book.titleAr}: ${summary}`);
      return { recordsImported: written.createdSections + written.createdItems, summary, sectionIds: written.sectionIds };
    });

    const writtenSections: WrittenSection[] = sections.map((section, index) => ({
      id: outcome.sectionIds[index] ?? '',
      parsed: section,
    }));
    reports.push({ key: book.key, titleAr: book.titleAr, sections: writtenSections });
  }

  writeDunyaDocs(reports);
  console.log(
    `ibn-abi-dunya: books=${DUNYA_BOOKS.length} createdSections=${totalCreatedSections} createdItems=${totalCreatedItems} quoteRows=${totalQuotes} tsv=${DOCS}`,
  );
}
