/**
 * One SyncLog row per import run against the work's Source (vision v2 §5.5).
 * The per-run counters and the pinned corpus travel in `errorMessage` as a
 * one-line summary (content-pipeline §3.4), because SyncLog has no stats column.
 */
import { SyncStatus, type PrismaClient } from '@prisma/client';
import type { CorpusFile } from './corpus.js';

async function startRun(prisma: PrismaClient, sourceId: string): Promise<string> {
  const run = await prisma.syncLog.create({
    data: { sourceId, status: SyncStatus.RUNNING, recordsImported: 0 },
  });
  return run.id;
}

export async function recordProgress(prisma: PrismaClient, runId: string, recordsImported: number): Promise<void> {
  await prisma.syncLog.update({ where: { id: runId }, data: { recordsImported } });
}

async function finishRun(
  prisma: PrismaClient,
  runId: string,
  sourceId: string,
  outcome: { status: 'SUCCESS' | 'FAILED'; recordsImported: number; summary: string },
): Promise<void> {
  const finishedAt = new Date();
  await prisma.syncLog.update({
    where: { id: runId },
    data: {
      status: outcome.status === 'SUCCESS' ? SyncStatus.SUCCESS : SyncStatus.FAILED,
      finishedAt,
      recordsImported: outcome.recordsImported,
      errorMessage: outcome.summary,
    },
  });
  if (outcome.status === 'SUCCESS') {
    await prisma.source.update({ where: { id: sourceId }, data: { lastSyncedAt: finishedAt } });
  }
}

/** `created=… updated=…; corpus=<versionUri>@<commit> sha256=<hex>` */
export function formatSummary(counts: Readonly<Record<string, number>>, corpus: readonly CorpusFile[]): string {
  const countPart = Object.entries(counts)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  const corpusPart = corpus
    .map((file) => `corpus=${file.versionUri}@${file.spec.commit} sha256=${file.spec.sha256}`)
    .join('; ');
  return `${countPart}; ${corpusPart}`;
}

/** Runs `work` inside a SyncLog lifecycle; marks the run FAILED and rethrows on error. */
export async function withRunLog<T extends { recordsImported: number; summary: string }>(
  prisma: PrismaClient,
  sourceId: string,
  work: (runId: string) => Promise<T>,
): Promise<T> {
  const runId = await startRun(prisma, sourceId);
  try {
    const result = await work(runId);
    await finishRun(prisma, runId, sourceId, { status: 'SUCCESS', ...result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(prisma, runId, sourceId, {
      status: 'FAILED',
      recordsImported: 0,
      summary: `failed: ${message}`.slice(0, 2000),
    });
    throw error;
  }
}
