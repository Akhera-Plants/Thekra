/**
 * Al-Sa'di's tafsir for every ayah, from Quran.com resource 91.
 * The owner must check Quran.com's terms before this text is treated as settled.
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
const RESOURCE = 91;

interface TafsirRow {
  id: number;
  verse_key: string;
  text: string;
}

interface Page {
  tafsirs: TafsirRow[];
  pagination: { next_page: number | null };
}

export interface SadiPassage {
  verseKey: string;
  text: string;
  resourceRowId: number;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'Thekra/1.0 (+contact@thekra.app)' } });
  if (!response.ok) throw new Error(`Quran.com ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

export async function loadSadi(limit: number | null): Promise<SadiPassage[]> {
  const passages: SadiPassage[] = [];
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

/** Chapter pages omit some ayat. One request per missing key fills what the API has. */
export async function fillSadiGaps(keys: readonly string[]): Promise<SadiPassage[]> {
  const filled: SadiPassage[] = [];
  for (const key of keys) {
    let body: { tafsir?: { id?: number; text?: string } };
    try {
      body = await getJson(`${API}/tafsirs/${RESOURCE}/by_ayah/${key}`);
    } catch {
      continue;
    }
    const text = plainTafsir(body.tafsir?.text ?? '');
    if (text) filled.push({ verseKey: key, text, resourceRowId: body.tafsir?.id ?? 0 });
  }
  return filled;
}

export async function runSadiImport(options: ImportOptions): Promise<void> {
  const work = approvedWork('book:sadi-tafsir');
  await ensureSource(options.prisma, work);
  const passages = await loadSadi(options.limit);
  if (options.limit === null) {
    const have = new Set(passages.map((passage) => passage.verseKey));
    const keys = (await options.prisma.quote.findMany({
      where: { type: 'QURAN_VERSE', apiProvider: PROVIDER, externalId: { not: null } },
      select: { externalId: true },
    })).map((row) => row.externalId).filter((key): key is string => key != null && !have.has(key));
    passages.push(...await fillSadiGaps(keys));
  }
  const hash = createHash('sha256');
  for (const passage of passages) hash.update(passage.verseKey).update(passage.text);
  const sha256 = hash.digest('hex');
  const verseKeys = options.limit === null
    ? (await options.prisma.quote.findMany({
      where: { type: 'QURAN_VERSE', apiProvider: PROVIDER, externalId: { not: null } },
      select: { externalId: true },
    })).map((row) => row.externalId).filter((key): key is string => key != null)
    : [];
  const covered = new Set(passages.map((passage) => passage.verseKey));
  const gaps = verseKeys.filter((key) => !covered.has(key));
  if (options.limit === null && verseKeys.length !== 6236) {
    throw new Error(`Quran verse keys in the database are ${verseKeys.length}, expected 6236`);
  }
  if (gaps.length > 200) {
    throw new Error(`al-Sa'di is missing ${gaps.length} ayat; that is more than an editorial gap`);
  }

  const existing = await options.prisma.explanation.findMany({
    where: { apiProvider: PROVIDER, externalId: { startsWith: `${RESOURCE}:` } },
    select: { externalId: true, text: true, ayahKey: true },
  });
  const byExternal = new Map(existing.map((row) => [row.externalId, row]));
  let created = 0;
  let updated = 0;
  const writes: SadiPassage[] = [];
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

  const gapList = gaps.length > 0 && gaps.length <= 80 ? ` missing=${gaps.join(',')}` : '';
  const summary = `created=${created} updated=${updated} unchanged=${passages.length - created - updated} passages=${passages.length} gaps=${gaps.length}${gapList}; corpus=${API}/tafsirs/${RESOURCE}@quran.com-api-v4 sha256=${sha256}`;
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
          languageCode: 'ar',
          text: passage.text,
          sourceId: work.id,
          reference: 'تفسير السعدي',
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
