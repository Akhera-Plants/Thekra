import { HadithGrade } from '@prisma/client';
export declare const ARNAUT_NAME = "\u0634\u0639\u064A\u0628 \u0627\u0644\u0623\u0631\u0646\u0624\u0648\u0637";
export declare const SUNAN_SCHOLAR_NAMES: {
    readonly 'Shuaib Al Arnaut': "شعيب الأرنؤوط";
};
export type SunanScholarKey = keyof typeof SUNAN_SCHOLAR_NAMES;
export declare const SUNAN_BOOK_TITLES: {
    readonly abudawud: "سنن أبي داود";
    readonly ibnmajah: "سنن ابن ماجه";
    readonly tirmidhi: "سنن الترمذي";
};
export type SunanBookKey = keyof typeof SUNAN_BOOK_TITLES;
export declare const OUTSIDE_SAHIHAYN_NOTE = "\u0644\u064A\u0633 \u0645\u0646 \u0627\u0644\u0635\u062D\u064A\u062D\u064A\u0646";
export declare function stripArabicMarks(text: string): string;
export declare function citesSahihayn(text: string): boolean;
export declare function foldGradeLabel(raw: string): string;
export declare function appropriateGrade(raw: string): HadithGrade | null;
export interface SunanHit {
    scholar: SunanScholarKey;
    book: SunanBookKey;
    number: number;
    rawGrade: string;
}
export interface SunanRuling {
    grade: HadithGrade;
    gradeAuthority: string;
    gradeReference: string;
    scholars: string[];
    references: string[];
    rawGrades: string[];
}
export declare function decideSunanRuling(hits: readonly SunanHit[]): SunanRuling | null;
