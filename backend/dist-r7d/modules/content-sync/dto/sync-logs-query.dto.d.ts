import { SyncStatus } from '@prisma/client';
export declare class SyncLogsQueryDto {
    sourceId?: string;
    status?: SyncStatus;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}
