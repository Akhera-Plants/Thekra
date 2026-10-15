/**
 * English Tafsir as-Sa'di from tafsirs.org shard API.
 * Print: Nasiruddin al-Khattab / Huda Khattab, IIPH, 2018 (OCR on tafsirs.org).
 * The owner must check IIPH / tafsirs.org redistribution terms before this is settled.
 * Quran.com and spa5k have no English Sa'di.
 */
import { createHash } from 'node:crypto';
import { ExplanationKind, QuoteOrigin, type Prisma } from '@prisma/client';
import type { ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';

const API = 'https://tafsirs.org/api';
const PROVIDER = 'tafsirs.org';
const WORK = 'sadi';

interface Anchor {
  kind: string;
  surah: number;
  start: number;
  end: number;
}

interface PassageJson {
  id: string;
  work: string;
  anchor: Anchor;
  order: number;
  body: unknown[];
}

export interface SadiEnPassage {
  ayahKey: string;
  text: string;
  externalId: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
}

function ayahKey(anchor: Anchor): string {
  return anchor.start === anchor.end
    ? `${anchor.surah}:${anchor.start}`
    : `${anchor.surah}:${anchor.start}-${anchor.end}`;
}

/** Flatten tafsirs.org body nodes into readable plain text. */
export function plainSadiEn(body: unknown[]): string {
  const blocks: string[] = [];

  function runsText(runs: unknown): string {
    if (!Array.isArray(runs)) return '';
    const parts: string[] = [];
    for (const run of runs) {
      if (!run || typeof run !== 'object') continue;
      const row = run as Record<string, unknown>;
      if (row.kind === 'pageBreak') {
        parts.push(' ');
        continue;
      }
      if (row.kind === 'footnoteRef') continue;
      if ((row.kind === 'text' || row.kind === 'arabic') && typeof row.text === 'string') {
        parts.push(row.text);
      }
    }
    return parts.join('').replace(/[ \t]{2,}/g, ' ').trim();
  }

  for (const node of body) {
    if (!node || typeof node !== 'object') continue;
    const row = node as Record<string, unknown>;
    if (row.kind === 'heading' || row.kind === 'paragraph' || row.kind === 'quote') {
      const text = runsText(row.runs);
      if (text) blocks.push(text);
      continue;
    }
    if (Array.isArray(row.runs)) {
      const text = runsText(row.runs);
      if (text) blocks.push(text);
    }
  }
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function getJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Thekra/1.0 (+contact@thekra.app)', Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`tafsirs.org ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

export async function loadSadiEn(limit: number | null): Promise<SadiEnPassage[]> {
  const passages: SadiEnPassage[] = [];
  for (let surah = 1; surah <= 114; surah += 1) {
    for (let shard = 0; ; shard += 1) {
      const rows = await getJson<PassageJson[]>(`${API}/t/${WORK}/${surah}/${shard}.json`);
      if (rows == null) break;
      for (const row of rows) {
        if (row.anchor?.kind !== 'ayah') continue;
        const text = plainSadiEn(row.body ?? []);
        if (!text) continue;
        passages.push({
          ayahKey: ayahKey(row.anchor),
          text,
          externalId: row.id,
          surah: row.anchor.surah,
          ayahStart: row.anchor.start,
          ayahEnd: row.anchor.end,
        });
        if (limit !== null && passages.length >= limit) return passages;
      }
    }
  }
  return passages;
}

export async function runSadiEnImport(options: ImportOptions): Promise<void> {
  const work = approvedWork('book:sadi-tafsir');
  await ensureSource(options.prisma, work);
  const passages = await loadSadiEn(options.limit);
  if (options.limit === null && passages.length < 1500) {
    throw new Error(`English Sa'di loaded ${passages.length} passages; expected ~1969 from tafsirs.org`);
  }

  const hash = createHash('sha256');
  for (const passage of passages) hash.update(passage.externalId).update(passage.text);
  const sha256 = hash.digest('hex');

  const existing = await options.prisma.explanation.findMany({
    where: { apiProvider: PROVIDER, externalId: { startsWith: 'tafsir:sadi:' } },
    select: { externalId: true, text: true, ayahKey: true },
  });
  const byExternal = new Map(existing.map((row) => [row.externalId, row]));
  let created = 0;
  let updated = 0;
  const writes: SadiEnPassage[] = [];
  for (const passage of passages) {
    const current = byExternal.get(passage.externalId);
    if (!current) {
      created += 1;
      writes.push(passage);
      continue;
    }
    if (current.text !== passage.text || current.ayahKey !== passage.ayahKey) {
      updated += 1;
      writes.push(passage);
    }
  }

  const summary = `created=${created} updated=${updated} unchanged=${passages.length - created - updated} passages=${passages.length}; corpus=${API}/t/${WORK}/*@tafsirs.org-iiph-2018 sha256=${sha256}`;
  if (options.dryRun) {
    console.log(summary);
    return;
  }
  await withRunLog(options.prisma, work.id, async () => {
    await inTransactionBatches(options.prisma, writes, async (tx, batch) => {
      for (const passage of batch) {
        const data = {
          kind: ExplanationKind.TAFSIR,
          ayahKey: passage.ayahKey,
          languageCode: 'en',
          text: passage.text,
          sourceId: work.id,
          reference: "Tafsir as-Sa'di (IIPH)",
          origin: QuoteOrigin.API_CACHED,
          rawPayload: {
            work: WORK,
            surah: passage.surah,
            ayahStart: passage.ayahStart,
            ayahEnd: passage.ayahEnd,
            edition: 'IIPH 2018 Nasiruddin al-Khattab',
          } as Prisma.InputJsonObject,
        };
        await tx.explanation.upsert({
          where: { apiProvider_externalId: { apiProvider: PROVIDER, externalId: passage.externalId } },
          create: { ...data, apiProvider: PROVIDER, externalId: passage.externalId },
          update: data,
        });
      }
    }, undefined, 40);
    return { recordsImported: created, summary };
  });
  console.log(summary);
}
