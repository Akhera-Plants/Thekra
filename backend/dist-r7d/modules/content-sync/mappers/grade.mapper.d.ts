import { HadithGrade } from '@prisma/client';
export declare function normalizeGrade(raw: string | null | undefined): {
    grade: HadithGrade;
    unmapped: boolean;
};
export declare function resolveWeakestGrade(raws: (string | null | undefined)[]): {
    grade: HadithGrade;
    unmappedStrings: string[];
};
