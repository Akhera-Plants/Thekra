export interface PrintedReference {
    referenceNumber: number | null;
    referenceLabel: string | null;
}
export declare function parsePrintedReference(value: string | null | undefined): PrintedReference;
export declare function utcDayNumber(date: Date): number;
export declare function formatPrintedReference(input: {
    locale: 'ar' | 'en';
    workAr: string | null;
    workEn: string;
    referenceNumber: number | null;
    referenceLabel: string | null;
}): string | null;
