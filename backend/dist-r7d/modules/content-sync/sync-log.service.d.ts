import { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncStatus } from '@prisma/client';
import type { SyncLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
export declare class SyncLogService implements OnApplicationBootstrap {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    private get staleAfterMinutes();
    constructor(prisma: PrismaService, config: ConfigService);
    onApplicationBootstrap(): Promise<void>;
    reconcileStaleRuns(): Promise<number>;
    findActiveRun(sourceId: string): Promise<SyncLog | null>;
    create(sourceId: string): Promise<SyncLog>;
    markRunning(id: string): Promise<SyncLog>;
    markSuccess(id: string, stats: {
        recordsImported: number;
        created: number;
        updated: number;
        skipped: number;
        failed: number;
        unmappedGrades: string[];
    }): Promise<SyncLog>;
    markFailed(id: string, errorMessage: string, recordsImported?: number): Promise<SyncLog>;
    incrementImported(id: string, delta: number): Promise<void>;
    findAll(query: {
        sourceId?: string;
        status?: SyncStatus;
        from?: Date;
        to?: Date;
        page?: number;
        limit?: number;
    }): Promise<{
        data: {
            id: string;
            status: import("@prisma/client").$Enums.SyncStatus;
            startedAt: Date;
            finishedAt: Date | null;
            durationMs: number | null;
            recordsImported: number | null;
            errorMessage: string | null;
            source: {
                id: string;
                name: string;
                apiProvider: string | null;
            };
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
        };
    }>;
    findById(id: string): Promise<ReturnType<typeof mapSyncLogDto> | null>;
    private buildWhere;
}
declare function mapSyncLogDto(row: SyncLog & {
    source: {
        id: string;
        name: string;
        apiProvider: string | null;
    };
}): {
    id: string;
    status: import("@prisma/client").$Enums.SyncStatus;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    recordsImported: number | null;
    errorMessage: string | null;
    source: {
        id: string;
        name: string;
        apiProvider: string | null;
    };
};
export {};
