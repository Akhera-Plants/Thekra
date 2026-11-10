import { ContentSyncService } from './content-sync.service.js';
import { SyncLogService } from './sync-log.service.js';
import { TriggerSyncDto } from './dto/trigger-sync.dto.js';
import { SyncLogsQueryDto } from './dto/sync-logs-query.dto.js';
export declare class ContentSyncAdminController {
    private readonly contentSyncService;
    private readonly syncLogService;
    constructor(contentSyncService: ContentSyncService, syncLogService: SyncLogService);
    triggerRun(dto: TriggerSyncDto): Promise<{
        data: {
            syncLogId: string;
            sourceId: string;
            status: string;
            startedAt: Date;
        };
    }>;
    listRuns(query: SyncLogsQueryDto): Promise<{
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
    getRun(id: string): Promise<{
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
        };
    }>;
}
