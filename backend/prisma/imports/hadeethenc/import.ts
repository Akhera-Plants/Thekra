/**
 * Import HadeethEnc explanations (SHARH / FAWAID / GHARIB), match matn to our
 * HADITH quotes at 0.75, apply HADEETHENC grades where allowed, and export
 * unmatched rows for the reviewer.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ExplanationKind,
  GradeSource,
  HadithGrade,
  Prisma,
  QuoteOrigin,
  QuoteType,
  TextSource,
  type PrismaClient,
} from '@prisma/client';
import { STRONG_MATCH_SCORE, combinedScore, wordOverlap } from '../../../src/common/text/match-score.js';
import { splitMatn } from '../../../src/common/text/matn.js';
import { normalizeMatn } from '../../../src/common/text/normalize-matn.js';
import type { ImportOptions } from '../lib/cli.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import { withRunLog } from '../lib/run-log.js';
import {
  PROVIDER,
  collectAllIds,
  fetchOne,
  formatGharib,
  formatHints,
  type HadeethOne,
} from './api.js';
import {
  HADEETHENC_AUTHORITY_AR,
  mapHadeethencGrade,
  referenceLine,
} from './grades.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const UNLINKED_TSV = join(REPO_ROOT, 'docs/taxonomy/hadeethenc-unlinked.tsv');

const PROTECTED_SOURCES: ReadonlySet<GradeSource> = new Set([
  GradeSource.SAHIHAYN,
  GradeSource.AUTO_SAHIHAYN,
  GradeSource.SUNAN_TAHQIQ,
  GradeSource.AHMAD_TAHQIQ,
  GradeSource.IBN_HIBBAN_TAHQIQ,
  GradeSource.MANUAL,
]);

interface CorpusHadith {
  id: string;
  rootTitle: string;
  ar: HadeethOne;
  en: HadeethOne | null;
  matn: string;
  words: string[];
  mapped: ReturnType<typeof mapHadeethencGrade>;
  ref: string | null;
}

interface QuoteRow {
  id: string;
  textAr: string;
  grade: HadithGrade | null;
  gradeSource: GradeSource;
  gradeAuthority: string | null;
  gradeReference: string | null;
  legacyGrade: HadithGrade | null;
  legacyGradeAuthority: string | null;
  legacyGradeReference: string | null;
  matn: string;
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

async function trigramScores(
  prisma: PrismaClient,
  pairs: Array<{ quoteId: string; corpusIndex: number; left: string; right: string }>,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const chunkSize = 400;
  for (let offset = 0; offset < pairs.length; offset += chunkSize) {
    const chunk = pairs.slice(offset, offset + chunkSize);
    const values = Prisma.join(
      chunk.map(
        (row) => Prisma.sql`(
      ${row.quoteId}::text, ${String(row.corpusIndex)}::text, ${row.left}::text, ${row.right}::text
    )`,
      ),
    );
    const found = await prisma.$queryRaw<Array<{ quoteId: string; corpusIndex: string; trgm: number }>>`
      SELECT qid AS "quoteId", cid AS "corpusIndex", similarity(left_text, right_text) AS trgm
      FROM (VALUES ${values}) AS t(qid, cid, left_text, right_text)
    `;
    for (const row of found) scores.set(`${row.quoteId}:${row.corpusIndex}`, Number(row.trgm));
    if (offset > 0 && offset % 8_000 === 0) console.log(`trigram ${offset} / ${pairs.length}`);
  }
  return scores;
}

function explanationExternalId(
  hadeethId: string,
  language: string,
  kind: ExplanationKind,
  quoteId: string,
): string {
  return `${hadeethId}:${language}:${kind}:${quoteId}`;
}

async function upsertExplanation(
  prisma: PrismaClient,
  input: {
    kind: ExplanationKind;
    quoteId: string;
    languageCode: string;
    text: string;
    sourceId: string;
    reference: string | null;
    hadeethId: string;
    raw: Prisma.InputJsonValue;
  },
): Promise<'created' | 'updated' | 'unchanged'> {
  const externalId = explanationExternalId(input.hadeethId, input.languageCode, input.kind, input.quoteId);
  const existing = await prisma.explanation.findUnique({
    where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId } },
    select: { id: true, text: true, reference: true, quoteId: true },
  });
  if (
    existing
    && existing.text === input.text
    && existing.reference === input.reference
    && existing.quoteId === input.quoteId
  ) {
    return 'unchanged';
  }
  await prisma.explanation.upsert({
    where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId } },
    create: {
      kind: input.kind,
      quoteId: input.quoteId,
      languageCode: input.languageCode,
      text: input.text,
      sourceId: input.sourceId,
      reference: input.reference,
      origin: QuoteOrigin.API_CACHED,
      apiProvider: PROVIDER,
      externalId,
      rawPayload: input.raw,
      sortOrder: input.kind === ExplanationKind.SHARH ? 0 : input.kind === ExplanationKind.FAWAID ? 1 : 2,
    },
    update: {
      text: input.text,
      reference: input.reference,
      quoteId: input.quoteId,
      rawPayload: input.raw,
    },
  });
  return existing ? 'updated' : 'created';
}

async function attachBundle(
  prisma: PrismaClient,
  sourceId: string,
  quoteId: string,
  row: CorpusHadith,
): Promise<{ created: number; updated: number; unchanged: number }> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const record = async (
    language: 'ar' | 'en',
    one: HadeethOne,
    kind: ExplanationKind,
    text: string | null,
  ) => {
    if (!text) return;
    const result = await upsertExplanation(prisma, {
      kind,
      quoteId,
      languageCode: language,
      text,
      sourceId,
      reference: referenceLine(row.ar.reference) ?? row.ref,
      hadeethId: row.id,
      raw: { hadeethId: row.id, language, kind, categories: one.categories ?? row.ar.categories },
    });
    if (result === 'created') created += 1;
    else if (result === 'updated') updated += 1;
    else unchanged += 1;
  };

  await record('ar', row.ar, ExplanationKind.SHARH, (row.ar.explanation ?? '').trim() || null);
  await record('ar', row.ar, ExplanationKind.FAWAID, formatHints(row.ar.hints));
  await record('ar', row.ar, ExplanationKind.GHARIB, formatGharib(row.ar.words_meanings));
  if (row.en) {
    await record('en', row.en, ExplanationKind.SHARH, (row.en.explanation ?? '').trim() || null);
    await record('en', row.en, ExplanationKind.FAWAID, formatHints(row.en.hints));
    await record('en', row.en, ExplanationKind.GHARIB, formatGharib(row.en.words_meanings));
  }
  return { created, updated, unchanged };
}

function mayApplyGrade(current: GradeSource): boolean {
  return current === GradeSource.AUTHORITY_LEGACY || current === GradeSource.HADEETHENC;
}

async function applyGrade(
  prisma: PrismaClient,
  quote: QuoteRow,
  row: CorpusHadith,
  alreadyGraded: Set<string>,
): Promise<'graded' | 'skipped' | 'unchanged'> {
  if (!row.mapped.publishable) return 'skipped';
  if (PROTECTED_SOURCES.has(quote.gradeSource)) return 'skipped';
  if (!mayApplyGrade(quote.gradeSource)) return 'skipped';
  if (alreadyGraded.has(quote.id)) return 'unchanged';
  // Already stamped HADEETHENC — leave the citation alone (a quote can match
  // several HadeethEnc rows; flipping the reference every re-run is not idempotent).
  if (quote.gradeSource === GradeSource.HADEETHENC) {
    alreadyGraded.add(quote.id);
    return 'unchanged';
  }
  const reference = row.ref;
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      grade: row.mapped.grade,
      gradeSource: GradeSource.HADEETHENC,
      gradeAuthority: HADEETHENC_AUTHORITY_AR,
      gradeReference: reference,
      legacyGrade: quote.legacyGrade ?? quote.grade,
      legacyGradeAuthority: quote.legacyGradeAuthority ?? quote.gradeAuthority,
      legacyGradeReference: quote.legacyGradeReference ?? quote.gradeReference,
    },
  });
  alreadyGraded.add(quote.id);
  quote.gradeSource = GradeSource.HADEETHENC;
  quote.grade = row.mapped.grade;
  quote.gradeAuthority = HADEETHENC_AUTHORITY_AR;
  quote.gradeReference = reference;
  return 'graded';
}

function tsvEscape(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
}

export async function runHadeethencImport(options: ImportOptions): Promise<void> {
  const work = approvedWork('book:hadeethenc');
  await ensureSource(options.prisma, work);
  const sourceId = work.id;

  console.log('hadeethenc: collecting ids…');
  const allIds = await collectAllIds(options.limit);
  console.log(`hadeethenc: ${allIds.length} hadith to load`);

  const corpus: CorpusHadith[] = [];
  for (let i = 0; i < allIds.length; i += 1) {
    const { id, rootTitle, hasEn } = allIds[i]!;
    const ar = await fetchOne(id, 'ar');
    if (!ar) {
      console.warn(`hadeethenc: skip missing ar id=${id}`);
      continue;
    }
    const en = hasEn ? await fetchOne(id, 'en') : null;
    const matn = normalizeMatn(splitMatn(ar.hadeeth ?? '').matnText || ar.hadeeth || '');
    corpus.push({
      id,
      rootTitle,
      ar,
      en,
      matn,
      words: matnWords(matn),
      mapped: mapHadeethencGrade(ar.grade),
      ref: referenceLine(ar.reference),
    });
    if ((i + 1) % 100 === 0) {
      console.log(`hadeethenc: loaded ${i + 1} / ${allIds.length}`);
    }
  }

  if (options.dryRun) {
    console.log(JSON.stringify({ dryRun: true, fetched: corpus.length }, null, 2));
    return;
  }

  await withRunLog(options.prisma, sourceId, async () => {
    console.log(`hadeethenc: matching ${corpus.length} hadith`);

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

    // Match against existing book/Sahihayn copies only — never against Quotes
    // this importer created, or a re-run would “match” each hadith to itself.
    const stored = await options.prisma.quote.findMany({
      where: {
        type: QuoteType.HADITH,
        OR: [{ apiProvider: null }, { apiProvider: { not: PROVIDER } }],
      },
      select: {
        id: true,
        textAr: true,
        matnAr: true,
        grade: true,
        gradeSource: true,
        gradeAuthority: true,
        gradeReference: true,
        legacyGrade: true,
        legacyGradeAuthority: true,
        legacyGradeReference: true,
      },
    });
    const quotes: QuoteRow[] = stored.map((row) => ({
      ...row,
      matn: normalizeMatn(
        (row.matnAr && row.matnAr.trim()) || splitMatn(row.textAr).matnText || row.textAr,
      ),
    }));
    console.log(`hadeethenc: matching against ${quotes.length} HADITH quotes`);

    const pendingPairs: Array<{ quoteId: string; corpusIndex: number; left: string; right: string }> = [];
    for (const quote of quotes) {
      if (quote.matn.length < 25) continue;
      const indexes = proposeIndexes(matnWords(quote.matn), postings, documentFrequency);
      for (const index of indexes) {
        const row = corpus[index];
        if (!row || row.matn.length < 25) continue;
        if (wordOverlap(quote.matn, row.matn) < 0.5) continue;
        pendingPairs.push({ quoteId: quote.id, corpusIndex: index, left: quote.matn, right: row.matn });
      }
    }
    console.log(`hadeethenc: scoring ${pendingPairs.length} pairs`);
    const trgm = await trigramScores(options.prisma, pendingPairs);

    const matchesByCorpus = new Map<number, Array<{ quote: QuoteRow; score: number }>>();
    const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
    for (const pair of pendingPairs) {
      const score = combinedScore(
        trgm.get(`${pair.quoteId}:${pair.corpusIndex}`) ?? 0,
        wordOverlap(pair.left, pair.right),
      );
      if (score < STRONG_MATCH_SCORE) continue;
      const quote = quoteById.get(pair.quoteId);
      if (!quote) continue;
      const list = matchesByCorpus.get(pair.corpusIndex) ?? [];
      list.push({ quote, score });
      matchesByCorpus.set(pair.corpusIndex, list);
    }

    let matchedHadith = 0;
    let unmatchedHadith = 0;
    let explanationsCreated = 0;
    let explanationsUpdated = 0;
    let explanationsUnchanged = 0;
    let gradesApplied = 0;
    let gradesSkipped = 0;
    let quotesCreated = 0;
    let quotesUnchanged = 0;
    const alreadyGraded = new Set<string>();
    const unlinked: Array<{ id: string; title: string; categories: string; grade: string }> = [];
    const gradeHistogram = new Map<string, number>();

    for (let index = 0; index < corpus.length; index += 1) {
      const row = corpus[index]!;
      gradeHistogram.set(row.ar.grade ?? '', (gradeHistogram.get(row.ar.grade ?? '') ?? 0) + 1);
      const hits = matchesByCorpus.get(index) ?? [];
      const uniqueQuotes = [...new Map(hits.map((hit) => [hit.quote.id, hit.quote])).values()];

      if (uniqueQuotes.length > 0) {
        matchedHadith += 1;
        for (const quote of uniqueQuotes) {
          const bundle = await attachBundle(options.prisma, sourceId, quote.id, row);
          explanationsCreated += bundle.created;
          explanationsUpdated += bundle.updated;
          explanationsUnchanged += bundle.unchanged;
          const gradeResult = await applyGrade(options.prisma, quote, row, alreadyGraded);
          if (gradeResult === 'graded') gradesApplied += 1;
          else if (gradeResult === 'skipped') gradesSkipped += 1;
        }
        continue;
      }

      unmatchedHadith += 1;
      const categories = (row.ar.categories ?? []).join('|') || row.rootTitle;
      unlinked.push({
        id: row.id,
        title: row.ar.title ?? '',
        categories: `${row.rootTitle}${categories ? ` / ${categories}` : ''}`,
        grade: row.ar.grade ?? '',
      });

      const externalId = row.id;
      const existingQuote = await options.prisma.quote.findUnique({
        where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId } },
        select: {
          id: true,
          textAr: true,
          grade: true,
          gradeSource: true,
          gradeAuthority: true,
          gradeReference: true,
          legacyGrade: true,
          legacyGradeAuthority: true,
          legacyGradeReference: true,
        },
      });
      const textAr = (row.ar.hadeeth ?? '').replace(/\s+/g, ' ').trim();
      const publishable = row.mapped.publishable;
      let quoteId: string;
      if (!existingQuote) {
        const created = await options.prisma.quote.create({
          data: {
            type: QuoteType.HADITH,
            origin: QuoteOrigin.API_CACHED,
            textAr,
            sourceId,
            textSource: TextSource.DIGITAL,
            grade: publishable ? row.mapped.grade : row.mapped.grade,
            gradeSource: publishable ? GradeSource.HADEETHENC : GradeSource.AUTHORITY_LEGACY,
            gradeAuthority: publishable ? HADEETHENC_AUTHORITY_AR : null,
            gradeReference: publishable ? row.ref : null,
            apiProvider: PROVIDER,
            externalId,
            rawPayload: {
              hadeethencId: row.id,
              title: row.ar.title,
              categories: row.ar.categories,
              rootTitle: row.rootTitle,
              attribution: row.ar.attribution,
              gradeRaw: row.ar.grade,
            },
          },
          select: { id: true },
        });
        quoteId = created.id;
        quotesCreated += 1;
      } else {
        quoteId = existingQuote.id;
        const nextGradeSource = publishable ? GradeSource.HADEETHENC : existingQuote.gradeSource;
        const nextAuthority = publishable ? HADEETHENC_AUTHORITY_AR : existingQuote.gradeAuthority;
        const nextReference = publishable ? row.ref : existingQuote.gradeReference;
        const same =
          existingQuote.textAr === textAr
          && existingQuote.grade === row.mapped.grade
          && existingQuote.gradeSource === nextGradeSource
          && existingQuote.gradeAuthority === nextAuthority
          && existingQuote.gradeReference === nextReference;
        if (!same && mayApplyGrade(existingQuote.gradeSource)) {
          await options.prisma.quote.update({
            where: { id: existingQuote.id },
            data: {
              textAr,
              grade: row.mapped.grade,
              gradeSource: nextGradeSource,
              gradeAuthority: nextAuthority,
              gradeReference: nextReference,
              rawPayload: {
                hadeethencId: row.id,
                title: row.ar.title,
                categories: row.ar.categories,
                rootTitle: row.rootTitle,
                attribution: row.ar.attribution,
                gradeRaw: row.ar.grade,
              },
            },
          });
        } else {
          quotesUnchanged += 1;
        }
      }

      const quoteForGrade: QuoteRow = {
        id: quoteId,
        textAr,
        grade: row.mapped.grade,
        gradeSource: publishable ? GradeSource.HADEETHENC : GradeSource.AUTHORITY_LEGACY,
        gradeAuthority: publishable ? HADEETHENC_AUTHORITY_AR : null,
        gradeReference: publishable ? row.ref : null,
        legacyGrade: null,
        legacyGradeAuthority: null,
        legacyGradeReference: null,
        matn: row.matn,
      };
      const bundle = await attachBundle(options.prisma, sourceId, quoteId, row);
      explanationsCreated += bundle.created;
      explanationsUpdated += bundle.updated;
      explanationsUnchanged += bundle.unchanged;
      if (existingQuote) {
        const gradeResult = await applyGrade(
          options.prisma,
          {
            ...quoteForGrade,
            grade: existingQuote.grade,
            gradeSource: existingQuote.gradeSource,
            gradeAuthority: existingQuote.gradeAuthority,
            gradeReference: existingQuote.gradeReference,
            legacyGrade: existingQuote.legacyGrade,
            legacyGradeAuthority: existingQuote.legacyGradeAuthority,
            legacyGradeReference: existingQuote.legacyGradeReference,
          },
          row,
          alreadyGraded,
        );
        if (gradeResult === 'graded') gradesApplied += 1;
        else if (gradeResult === 'skipped') gradesSkipped += 1;
      }
    }

    mkdirSync(dirname(UNLINKED_TSV), { recursive: true });
    const lines = [
      'id\ttitle\tcategories\tgrade',
      ...unlinked.map(
        (row) =>
          `${tsvEscape(row.id)}\t${tsvEscape(row.title)}\t${tsvEscape(row.categories)}\t${tsvEscape(row.grade)}`,
      ),
    ];
    writeFileSync(UNLINKED_TSV, `${lines.join('\n')}\n`, 'utf8');

    const summary = [
      `fetched=${corpus.length}`,
      `matched=${matchedHadith}`,
      `unmatched=${unmatchedHadith}`,
      `quotesCreated=${quotesCreated}`,
      `explanationsCreated=${explanationsCreated}`,
      `explanationsUpdated=${explanationsUpdated}`,
      `explanationsUnchanged=${explanationsUnchanged}`,
      `gradesApplied=${gradesApplied}`,
      `gradesSkipped=${gradesSkipped}`,
    ].join(' ');
    console.log(
      JSON.stringify(
        {
          fetched: corpus.length,
          matched: matchedHadith,
          unmatched: unmatchedHadith,
          quotesCreated,
          quotesUnchanged,
          explanationsCreated,
          explanationsUpdated,
          explanationsUnchanged,
          gradesApplied,
          gradesSkipped,
          gradesByValue: Object.fromEntries(gradeHistogram),
          unlinkedTsv: UNLINKED_TSV,
        },
        null,
        2,
      ),
    );
    return {
      recordsImported: explanationsCreated + quotesCreated + gradesApplied,
      summary,
    };
  });
}
