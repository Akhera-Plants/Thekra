import {
  UnprocessableEntityException,
} from '@nestjs/common';
import { HadithGrade, Prisma, QuoteType } from '@prisma/client';
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

  static whereClause(allowed: HadithGrade[]): Prisma.QuoteWhereInput {
    return {
      OR: [
        { type: { not: QuoteType.HADITH } },
        { grade: { in: allowed } },
        ...(allowed.includes(HadithGrade.UNGRADED)
          ? [{ type: QuoteType.HADITH, grade: null }]
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
