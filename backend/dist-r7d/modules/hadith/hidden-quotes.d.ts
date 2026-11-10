export type HiddenQuoteDecision = 'SHOW' | 'HIDE' | null;
export interface HiddenQuoteRow {
    id: string;
    reason: string;
    decision: HiddenQuoteDecision;
}
export declare function parseHiddenQuotes(text: string): HiddenQuoteRow[];
export declare function hiddenQuoteIds(): readonly string[];
export declare function isHiddenQuote(id: string): boolean;
