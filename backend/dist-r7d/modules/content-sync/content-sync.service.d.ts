import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SyncLogService } from './sync-log.service.js';
import { type ContentProvider, type MappedQuote } from './providers/content-provider.interface.js';
import type { TriggerSyncDto } from './dto/trigger-sync.dto.js';
export declare class ContentSyncService {
    private readonly prisma;
    private readonly syncLogService;
    private readonly config;
    private readonly providers;
    private readonly logger;
    constructor(prisma: PrismaService, syncLogService: SyncLogService, config: ConfigService, providers: ContentProvider[]);
    triggerRun(dto: TriggerSyncDto): Promise<{
        syncLogId: string;
        sourceId: string;
        status: string;
        startedAt: Date;
    }>;
    executeRun(syncLogId: string, sourceId: string, provider: ContentProvider, dto: TriggerSyncDto, sleepFn?: (ms: number) => Promise<void>): Promise<void>;
    upsertRecord(mapped: MappedQuote, providerKey: string): Promise<'created' | 'updated'>;
    private resolveProvider;
    getProvider(key: string): ContentProvider | undefined;
}
