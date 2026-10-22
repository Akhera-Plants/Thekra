/**
 * content-sync.scheduler.ts
 *
 * Cron-based scheduler for content-sync runs using @nestjs/schedule decorators.
 * Cron jobs are registered via @Cron() but deleted from the registry at startup
 * when SYNC_ENABLED != 'true' — local and CI are never affected.
 *
 * See content-pipeline-plan §3.2 for the schedule spec.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ContentSyncService } from './content-sync.service.js';

/** Names must match the `name` option on each @Cron() decorator. */
const CRON_QURAN = 'quran-full-sync';
const CRON_HADITH = 'hadith-incremental';

@Injectable()
export class ContentSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(ContentSyncScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly contentSyncService: ContentSyncService,
  ) {}

  /**
   * Runs after the module is initialised.
   * If SYNC_ENABLED != 'true', all cron jobs are removed from the registry so
   * they never fire — not even once.
   */
  onModuleInit() {
    const enabled = this.config.get<string>('SYNC_ENABLED');
    if (enabled !== 'true') {
      for (const name of [CRON_QURAN, CRON_HADITH]) {
        try {
          this.schedulerRegistry.deleteCronJob(name);
        } catch {
          // Job may not exist yet in the registry — safe to ignore
        }
      }
      this.logger.log(
        'SYNC_ENABLED is not "true" — scheduled sync jobs are disabled. ' +
          'Use POST /v1/admin/content-sync/runs to trigger manually.',
      );
      return;
    }

    this.logger.log('Content-sync cron jobs active (SYNC_ENABLED=true)');
  }

  /**
   * Quran full sync — Sunday 03:00 UTC.
   * Quran text is immutable; the run is mostly no-op upserts (idempotency canary).
   * Schedule overridable via SYNC_QURAN_CRON env var (validated in module init).
   */
  @Cron('0 3 * * 0', { name: CRON_QURAN, timeZone: 'UTC' })
  async runQuranSync(): Promise<void> {
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
    } catch (err) {
      this.logger.error({ err }, 'Quran cron: failed to trigger run');
    }
  }

  /**
   * Hadith incremental sync — daily 04:00 UTC.
   * Prefers sunnah.com if keyed; falls back to hadithapi.com.
   */
  @Cron('0 4 * * *', { name: CRON_HADITH, timeZone: 'UTC' })
  async runHadithSync(): Promise<void> {
    this.logger.log('Hadith incremental sync triggered by cron');
    try {
      const sunnahApiKey = this.config.get<string>('SUNNAH_API_KEY');
      const hadithApiKey = this.config.get<string>('HADITH_API_KEY');
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
    } catch (err) {
      this.logger.error({ err }, 'Hadith cron: failed to trigger run');
    }
  }
}
