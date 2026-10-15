/**
 * English abridged Ibn Kathir tafsir from Quran.com resource 169.
 * Used when the UI is English: Quran.com has no English Sa'di or Ibn Ashur.
 */
import { createHash } from 'node:crypto';
import { ExplanationKind, QuoteOrigin, type Prisma } from '@prisma/client';
import type { ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import { plainTafsir } from './plain.js';

const API = 'https://api.quran.com/api/v4';
const PROVIDER = 'quran.com';
const RESOURCE = 169;

interface TafsirRow {
  id: number;
  verse_key: string;
  text: string;
}

interface Page {
  tafsirs: TafsirRow[];
  pagination: { next_page: number | null };
}

export interface KathirPassage {
  verseKey: string;
  text: string;
  resourceRowId: number;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'Thekra/1.0 (+contact@thekra.app)' } });
  if (!response.ok) throw new Error(`Quran.com ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

export async function loadKathirEn(limit: number | null): Promise<KathirPassage[]> {
  const passages: KathirPassage[] = [];
  for (let surah = 1; surah <= 114; surah += 1) {
    let page = 1;
    while (true) {
      const body = await getJson<Page>(`${API}/tafsirs/${RESOURCE}/by_chapter/${surah}?per_page=50&page=${page}`);
      for (const row of body.tafsirs) {
        const text = plainTafsir(row.text);
        if (text) passages.push({ verseKey: row.verse_key, text, resourceRowId: row.id });
        if (limit !== null && passages.length >= limit) return passages;
      }
      if (body.pagination.next_page == null) break;
      page = body.pagination.next_page;
    }
  }
  return passages;
}

export async function runIbnKathirEnImport(options: ImportOptions): Promise<void> {
  const work = approvedWork('book:ibn-kathir-en');
  await ensureSource(options.prisma, work);
  const passages = await loadKathirEn(options.limit);
  const hash = createHash('sha256');
  for (const passage of passages) hash.update(passage.verseKey).update(passage.text);
  const sha256 = hash.digest('hex');

  const existing = await options.prisma.explanation.findMany({
    where: { apiProvider: PROVIDER, externalId: { startsWith: `${RESOURCE}:` } },
    select: { externalId: true, text: true, ayahKey: true },
  });
  const byExternal = new Map(existing.map((row) => [row.externalId, row]));
  let created = 0;
  let updated = 0;
  const writes: KathirPassage[] = [];
  for (const passage of passages) {
    const externalId = `${RESOURCE}:${passage.verseKey}`;
    const current = byExternal.get(externalId);
    if (!current) {
      created += 1;
      writes.push(passage);
      continue;
    }
    if (current.text !== passage.text || current.ayahKey !== passage.verseKey) {
      updated += 1;
      writes.push(passage);
    }
  }

  const summary = `created=${created} updated=${updated} unchanged=${passages.length - created - updated} passages=${passages.length}; corpus=${API}/tafsirs/${RESOURCE}@quran.com-api-v4 sha256=${sha256}`;
  if (options.dryRun) {
    console.log(summary);
    return;
  }
  await withRunLog(options.prisma, work.id, async () => {
    await inTransactionBatches(options.prisma, writes, async (tx, batch) => {
      for (const passage of batch) {
        const externalId = `${RESOURCE}:${passage.verseKey}`;
        const data = {
          kind: ExplanationKind.TAFSIR,
          ayahKey: passage.verseKey,
          languageCode: 'en',
          text: passage.text,
          sourceId: work.id,
          reference: 'Ibn Kathir (Abridged)',
          origin: QuoteOrigin.API_CACHED,
          rawPayload: { resourceId: RESOURCE, verseKey: passage.verseKey, rowId: passage.resourceRowId } as Prisma.InputJsonObject,
        };
        await tx.explanation.upsert({
          where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId } },
          create: { ...data, apiProvider: PROVIDER, externalId },
          update: data,
        });
      }
    });
    return { recordsImported: created, summary };
  });
  console.log(summary);
}
