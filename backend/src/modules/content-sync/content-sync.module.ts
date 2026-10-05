/**
 * content-sync.module.ts
 *
 * Wires together:
 *   - All four ContentProvider implementations
 *   - ContentSyncService (executor)
 *   - SyncLogService (bookkeeping)
 *   - ContentSyncScheduler (cron, only active when SYNC_ENABLED=true)
 *   - ContentSyncAdminController (#58–#60)
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ContentSyncService } from './content-sync.service.js';
import { ContentSyncScheduler } from './content-sync.scheduler.js';
import { ContentSyncAdminController } from './content-sync.admin.controller.js';
import { SyncLogService } from './sync-log.service.js';
import { QuranComProvider } from './providers/quran-com.provider.js';
import { AlQuranCloudProvider } from './providers/al-quran-cloud.provider.js';
import { SunnahProvider } from './providers/sunnah.provider.js';
import { HadithApiProvider } from './providers/hadith-api.provider.js';
import { CONTENT_PROVIDERS_TOKEN } from './providers/content-provider.interface.js';

@Module({
  imports: [
    // HttpModule for outbound HTTP from providers
    HttpModule.register({ timeout: 15_000, maxRedirects: 3 }),
    // ScheduleModule must be imported here (and in AppModule's forRoot call)
    // We do NOT import ScheduleModule.forRoot() here — it must be registered
    // once at the AppModule level. The scheduler uses SchedulerRegistry instead.
  ],
  controllers: [ContentSyncAdminController],
  providers: [
    // Individual providers
    QuranComProvider,
    AlQuranCloudProvider,
    SunnahProvider,
    HadithApiProvider,

    // Registry — injected via CONTENT_PROVIDERS_TOKEN
    {
      provide: CONTENT_PROVIDERS_TOKEN,
      useFactory: (
        quranCom: QuranComProvider,
        alQuranCloud: AlQuranCloudProvider,
        sunnah: SunnahProvider,
        hadithApi: HadithApiProvider,
      ) => [quranCom, alQuranCloud, sunnah, hadithApi],
      inject: [QuranComProvider, AlQuranCloudProvider, SunnahProvider, HadithApiProvider],
    },

    SyncLogService,
    ContentSyncService,
    ContentSyncScheduler,
  ],
  exports: [ContentSyncService, SyncLogService],
})
export class ContentSyncModule {}
