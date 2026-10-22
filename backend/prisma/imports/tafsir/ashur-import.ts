/**
 * Ibn Ashur, al-Tahrir wa al-Tanwir, one Explanation per headed passage.
 * A passage that names several ayat keeps that range. Ayat with no passage are gaps.
 */
import { ExplanationKind, QuoteOrigin, type Prisma } from '@prisma/client';
import type { ImportOptions } from '../lib/cli.js';
import { inTransactionBatches } from '../lib/batch.js';
import { loadCorpus, type CorpusSpec } from '../lib/corpus.js';
import { withRunLog } from '../lib/run-log.js';
import { approvedWork, ensureSource } from '../lib/source.js';
import { ashurGaps, parseAshur, type AshurPassage } from './ashur.js';

const ASHUR_CORPUS: CorpusSpec = {
  repo: '1400AH',
  path: 'data/1393MuhammadTahirIbnCashurTunisi/1393MuhammadTahirIbnCashurTunisi.TahrirWaTanwir/1393MuhammadTahirIbnCashurTunisi.TahrirWaTanwir.Shamela0009776-ara1',
  commit: '9ecd69d142e2f165f80a52a958aa2cda09048e03',
  sha256: '72a02504a798f31092daceb1883f0d4f11c8b0f1ca5fe23e6660b0261e7989a0',
};

const PROVIDER = 'openiti';

interface StoredPassage extends AshurPassage {
  externalId: string;
}

function withIds(passages: readonly AshurPassage[]): StoredPassage[] {
  const seen = new Map<string, number>();
  return passages.map((passage) => {
    const ordinal = seen.get(passage.ayahKey) ?? 0;
    seen.set(passage.ayahKey, ordinal + 1);
    return { ...passage, externalId: `ashur:${passage.ayahKey}:${ordinal}` };
  });
}

export async function runAshurImport(options: ImportOptions): Promise<void> {
  const work = approvedWork('book:ibn-ashur-tahrir');
  await ensureSource(options.prisma, work);
  const file = await loadCorpus(ASHUR_CORPUS);
  const parsed = parseAshur(file.text);
  const stored = withIds(options.limit === null ? parsed.passages : parsed.passages.slice(0, options.limit));
  const verseKeys = options.limit === null
    ? (await options.prisma.quote.findMany({
      where: { type: 'QURAN_VERSE', externalId: { not: null }, surahNumber: { not: null } },
      select: { externalId: true },
    })).map((row) => row.externalId).filter((key): key is string => key != null && /^\d+:\d+$/.test(key))
    : [];
  const gaps = ashurGaps(stored, verseKeys);
  if (options.limit === null && (stored.length < 3000 || gaps.length > 800)) {
    throw new Error(`Tahrir wa al-Tanwir parsed ${stored.length} passages and ${gaps.length} gaps; the headings were not read`);
  }

  const existing = await options.prisma.explanation.findMany({
    where: { apiProvider: PROVIDER, externalId: { startsWith: 'ashur:' } },
    select: { externalId: true, text: true, ayahKey: true },
  });
  const byExternal = new Map(existing.map((row) => [row.externalId, row]));
  let created = 0;
  let updated = 0;
  const writes: StoredPassage[] = [];
  for (const passage of stored) {
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

  const gapList = gaps.length > 0 && gaps.length <= 30 ? ` missing=${gaps.join(',')}` : '';
  const unparsedList = parsed.unparsed.length > 0 && parsed.unparsed.length <= 5
    ? ` unparsedText=${parsed.unparsed.map((heading) => heading.slice(0, 80)).join(' | ')}`
    : '';
  const summary = `created=${created} updated=${updated} unchanged=${stored.length - created - updated} passages=${stored.length} unparsed=${parsed.unparsed.length}${unparsedList} gaps=${gaps.length}${gapList}; corpus=${file.versionUri}@${file.spec.commit} sha256=${file.spec.sha256}`;
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
          languageCode: 'ar',
          text: passage.text,
          sourceId: work.id,
          reference: 'التحرير والتنوير',
          origin: QuoteOrigin.LOCAL,
          rawPayload: {
            surah: passage.surah,
            ayahStart: passage.ayahStart,
            ayahEnd: passage.ayahEnd,
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
