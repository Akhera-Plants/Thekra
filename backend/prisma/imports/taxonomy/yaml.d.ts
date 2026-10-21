export type TopicSide = 'AVOID' | 'DO';
export interface Topic {
    slug: string;
    ar: string;
    en: string;
    side: TopicSide;
    domain: string;
    opposite: string | null;
    contemporary: boolean;
    hidden: boolean;
    listed: boolean;
    sideCheck: boolean;
    order: number;
    kabair: number[];
    riyadNumbers: number[];
    riyadPhrases: string[];
    branches: number[];
    targhib: string[];
    zuhd: string[];
    minhaj: string[];
    munajjid: string[];
    kw: string[];
    derivedFrom: string[];
}
export interface Domain {
    key: string;
    nameAr: string;
    order: number;
}
export interface AkhlaqLabel {
    key: string;
    ar: string;
    topics: string[];
}
export interface TopicPair {
    avoid: string;
    do: string;
    ar: string | null;
}
export interface TaxonomyFile {
    domains: Domain[];
    topics: Topic[];
    akhlaq: AkhlaqLabel[];
    pairs: TopicPair[];
}
export declare function parseTaxonomy(text: string): TaxonomyFile;
export declare function loadTaxonomy(path: string): TaxonomyFile;
export declare function topicBySlug(topics: readonly Topic[]): Map<string, Topic>;
