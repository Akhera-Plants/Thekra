export declare class SyncScopeDto {
    surahFrom?: number;
    surahTo?: number;
    collection?: string;
    bookFrom?: number;
    bookTo?: number;
}
export declare class TriggerSyncDto {
    sourceId: string;
    scope?: SyncScopeDto;
    dryRun?: boolean;
    force?: boolean;
}
