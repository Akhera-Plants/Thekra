var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ContentSyncScheduler_1;
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ContentSyncService } from './content-sync.service.js';
const CRON_QURAN = 'quran-full-sync';
const CRON_HADITH = 'hadith-incremental';
let ContentSyncScheduler = ContentSyncScheduler_1 = class ContentSyncScheduler {
    config;
    schedulerRegistry;
    prisma;
    contentSyncService;
    logger = new Logger(ContentSyncScheduler_1.name);
    constructor(config, schedulerRegistry, prisma, contentSyncService) {
        this.config = config;
        this.schedulerRegistry = schedulerRegistry;
        this.prisma = prisma;
        this.contentSyncService = contentSyncService;
    }
    onModuleInit() {
        const enabled = this.config.get('SYNC_ENABLED');
        if (enabled !== 'true') {
            for (const name of [CRON_QURAN, CRON_HADITH]) {
                try {
                    this.schedulerRegistry.deleteCronJob(name);
                }
                catch {
                }
            }
            this.logger.log('SYNC_ENABLED is not "true" — scheduled sync jobs are disabled. ' +
                'Use POST /v1/admin/content-sync/runs to trigger manually.');
            return;
        }
        this.logger.log('Content-sync cron jobs active (SYNC_ENABLED=true)');
    }
    async runQuranSync() {
        this.logger.log('Quran full sync triggered by cron');
        try {
            const source = await this.prisma.source.findFirst({
                where: { apiProvider: 'quran.com', isExternalApi: true },
            });
            if (!source) {
                this.logger.warn('Quran cron: no quran.com source found — skipping');
                return;
            }
            await this.contentSyncService.triggerRun({ sourceId: source.id, dryRun: false });
        }
        catch (err) {
            this.logger.error({ err }, 'Quran cron: failed to trigger run');
        }
    }
    async runHadithSync() {
        this.logger.log('Hadith incremental sync triggered by cron');
        try {
            const sunnahApiKey = this.config.get('SUNNAH_API_KEY');
            const hadithApiKey = this.config.get('HADITH_API_KEY');
            const preferredKey = sunnahApiKey ? 'sunnah.com' : hadithApiKey ? 'hadithapi.com' : null;
            if (!preferredKey) {
                this.logger.warn('Hadith cron: no Hadith API key configured — skipping');
                return;
            }
            const source = await this.prisma.source.findFirst({
                where: { apiProvider: preferredKey, isExternalApi: true },
            });
            if (!source) {
                this.logger.warn(`Hadith cron: no ${preferredKey} source found — skipping`);
                return;
            }
            await this.contentSyncService.triggerRun({ sourceId: source.id, dryRun: false });
        }
        catch (err) {
            this.logger.error({ err }, 'Hadith cron: failed to trigger run');
        }
    }
};
__decorate([
    Cron('0 3 * * 0', { name: CRON_QURAN, timeZone: 'UTC' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ContentSyncScheduler.prototype, "runQuranSync", null);
__decorate([
    Cron('0 4 * * *', { name: CRON_HADITH, timeZone: 'UTC' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ContentSyncScheduler.prototype, "runHadithSync", null);
ContentSyncScheduler = ContentSyncScheduler_1 = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [ConfigService,
        SchedulerRegistry,
        PrismaService,
        ContentSyncService])
], ContentSyncScheduler);
export { ContentSyncScheduler };
//# sourceMappingURL=content-sync.scheduler.js.map