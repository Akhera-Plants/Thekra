import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ContentSyncService } from './content-sync.service.js';
export declare class ContentSyncScheduler implements OnModuleInit {
    private readonly config;
    private readonly schedulerRegistry;
    private readonly prisma;
    private readonly contentSyncService;
    private readonly logger;
    constructor(config: ConfigService, schedulerRegistry: SchedulerRegistry, prisma: PrismaService, contentSyncService: ContentSyncService);
    onModuleInit(): void;
    runQuranSync(): Promise<void>;
    runHadithSync(): Promise<void>;
}
