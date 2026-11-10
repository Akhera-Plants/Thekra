import { UnprocessableEntityException, } from '@nestjs/common';
import { FlagSeverity, FlagStatus, GradeSource, HadithGrade, QuoteType, TextSource, } from '@prisma/client';
import { registerDecorator, } from 'class-validator';
import { hiddenQuoteIds, isHiddenQuote } from './hidden-quotes.js';
export const DEFAULT_ALLOWED_GRADES = [
    HadithGrade.SAHIH,
    HadithGrade.HASAN,
];
export const WEAK_OPT_IN_GRADES = [
    HadithGrade.DAIF,
    HadithGrade.UNGRADED,
];
export const NEVER_SERVE = [HadithGrade.MAWDU];
export const ARNAUT_GRADE_SOURCES = [
    GradeSource.SUNAN_TAHQIQ,
    GradeSource.AHMAD_TAHQIQ,
    GradeSource.IBN_HIBBAN_TAHQIQ,
];
export function isArnautGradeSource(source) {
    return ARNAUT_GRADE_SOURCES.includes(source);
}
export const PUBLISHABLE_GRADE_SOURCES = [
    GradeSource.SAHIHAYN,
    GradeSource.AUTO_SAHIHAYN,
    GradeSource.MANUAL,
    ...ARNAUT_GRADE_SOURCES,
    GradeSource.HADEETHENC,
];
export const ATHAR_PUBLIC_ENABLED = process.env['ATHAR_PUBLIC_ENABLED'] === 'true';
export function atharMayPublish(row, enabled = ATHAR_PUBLIC_ENABLED) {
    return enabled && row.isAthar === true && !!row.atharSpeakerKey && row.atharReviewDecision === 'KEEP';
}
export class GradePolicy {
    static defaultAllowedGrades() {
        return [...DEFAULT_ALLOWED_GRADES];
    }
    static resolveAllowedGrades(options) {
        if (options.grades?.length) {
            this.assertRenderableList(options.grades);
            return [...options.grades];
        }
        const allowed = this.defaultAllowedGrades();
        if (options.includeWeak) {
            allowed.push(...WEAK_OPT_IN_GRADES);
        }
        return allowed;
    }
    static assertRenderable(grade) {
        if (grade === HadithGrade.MAWDU) {
            throw new UnprocessableEntityException({
                code: 'GRADE_NOT_PERMITTED',
                message: 'Fabricated (MAWDU) narrations are never served',
            });
        }
    }
    static assertRenderableList(grades) {
        if (grades.includes(HadithGrade.MAWDU)) {
            throw new UnprocessableEntityException({
                code: 'GRADE_NOT_PERMITTED',
                message: 'Fabricated (MAWDU) narrations are never served',
            });
        }
    }
    static publicTextClause() {
        return {
            OR: [
                { textSource: { not: TextSource.OCR } },
                { textVerifiedAt: { not: null } },
            ],
        };
    }
    static isPublicText(row) {
        return row.textSource !== TextSource.OCR || row.textVerifiedAt !== null;
    }
    static publishableClause(athar = ATHAR_PUBLIC_ENABLED) {
        const publishableOr = [
            {
                isAthar: false,
                OR: [
                    { type: { not: QuoteType.HADITH } },
                    { gradeSource: { in: [...PUBLISHABLE_GRADE_SOURCES] } },
                ],
            },
        ];
        if (athar) {
            publishableOr.push({
                isAthar: true,
                atharSpeakerKey: { not: null },
                atharReviewDecision: 'KEEP',
            });
        }
        const hidden = hiddenQuoteIds();
        return {
            AND: [
                { OR: publishableOr },
                { flags: { none: { status: FlagStatus.OPEN, severity: FlagSeverity.HIGH } } },
                ...(hidden.length > 0 ? [{ id: { notIn: [...hidden] } }] : []),
            ],
        };
    }
    static readerClause() {
        return {
            AND: [
                this.publicTextClause(),
                this.publishableClause(),
                { NOT: { apiProvider: 'book-structure', type: QuoteType.BOOK_EXCERPT } },
            ],
        };
    }
    static isPublishable(row, athar = ATHAR_PUBLIC_ENABLED) {
        if (row.id !== undefined && isHiddenQuote(row.id))
            return false;
        if (row.isAthar)
            return atharMayPublish(row, athar);
        if (row.type !== QuoteType.HADITH)
            return true;
        return PUBLISHABLE_GRADE_SOURCES.includes(row.gradeSource);
    }
    static whereClause(allowed, athar = ATHAR_PUBLIC_ENABLED) {
        return {
            OR: [
                { type: { not: QuoteType.HADITH } },
                { grade: { in: allowed } },
                ...(allowed.includes(HadithGrade.UNGRADED)
                    ? [{ type: QuoteType.HADITH, grade: null }]
                    : []),
                ...(athar
                    ? [{ isAthar: true, atharSpeakerKey: { not: null }, atharReviewDecision: 'KEEP' }]
                    : []),
            ],
        };
    }
    static isAllowed(grade, allowed) {
        if (grade === HadithGrade.MAWDU) {
            return false;
        }
        if (grade == null) {
            return true;
        }
        return allowed.includes(grade);
    }
}
export function NotMawdu(validationOptions) {
    return function (object, propertyName) {
        registerDecorator({
            name: 'notMawdu',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value) {
                    if (value == null)
                        return true;
                    const grades = Array.isArray(value) ? value : [value];
                    return !grades.includes(HadithGrade.MAWDU);
                },
                defaultMessage(_args) {
                    return 'MAWDU grade is not permitted';
                },
            },
        });
    };
}
//# sourceMappingURL=grade-policy.js.map