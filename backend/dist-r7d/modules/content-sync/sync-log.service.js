var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SyncLogService_1;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
let SyncLogService = SyncLogService_1 = class SyncLogService {
    prisma;
    config;
    logger = new Logger(SyncLogService_1.name);
    get staleAfterMinutes() {
        return this.config.get('SYNC_STALE_AFTER_MINUTES') ?? 120;
    }
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async onApplicationBootstrap() {
        await this.reconcileStaleRuns();
    }
    async reconcileStaleRuns() {
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
            this.logger.warn({ count, cutoffMinutes: this.staleAfterMinutes }, 'Reconciled stale RUNNING SyncLog rows');
        }
        return count;
    }
    async findActiveRun(sourceId) {
        return this.prisma.syncLog.findFirst({
            where: {
                sourceId,
                status: { in: [SyncStatus.PENDING, SyncStatus.RUNNING] },
            },
        });
    }
    async create(sourceId) {
        return this.prisma.syncLog.create({
            data: {
                sourceId,
                status: SyncStatus.PENDING,
                recordsImported: 0,
            },
        });
    }
    async markRunning(id) {
        return this.prisma.syncLog.update({
            where: { id },
            data: { status: SyncStatus.RUNNING },
        });
    }
    async markSuccess(id, stats) {
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
    async markFailed(id, errorMessage, recordsImported = 0) {
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
    async incrementImported(id, delta) {
        await this.prisma.syncLog.update({
            where: { id },
            data: { recordsImported: { increment: delta } },
        });
    }
    async findAll(query) {
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
    async findById(id) {
        const row = await this.prisma.syncLog.findUnique({
            where: { id },
            include: { source: { select: { id: true, name: true, apiProvider: true } } },
        });
        return row ? mapSyncLogDto(row) : null;
    }
    buildWhere(query) {
        const w = {};
        if (query.sourceId)
            w['sourceId'] = query.sourceId;
        if (query.status)
            w['status'] = query.status;
        if (query.from || query.to) {
            const startedAt = {};
            if (query.from)
                startedAt['gte'] = query.from;
            if (query.to)
                startedAt['lte'] = query.to;
            w['startedAt'] = startedAt;
        }
        return w;
    }
};
SyncLogService = SyncLogService_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService,
        ConfigService])
], SyncLogService);
export { SyncLogService };
function mapSyncLogDto(row) {
    const durationMs = row.finishedAt && row.startedAt
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
//# sourceMappingURL=sync-log.service.js.map