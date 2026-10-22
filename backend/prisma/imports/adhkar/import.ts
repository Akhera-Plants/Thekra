/**
 * Al-Adhkar (al-Nawawi) — structure-only import (OpenITI 0700AH /
 * 0676Nawawi.Adhkar.Shamela0001956-ara1, Dar al-Fikr, ed. ʿAbd al-Qadir
 * al-Arna'ut).
 *
 * Creates one Source, the BookSection / SectionItem tree, and Quote rows for
 * numbered narrations (HADITH, with matnAr from splitMatn so the shared
 * matn-only takhrij runs apply) and author paragraphs (BOOK_EXCERPT). AYAH
 * items link to the canonical Quran source. Does NOT create topic / sin /
 * deed / iman-branch links of any kind — the reviewer maps chapters later.
 * Al-Nawawi's own grading remarks are author/narration text, never a grade
 * source; narrations stay UNGRADED until the takhrij / hadeethenc runs match
 * them, and unmatched ones stay unpublished by the existing GradePolicy.
 *
 * After structure: run `takhrij` (Sahihayn matn match) and `athar` (the
 * classifier includes book:nawawi-adhkar). A second run inserts nothing.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GradeSource,
  HadithGrade,
  QuoteOrigin,
  QuoteType,
  TextSource,
  type Prisma,
  type PrismaClient,
  type SectionItemKind,
} from '@prisma/client';
import { splitMatn } from '../../../src/common/text/matn.js';
import { stripPageMarkers } from '../../../src/common/text/strip-page-markers.js';
import { inTransactionBatches } from '../lib/batch.js';
import type { ImportOptions } from '../lib/cli.js';
import { loadCorpus, provenanceOf } from '../lib/corpus.js';
import { formatSummary, withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import type { ParsedItem, ParsedSection } from '../structure/parse.js';
import { sectionTsv, type BookReport } from '../structure/report.js';
import { ADHKAR_CORPUS, ADHKAR_KEY, ADHKAR_PROVIDER, ADHKAR_SOURCE_ID, ADHKAR_TITLE_AR } from './edition.js';
import { parseAdhkar } from './parse.js';

const QURAN_SOURCE_ID = '10000000-0000-4000-8000-000000000001';
const AUTHOR_PROVIDER = 'book-structure';
const DOCS = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'taxonomy', 'sections');

interface PlannedItem {
  kind: SectionItemKind;
  quoteId: string | null;
  ayahFrom: string | null;
  ayahTo: string | null;
  externalId?: string;
}

interface FreshQuote {
  externalId: string;
  textAr: string;
  matnAr: string | null;
  type: QuoteType;
  referenceNumber: number | null;
  apiProvider: string;
  rawPayload: Prisma.InputJsonValue;
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

async function ensureQuotes(prisma: PrismaClient, rows: readonly FreshQuote[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (rows.length === 0) return ids;
  const lookup = async (slice: readonly FreshQuote[]): Promise<Array<{ id: string; apiProvider: string | null; externalId: string | null }>> => {
    const found: Array<{ id: string; apiProvider: string | null; externalId: string | null }> = [];
    for (let start = 0; start < slice.length; start += 200) {
      const chunk = slice.slice(start, start + 200);
      found.push(
        ...(await prisma.quote.findMany({
          where: { OR: chunk.map((row) => ({ apiProvider: row.apiProvider, externalId: row.externalId })) },
          select: { id: true, apiProvider: true, externalId: true },
        })),
      );
    }
    return found;
  };
  const existing = await lookup(rows);
  const have = new Map(existing.map((row) => [`${row.apiProvider}|${row.externalId}`, row.id]));
  const missing = rows.filter((row) => !have.has(`${row.apiProvider}|${row.externalId}`));
  await inTransactionBatches(prisma, missing, async (tx, batch) => {
    await tx.quote.createMany({
      data: batch.map((row) => ({
        type: row.type,
        origin: QuoteOrigin.LOCAL,
        textAr: row.textAr,
        matnAr: row.matnAr,
        sourceId: ADHKAR_SOURCE_ID,
        apiProvider: row.apiProvider,
        externalId: row.externalId,
        referenceNumber: row.referenceNumber,
        textSource: TextSource.DIGITAL,
        grade: row.type === QuoteType.HADITH ? HadithGrade.UNGRADED : null,
        gradeSource: GradeSource.AUTHORITY_LEGACY,
        rawPayload: row.rawPayload,
      })),
      skipDuplicates: true,
    });
  }, undefined, 80);
  const created = await lookup(missing);
  for (const [key, id] of have) ids.set(key, id);
  for (const row of created) ids.set(`${row.apiProvider}|${row.externalId}`, row.id);
  return ids;
}

async function persist(
  prisma: PrismaClient,
  sections: readonly ParsedSection[],
  planned: readonly PlannedItem[][],
): Promise<{ sectionIds: string[]; createdSections: number; createdItems: number }> {
  const existing = await prisma.bookSection.findMany({
    where: { sourceId: ADHKAR_SOURCE_ID },
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
        sourceId: ADHKAR_SOURCE_ID,
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
  await prisma.bookSection.deleteMany({ where: { sourceId: ADHKAR_SOURCE_ID, order: { gt: sections.length } } });
  return { sectionIds, createdSections, createdItems };
}

function plan(
  sections: readonly ParsedSection[],
  verses: Map<string, string>,
  provenance: Prisma.InputJsonValue,
): { fresh: FreshQuote[]; planned: PlannedItem[][] } {
  const fresh: FreshQuote[] = [];
  // 28 narration numbers repeat in this edition; suffix later occurrences so
  // every narration keeps its own quote row, deterministically across runs.
  const seen = new Map<number, number>();
  const planned: PlannedItem[][] = sections.map((section, sectionIndex) =>
    section.items.map((item: ParsedItem, itemIndex: number) => {
      if (item.kind === 'AYAH') {
        return {
          kind: 'AYAH' as const,
          quoteId: verses.get(item.ayahFrom ?? '') ?? null,
          ayahFrom: item.ayahFrom,
          ayahTo: item.ayahTo,
        };
      }
      if (item.kind === 'HADITH') {
        let externalId: string;
        if (item.hadithNumber != null) {
          const times = (seen.get(item.hadithNumber) ?? 0) + 1;
          seen.set(item.hadithNumber, times);
          externalId = times === 1 ? `openiti:${item.hadithNumber}` : `openiti:${item.hadithNumber}#${times}`;
        } else {
          externalId = `openiti:${sectionIndex + 1}:${itemIndex + 1}`;
        }
        const textAr = stripPageMarkers((item.text ?? '—').trim() || '—');
        const matn = splitMatn(textAr).matnText?.trim() || null;
        fresh.push({
          externalId,
          textAr,
          matnAr: matn || textAr,
          type: QuoteType.HADITH,
          referenceNumber: item.hadithNumber,
          apiProvider: ADHKAR_PROVIDER,
          rawPayload: { fullTextAr: textAr, ...((provenance as object) ?? {}) },
        });
        return { kind: 'HADITH' as const, quoteId: null, ayahFrom: null, ayahTo: null, externalId };
      }
      const externalId = `author:${ADHKAR_KEY}:${sectionIndex + 1}:${itemIndex + 1}`;
      fresh.push({
        externalId,
        textAr: stripPageMarkers((item.text ?? '—').trim() || '—'),
        matnAr: null,
        type: QuoteType.BOOK_EXCERPT,
        referenceNumber: null,
        apiProvider: AUTHOR_PROVIDER,
        rawPayload: provenance,
      });
      return { kind: 'AUTHOR_TEXT' as const, quoteId: null, ayahFrom: null, ayahTo: null, externalId };
    }),
  );
  return { fresh, planned };
}

export async function runAdhkarImport({ prisma, dryRun }: ImportOptions): Promise<void> {
  const corpus = await loadCorpus(ADHKAR_CORPUS);
  const sections = parseAdhkar(corpus.text);
  const provenance = provenanceOf(corpus) as unknown as Prisma.InputJsonValue;
  const verses = dryRun ? new Map<string, string>() : await verseIds(prisma);
  const { fresh, planned } = plan(sections, verses, provenance);

  if (dryRun) {
    console.log(
      `${ADHKAR_TITLE_AR}: dry-run sections=${sections.length} narrations=${fresh.filter((r) => r.type === QuoteType.HADITH).length} author=${fresh.filter((r) => r.type === QuoteType.BOOK_EXCERPT).length}`,
    );
    return;
  }

  await ensureSource(prisma, approvedWork(ADHKAR_PROVIDER));
  const made = await ensureQuotes(prisma, fresh);
  for (const items of planned) {
    for (const item of items) {
      if (item.quoteId || !item.externalId) continue;
      const provider = item.kind === 'AUTHOR_TEXT' ? AUTHOR_PROVIDER : ADHKAR_PROVIDER;
      item.quoteId = made.get(`${provider}|${item.externalId}`) ?? null;
    }
  }

  const outcome = await withRunLog(prisma, ADHKAR_SOURCE_ID, async () => {
    const written = await persist(prisma, sections, planned);
    const summary = formatSummary(
      {
        sections: sections.length,
        createdSections: written.createdSections,
        createdItems: written.createdItems,
        quotes: fresh.length,
      },
      [corpus],
    );
    console.log(`${ADHKAR_TITLE_AR}: ${summary}`);
    return { recordsImported: written.createdSections + written.createdItems, summary, sectionIds: written.sectionIds };
  });

  const report: BookReport = {
    key: ADHKAR_KEY,
    titleAr: ADHKAR_TITLE_AR,
    sections: sections.map((section, index) => ({ id: outcome.sectionIds[index] ?? '', parsed: section })),
  };
  mkdirSync(DOCS, { recursive: true });
  writeFileSync(join(DOCS, `${ADHKAR_KEY}.tsv`), sectionTsv(report));
}
