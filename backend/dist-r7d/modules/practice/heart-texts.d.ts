export interface HeartTexts {
    review: string;
    mizan: Record<string, string[]>;
    stories: Record<string, string | null>;
    mujahada: MujahadaTexts;
}
export interface MujahadaTexts {
    verses: string[][];
    sayings: string[];
    multiplierHadith: string | null;
    sittingPrayerHadith: string | null;
    easyHighReward: string[];
}
export declare const MIZAN_MAX = 2;
export declare const MUJAHADA_VERSES_MAX = 15;
export declare const MUJAHADA_PASSAGE_MAX = 3;
export declare const MUJAHADA_SAYINGS_MAX = 10;
export declare const EASY_HIGH_REWARD_MAX = 10;
export declare const BRANCH_MAX = 77;
export declare function isMizanKey(key: string): boolean;
export declare function buildHeartTexts(text: string): HeartTexts;
export declare function heartTexts(): HeartTexts;
export declare function mizanIdsFor(topic: string | number): string[];
