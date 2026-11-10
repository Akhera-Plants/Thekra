export declare function isWeakMatch(bestScore: number | null): boolean;
export interface GradeGroupRow {
    id: string;
    normalizedMatn: string;
    grade: string | null;
}
export declare function duplicateDifferentGrade(rows: readonly GradeGroupRow[]): string[];
export declare function quranMismatch(text: string, keys: readonly string[], canon: ReadonlyMap<string, string>): string[];
export interface OcrSignal {
    suspect: boolean;
    arabicRatio: number;
    latin: boolean;
    brokenWords: number;
}
export declare function ocrSuspect(text: string, textSource: string): OcrSignal;
export declare function referenceMismatch(similarity: number | null): boolean;
