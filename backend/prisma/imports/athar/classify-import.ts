/**
 * Classify Shu'ab / Zuhd / Minhaj (and later Ibn Abi al-Dunya) narrations as
 * MARFU vs ATHAR; persist isAthar + atharSpeakerKey; export unlisted speakers.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyNarration, matchAtharSpeaker } from '../../../src/common/text/athar-classify.js';
import type { ImportOptions } from '../lib/cli.js';
import { loadAtharSpeakers } from './speakers.js';

function tsvEscape(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

export async function runAtharClassify(options: ImportOptions): Promise<void> {
  const speakers = loadAtharSpeakers();
  const rows = await options.prisma.quote.findMany({
    where: {
      OR: [
        { apiProvider: { in: ['book:shuab-iman', 'book:ibn-mubarak-zuhd', 'book:ibn-qudama-minhaj'] } },
        { apiProvider: { startsWith: 'book:ibn-abi-dunya' } },
      ],
    },
    select: {
      id: true,
      textAr: true,
      matnAr: true,
      isAthar: true,
      atharSpeakerKey: true,
      atharSpeakerAr: true,
      referenceNumber: true,
      apiProvider: true,
    },
    orderBy: { id: 'asc' },
  });

  let marfu = 0;
  let athar = 0;
  let reject = 0;
  let listed = 0;
  let unlisted = 0;
  let updated = 0;
  const unlistedMap = new Map<string, { count: number; examples: string[] }>();

  for (const row of rows) {
    // Prefer full text so prophetic attribution in the isnad (`سمعنا رسول الله`)
    // is not lost when matnAr was split off the chain.
    const text = row.textAr || row.matnAr || '';
    const classified = classifyNarration(text);
    let isAthar = classified.kind === 'ATHAR';
    let atharSpeakerKey: string | null = null;
    let atharSpeakerAr: string | null = null;

    if (classified.kind === 'REJECT') {
      reject += 1;
      isAthar = false;
    } else if (isAthar) {
      athar += 1;
      const matched = matchAtharSpeaker(classified.speakerRaw, speakers);
      if (matched) {
        atharSpeakerKey = matched.key;
        atharSpeakerAr = matched.ar;
        listed += 1;
      } else {
        unlisted += 1;
        const key = classified.speakerRaw?.trim() || '(unknown)';
        const bucket = unlistedMap.get(key) ?? { count: 0, examples: [] };
        bucket.count += 1;
        if (bucket.examples.length < 2) {
          bucket.examples.push(`${row.apiProvider}#${row.referenceNumber ?? row.id}`);
        }
        unlistedMap.set(key, bucket);
      }
    } else {
      marfu += 1;
    }

    if (
      row.isAthar !== isAthar ||
      row.atharSpeakerKey !== atharSpeakerKey ||
      row.atharSpeakerAr !== atharSpeakerAr
    ) {
      if (!options.dryRun) {
        await options.prisma.quote.update({
          where: { id: row.id },
          data: { isAthar, atharSpeakerKey, atharSpeakerAr },
        });
      }
      updated += 1;
    }
  }

  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/taxonomy');
  mkdirSync(outDir, { recursive: true });
  const tsvPath = resolve(outDir, 'athar-unlisted-speakers.tsv');
  const lines = ['speaker\tcount\texample1\texample2'];
  for (const [speaker, info] of [...unlistedMap.entries()].sort((a, b) => b[1].count - a[1].count)) {
    lines.push(
      `${tsvEscape(speaker)}\t${info.count}\t${tsvEscape(info.examples[0] ?? '')}\t${tsvEscape(info.examples[1] ?? '')}`,
    );
  }
  if (!options.dryRun) writeFileSync(tsvPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(
    `athar classify: total=${rows.length} marfu=${marfu} athar=${athar} reject=${reject}` +
      ` listed=${listed} unlisted=${unlisted} updated=${updated}` +
      ` tsv=${tsvPath}`,
  );
}

export async function runAtharClassifyImport(options: ImportOptions): Promise<void> {
  await runAtharClassify(options);
}
