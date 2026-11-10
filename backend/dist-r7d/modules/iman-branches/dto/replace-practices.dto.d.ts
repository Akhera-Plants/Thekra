declare class BranchGoodDeedItemDto {
    goodDeedId: string;
    sortOrder?: number;
    note?: string;
}
declare class BranchSinItemDto {
    sinId: string;
    sortOrder?: number;
    note?: string;
}
export declare class ReplaceBranchPracticesDto {
    goodDeeds: BranchGoodDeedItemDto[];
    sins: BranchSinItemDto[];
}
export {};
