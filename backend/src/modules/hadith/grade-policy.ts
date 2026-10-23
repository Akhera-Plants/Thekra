import {
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FlagSeverity,
  FlagStatus,
  GradeSource,
  HadithGrade,
  Prisma,
  QuoteType,
  TextSource,
} from '@prisma/client';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export const DEFAULT_ALLOWED_GRADES: HadithGrade[] = [
  HadithGrade.SAHIH,
  HadithGrade.HASAN,
];

export const WEAK_OPT_IN_GRADES: HadithGrade[] = [
  HadithGrade.DAIF,
  HadithGrade.UNGRADED,
];

export const NEVER_SERVE: HadithGrade[] = [HadithGrade.MAWDU];

/** Shu'ayb al-Arna'ut's tahqiq: the Sunan, Musnad Ahmad, and Sahih Ibn Hibban. Never a Sahihayn grade. */
export const ARNAUT_GRADE_SOURCES: readonly GradeSource[] = [
  GradeSource.SUNAN_TAHQIQ,
  GradeSource.AHMAD_TAHQIQ,
  GradeSource.IBN_HIBBAN_TAHQIQ,
];

export function isArnautGradeSource(source: GradeSource): boolean {
  return ARNAUT_GRADE_SOURCES.includes(source);
}

/** Hadith grade sources a public route may serve. AUTHORITY_LEGACY and IBN_RAJAB stay stored and hidden. */
export const PUBLISHABLE_GRADE_SOURCES: readonly GradeSource[] = [
  GradeSource.SAHIHAYN,
  GradeSource.AUTO_SAHIHAYN,
  GradeSource.MANUAL,
  ...ARNAUT_GRADE_SOURCES,
  GradeSource.HADEETHENC,
];

/**
 * Listed athar stay off the public site until the classifier audit passes
 * (docs/build/CURSOR / SHUAB_ATHAR_REPORT «Athar audit»). Data + ReminderReader
 * UI remain; flip to true only after the precision check.
 */
export const ATHAR_PUBLIC_ENABLED = process.env['ATHAR_PUBLIC_ENABLED'] === 'true';

/**
 * Public athar: the section flag, a listed speaker, and an explicit keep.
 * A missing decision stays hidden.
 */
export function atharMayPublish(
  row: {
    isAthar?: boolean;
    atharSpeakerKey?: string | null;
    atharReviewDecision?: 'KEEP' | 'DROP' | null;
  },
  enabled = ATHAR_PUBLIC_ENABLED,
): boolean {
  return enabled && row.isAthar === true && !!row.atharSpeakerKey && row.atharReviewDecision === 'KEEP';
}

export class GradePolicy {
  static defaultAllowedGrades(): HadithGrade[] {
    return [...DEFAULT_ALLOWED_GRADES];
  }

  static resolveAllowedGrades(options: {
    grades?: HadithGrade[];
    includeWeak?: boolean;
  }): HadithGrade[] {
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

  static assertRenderable(grade: HadithGrade | null | undefined): void {
    if (grade === HadithGrade.MAWDU) {
      throw new UnprocessableEntityException({
        code: 'GRADE_NOT_PERMITTED',
        message: 'Fabricated (MAWDU) narrations are never served',
      });
    }
  }

  static assertRenderableList(grades: HadithGrade[]): void {
    if (grades.includes(HadithGrade.MAWDU)) {
      throw new UnprocessableEntityException({
        code: 'GRADE_NOT_PERMITTED',
        message: 'Fabricated (MAWDU) narrations are never served',
      });
    }
  }

  /**
   * Unverified OCR is not public, including when includeWeak is set.
   * Kept off whereClause so an admin grade filter does not hide OCR rows.
   */
  static publicTextClause(): Prisma.QuoteWhereInput {
    return {
      OR: [
        { textSource: { not: TextSource.OCR } },
        { textVerifiedAt: { not: null } },
      ],
    };
  }

  static isPublicText(row: { textSource: TextSource; textVerifiedAt: Date | null }): boolean {
    return row.textSource !== TextSource.OCR || row.textVerifiedAt !== null;
  }

  /**
   * A hadith is publishable from a sahihayn match, a manual grade, a sunan
   * tahqiq grade (Arna'ut, sahih or hasan), or HadeethEnc (صحيح / حسن).
   * Ibn Rajab is selection only — never a grade.
   * An athar answers to the athar rule alone (section flag, listed speaker, KEEP),
   * whatever its grade source or type: a sahihayn or HadeethEnc grade does not publish it.
   * An open high-severity flag hides every quote type. OUTSIDE_SAHIHAYN is low and does not hide.
   */
  static publishableClause(athar = ATHAR_PUBLIC_ENABLED): Prisma.QuoteWhereInput {
    const publishableOr: Prisma.QuoteWhereInput[] = [
      {
        isAthar: false,
        OR: [
          { type: { not: QuoteType.HADITH } },
          { gradeSource: { in: [...PUBLISHABLE_GRADE_SOURCES] } },
        ],
      },
    ];
    if (athar) {
      // Listed, and the reviewer wrote keep. A blank decision stays hidden.
      publishableOr.push({
        isAthar: true,
        atharSpeakerKey: { not: null },
        atharReviewDecision: 'KEEP',
      });
    }
    return {
      AND: [
        { OR: publishableOr },
        { flags: { none: { status: FlagStatus.OPEN, severity: FlagSeverity.HIGH } } },
      ],
    };
  }

  static readerClause(): Prisma.QuoteWhereInput {
    return {
      AND: [
        this.publicTextClause(),
        this.publishableClause(),
        // The book-structure import stores the author's commentary here. It is not a public text.
        { NOT: { apiProvider: 'book-structure', type: QuoteType.BOOK_EXCERPT } },
      ],
    };
  }

  /** Row form of publishableClause (without the flag check). Callers must select the athar fields. */
  static isPublishable(
    row: {
      type: QuoteType;
      gradeSource: GradeSource;
      isAthar: boolean;
      atharSpeakerKey: string | null;
      atharReviewDecision: 'KEEP' | 'DROP' | null;
    },
    athar = ATHAR_PUBLIC_ENABLED,
  ): boolean {
    if (row.isAthar) return atharMayPublish(row, athar);
    if (row.type !== QuoteType.HADITH) return true;
    return PUBLISHABLE_GRADE_SOURCES.includes(row.gradeSource);
  }

  static whereClause(allowed: HadithGrade[], athar = ATHAR_PUBLIC_ENABLED): Prisma.QuoteWhereInput {
    return {
      OR: [
        { type: { not: QuoteType.HADITH } },
        { grade: { in: allowed } },
        ...(allowed.includes(HadithGrade.UNGRADED)
          ? [{ type: QuoteType.HADITH, grade: null }]
          : []),
        // A kept athar carries no hadith grade; it is labelled «أثر، وليس حديثًا» instead.
        ...(athar
          ? [{ isAthar: true, atharSpeakerKey: { not: null }, atharReviewDecision: 'KEEP' as const }]
          : []),
      ],
    };
  }

  static isAllowed(
    grade: HadithGrade | null | undefined,
    allowed: HadithGrade[],
  ): boolean {
    if (grade === HadithGrade.MAWDU) {
      return false;
    }
    if (grade == null) {
      return true;
    }
    return allowed.includes(grade);
  }
}

export function NotMawdu(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'notMawdu',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value == null) return true;
          const grades = Array.isArray(value) ? value : [value];
          return !grades.includes(HadithGrade.MAWDU);
        },
        defaultMessage(_args: ValidationArguments) {
          return 'MAWDU grade is not permitted';
        },
      },
    });
  };
}
