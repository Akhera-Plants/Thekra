/**
 * Idempotent cleanup: strips printed-page markers from textAr, matnAr, and
 * atharTextAr of all Quote rows that still contain them.
 *
 * Two passes are merged in one run:
 *
 *  A) First-time strip — rows whose current fields still contain markers:
 *     Apply stripPageMarkers, record the original in
 *     rawPayload.textBeforePageStrip (written only once).
 *
 *  B) Restore from over-strip — rows where rawPayload.textBeforePageStrip
 *     is already set (a previous cleanup run stored the original before the
 *     helper was fixed): re-derive the correct textAr from that stored
 *     original and rewrite if it differs from what is currently stored.
 *
 * A second run of the corrected helper always updates 0 rows.
 *
 * Usage:
 *   pnpm import:book strip-page-markers [--dry-run]
 */
import { Prisma } from '@prisma/client';
import { stripPageMarkers } from '../../../src/common/text/strip-page-markers.js';
import type { ImportOptions } from '../lib/cli.js';

/** Candidate marker pattern — mirrors the one inside stripPageMarkers. */
const HAS_PAGE_MARKER = /[\[(](?:ج[ـ]?\d+\s+)?ص:?\s*\d+[\])]/u;

function hasMarker(value: string | null | undefined): boolean {
  return value != null && HAS_PAGE_MARKER.test(value);
}

function rawObject(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

export async function runStripPageMarkersCleanup(options: ImportOptions): Promise<void> {
  const { prisma, dryRun } = options;

  // ── Pass A: rows whose current fields still contain markers ──────────────
  const withMarkers = await prisma.quote.findMany({
    where: {
      OR: [
        { textAr: { contains: 'ص:' } },
        { textAr: { contains: 'ص ' } },
        { matnAr: { contains: 'ص:' } },
        { matnAr: { contains: 'ص ' } },
        { atharTextAr: { contains: 'ص:' } },
        { atharTextAr: { contains: 'ص ' } },
      ],
    },
    select: { id: true, textAr: true, matnAr: true, atharTextAr: true, rawPayload: true },
  });

  // ── Pass B: rows with a stored original to re-derive from ────────────────
  const withStoredOriginal = await prisma.quote.findMany({
    where: {
      rawPayload: { path: ['textBeforePageStrip'], not: Prisma.DbNull },
    },
    select: { id: true, textAr: true, matnAr: true, atharTextAr: true, rawPayload: true },
  });

  // Merge: Pass A rows overwrite Pass B rows with the same id so we don't
  // double-update; the pass A row already carries the rawPayload we need.
  const byId = new Map<string, (typeof withMarkers)[number]>();
  for (const row of withStoredOriginal) byId.set(row.id, row);
  for (const row of withMarkers) byId.set(row.id, row);

  let updated = 0;
  let skipped = 0;

  for (const row of byId.values()) {
    const existing = rawObject(row.rawPayload);
    const storedOriginal =
      typeof existing.textBeforePageStrip === 'string' ? existing.textBeforePageStrip : null;

    // Compute the correct target for each field.
    // For textAr: if we have the stored original (from a previous run), re-derive
    // from it so the helper fix is applied to the true source text.
    // For matnAr / atharTextAr: always re-derive from the current value (the
    // stored original only captures textAr; those fields were not affected in
    // the over-strip situation).
    const targetTextAr = storedOriginal != null
      ? stripPageMarkers(storedOriginal)
      : stripPageMarkers(row.textAr);
    const targetMatnAr =
      row.matnAr != null ? stripPageMarkers(row.matnAr) : null;
    const targetAtharTextAr =
      row.atharTextAr != null ? stripPageMarkers(row.atharTextAr) : null;

    const changeTextAr = row.textAr !== targetTextAr;
    const changeMatnAr = row.matnAr !== targetMatnAr;
    const changeAtharTextAr = row.atharTextAr !== targetAtharTextAr;

    if (!changeTextAr && !changeMatnAr && !changeAtharTextAr) {
      skipped += 1;
      continue;
    }

    // Build updated rawPayload: write textBeforePageStrip only once.
    const rawPayloadUpdate: Record<string, unknown> = { ...existing };
    if (!('textBeforePageStrip' in rawPayloadUpdate)) {
      rawPayloadUpdate.textBeforePageStrip =
        hasMarker(row.textAr) ? row.textAr
        : hasMarker(row.matnAr) ? row.matnAr
        : row.atharTextAr;
    }

    if (dryRun) {
      if (updated < 5) {
        console.log(`  [dry-run] id=${row.id}`);
        if (changeTextAr)
          console.log(`    textAr:      ${row.textAr.slice(0, 100)}\n             → ${targetTextAr.slice(0, 100)}`);
        if (changeMatnAr)
          console.log(`    matnAr:      ${(row.matnAr ?? '').slice(0, 100)}\n             → ${(targetMatnAr ?? '').slice(0, 100)}`);
        if (changeAtharTextAr)
          console.log(`    atharTextAr: ${(row.atharTextAr ?? '').slice(0, 80)}\n             → ${(targetAtharTextAr ?? '').slice(0, 80)}`);
      }
      updated += 1;
      continue;
    }

    await prisma.quote.update({
      where: { id: row.id },
      data: {
        ...(changeTextAr && { textAr: targetTextAr }),
        ...(changeMatnAr && { matnAr: targetMatnAr }),
        ...(changeAtharTextAr && { atharTextAr: targetAtharTextAr }),
        rawPayload: rawPayloadUpdate as Prisma.InputJsonValue,
      },
    });
    updated += 1;
  }

  const mode = dryRun ? '[dry-run] would update' : 'updated';
  console.log(`strip-page-markers: ${mode} ${updated} rows, skipped ${skipped} (already clean)`);
  if (updated > 0 && !dryRun) {
    console.log(`  Original text preserved in rawPayload.textBeforePageStrip for each updated row.`);
  }
}
