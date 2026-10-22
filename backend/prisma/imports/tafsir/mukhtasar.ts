/**
 * Al-Mukhtasar fi Tafsir al-Qur'an — Tafsir Center for Quranic Studies,
 * via QuranEnc (`english_mokhtasar` / `arabic_mokhtasar`).
 * Free access stated by QuranEnc; the owner confirms redistribution before launch.
 * Cached under backend/.corpus/quranenc/ (git-ignored).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExplanationKind, QuoteOrigin, type Prisma } from '@prisma/client';
import type { ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';

const API = 'https://quranenc.com/api/v1';
const PROVIDER = 'quranenc.com';
const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.corpus/quranenc');

/**
 * Pinned SHA-256 of the cached full JSON (all 114 surahs).
 * Empty string = accept and print the hash on first run; then pin it here.
 */
const PINNED_SHA256: Record<string, string> = {
  english_mokhtasar: '474710798524f4701a888d20b202f755ad959e22cac6e303a12f96c9c6f22c7c',
  arabic_mokhtasar: 'bc93d6a0e358005aa6f0894d1bae35c796913d742e45601764cc7115e1d2fbab',
};

interface AyaRow {
  id: string;
  sura: string;
  aya: string;
  translation: string;
}

interface SuraPayload {
  result: AyaRow[];
}

export interface MukhtasarPassage {
  verseKey: string;
  text: string;
  externalId: string;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Thekra/1.0 (+contact@thekra.app)', Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`QuranEnc ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

function corpusPath(key: string): string {
  return join(CORPUS_DIR, `${key}.json`);
}

async function loadEdition(key: string): Promise<{ passages: MukhtasarPassage[]; sha256: string }> {
  mkdirSync(CORPUS_DIR, { recursive: true });
  const path = corpusPath(key);
  let raw: string;
  if (existsSync(path)) {
    raw = readFileSync(path, 'utf8');
  } else {
    const bySurah: Record<string, AyaRow[]> = {};
    for (let surah = 1; surah <= 114; surah += 1) {
      const body = await getJson<SuraPayload>(`${API}/translation/sura/${key}/${surah}`);
      bySurah[String(surah)] = body.result ?? [];
    }
    raw = JSON.stringify(bySurah);
    writeFileSync(path, raw);
  }
  const sha256 = createHash('sha256').update(raw).digest('hex');
  const pinned = PINNED_SHA256[key];
  if (pinned && pinned !== sha256) {
    throw new Error(`QuranEnc corpus checksum mismatch for ${key}: expected ${pinned}, got ${sha256}`);
  }
  const bySurah = JSON.parse(raw) as Record<string, AyaRow[]>;
  const passages: MukhtasarPassage[] = [];
  for (let surah = 1; surah <= 114; surah += 1) {
    for (const row of bySurah[String(surah)] ?? []) {
      const text = (row.translation ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const verseKey = `${Number(row.sura)}:${Number(row.aya)}`;
      passages.push({
        verseKey,
        text,
        externalId: `${key}:${verseKey}`,
      });
    }
  }
  return { passages, sha256 };
}

async function importLanguage(
  options: ImportOptions,
  key: 'english_mokhtasar' | 'arabic_mokhtasar',
): Promise<{ created: number; updated: number; unchanged: number; passages: number; sha256: string }> {
  const work = approvedWork('book:mukhtasar-tafsir');
  await ensureSource(options.prisma, work);
  const languageCode = key === 'english_mokhtasar' ? 'en' : 'ar';
  const { passages: loaded, sha256 } = await loadEdition(key);
  const passages = options.limit === null ? loaded : loaded.slice(0, options.limit);
  if (options.limit === null && passages.length < 6000) {
    throw new Error(`Mukhtasar ${key} loaded ${passages.length} ayat; expected ~6236`);
  }

  const existing = await options.prisma.explanation.findMany({
    where: { apiProvider: PROVIDER, externalId: { startsWith: `${key}:` } },
    select: { externalId: true, text: true, ayahKey: true },
  });
  const byExternal = new Map(existing.map((row) => [row.externalId, row]));
  let created = 0;
  let updated = 0;
  const writes: MukhtasarPassage[] = [];
  for (const passage of passages) {
    const current = byExternal.get(passage.externalId);
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
  const unchanged = passages.length - created - updated;
  const summary = `key=${key} created=${created} updated=${updated} unchanged=${unchanged} passages=${passages.length} sha256=${sha256}`;
  if (options.dryRun) {
    console.log(summary);
    return { created, updated, unchanged, passages: passages.length, sha256 };
  }
  await withRunLog(options.prisma, work.id, async () => {
    await inTransactionBatches(options.prisma, writes, async (tx, batch) => {
      for (const passage of batch) {
        const data = {
          kind: ExplanationKind.TAFSIR,
          ayahKey: passage.verseKey,
          languageCode,
          text: passage.text,
          sourceId: work.id,
          reference: languageCode === 'en'
            ? 'Al-Mukhtasar — Tafsir Center (QuranEnc.com)'
            : 'المختصر في تفسير القرآن الكريم — مركز تفسير (QuranEnc.com)',
          origin: QuoteOrigin.API_CACHED,
          rawPayload: {
            key,
            verseKey: passage.verseKey,
            attribution: 'QuranEnc.com',
          } as Prisma.InputJsonObject,
        };
        await tx.explanation.upsert({
          where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId: passage.externalId } },
          create: { ...data, apiProvider: PROVIDER, externalId: passage.externalId },
          update: data,
        });
      }
    }, undefined, 80);
    return { recordsImported: created, summary };
  });
  console.log(summary);
  return { created, updated, unchanged, passages: passages.length, sha256 };
}

/** Delete the unlicensed IIPH English Sa'di rows from tafsirs.org. */
export async function deleteSadiEnRows(options: ImportOptions): Promise<number> {
  if (options.dryRun) {
    return options.prisma.explanation.count({ where: { apiProvider: 'tafsirs.org' } });
  }
  const result = await options.prisma.explanation.deleteMany({ where: { apiProvider: 'tafsirs.org' } });
  return result.count;
}

export async function runMukhtasarImport(options: ImportOptions): Promise<void> {
  const deleted = await deleteSadiEnRows(options);
  const en = await importLanguage(options, 'english_mokhtasar');
  const ar = await importLanguage(options, 'arabic_mokhtasar');
  console.log(JSON.stringify({
    deletedSadiEn: deleted,
    english: en,
    arabic: ar,
    dryRun: options.dryRun,
    note: 'QuranEnc states free access; owner confirms redistribution before launch',
  }));
}
