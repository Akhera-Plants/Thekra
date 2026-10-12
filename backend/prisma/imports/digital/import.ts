/**
 * Prefers the pinned OpenITI text. A narration that is the same text as a
 * Waqfeya row updates that row and keeps its PDF page. Anything else is a new
 * row. A second run writes nothing.
 */
import { HadithGrade, LinkReviewStatus, QuoteOrigin, QuoteType, TextSource, type Prisma } from '@prisma/client';
import { wordOverlap } from '../../../src/common/text/match-score.js';
import { normalizeArabic } from '../../../src/common/text/arabic-normalizer.js';
import { approvedWork, ensureSource, type BookKey } from '../lib/source.js';
import { loadCorpus, provenanceOf, type CorpusSpec } from '../lib/corpus.js';
import type { ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { formatSummary, withRunLog } from '../lib/run-log.js';
import { applyVerseReplacements, detectQuranSpans, loadUthmaniMap } from '../waqfeya/quran.js';
import { join } from 'node:path';
import { parseKabairSections, parseMinhajSections, parseNumberedBook, prophetParagraphs, type DigitalPiece } from './parse.js';

const DETECTOR = join(import.meta.dirname, '..', '..', '..', '.corpus', 'detector');
const SEPARATOR = '\n\n⟦⟧\n\n';

const RIYAD: CorpusSpec = {
  repo: '0700AH',
  path: 'data/0676Nawawi/0676Nawawi.RiyadSalihin/0676Nawawi.RiyadSalihin.Shamela0002348-ara5',
  commit: '6dca5e250b9e4405b93c4a5e73cfffdef5d7fef7',
  sha256: 'a601cbcb6b1846c00f10e9fb38377bb1609fe664d90fe01f1506aa9c10d5d88e',
};
const ZUHD: CorpusSpec = {
  repo: '0200AH',
  path: 'data/0181IbnMubarak/0181IbnMubarak.Zuhd/0181IbnMubarak.Zuhd.Shamela0013028-ara1',
  commit: '62b3ebfde6886b17b0ad6c346d7fc79f8ac0fcd8',
  sha256: '0c2b26f6bf959f301467a493af0714debb8c0350597df465eadaf2fcce46da3a',
};
const MINHAJ: CorpusSpec = {
  repo: '0700AH',
  path: 'data/0689AhmadIbnCabdRahmanIbnQudama/0689AhmadIbnCabdRahmanIbnQudama.MukhtasarMinhajQasidin/0689AhmadIbnCabdRahmanIbnQudama.MukhtasarMinhajQasidin.Shamela0098087-ara1',
  commit: '6dca5e250b9e4405b93c4a5e73cfffdef5d7fef7',
  sha256: '68939b45c8c8a60b3dbf145a0c0bc17e9fccbfc05a2278b30757160bad556ed3',
};
const KABAIR: CorpusSpec = {
  repo: '0750AH',
  path: 'data/0748Dhahabi/0748Dhahabi.Kabair/0748Dhahabi.Kabair.Shamela0006848-ara1',
  commit: '9168f4a124537948de88cba6adfacf560bc35d35',
  sha256: '4cccf7f3de5da10fcc52f78422f5a03dfc6ea4fd29ac15da72935be169783b1a',
};

interface Job {
  bookKey: BookKey;
  corpus: CorpusSpec;
  prefix: string;
  parse: (source: string) => DigitalPiece[];
  /** Link each section to the sin already ranked from this book. */
  linkRankedSins: boolean;
}

interface Row {
  externalId: string;
  kind: 'narration' | 'section';
  number: number;
  title: string | null;
  textAr: string;
  volume: string | null;
  page: string | null;
}

interface StoredQuote {
  id: string;
  externalId: string | null;
  textAr: string;
  referenceNumber: number | null;
  textSource: TextSource;
  rawPayload: Prisma.JsonValue;
  folded: string;
}

function fold(text: string): string {
  return normalizeArabic(text).replace(/[^\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function replaceQuran(pieces: DigitalPiece[], uthmani: Map<string, string>): { pieces: DigitalPiece[]; spans: number } {
  const joined = pieces.map((piece) => piece.textAr).join(SEPARATOR);
  const spans = detectQuranSpans(joined, DETECTOR);
  const replaced = applyVerseReplacements(joined, spans, (surah, ayah) => {
    const text = uthmani.get(`${surah}:${ayah}`);
    if (!text) throw new Error(`No Uthmani text for ${surah}:${ayah}`);
    return text;
  });
  const parts = replaced.text.split(SEPARATOR);
  if (parts.length !== pieces.length) throw new Error('Quran replacement split the book text');
  const next = pieces.map((piece, index) => {
    const textAr = parts[index]?.trim() ?? piece.textAr;
    return {
      ...piece,
      textAr,
      narrations: piece.kind === 'section' ? prophetParagraphs(textAr) : [],
    };
  });
  return { pieces: next, spans: spans.length };
}

function flatten(prefix: string, pieces: readonly DigitalPiece[]): Row[] {
  const rows: Row[] = [];
  const seen = new Map<number, number>();
  for (const piece of pieces) {
    const occurrence = (seen.get(piece.number) ?? 0) + 1;
    seen.set(piece.number, occurrence);
    const base = occurrence === 1 ? `${prefix}:${piece.number}` : `${prefix}:${piece.number}:${occurrence}`;
    rows.push({
      externalId: base,
      kind: piece.kind,
      number: piece.number,
      title: piece.title,
      textAr: piece.textAr,
      volume: piece.volume,
      page: piece.page,
    });
    piece.narrations.forEach((text, index) => {
      rows.push({
        externalId: `${base}:h${index + 1}`,
        kind: 'narration',
        number: piece.number,
        title: piece.title,
        textAr: text,
        volume: piece.volume,
        page: piece.page,
      });
    });
  }
  return rows;
}

function claimOcr(row: Row, pool: StoredQuote[], used: Set<string>): StoredQuote | null {
  const sameNumber = pool.filter((candidate) => candidate.referenceNumber === row.number && !used.has(candidate.id));
  const numbered = best(row, sameNumber, 0.55);
  if (numbered) return numbered;
  return best(row, pool.filter((candidate) => !used.has(candidate.id)), 0.72);
}

function best(row: Row, pool: readonly StoredQuote[], floor: number): StoredQuote | null {
  const folded = fold(row.textAr);
  let chosen: StoredQuote | null = null;
  let score = floor;
  for (const candidate of pool) {
    const next = wordOverlap(folded, candidate.folded);
    if (next >= score) {
      score = next;
      chosen = candidate;
    }
  }
  return chosen;
}

export async function runDigitalImport(options: ImportOptions): Promise<void> {
  const jobs: Job[] = [
    { bookKey: 'book:nawawi-riyad', corpus: RIYAD, prefix: 'digital:riyad', parse: parseNumberedBook, linkRankedSins: false },
    { bookKey: 'book:ibn-mubarak-zuhd', corpus: ZUHD, prefix: 'digital:zuhd', parse: parseNumberedBook, linkRankedSins: false },
    { bookKey: 'book:ibn-qudama-minhaj', corpus: MINHAJ, prefix: 'digital:minhaj', parse: parseMinhajSections, linkRankedSins: false },
    { bookKey: 'book:dhahabi-kabair', corpus: KABAIR, prefix: 'digital:kabair', parse: parseKabairSections, linkRankedSins: true },
  ];
  for (const job of jobs) await importJob(options, job);
}

async function importJob(options: ImportOptions, job: Job): Promise<void> {
  const work = approvedWork(job.bookKey);
  const corpus = await loadCorpus(job.corpus);
  const parsed = job.parse(corpus.text);
  const limited = options.limit === null ? parsed : parsed.slice(0, options.limit);
  const uthmani = await loadUthmaniMap(options.prisma, join(DETECTOR, '..', 'uthmani.json'));
  const replaced = replaceQuran(limited, uthmani);
  const rows = flatten(job.prefix, replaced.pieces);
  console.log(`${work.nameAr}: pieces=${replaced.pieces.length} rows=${rows.length} quranSpans=${replaced.spans}`);
  if (options.dryRun) return;

  await ensureSource(options.prisma, work);
  await withRunLog(options.prisma, work.id, async () => {
    const counts = await writeRows(options, work.id, work.bookKey, work.nameAr, work.authorAr ?? null, rows, provenanceOf(corpus));
    if (job.linkRankedSins) counts.linked = await linkRanked(options, work.id, rows);
    const summary = formatSummary(counts, [corpus]);
    console.log(summary);
    return { recordsImported: counts.created + counts.updated, summary };
  });
}

async function writeRows(
  options: ImportOptions,
  sourceId: string,
  apiProvider: string,
  bookTitle: string,
  author: string | null,
  rows: readonly Row[],
  provenance: ReturnType<typeof provenanceOf>,
): Promise<{ created: number; updated: number; unchanged: number; matched: number; linked: number }> {
  const stored = await options.prisma.quote.findMany({
    where: { sourceId },
    select: { id: true, externalId: true, textAr: true, referenceNumber: true, textSource: true, rawPayload: true },
  });
  const byExternal = new Map(stored.filter((row) => row.externalId).map((row) => [row.externalId as string, row]));
  const pinned = new Map<string, (typeof stored)[number]>();
  for (const row of stored) {
    const marker = pinnedExternalId(row.rawPayload);
    if (marker) pinned.set(marker, row);
  }
  const ocr: StoredQuote[] = stored
    .filter((row) => row.externalId == null || !row.externalId.startsWith('digital:'))
    .map((row) => ({ ...row, folded: fold(row.textAr) }));
  const used = new Set<string>();
  const counts = { created: 0, updated: 0, unchanged: 0, matched: 0, linked: 0 };
  const creates: Prisma.QuoteCreateManyInput[] = [];
  const updates: Array<{ id: string; textAr: string; rawPayload: Prisma.InputJsonValue }> = [];

  for (const row of rows) {
    const owned = byExternal.get(row.externalId) ?? pinned.get(row.externalId);
    if (owned) {
      used.add(owned.id);
      if (owned.textAr === row.textAr && owned.textSource === TextSource.DIGITAL) {
        counts.unchanged += 1;
      } else {
        counts.updated += 1;
        updates.push({ id: owned.id, textAr: row.textAr, rawPayload: payload(owned.rawPayload, provenance, row) });
      }
      continue;
    }
    const claim = row.kind === 'narration' ? claimOcr(row, ocr, used) : null;
    if (claim) {
      used.add(claim.id);
      counts.matched += 1;
      if (claim.textAr === row.textAr && claim.textSource === TextSource.DIGITAL) counts.unchanged += 1;
      else {
        counts.updated += 1;
        updates.push({ id: claim.id, textAr: row.textAr, rawPayload: payload(claim.rawPayload, provenance, row) });
      }
      continue;
    }
    counts.created += 1;
    creates.push({
      type: row.kind === 'section' ? QuoteType.BOOK_EXCERPT : QuoteType.HADITH,
      origin: QuoteOrigin.LOCAL,
      textAr: row.textAr,
      sourceId,
      apiProvider,
      externalId: row.externalId,
      referenceNumber: row.number,
      volume: row.volume,
      page: row.page,
      bookTitle,
      author,
      pageOrChapter: row.title,
      grade: row.kind === 'section' ? null : HadithGrade.UNGRADED,
      textSource: TextSource.DIGITAL,
      rawPayload: payload(null, provenance, row),
    });
  }

  await inTransactionBatches(options.prisma, updates, async (tx, batch) => {
    for (const row of batch) {
      await tx.quote.update({
        where: { id: row.id },
        data: { textAr: row.textAr, textSource: TextSource.DIGITAL, rawPayload: row.rawPayload },
      });
    }
  }, undefined, 40);
  await inTransactionBatches(options.prisma, creates, async (tx, batch) => {
    await tx.quote.createMany({ data: [...batch] });
  }, undefined, 40);
  return counts;
}

function payload(
  previous: Prisma.JsonValue | null,
  provenance: ReturnType<typeof provenanceOf>,
  row: Row,
): Prisma.InputJsonObject {
  const base = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  return {
    ...base,
    ...provenance,
    chapterTitle: row.title,
    openitiPage: row.page,
    openitiExternalId: row.externalId,
    textOrigin: 'openiti',
  };
}

function pinnedExternalId(raw: Prisma.JsonValue | null): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw.openitiExternalId;
  return typeof value === 'string' ? value : null;
}

async function linkRanked(options: ImportOptions, sourceId: string, rows: readonly Row[]): Promise<number> {
  const sins = await options.prisma.sin.findMany({
    where: { rankSourceId: sourceId },
    select: { id: true, slug: true, rankReference: true },
  });
  const sinByNumber = new Map<number, string>();
  for (const sin of sins) {
    const slug = /^kabira-(\d+)$/.exec(sin.slug);
    const reference = /رقم (\d+)/.exec(sin.rankReference ?? '');
    const number = slug ? Number(slug[1]) : reference ? Number(reference[1]) : null;
    if (number != null) sinByNumber.set(number, sin.id);
  }
  const quotes = await options.prisma.quote.findMany({
    where: { sourceId, externalId: { in: rows.map((row) => row.externalId) } },
    select: { id: true, externalId: true },
  });
  const quoteByExternal = new Map(quotes.map((quote) => [quote.externalId, quote.id]));
  const links = rows.flatMap((row) => {
    const sinId = sinByNumber.get(row.number);
    const quoteId = quoteByExternal.get(row.externalId);
    if (!sinId || !quoteId) return [];
    return [{
      sinId,
      quoteId,
      reviewStatus: LinkReviewStatus.ACCEPTED,
      note: `باب ${row.title ?? ''} — الكبائر`.slice(0, 500),
    }];
  });
  if (links.length > 0) await options.prisma.sinQuote.createMany({ data: links, skipDuplicates: true });
  return links.length;
}
