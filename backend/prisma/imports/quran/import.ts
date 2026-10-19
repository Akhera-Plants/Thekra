/**
 * All 6,236 Uthmani verses from the Quran.com API, on the one public Quran source.
 * A verse already stored for that surah and ayah is updated in place.
 */
import { createHash } from 'node:crypto';
import { QuoteOrigin, QuoteType, TextSource, type PrismaClient } from '@prisma/client';
import type { ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { withRunLog } from '../lib/run-log.js';

const QURAN_SOURCE_ID = '10000000-0000-4000-8000-000000000001';
const API = 'https://api.quran.com/api/v4';
const PROVIDER = 'quran.com';

interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
}

interface Verse {
  verse_key: string;
  verse_number: number;
  chapter_id?: number;
  text_uthmani: string;
}

/** The by_chapter response omits chapter_id; the verse key is `surah:ayah`. */
export function chapterOf(verse: { verse_key: string; chapter_id?: number }): number {
  const fromKey = Number(verse.verse_key.split(':')[0]);
  return verse.chapter_id && verse.chapter_id > 0 ? verse.chapter_id : fromKey;
}

interface Page {
  verses: Verse[];
  pagination: { next_page: number | null };
}

export function nextVersePage(current: { surah: number; nextPage: number | null; surahTo: number }): { surah: number; page: number } | null {
  if (current.nextPage != null) return { surah: current.surah, page: current.nextPage };
  if (current.surah < current.surahTo) return { surah: current.surah + 1, page: 1 };
  return null;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'Thekra/1.0 (+contact@thekra.app)' } });
  if (!response.ok) throw new Error(`Quran.com ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

/** Arabic + English chapter names keyed by surah number (1–114). */
async function loadChapters(): Promise<Map<number, Chapter>> {
  const [ar, en] = await Promise.all([
    getJson<{ chapters: Chapter[] }>(`${API}/chapters?language=ar`),
    getJson<{ chapters: Chapter[] }>(`${API}/chapters?language=en`),
  ]);
  const byId = new Map<number, Chapter>();
  for (const chapter of ar.chapters) {
    byId.set(chapter.id, {
      id: chapter.id,
      name_arabic: chapter.name_arabic,
      name_simple: chapter.name_simple,
    });
  }
  for (const chapter of en.chapters) {
    const current = byId.get(chapter.id);
    if (!current) continue;
    // Prefer the English endpoint's simple name when present.
    byId.set(chapter.id, {
      ...current,
      name_simple: chapter.name_simple || current.name_simple,
    });
  }
  return byId;
}

async function loadVerses(limit: number | null): Promise<Verse[]> {
  const verses: Verse[] = [];
  for (let surah = 1; surah <= 114; surah += 1) {
    let page = 1;
    while (true) {
      const body = await getJson<Page>(
        `${API}/verses/by_chapter/${surah}?language=ar&fields=text_uthmani&per_page=50&page=${page}`,
      );
      verses.push(...body.verses);
      if (limit !== null && verses.length >= limit) return verses.slice(0, limit);
      const next = nextVersePage({ surah, nextPage: body.pagination.next_page, surahTo: 114 });
      if (!next || next.surah !== surah) break;
      page = next.page;
    }
  }
  return verses;
}

export async function runQuranImport(options: ImportOptions): Promise<void> {
  const chapters = await loadChapters();
  const verses = await loadVerses(options.limit);
  const hash = createHash('sha256');
  for (const verse of verses) hash.update(verse.verse_key).update(verse.text_uthmani);
  const sha256 = hash.digest('hex');
  if (options.limit === null && verses.length !== 6236) {
    throw new Error(`Quran.com returned ${verses.length} verses, expected 6236`);
  }

  const existing = await options.prisma.quote.findMany({
    where: { type: QuoteType.QURAN_VERSE, sourceId: QURAN_SOURCE_ID },
    select: {
      id: true,
      surahNumber: true,
      ayahNumber: true,
      surahName: true,
      surahNameAr: true,
      textAr: true,
      apiProvider: true,
      externalId: true,
    },
  });
  const byExternal = new Map(existing.filter((row) => row.externalId).map((row) => [row.externalId, row]));
  const byAyah = new Map(
    existing
      .filter((row) => row.surahNumber != null && row.ayahNumber != null)
      .map((row) => [`${row.surahNumber}:${row.ayahNumber}`, row]),
  );
  let created = 0;
  let updated = 0;
  const writes: Array<{ id: string | null; dropId: string | null; verse: Verse }> = [];
  for (const verse of verses) {
    const chapterId = chapterOf(verse);
    const chapter = chapters.get(chapterId);
    const expectedName = chapter?.name_simple ?? null;
    const expectedNameAr = chapter?.name_arabic ?? null;
    const api = byExternal.get(verse.verse_key);
    const ayah = byAyah.get(`${chapterId}:${verse.verse_number}`);
    const row = ayah ?? api ?? null;
    const dropId = ayah && api && ayah.id !== api.id ? api.id : null;
    if (!row) {
      created += 1;
      writes.push({ id: null, dropId: null, verse });
      continue;
    }
    const same = row.surahNumber === chapterId
      && row.ayahNumber === verse.verse_number
      && row.textAr === verse.text_uthmani
      && row.externalId === verse.verse_key
      && row.apiProvider === PROVIDER
      && row.surahName === expectedName
      && row.surahNameAr === expectedNameAr
      && dropId === null;
    if (!same) {
      updated += 1;
      writes.push({ id: row.id, dropId, verse });
    }
  }

  const writeRows = async (): Promise<void> => {
    if (writes.length === 0) return;
    await inTransactionBatches(options.prisma, writes, async (tx, batch) => {
      for (const row of batch) {
        const chapterId = chapterOf(row.verse);
        const chapter = chapters.get(chapterId);
        const data = {
          textAr: row.verse.text_uthmani,
          surahNumber: chapterId,
          surahName: chapter?.name_simple ?? null,
          surahNameAr: chapter?.name_arabic ?? null,
          ayahNumber: row.verse.verse_number,
          textSource: TextSource.DIGITAL,
          apiProvider: PROVIDER,
          externalId: row.verse.verse_key,
        };
        if (row.dropId) await tx.quote.delete({ where: { id: row.dropId } });
        if (row.id) {
          await tx.quote.update({ where: { id: row.id }, data });
          continue;
        }
        await tx.quote.create({
          data: {
            ...data,
            type: QuoteType.QURAN_VERSE,
            origin: QuoteOrigin.API_CACHED,
            sourceId: QURAN_SOURCE_ID,
          },
        });
      }
    });
  };

  const summary = `created=${created} updated=${updated} unchanged=${verses.length - created - updated} verses=${verses.length}; corpus=${API}@quran.com-api-v4 sha256=${sha256}`;
  if (options.dryRun) {
    console.log(summary);
    return;
  }
  await withRunLog(options.prisma, QURAN_SOURCE_ID, async () => {
    await writeRows();
    return { recordsImported: created, summary };
  });
  console.log(summary);
}

export async function countQuranVerses(prisma: PrismaClient): Promise<number> {
  return prisma.quote.count({ where: { type: QuoteType.QURAN_VERSE, sourceId: QURAN_SOURCE_ID, apiProvider: PROVIDER } });
}
