export type TextReviewDecision = 'COMPLETE' | 'FRAGMENT' | null;
export interface TextReviewRow {
    id: string;
    decision: TextReviewDecision;
}
export declare function parseTextReview(text: string): TextReviewRow[];
export declare function unfeaturableTextIds(): readonly string[];
