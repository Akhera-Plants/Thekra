export interface MatnSplit {
    isnadText: string;
    matnText: string;
}
export declare function stripFootnotes(value: string): string;
export declare function splitMatn(narration: string): MatnSplit;
export declare const CONTEXT_MAX_WORDS = 200;
export declare function contextMatn(narration: string): string;
export declare function displayMatn(narration: string): string;
export declare function joinNarration(isnadText: string, matnText: string): string;
export declare function startsWithNarratorLead(text: string): boolean;
export declare function matnForMatching(row: {
    textAr: string;
    matnAr?: string | null;
}): string;
