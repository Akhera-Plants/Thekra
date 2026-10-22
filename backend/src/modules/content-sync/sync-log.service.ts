/**
 * sync-log.service.ts
 *
 * Thin wrapper around the SyncLog Prisma model.
 * Owns the stale-run reconciliation that runs at startup
 * (content-pipeline-plan §3.3 — a RUNNING row older than SYNC_STALE_AFTER_MINUTES
 * is marked FAILED with "stale run reconciled at startup").
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncStatus } from '@prisma/client';
import type { SyncLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SyncLogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncLogService.name);

  /** Minutes after which a RUNNING row is considered stale. */
  private get staleAfterMinutes(): number {
    return this.config.get<number>('SYNC_STALE_AFTER_MINUTES') ?? 120;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reconcile stale RUNNING rows on startup.
   * Called automatically by NestJS because this service implements
   * OnApplicationBootstrap.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.reconcileStaleRuns();
  }

  async reconcileStaleRuns(): Promise<number> {
    const cutoff = new Date(Date.now() - this.staleAfterMinutes * 60_000);
    const { count } = await this.prisma.syncLog.updateMany({
      where: {
        status: SyncStatus.RUNNING,
        startedAt: { lt: cutoff },
      },
      data: {
        status: SyncStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: 'stale run reconciled at startup',
      },
    });

    if (count > 0) {
      this.logger.warn(
        { count, cutoffMinutes: this.staleAfterMinutes },
        'Reconciled stale RUNNING SyncLog rows',
      );
    }

    return count;
  }

  async findActiveRun(sourceId: string): Promise<SyncLog | null> {
    return this.prisma.syncLog.findFirst({
      where: {
        sourceId,
        status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] },
      },
    });
  }

  async create(sourceId: string): Promise<SyncLog> {
    return this.prisma.syncLog.create({
      data: {
        sourceId,
        status: SyncStatus.PENDING,
        recordsImported: 0,
      },
    });
  }

  async markRunning(id: string): Promise<SyncLog> {
    return this.prisma.syncLog.update({
      where: { id },
      data: { status: SyncStatus.RUNNING },
    });
  }

  async markSuccess(
    id: string,
    stats: {
      recordsImported: number;
      created: number;
      updated: number;
      skipped: number;
      failed: number;
      unmappedGrades: string[];
    },
  ): Promise<SyncLog> {
    const isClean = stats.failed === 0 && stats.skipped === 0 && stats.unmappedGrades.length === 0;
    const errorMessage = isClean
      ? null
      : `partial: created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} failed=${stats.failed}` +
        (stats.unmappedGrades.length > 0
          ? `; unmapped grades: ${JSON.stringify(stats.unmappedGrades)}`
          : '');

    return this.prisma.syncLog.update({
      where: { id },
      data: {
        status: SyncStatus.SUCCESS,
        finishedAt: new Date(),
        recordsImported: stats.recordsImported,
        errorMessage,
      },
    });
  }

  async markFailed(id: string, errorMessage: string, recordsImported = 0): Promise<SyncLog> {
    return this.prisma.syncLog.update({
      where: { id },
      data: {
        status: SyncStatus.FAILED,
        finishedAt: new Date(),
        recordsImported,
        errorMessage,
      },
    });
  }

  async incrementImported(id: string, delta: number): Promise<void> {
    await this.prisma.syncLog.update({
      where: { id },
      data: { recordsImported: { increment: delta } },
    });
  }

  async findAll(query: {
    sourceId?: string;
    status?: SyncStatus;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.syncLog.findMany({
        where,
        include: { source: { select: { id: true, name: true, apiProvider: true } } },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.syncLog.count({ where }),
    ]);

    return {
      data: rows.map(mapSyncLogDto),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
      },
    };
  }

  async findById(id: string): Promise<ReturnType<typeof mapSyncLogDto> | null> {
    const row = await this.prisma.syncLog.findUnique({
      where: { id },
      include: { source: { select: { id: true, name: true, apiProvider: true } } },
    });
    return row ? mapSyncLogDto(row) : null;
  }

  private buildWhere(query: {
    sourceId?: string;
    status?: SyncStatus;
    from?: Date;
    to?: Date;
  }) {
    const w: Record<string, unknown> = {};
    if (query.sourceId) w['sourceId'] = query.sourceId;
    if (query.status) w['status'] = query.status;
    if (query.from || query.to) {
      const startedAt: Record<string, Date> = {};
      if (query.from) startedAt['gte'] = query.from;
      if (query.to) startedAt['lte'] = query.to;
      w['startedAt'] = startedAt;
    }
    return w;
  }
}

// ─── DTO shape ────────────────────────────────────────────────────────────────

function mapSyncLogDto(
  row: SyncLog & { source: { id: string; name: string; apiProvider: string | null } },
) {
  const durationMs =
    row.finishedAt && row.startedAt
      ? row.finishedAt.getTime() - row.startedAt.getTime()
      : null;

  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs,
    recordsImported: row.recordsImported,
    errorMessage: row.errorMessage,
    source: row.source,
  };
}
