export interface ResolvedPair {
    avoid: string;
    do: string;
    titleAr: string;
    titleEn: string;
}
export type TopicSide = 'AVOID' | 'DO';
export declare function resetTopicPairsCache(): void;
export declare function pairForSlug(slug: string): ResolvedPair | null;
export declare function allTopicPairs(): readonly ResolvedPair[];
export declare function isPairedSlug(slug: string): boolean;
export declare function topicSide(slug: string): TopicSide | null;
export declare function topicBranches(slug: string): readonly number[];
export declare function topicNames(slug: string): {
    ar: string;
    en: string;
} | null;
