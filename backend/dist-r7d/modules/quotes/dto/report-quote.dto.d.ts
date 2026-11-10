export declare const REPORT_REASONS: readonly ["TEXT", "ISNAD", "GRADE", "CLASSIFICATION", "OTHER"];
export type ReportReason = (typeof REPORT_REASONS)[number];
export declare class ReportQuoteDto {
    reason: ReportReason;
    note?: string;
}
