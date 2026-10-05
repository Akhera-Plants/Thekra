/**
 * content-sync.service.spec.ts
 *
 * Tests for the sync executor — no real DB, no real HTTP.
 *
 * Critical tests:
 *   - curation-survival: re-sync MUST NOT touch SinQuote/GoodDeedQuote/relevanceScore
 *   - partial-failure: one bad record → run is SUCCESS, failed=1, others imported
 *   - missing-arabic: SkipRecordError → skipped, no row written
 *   - lock: concurrent trigger for same source → 409 SYNC_ALREADY_RUNNING
 *   - stale reconciliation: RUNNING row older than threshold → FAILED at startup
 */

import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { QuoteType, SyncStatus } from '@prisma/client';
import type { Source, SyncLog } from '@prisma/client';
import { ContentSyncService } from './content-sync.service.js';
import { SyncLogService } from './sync-log.service.js';
import type { ContentProvider, MappedQuote } from './providers/content-provider.interface.js';
import { SkipRecordError } from './providers/content-provider.interface.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 'src-001',
    name: 'Test Source',
    nameAr: null,
    type: 'QURAN',
    author: null,
    authorAr: null,
    language: 'ar',
    isExternalApi: true,
    apiProvider: 'quran.com',
    apiBaseUrl: null,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSyncLog(overrides: Partial<SyncLog> = {}): SyncLog {
  return {
    id: 'log-001',
    sourceId: 'src-001',
    status: SyncStatus.PENDING,
    startedAt: new Date(),
    finishedAt: null,
    recordsImported: 0,
    errorMessage: null,
    ...overrides,
  };
}

function makeMappedQuote(overrides: Partial<MappedQuote> = {}): MappedQuote {
  return {
    externalId: '49:12',
    quote: {
      type: QuoteType.QURAN_VERSE,
      textAr: 'test arabic',
      sourceId: 'src-001',
      surahNumber: 49,
      surahName: 'Al-Hujurat',
      surahNameAr: 'الحجرات',
      ayahNumber: 12,
      narrator: null,
      narratorAr: null,
      grade: null,
      hadithReference: null,
      bookTitle: null,
      author: null,
      pageOrChapter: null,
    },
    translations: [],
    ...overrides,
  };
}

// ─── Build service with plain vi.fn() mocks ───────────────────────────────────

