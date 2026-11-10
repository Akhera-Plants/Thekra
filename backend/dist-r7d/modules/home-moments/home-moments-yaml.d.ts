export type HomeMomentTopicKey = 'sin' | 'good-deed' | 'branch';
export declare const HOME_MOMENT_TOPICS: Record<HomeMomentTopicKey, 'SIN' | 'GOOD_DEED' | 'BRANCH'>;
export interface HomeMomentSeed {
    key: string;
    topicType: 'SIN' | 'GOOD_DEED' | 'BRANCH';
    topicSlug: string;
    labelAr: string;
    labelEn: string;
    situationAr: string | null;
    situationEn: string | null;
    icon: string;
    sortOrder: number;
    published: boolean;
}
export declare const MOMENT_KEY: RegExp;
export declare const MOMENT_SLUG: RegExp;
export declare const MOMENT_ICON: RegExp;
export declare const MOMENT_LABEL_MAX = 120;
export declare const MOMENT_SITUATION_MAX = 160;
export declare function buildHomeMoments(source: string): HomeMomentSeed[];
export declare function readHomeMomentsSeed(): HomeMomentSeed[];
