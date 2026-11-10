export declare const STRONG_MATCH_SCORE = 0.75;
export declare const WEAK_MATCH_SCORE = 0.48;
export declare const CANDIDATE_FLOOR = 0.3;
export declare const MATCH_METHOD = "trgm+overlap";
export declare function wordOverlap(left: string, right: string): number;
export declare function combinedScore(trgm: number, overlap: number): number;
