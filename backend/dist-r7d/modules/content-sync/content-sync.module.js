var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let ContentSyncModule = class ContentSyncModule {
};
ContentSyncModule = __decorate([
    Module({
        imports: [
            HttpModule.register({ timeout: 15_000, maxRedirects: 3 }),
        ],
        controllers: [ContentSyncAdminController],
        providers: [
            QuranComProvider,
            AlQuranCloudProvider,
            SunnahProvider,
            HadithApiProvider,
            {
                provide: CONTENT_PROVIDERS_TOKEN,
                useFactory: (quranCom, alQuranCloud, sunnah, hadithApi) => [quranCom, alQuranCloud, sunnah, hadithApi],
                inject: [QuranComProvider, AlQuranCloudProvider, SunnahProvider, HadithApiProvider],
            },
            SyncLogService,
            ContentSyncService,
            ContentSyncScheduler,
        ],
        exports: [ContentSyncService, SyncLogService],
    })
], ContentSyncModule);
export { ContentSyncModule };
//# sourceMappingURL=content-sync.module.js.map