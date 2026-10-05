/**
 * content-sync.service.ts
 *
 * Run executor for the content-sync pipeline.
 * See content-pipeline-plan §3 for the full specification.
 *
 * Responsibilities:
 *   - Guard checks (PENDING/RUNNING, isExternalApi, isConfigured)
 *   - Create SyncLog (PENDING) and return immediately (async fire-and-forget)
 *   - Acquire Postgres advisory lock (pg_try_advisory_lock)
 *   - Iterate batches with backoff, per-record try/catch, budget enforcement
 *   - Release lock in `finally`
 *   - Mark SyncLog SUCCESS / FAILED
 *
 * Curation survival guarantee (tested):
 *   The `update` branch of the upsert ONLY touches provider-owned fields.
 *   It NEVER writes sinLinks, goodDeedLinks, relevanceScore, tags, or favorites.
 *   See content-pipeline-plan §3.6.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SyncLogService } from './sync-log.service.js';
import {
  CONTENT_PROVIDERS_TOKEN,
  ProviderHttpError,
  RunAbortedError,
  SkipRecordError,
  type ContentProvider,
  type ProviderCursor,
  type MappedQuote,
} from './providers/content-provider.interface.js';
import type { TriggerSyncDto } from './dto/trigger-sync.dto.js';

// ─── Tuneable constants (override via env) ────────────────────────────────────

const DEFAULT_MAX_REQUESTS_PER_RUN = 2000;
const DEFAULT_MAX_DURATION_MINUTES = 30;
const DEFAULT_MAX_RECORD_FAILURES = 50;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
const DEFAULT_MAX_RETRY_ATTEMPTS = 5;

// ─── withRetry ────────────────────────────────────────────────────────────────

/** Statuses that are never retried — they indicate a config/logic error. */
const NEVER_RETRY_STATUSES = new Set([400, 401, 403, 404, 422]);

interface RetryContext {
  providerKey: string;
  context: string;
  maxAttempts?: number;
  logger: Logger;
  /** Override sleep for tests (pass a no-op or fake-timer-compatible fn). */
  sleep?: (ms: number) => Promise<void>;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  ctx: RetryContext,
): Promise<T> {
  const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
  const sleepFn = ctx.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isProviderError = err instanceof ProviderHttpError;
      const status = isProviderError ? err.statusCode : 0;

      // Non-transient: fail immediately
      if (isProviderError && NEVER_RETRY_STATUSES.has(status)) {
        throw err;
      }

      if (attempt === maxAttempts) {
        ctx.logger.error(
          { providerKey: ctx.providerKey, context: ctx.context, attempt, err },
          `${ctx.providerKey}: exhausted ${maxAttempts} retry attempts`,
        );
        throw err;
      }

      // Compute backoff: min(2^n * 1s, 60s) * random(0.5..1)
      let delayMs: number;
      if (isProviderError && err.retryAfterMs !== undefined) {
        delayMs = err.retryAfterMs;
        ctx.logger.warn(
          { attempt, retryAfterMs: delayMs, context: ctx.context },
          `${ctx.providerKey}: honoring Retry-After`,
        );
      } else {
        const base = Math.min(Math.pow(2, attempt) * 1000, 60_000);
        delayMs = base * (0.5 + Math.random() * 0.5);
        ctx.logger.warn(
          { attempt, delayMs: Math.round(delayMs), status, context: ctx.context },
          `${ctx.providerKey}: transient error, retrying after backoff`,
        );
      }

      await sleepFn(delayMs);
    }
  }

  // TypeScript narrowing: unreachable, but keeps the compiler happy
  throw new Error('unreachable');
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main service ─────────────────────────────────────────────────────────────

@Injectable()
export class ContentSyncService {
  private readonly logger = new Logger(ContentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncLogService: SyncLogService,
    private readonly config: ConfigService,
    @Inject(CONTENT_PROVIDERS_TOKEN)
    private readonly providers: ContentProvider[],
  ) {}