function buildService(providers: ContentProvider[]) {
  const prisma = {
    source: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    syncLog: {
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };

  const syncLogService: Partial<SyncLogService> = {
    findActiveRun: vi.fn(),
    create: vi.fn(),
    markRunning: vi.fn(),
    markSuccess: vi.fn(),
    markFailed: vi.fn(),
    incrementImported: vi.fn(),
    reconcileStaleRuns: vi.fn(),
  };

  const config = {
    get: (key: string) => {
      if (key === 'SYNC_MAX_REQUESTS_PER_RUN') return 100;
      if (key === 'SYNC_MAX_DURATION_MINUTES') return 5;
      if (key === 'SYNC_MAX_RECORD_FAILURES') return 50;
      return undefined;
    },
  };

  const service = new ContentSyncService(
    prisma as never,
    syncLogService as SyncLogService,
    config as never,
    providers,
  );

  return { service, prisma, syncLogService };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContentSyncService.triggerRun', () => {
  it('throws NotFoundException when source not found', async () => {
    const { service, prisma } = buildService([]);
    prisma.source.findUnique.mockResolvedValue(null);

    await expect(service.triggerRun({ sourceId: 'non-existent' })).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException when source is not external API', async () => {
    const { service, prisma } = buildService([]);
    prisma.source.findUnique.mockResolvedValue(makeSource({ isExternalApi: false }));

    await expect(service.triggerRun({ sourceId: 'src-001' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws UnprocessableEntityException when no provider registered', async () => {
    const { service, prisma } = buildService([]);
    prisma.source.findUnique.mockResolvedValue(makeSource({ apiProvider: 'unknown-provider' }));

    await expect(service.triggerRun({ sourceId: 'src-001' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws UnprocessableEntityException when provider not configured (missing API key)', async () => {
    const unconfiguredProvider: ContentProvider = {
      key: 'quran.com',
      isConfigured: () => false,
      fetchBatch: vi.fn(),
      mapToQuote: vi.fn(),
    };
    const { service, prisma } = buildService([unconfiguredProvider]);
    prisma.source.findUnique.mockResolvedValue(makeSource());

    await expect(service.triggerRun({ sourceId: 'src-001' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('throws 409 SYNC_ALREADY_RUNNING when an active run exists', async () => {
    const provider: ContentProvider = {
      key: 'quran.com',
      isConfigured: () => true,
      fetchBatch: vi.fn(),
      mapToQuote: vi.fn(),
    };
    const { service, prisma, syncLogService } = buildService([provider]);
    prisma.source.findUnique.mockResolvedValue(makeSource());
    (syncLogService.findActiveRun as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSyncLog({ status: SyncStatus.RUNNING }),
    );

    await expect(service.triggerRun({ sourceId: 'src-001' })).rejects.toThrow(ConflictException);
  });

  it('returns syncLogId and PENDING status immediately (fire-and-forget)', async () => {
    const provider: ContentProvider = {
      key: 'quran.com',
      isConfigured: () => true,
      fetchBatch: vi.fn().mockResolvedValue({ records: [], nextCursor: null }),
      mapToQuote: vi.fn(),
    };
    const { service, prisma, syncLogService } = buildService([provider]);
    prisma.source.findUnique.mockResolvedValue(makeSource());
    (syncLogService.findActiveRun as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (syncLogService.create as ReturnType<typeof vi.fn>).mockResolvedValue(makeSyncLog());

    const result = await service.triggerRun({ sourceId: 'src-001' });

    expect(result.status).toBe('PENDING');
    expect(result.syncLogId).toBe('log-001');
  });

  it('bypasses the SYNC_ALREADY_RUNNING check when force=true', async () => {
    const provider: ContentProvider = {
      key: 'quran.com',
      isConfigured: () => true,
      fetchBatch: vi.fn().mockResolvedValue({ records: [], nextCursor: null }),
      mapToQuote: vi.fn(),
    };
    const { service, prisma, syncLogService } = buildService([provider]);
    prisma.source.findUnique.mockResolvedValue(makeSource());
    (syncLogService.create as ReturnType<typeof vi.fn>).mockResolvedValue(makeSyncLog());

    // Even with an active run, force=true should bypass the guard
    const result = await service.triggerRun({ sourceId: 'src-001', force: true });
    expect(result.syncLogId).toBe('log-001');
    // findActiveRun should NOT have been called
    expect(syncLogService.findActiveRun).not.toHaveBeenCalled();
  });
});

// ─── Curation survival ────────────────────────────────────────────────────────

describe('ContentSyncService.upsertRecord — curation survival', () => {
  /**
   * The most important regression test in the pipeline.
   * Verifies that when a quote already exists (re-sync scenario),
   * the update branch ONLY writes provider-owned fields.
   * sinLinks, goodDeedLinks, relevanceScore, tags, favorites are NEVER touched.
   *
   * See content-pipeline-plan §3.6.
   */

  it('upsert on existing row returns "updated"', async () => {
    const { service, prisma } = buildService([]);

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        quote: {
          findUnique: vi.fn().mockResolvedValue({ id: 'existing-quote-id' }),
          upsert: vi.fn().mockResolvedValue({ id: 'existing-quote-id' }),
        },
        translation: {
          upsert: vi.fn().mockResolvedValue({ id: 't1' }),
        },
      };
      return fn(tx as never);
    });

    const result = await service.upsertRecord(makeMappedQuote(), 'quran.com');
    expect(result).toBe('updated');
  });

  it('upsert on new row returns "created"', async () => {
    const { service, prisma } = buildService([]);

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        quote: {
          findUnique: vi.fn().mockResolvedValue(null), // not found → new
          upsert: vi.fn().mockResolvedValue({ id: 'new-quote-id' }),
        },
        translation: {
          upsert: vi.fn().mockResolvedValue({ id: 't1' }),
        },
      };
      return fn(tx as never);
    });

    const result = await service.upsertRecord(
      makeMappedQuote({ externalId: 'new:1' }),
      'quran.com',
    );
    expect(result).toBe('created');
  });

  it('idempotency: running twice on the same record yields "updated" the second time', async () => {
    const { service, prisma } = buildService([]);

    let callCount = 0;
    prisma.$transaction.mockImplementation(async (fn) => {
      callCount++;
      const tx = {
        quote: {
          findUnique: vi.fn().mockResolvedValue(callCount > 1 ? { id: 'q-1' } : null),
          upsert: vi.fn().mockResolvedValue({ id: 'q-1' }),
        },
        translation: { upsert: vi.fn().mockResolvedValue({ id: 't1' }) },
      };
      return fn(tx as never);
    });

    const mapped = makeMappedQuote();
    const first = await service.upsertRecord(mapped, 'quran.com');
    const second = await service.upsertRecord(mapped, 'quran.com');
    expect(first).toBe('created');
    expect(second).toBe('updated');
  });

  it('update data object NEVER includes sinLinks/goodDeedLinks/relevanceScore', async () => {
    const { service, prisma } = buildService([]);

    let capturedUpdateData: Record<string, unknown> | undefined;

    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        quote: {
          findUnique: vi.fn().mockResolvedValue({ id: 'existing-id' }),
          upsert: vi.fn().mockImplementation(({ update }: { update: Record<string, unknown> }) => {
            capturedUpdateData = update;
            return Promise.resolve({ id: 'existing-id' });
          }),
        },
        translation: { upsert: vi.fn().mockResolvedValue({ id: 't1' }) },
      };
      return fn(tx as never);
    });

    await service.upsertRecord(makeMappedQuote(), 'quran.com');

    // The update data must never contain curation fields
    expect(capturedUpdateData).toBeDefined();
    expect(capturedUpdateData).not.toHaveProperty('sinLinks');
    expect(capturedUpdateData).not.toHaveProperty('goodDeedLinks');
    expect(capturedUpdateData).not.toHaveProperty('relevanceScore');
    expect(capturedUpdateData).not.toHaveProperty('tags');
    expect(capturedUpdateData).not.toHaveProperty('favorites');
    // Confirm it DOES contain provider-owned fields
    expect(capturedUpdateData).toHaveProperty('textAr');
    expect(capturedUpdateData).toHaveProperty('rawPayload');
  });
});

// ─── Executor: partial failure ────────────────────────────────────────────────

describe('ContentSyncService.executeRun — partial failure', () => {
  it('continues run when one record throws, marks run SUCCESS with failed=1', async () => {
    const noopSleep = vi.fn().mockResolvedValue(undefined);
    let mapCallCount = 0;

    const provider: ContentProvider = {
      key: 'quran.com',
      isConfigured: () => true,
      fetchBatch: vi.fn().mockResolvedValueOnce({
        records: [
          { _type: 'good', verse_key: 'GOOD:1' },
          { _type: 'bad', verse_key: 'BAD:2' },
          { _type: 'good', verse_key: 'GOOD:3' },
        ],
        nextCursor: null,
      }),
      mapToQuote: vi.fn().mockImplementation((raw: unknown) => {
        mapCallCount++;
        const r = raw as { _type: string; verse_key: string };
        if (r._type === 'bad') throw new Error('Simulated DB error on record');
        return makeMappedQuote({ externalId: r.verse_key });
      }),
    };

    const { service, prisma, syncLogService } = buildService([provider]);

    const source = makeSource();
    prisma.source.findUniqueOrThrow.mockResolvedValue(source);
    prisma.$queryRaw.mockResolvedValue([{ acquired: true }]); // advisory lock
    prisma.source.update.mockResolvedValue(source);
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        quote: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ id: `q-${mapCallCount}` }),
        },
        translation: { upsert: vi.fn().mockResolvedValue({ id: 't1' }) },
      };
      return fn(tx as never);
    });

    (syncLogService.markRunning as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSyncLog({ status: SyncStatus.RUNNING }),
    );
    (syncLogService.incrementImported as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    let capturedStats: { failed: number; created: number; updated: number } | undefined;
    (syncLogService.markSuccess as ReturnType<typeof vi.fn>).mockImplementation(
      async (_id, stats) => {
        capturedStats = stats;
        return makeSyncLog({ status: SyncStatus.SUCCESS });
      },
    );

    await service.executeRun('log-001', 'src-001', provider, { sourceId: 'src-001' }, noopSleep);

    expect(syncLogService.markSuccess).toHaveBeenCalledOnce();
    expect(syncLogService.markFailed).not.toHaveBeenCalled();
    expect(capturedStats?.failed).toBe(1);
    expect((capturedStats?.created ?? 0) + (capturedStats?.updated ?? 0)).toBe(2);
  });

  it('skips records that throw SkipRecordError (missing Arabic)', async () => {
    const noopSleep = vi.fn().mockResolvedValue(undefined);

    const provider: ContentProvider = {
      key: 'sunnah.com',
      isConfigured: () => true,
      fetchBatch: vi.fn().mockResolvedValueOnce({
        records: [{ _noArabic: true }],
        nextCursor: null,
      }),
      mapToQuote: vi.fn().mockImplementation(() => {
        throw new SkipRecordError('No Arabic text');
      }),
    };

    const { service, prisma, syncLogService } = buildService([provider]);
    const source = makeSource({ apiProvider: 'sunnah.com' });
    prisma.source.findUniqueOrThrow.mockResolvedValue(source);
    prisma.$queryRaw.mockResolvedValue([{ acquired: true }]);
    prisma.source.update.mockResolvedValue(source);

    (syncLogService.markRunning as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSyncLog({ status: SyncStatus.RUNNING }),
    );
    (syncLogService.incrementImported as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    let capturedStats: { skipped: number; failed: number } | undefined;
    (syncLogService.markSuccess as ReturnType<typeof vi.fn>).mockImplementation(
      async (_id, stats) => {
        capturedStats = stats;
        return makeSyncLog({ status: SyncStatus.SUCCESS });
      },
    );

    await service.executeRun('log-001', 'src-001', provider, { sourceId: 'src-001' }, noopSleep);

    expect(syncLogService.markSuccess).toHaveBeenCalledOnce();
    expect(capturedStats?.skipped).toBe(1);
    expect(capturedStats?.failed).toBe(0);
    // No upsert was attempted
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks run FAILED when advisory lock not acquired', async () => {
    const provider: ContentProvider = {
      key: 'quran.com',
      isConfigured: () => true,
      fetchBatch: vi.fn(),
      mapToQuote: vi.fn(),
    };
    const { service, prisma, syncLogService } = buildService([provider]);
    const source = makeSource();
    prisma.source.findUniqueOrThrow.mockResolvedValue(source);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ acquired: false }]) // lock not acquired
      .mockResolvedValue([]); // unlock

    (syncLogService.markFailed as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSyncLog({ status: SyncStatus.FAILED }),
    );

    await service.executeRun('log-001', 'src-001', provider, { sourceId: 'src-001' });

    expect(syncLogService.markFailed).toHaveBeenCalledWith(
      'log-001',
      expect.stringContaining('lock'),
    );
    expect(syncLogService.markRunning).not.toHaveBeenCalled();
  });
});

// ─── SyncLogService.reconcileStaleRuns ────────────────────────────────────────

describe('SyncLogService.reconcileStaleRuns', () => {
  it('marks RUNNING rows older than threshold as FAILED', async () => {
    const prisma = {
      syncLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const config = { get: () => 120 };
    const { SyncLogService: SyncLogServiceClass } = await import('./sync-log.service.js');
    const svc = new SyncLogServiceClass(prisma as never, config as never);

    const count = await svc.reconcileStaleRuns();
    expect(count).toBe(2);

    expect(prisma.syncLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: SyncStatus.RUNNING }),
        data: expect.objectContaining({
          status: SyncStatus.FAILED,
          errorMessage: 'stale run reconciled at startup',
        }),
      }),
    );
  });

  it('does nothing when no stale rows exist', async () => {
    const prisma = {
      syncLog: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const config = { get: () => 120 };
    const { SyncLogService: SyncLogServiceClass } = await import('./sync-log.service.js');
    const svc = new SyncLogServiceClass(prisma as never, config as never);

    const count = await svc.reconcileStaleRuns();
    expect(count).toBe(0);
  });
});
