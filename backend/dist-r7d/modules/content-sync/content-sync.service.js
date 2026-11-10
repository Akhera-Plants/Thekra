var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ContentSyncService_1;
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SyncLogService } from './sync-log.service.js';
import { CONTENT_PROVIDERS_TOKEN, ProviderHttpError, RunAbortedError, SkipRecordError, } from './providers/content-provider.interface.js';
const DEFAULT_MAX_REQUESTS_PER_RUN = 2000;
const DEFAULT_MAX_DURATION_MINUTES = 30;
const DEFAULT_MAX_RECORD_FAILURES = 50;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
const DEFAULT_MAX_RETRY_ATTEMPTS = 5;
const NEVER_RETRY_STATUSES = new Set([400, 401, 403, 404, 422]);
async function withRetry(fn, ctx) {
    const maxAttempts = ctx.maxAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
    const sleepFn = ctx.sleep ?? defaultSleep;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            const isProviderError = err instanceof ProviderHttpError;
            const status = isProviderError ? err.statusCode : 0;
            if (isProviderError && NEVER_RETRY_STATUSES.has(status)) {
                throw err;
            }
            if (attempt === maxAttempts) {
                ctx.logger.error({ providerKey: ctx.providerKey, context: ctx.context, attempt, err }, `${ctx.providerKey}: exhausted ${maxAttempts} retry attempts`);
                throw err;
            }
            let delayMs;
            if (isProviderError && err.retryAfterMs !== undefined) {
                delayMs = err.retryAfterMs;
                ctx.logger.warn({ attempt, retryAfterMs: delayMs, context: ctx.context }, `${ctx.providerKey}: honoring Retry-After`);
            }
            else {
                const base = Math.min(Math.pow(2, attempt) * 1000, 60_000);
                delayMs = base * (0.5 + Math.random() * 0.5);
                ctx.logger.warn({ attempt, delayMs: Math.round(delayMs), status, context: ctx.context }, `${ctx.providerKey}: transient error, retrying after backoff`);
            }
            await sleepFn(delayMs);
        }
    }
    throw new Error('unreachable');
}
function defaultSleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
let ContentSyncService = ContentSyncService_1 = class ContentSyncService {
    prisma;
    syncLogService;
    config;
    providers;
    logger = new Logger(ContentSyncService_1.name);
    constructor(prisma, syncLogService, config, providers) {
        this.prisma = prisma;
        this.syncLogService = syncLogService;
        this.config = config;
        this.providers = providers;
    }
    async triggerRun(dto) {
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
    async executeRun(syncLogId, sourceId, provider, dto, sleepFn) {
        const maxRequests = this.config.get('SYNC_MAX_REQUESTS_PER_RUN') ?? DEFAULT_MAX_REQUESTS_PER_RUN;
        const maxDurationMs = (this.config.get('SYNC_MAX_DURATION_MINUTES') ?? DEFAULT_MAX_DURATION_MINUTES) *
            60_000;
        const maxRecordFailures = this.config.get('SYNC_MAX_RECORD_FAILURES') ?? DEFAULT_MAX_RECORD_FAILURES;
        const maxConsecutive = DEFAULT_MAX_CONSECUTIVE_FAILURES;
        const source = await this.prisma.source.findUniqueOrThrow({ where: { id: sourceId } });
        const lockKey = hashSourceId(sourceId);
        const lockResult = await this.prisma.$queryRaw(Prisma.sql `SELECT pg_try_advisory_lock(${lockKey}::bigint) AS acquired`);
        const acquired = lockResult[0]?.acquired ?? false;
        if (!acquired) {
            await this.syncLogService.markFailed(syncLogId, 'Advisory lock not acquired — another process may be running the same source');
            return;
        }
        try {
            await this.syncLogService.markRunning(syncLogId);
            const counters = {
                created: 0,
                updated: 0,
                skipped: 0,
                failed: 0,
                unmappedGrades: [],
            };
            let requestCount = 0;
            let consecutiveFailures = 0;
            const runStart = Date.now();
            const initialCursor = {
                page: 1,
                surahFrom: dto.scope?.surahFrom,
                surahTo: dto.scope?.surahTo,
                collection: dto.scope?.collection,
                bookFrom: dto.scope?.bookFrom,
                dryRun: dto.dryRun,
            };
            let cursor = initialCursor;
            while (cursor !== null) {
                if (requestCount >= maxRequests) {
                    this.logger.log({ syncLogId, requestCount }, 'Budget: max requests reached, ending run cleanly');
                    break;
                }
                if (Date.now() - runStart > maxDurationMs) {
                    this.logger.log({ syncLogId }, 'Budget: max duration reached, ending run cleanly');
                    break;
                }
                let batch;
                try {
                    batch = await withRetry(() => provider.fetchBatch(cursor), {
                        providerKey: provider.key,
                        context: `cursor page=${cursor.page}`,
                        logger: this.logger,
                        sleep: sleepFn,
                    });
                    consecutiveFailures = 0;
                }
                catch (err) {
                    consecutiveFailures++;
                    this.logger.error({ syncLogId, cursor, consecutiveFailures, err }, `${provider.key}: fetch failed`);
                    if (consecutiveFailures >= maxConsecutive) {
                        throw new RunAbortedError(`provider circuit opened after ${consecutiveFailures} consecutive failures`);
                    }
                    cursor = cursor.page !== undefined
                        ? { ...cursor, page: cursor.page + 1 }
                        : null;
                    continue;
                }
                requestCount++;
                for (const raw of batch.records) {
                    try {
                        const mapped = provider.mapToQuote(raw, source);
                        if (!dto.dryRun) {
                            const action = await this.upsertRecord(mapped, provider.key);
                            if (action === 'created')
                                counters.created++;
                            else
                                counters.updated++;
                        }
                    }
                    catch (err) {
                        if (err instanceof SkipRecordError) {
                            counters.skipped++;
                            this.logger.debug({ providerKey: provider.key, reason: err.message }, 'Record skipped');
                            continue;
                        }
                        if (err instanceof Error && err.message.includes('unmapped grade')) {
                            counters.unmappedGrades.push(err.message);
                            continue;
                        }
                        counters.failed++;
                        const externalId = safeExternalId(raw);
                        this.logger.warn({ providerKey: provider.key, externalId }, 'Record failed; continuing run');
                        if (counters.failed > maxRecordFailures) {
                            throw new RunAbortedError(`record failure threshold exceeded (${counters.failed} failures)`);
                        }
                    }
                }
                if (batch.records.length > 0) {
                    await this.syncLogService.incrementImported(syncLogId, batch.records.length - counters.skipped - counters.failed > 0 ? 1 : 0);
                }
                cursor = batch.nextCursor;
                if (cursor !== null && sleepFn === undefined) {
                    const rps = this.config.get(`SYNC_${provider.key.toUpperCase().replace(/\./g, '_')}_RPS`) ?? 2;
                    await defaultSleep(1000 / rps);
                }
            }
            if (!dto.dryRun) {
                await this.prisma.source.update({
                    where: { id: sourceId },
                    data: { lastSyncedAt: new Date() },
                });
            }
            const totalImported = counters.created + counters.updated;
            if (dto.dryRun) {
                await this.syncLogService.markFailed(syncLogId, `dryRun: would create=${counters.created} update=${counters.updated} skip=${counters.skipped} fail=${counters.failed}`, 0);
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
            this.logger.log({ syncLogId, ...counters, totalImported, requestCount }, `${provider.key}: run completed`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await this.syncLogService.markFailed(syncLogId, message).catch(() => {
            });
            this.logger.error({ syncLogId, err }, `${provider.key}: run aborted`);
        }
        finally {
            const lockKey = hashSourceId(sourceId);
            await this.prisma
                .$queryRaw(Prisma.sql `SELECT pg_advisory_unlock(${lockKey}::bigint)`)
                .catch((e) => {
                this.logger.error({ e }, 'Failed to release advisory lock');
            });
        }
    }
    async upsertRecord(mapped, providerKey) {
        const { externalId, quote, translations } = mapped;
        const alias = await this.prisma.source.findUnique({
            where: { id: quote.sourceId },
            select: { canonicalId: true },
        });
        const sourceId = alias?.canonicalId ?? quote.sourceId;
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
                    sourceId,
                    origin: 'API_CACHED',
                    apiProvider: providerKey,
                    externalId,
                },
                update: {
                    textAr: quote.textAr,
                    narrator: quote.narrator,
                    narratorAr: quote.narratorAr,
                    grade: quote.grade,
                    hadithReference: quote.hadithReference,
                    referenceNumber: quote.referenceNumber,
                    referenceLabel: quote.referenceLabel,
                    surahNumber: quote.surahNumber,
                    surahName: quote.surahName,
                    surahNameAr: quote.surahNameAr,
                    ayahNumber: quote.ayahNumber,
                    rawPayload: quote.rawPayload,
                    sourceId,
                    textSource: quote.textSource,
                },
                select: { id: true },
            });
            const seenLangs = new Set();
            for (const t of translations) {
                if (seenLangs.has(t.languageCode))
                    continue;
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
    resolveProvider(apiProvider) {
        return this.providers.find((p) => p.key === apiProvider);
    }
    getProvider(key) {
        return this.providers.find((p) => p.key === key);
    }
};
ContentSyncService = ContentSyncService_1 = __decorate([
    Injectable(),
    __param(3, Inject(CONTENT_PROVIDERS_TOKEN)),
    __metadata("design:paramtypes", [PrismaService,
        SyncLogService,
        ConfigService, Array])
], ContentSyncService);
export { ContentSyncService };
function hashSourceId(sourceId) {
    let hash = 5381n;
    for (let i = 0; i < sourceId.length; i++) {
        hash = ((hash << 5n) + hash + BigInt(sourceId.charCodeAt(i))) & 0x7fffffffffffffffn;
    }
    return hash;
}
function safeExternalId(raw) {
    if (raw && typeof raw === 'object') {
        const r = raw;
        const id = r['verse_key'] ?? r['hadithNumber'] ?? r['id'];
        return typeof id === 'string' || typeof id === 'number' ? String(id) : 'unknown';
    }
    return 'unknown';
}
//# sourceMappingURL=content-sync.service.js.map