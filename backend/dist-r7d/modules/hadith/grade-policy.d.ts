import { GradeSource, HadithGrade, Prisma, QuoteType, TextSource } from '@prisma/client';
import { type ValidationOptions } from 'class-validator';
export declare const DEFAULT_ALLOWED_GRADES: HadithGrade[];
export declare const WEAK_OPT_IN_GRADES: HadithGrade[];
export declare const NEVER_SERVE: HadithGrade[];
export declare const ARNAUT_GRADE_SOURCES: readonly GradeSource[];
export declare function isArnautGradeSource(source: GradeSource): boolean;
export declare const PUBLISHABLE_GRADE_SOURCES: readonly GradeSource[];
export declare const ATHAR_PUBLIC_ENABLED: boolean;
export declare function atharMayPublish(row: {
    isAthar?: boolean;
    atharSpeakerKey?: string | null;
    atharReviewDecision?: 'KEEP' | 'DROP' | null;
}, enabled?: boolean): boolean;
export declare class GradePolicy {
    static defaultAllowedGrades(): HadithGrade[];
    static resolveAllowedGrades(options: {
        grades?: HadithGrade[];
        includeWeak?: boolean;
    }): HadithGrade[];
    static assertRenderable(grade: HadithGrade | null | undefined): void;
    static assertRenderableList(grades: HadithGrade[]): void;
    static publicTextClause(): Prisma.QuoteWhereInput;
    static isPublicText(row: {
        textSource: TextSource;
        textVerifiedAt: Date | null;
    }): boolean;
    static publishableClause(athar?: boolean): Prisma.QuoteWhereInput;
    static readerClause(): Prisma.QuoteWhereInput;
    static isPublishable(row: {
        id?: string;
        type: QuoteType;
        gradeSource: GradeSource;
        isAthar: boolean;
        atharSpeakerKey: string | null;
        atharReviewDecision: 'KEEP' | 'DROP' | null;
    }, athar?: boolean): boolean;
    static whereClause(allowed: HadithGrade[], athar?: boolean): Prisma.QuoteWhereInput;
    static isAllowed(grade: HadithGrade | null | undefined, allowed: HadithGrade[]): boolean;
}
export declare function NotMawdu(validationOptions?: ValidationOptions): (object: object, propertyName: string) => void;
