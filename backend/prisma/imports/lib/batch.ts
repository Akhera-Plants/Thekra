/**
 * Batched writes: one interactive transaction per batch (vision v2 §5.9), so a
 * crash loses at most one batch and a re-run (idempotent) finishes the job.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

const DEFAULT_BATCH_SIZE = 500;
const TRANSACTION_TIMEOUT_MS = 120_000;

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('Batch size must be at least 1');
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) batches.push(items.slice(start, start + size));
  return batches;
}

export async function inTransactionBatches<T>(
  prisma: PrismaClient,
  items: readonly T[],
  write: (tx: Prisma.TransactionClient, batch: readonly T[]) => Promise<void>,
  afterBatch?: (written: number) => Promise<void>,
  size = DEFAULT_BATCH_SIZE,
): Promise<void> {
  let written = 0;
  for (const batch of chunk(items, size)) {
    await prisma.$transaction((tx) => write(tx, batch), { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 });
    written += batch.length;
    if (afterBatch) await afterBatch(written);
  }
}
