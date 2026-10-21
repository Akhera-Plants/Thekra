/**
 * Classify Shu'ab / Zuhd / Minhaj (and later Ibn Abi al-Dunya) narrations as
 * MARFU vs ATHAR; persist isAthar + atharSpeakerKey; export unlisted speakers.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atharContentCue,
  classifyNarration,
  extractAtharStory,
  matchAtharSpeaker,
  type AtharAttributionKind,
  type AtharStoryRejectReason,
} from '../../../src/common/text/athar-classify.js';
import type { ImportOptions } from '../lib/cli.js';
import { loadAtharSpeakers } from './speakers.js';
import { strongMatnHits } from './takhrij.js';
import { REVIEW_HEADER, bookLabel, readReviewDecisions } from './review.js';

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
      atharTextAr: true,
      atharAttributionKind: true,
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
  let storyKept = 0;
  const storyReject: Record<AtharStoryRejectReason, number> = {
    short: 0,
    'frame-only': 0,
    ocr: 0,
    'mid-dialogue': 0,
    content: 0,
    gap: 0,
    gesture: 0,
  };
  const unlistedMap = new Map<string, { count: number; examples: string[] }>();
  const contentExcluded: string[] = [];
  const keptPending: Array<{
    row: (typeof rows)[number];
    atharTextAr: string;
    atharAttributionKind: AtharAttributionKind;
    atharSpeakerKey: string | null;
    atharSpeakerAr: string | null;
    speakerRaw: string;
  }> = [];

  for (const row of rows) {
    // Prefer full text so prophetic attribution in the isnad (`سمعنا رسول الله`)
    // is not lost when matnAr was split off the chain.
    const text = row.textAr || row.matnAr || '';
    const classified = classifyNarration(text);
    let isAthar = classified.kind === 'ATHAR';
    let atharSpeakerKey: string | null = null;
    let atharSpeakerAr: string | null = null;
    let atharTextAr: string | null = null;
    let atharAttributionKind: AtharAttributionKind | null = null;

    if (classified.kind === 'REJECT') {
      reject += 1;
      isAthar = false;
    } else if (isAthar) {
      const story = extractAtharStory(text);
      if (!story.kept) {
        storyReject[story.reason] += 1;
        isAthar = false;
        if (story.reason === 'content') {
          const excerpt = text.replace(/\s+/g, ' ').trim();
          contentExcluded.push(
            [
              tsvEscape(atharContentCue(text) ?? ''),
              tsvEscape(row.apiProvider ?? ''),
              String(row.referenceNumber ?? ''),
              tsvEscape(classified.speakerRaw ?? ''),
              tsvEscape(excerpt),
            ].join('\t'),
          );
        }
      } else {
        const matched = matchAtharSpeaker(story.speakerRaw, speakers);
        keptPending.push({
          row,
          atharTextAr: story.text,
          atharAttributionKind: story.attribution,
          atharSpeakerKey: matched?.key ?? null,
          atharSpeakerAr: matched?.ar ?? null,
          speakerRaw: story.speakerRaw,
        });
        continue;
      }
    } else {
      marfu += 1;
    }

    if (
      row.isAthar !== isAthar ||
      row.atharSpeakerKey !== atharSpeakerKey ||
      row.atharSpeakerAr !== atharSpeakerAr ||
      row.atharTextAr !== atharTextAr ||
      row.atharAttributionKind !== atharAttributionKind
    ) {
      if (!options.dryRun) {
        await options.prisma.quote.update({
          where: { id: row.id },
          data: { isAthar, atharSpeakerKey, atharSpeakerAr, atharTextAr, atharAttributionKind },
        });
      }
      updated += 1;
    }
  }

  const hits = await strongMatnHits(
    options.prisma,
    keptPending.map((pending) => ({ id: pending.row.id, text: pending.atharTextAr })),
  );
  let takhrijMarfu = 0;
  const reviewLines: string[] = [REVIEW_HEADER];
  const priorReview = readReviewDecisions(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/taxonomy/athar-review.tsv'),
  );

  for (const pending of keptPending) {
    const hit = hits.get(pending.row.id);
    const row = pending.row;
    let isAthar = true;
    let atharSpeakerKey = pending.atharSpeakerKey;
    let atharSpeakerAr = pending.atharSpeakerAr;
    let atharTextAr: string | null = pending.atharTextAr;
    let atharAttributionKind: AtharAttributionKind | null = pending.atharAttributionKind;

    if (hit) {
      takhrijMarfu += 1;
      marfu += 1;
      isAthar = false;
      atharSpeakerKey = null;
      atharSpeakerAr = null;
      atharTextAr = null;
      atharAttributionKind = null;
      if (pending.atharTextAr.includes('من صام رمضان')) {
        console.log(`athar takhrij case: ${row.apiProvider}#${row.referenceNumber} → ${hit.label} (${hit.score})`);
      }
    } else {
      athar += 1;
      storyKept += 1;
      if (atharSpeakerKey) {
        listed += 1;
        const prior = priorReview.get(row.id);
        reviewLines.push(
          [
            row.id,
            atharSpeakerKey,
            atharSpeakerAr ?? '',
            atharAttributionKind ?? '',
            bookLabel(row.apiProvider),
            String(row.referenceNumber ?? ''),
            atharTextAr ?? '',
            prior?.decision ?? '',
            prior?.correctedText ?? '',
            prior?.correctedAttribution ?? '',
          ].map(tsvEscape).join('\t'),
        );
      } else {
        unlisted += 1;
        const key = pending.speakerRaw.trim() || '(unknown)';
        const bucket = unlistedMap.get(key) ?? { count: 0, examples: [] };
        bucket.count += 1;
        if (bucket.examples.length < 2) {
          bucket.examples.push(`${row.apiProvider}#${row.referenceNumber ?? row.id}`);
        }
        unlistedMap.set(key, bucket);
      }
    }

    if (
      row.isAthar !== isAthar ||
      row.atharSpeakerKey !== atharSpeakerKey ||
      row.atharSpeakerAr !== atharSpeakerAr ||
      row.atharTextAr !== atharTextAr ||
      row.atharAttributionKind !== atharAttributionKind
    ) {
      if (!options.dryRun) {
        await options.prisma.quote.update({
          where: { id: row.id },
          data: { isAthar, atharSpeakerKey, atharSpeakerAr, atharTextAr, atharAttributionKind },
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
  const contentPath = resolve(outDir, 'athar-content-excluded.tsv');
  const reviewPath = resolve(outDir, 'athar-review.tsv');
  contentExcluded.sort();
  if (!options.dryRun) {
    writeFileSync(tsvPath, `${lines.join('\n')}\n`, 'utf8');
    writeFileSync(
      contentPath,
      `cue\tprovider\tnumber\tspeaker\ttext\n${contentExcluded.join('\n')}${contentExcluded.length ? '\n' : ''}`,
      'utf8',
    );
    writeFileSync(reviewPath, `${reviewLines.join('\n')}\n`, 'utf8');
  }

  console.log(
    `athar classify: total=${rows.length} marfu=${marfu} athar=${athar} reject=${reject}` +
      ` listed=${listed} unlisted=${unlisted} updated=${updated}` +
      ` storyKept=${storyKept} takhrijMarfu=${takhrijMarfu}` +
      ` storyReject short=${storyReject.short} frame-only=${storyReject['frame-only']}` +
      ` ocr=${storyReject.ocr} mid-dialogue=${storyReject['mid-dialogue']}` +
      ` content=${storyReject.content} gap=${storyReject.gap} gesture=${storyReject.gesture}` +
      ` tsv=${tsvPath}` +
      ` contentTsv=${contentPath}` +
      ` reviewTsv=${reviewPath} reviewRows=${reviewLines.length - 1}`,
  );
}

export async function runAtharClassifyImport(options: ImportOptions): Promise<void> {
  await runAtharClassify(options);
}
