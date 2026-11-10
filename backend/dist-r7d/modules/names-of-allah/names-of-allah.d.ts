export type NameLinkKind = 'deed' | 'sin' | 'action';
export declare const NAME_ACTIONS: readonly ["leave-sin"];
export type NameAction = (typeof NAME_ACTIONS)[number];
export interface NameLink {
    kind: NameLinkKind;
    slug: string;
}
export interface NameOfAllah {
    number: number;
    slug: string;
    nameAr: string;
    ref: string;
    surah: number;
    ayah: number;
    quoteId: string;
    meaningAr: string;
    meaningEn: string;
    links: NameLink[];
    bare: boolean;
}
export interface NamesOfAllahFile {
    review: string;
    names: NameOfAllah[];
}
export declare function buildNamesOfAllah(source: string): NamesOfAllahFile;
export declare function namesOfAllah(): NamesOfAllahFile;
export declare function nameOfAllahBySlug(slug: string): NameOfAllah | null;
export declare function nameWordPattern(name: Pick<NameOfAllah, 'nameAr' | 'bare'>): string;