  // ─── Trigger ──────────────────────────────────────────────────────────────

  /**
   * Public API called by the controller AND the scheduler.
   * Creates a SyncLog with status=PENDING and fires the executor asynchronously.
   * Returns immediately with the SyncLog handle (202 semantics).
   */
  async triggerRun(dto: TriggerSyncDto) {
    const source = await this.prisma.source.findUnique({ where: { id: dto.sourceId } });
    if (!source) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: `Source ${dto.sourceId} not found`,
      });
    }

    if (!source.isExternalApi) {
      throw new UnprocessableEntityException({
        code: 'SOURCE_NOT_EXTERNAL',
        message: 'Source must have isExternalApi=true to trigger a sync run',
      });
    }

    const provider = this.resolveProvider(source.apiProvider ?? '');
    if (!provider) {
      throw new UnprocessableEntityException({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `No provider registered for apiProvider='${source.apiProvider}'`,
      });
    }

    if (!provider.isConfigured()) {
      throw new UnprocessableEntityException({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `Provider '${provider.key}' requires an API key that is not configured`,
      });
    }

    if (!dto.force) {
      const active = await this.syncLogService.findActiveRun(dto.sourceId);
      if (active) {
        throw new ConflictException({
          code: 'SYNC_ALREADY_RUNNING',
          message: `A sync run for this source is already ${active.status}`,
        });
      }
    }

    const syncLog = await this.syncLogService.create(dto.sourceId);

    // Fire and forget — never await in the request handler
    this.executeRun(syncLog.id, source.id, provider, dto).catch((err) => {
      this.logger.error({ syncLogId: syncLog.id, err }, 'Unhandled executor crash');
    });

    return {
      syncLogId: syncLog.id,
      sourceId: dto.sourceId,
      status: 'PENDING',
      startedAt: syncLog.startedAt,
    };
  }

  // ─── Executor ─────────────────────────────────────────────────────────────

  /**
   * The actual import loop.
   * Runs asynchronously after `triggerRun` returns.
   */
  async executeRun(
    syncLogId: string,
    sourceId: string,
    provider: ContentProvider,
    dto: TriggerSyncDto,
    /** Injected sleep for tests — defaults to real setTimeout. */
    sleepFn?: (ms: number) => Promise<void>,
  ): Promise<void> {
    const maxRequests =
      this.config.get<number>('SYNC_MAX_REQUESTS_PER_RUN') ?? DEFAULT_MAX_REQUESTS_PER_RUN;
    const maxDurationMs =
      (this.config.get<number>('SYNC_MAX_DURATION_MINUTES') ?? DEFAULT_MAX_DURATION_MINUTES) *
      60_000;
    const maxRecordFailures =
      this.config.get<number>('SYNC_MAX_RECORD_FAILURES') ?? DEFAULT_MAX_RECORD_FAILURES;
    const maxConsecutive = DEFAULT_MAX_CONSECUTIVE_FAILURES;

    const source = await this.prisma.source.findUniqueOrThrow({ where: { id: sourceId } });

    // Acquire Postgres advisory lock
    const lockKey = hashSourceId(sourceId);
    const lockResult = await this.prisma.$queryRaw<[{ acquired: boolean }]>(
      Prisma.sql`SELECT pg_try_advisory_lock(${lockKey}::bigint) AS acquired`,
    );
    const acquired = lockResult[0]?.acquired ?? false;

    if (!acquired) {
      await this.syncLogService.markFailed(
        syncLogId,
        'Advisory lock not acquired — another process may be running the same source',
      );
      return;
    }

    try {
      await this.syncLogService.markRunning(syncLogId);

      const counters = {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        unmappedGrades: [] as string[],
      };

      let requestCount = 0;
      let consecutiveFailures = 0;
      const runStart = Date.now();

      const initialCursor: ProviderCursor = {
        page: 1,
        surahFrom: dto.scope?.surahFrom,
        surahTo: dto.scope?.surahTo,
        collection: dto.scope?.collection,
        bookFrom: dto.scope?.bookFrom,
        dryRun: dto.dryRun,
      };

      let cursor: ProviderCursor | null = initialCursor;

      while (cursor !== null) {
        // Budget checks
        if (requestCount >= maxRequests) {
          this.logger.log({ syncLogId, requestCount }, 'Budget: max requests reached, ending run cleanly');
          break;
        }
        if (Date.now() - runStart > maxDurationMs) {
          this.logger.log({ syncLogId }, 'Budget: max duration reached, ending run cleanly');
          break;
        }

        // Fetch one page with retry
        let batch: Awaited<ReturnType<ContentProvider['fetchBatch']>>;
        try {
          batch = await withRetry(() => provider.fetchBatch(cursor!), {
            providerKey: provider.key,
            context: `cursor page=${cursor!.page}`,
            logger: this.logger,
            sleep: sleepFn,
          });
          consecutiveFailures = 0;
        } catch (err: unknown) {
          consecutiveFailures++;
          this.logger.error(
            { syncLogId, cursor, consecutiveFailures, err },
            `${provider.key}: fetch failed`,
          );
          if (consecutiveFailures >= maxConsecutive) {
            throw new RunAbortedError(
              `provider circuit opened after ${consecutiveFailures} consecutive failures`,
            );
          }
          // Skip to next cursor (best effort)
          cursor = cursor.page !== undefined
            ? { ...cursor, page: cursor.page + 1 }
            : null;
          continue;
        }

        requestCount++;

        // Process each record
        for (const raw of batch.records) {
          try {
            const mapped = provider.mapToQuote(raw, source);

            if (!dto.dryRun) {
              const action = await this.upsertRecord(mapped, provider.key);
              if (action === 'created') counters.created++;
              else counters.updated++;
            }
            // In dry-run mode, just count what would happen
          } catch (err: unknown) {
            if (err instanceof SkipRecordError) {
              counters.skipped++;
              this.logger.debug({ providerKey: provider.key, reason: err.message }, 'Record skipped');
              continue;
            }

            // Collect unmapped grade warnings (non-fatal)
            if (err instanceof Error && err.message.includes('unmapped grade')) {
              counters.unmappedGrades.push(err.message);
              continue;
            }

            counters.failed++;
            const externalId = safeExternalId(raw);
            this.logger.warn(
              { providerKey: provider.key, externalId },
              'Record failed; continuing run',
            );

            if (counters.failed > maxRecordFailures) {
              throw new RunAbortedError(
                `record failure threshold exceeded (${counters.failed} failures)`,
              );
            }
          }
        }

        // Emit mid-run progress
        if (batch.records.length > 0) {
          await this.syncLogService.incrementImported(syncLogId, batch.records.length - counters.skipped - counters.failed > 0 ? 1 : 0);
        }

        cursor = batch.nextCursor;

        // Rate limiting: ~2 req/s between pages
        if (cursor !== null && sleepFn === undefined) {
          const rps = this.config.get<number>(`SYNC_${provider.key.toUpperCase().replace(/\./g, '_')}_RPS`) ?? 2;
          await defaultSleep(1000 / rps);
        }
      }

      // Update Source.lastSyncedAt
      if (!dto.dryRun) {
        await this.prisma.source.update({
          where: { id: sourceId },
          data: { lastSyncedAt: new Date() },
        });
      }

      const totalImported = counters.created + counters.updated;

      if (dto.dryRun) {
        await this.syncLogService.markFailed(
          syncLogId,
          `dryRun: would create=${counters.created} update=${counters.updated} skip=${counters.skipped} fail=${counters.failed}`,
          0,
        );
        // Mark as SUCCESS (dryRun is informational, not a failure)
        await this.prisma.syncLog.update({
          where: { id: syncLogId },
          data: { status: 'SUCCESS' },
        });
        return;
      }

      await this.syncLogService.markSuccess(syncLogId, {
        recordsImported: totalImported,
        ...counters,
      });

      this.logger.log(
        { syncLogId, ...counters, totalImported, requestCount },
        `${provider.key}: run completed`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.syncLogService.markFailed(syncLogId, message).catch(() => {
        /* ignore secondary failure */
      });
      this.logger.error({ syncLogId, err }, `${provider.key}: run aborted`);
    } finally {
      // Always release the advisory lock
      const lockKey = hashSourceId(sourceId);
      await this.prisma
        .$queryRaw(Prisma.sql`SELECT pg_advisory_unlock(${lockKey}::bigint)`)
        .catch((e: unknown) => {
          this.logger.error({ e }, 'Failed to release advisory lock');
        });
    }
  }

  // ─── Upsert ───────────────────────────────────────────────────────────────

  /**
   * Upsert one record into the Quote + Translation tables.
   *
   * The UPDATE branch ONLY touches provider-owned fields.
   * It NEVER writes sinLinks, goodDeedLinks, relevanceScore, tags, or favorites.
   * This is the curation-survival guarantee — see content-pipeline-plan §3.6.
   */
  async upsertRecord(
    mapped: MappedQuote,
    providerKey: string,
  ): Promise<'created' | 'updated'> {
    const { externalId, quote, translations } = mapped;

    let isNew = false;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quote.findUnique({
        where: { apiProvider_externalId: { apiProvider: providerKey, externalId } },
        select: { id: true },
      });

      isNew = !existing;

      const saved = await tx.quote.upsert({
        where: { apiProvider_externalId: { apiProvider: providerKey, externalId } },
        create: {
          ...quote,
          origin: 'API_CACHED',
          apiProvider: providerKey,
          externalId,
        },
        update: {
          // ── Provider-owned fields only ────────────────────────────────────
          // NEVER add sinLinks, goodDeedLinks, relevanceScore, tags, favorites.
          textAr: quote.textAr,
          narrator: quote.narrator,
          narratorAr: quote.narratorAr,
          grade: quote.grade,
          hadithReference: quote.hadithReference,
          surahNumber: quote.surahNumber,
          surahName: quote.surahName,
          surahNameAr: quote.surahNameAr,
          ayahNumber: quote.ayahNumber,
          rawPayload: quote.rawPayload,
          // sourceId is provider-owned too (the source record represents the collection)
          sourceId: quote.sourceId,
        },
        select: { id: true },
      });

      // Upsert translations — first configured language wins
      const seenLangs = new Set<string>();
      for (const t of translations) {
        if (seenLangs.has(t.languageCode)) continue; // first wins
        seenLangs.add(t.languageCode);

        await tx.translation.upsert({
          where: { quoteId_languageCode: { quoteId: saved.id, languageCode: t.languageCode } },
          create: { quoteId: saved.id, languageCode: t.languageCode, text: t.text },
          update: { text: t.text },
        });
      }
    });

    return isNew ? 'created' : 'updated';
  }

  // ─── Provider resolution ──────────────────────────────────────────────────

  private resolveProvider(apiProvider: string): ContentProvider | undefined {
    return this.providers.find((p) => p.key === apiProvider);
  }

  /** Expose for the scheduler. */
  getProvider(key: string): ContentProvider | undefined {
    return this.providers.find((p) => p.key === key);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a source UUID to a stable bigint for pg_try_advisory_lock.
 * Uses a simple djb2-style hash — collisions are acceptable (lock is advisory).
 */
function hashSourceId(sourceId: string): bigint {
  let hash = 5381n;
  for (let i = 0; i < sourceId.length; i++) {
    hash = ((hash << 5n) + hash + BigInt(sourceId.charCodeAt(i))) & 0x7fff_ffff_ffff_ffffn;
  }
  return hash;
}

function safeExternalId(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const id = r['verse_key'] ?? r['hadithNumber'] ?? r['id'];
    return typeof id === 'string' || typeof id === 'number' ? String(id) : 'unknown';
  }
  return 'unknown';
}
