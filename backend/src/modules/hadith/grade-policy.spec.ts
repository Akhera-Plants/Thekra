import { UnprocessableEntityException } from '@nestjs/common';
import { HadithGrade, QuoteType } from '@prisma/client';
import {
  DEFAULT_ALLOWED_GRADES,
  GradePolicy,
} from './grade-policy.js';

describe('GradePolicy', () => {
  it('rejects MAWDU', () => {
    expect(() => GradePolicy.assertRenderable(HadithGrade.MAWDU)).toThrow(
      UnprocessableEntityException,
    );
    expect(() =>
      GradePolicy.resolveAllowedGrades({ grades: [HadithGrade.MAWDU] }),
    ).toThrow(UnprocessableEntityException);
  });

  it('allows DAIF only with includeWeak', () => {
    const defaults = GradePolicy.resolveAllowedGrades({});
    expect(defaults).toEqual(DEFAULT_ALLOWED_GRADES);
    expect(defaults).not.toContain(HadithGrade.DAIF);

    const withWeak = GradePolicy.resolveAllowedGrades({ includeWeak: true });
    expect(withWeak).toContain(HadithGrade.DAIF);
    expect(withWeak).toContain(HadithGrade.UNGRADED);
  });

  it('excludes UNGRADED by default', () => {
    expect(GradePolicy.resolveAllowedGrades({})).not.toContain(
      HadithGrade.UNGRADED,
    );
  });

  describe('whereClause', () => {
    it('passes non-HADITH quotes and filters HADITH by grade', () => {
      const allowed = [HadithGrade.SAHIH, HadithGrade.HASAN];
      expect(GradePolicy.whereClause(allowed)).toEqual({
        OR: [
          { type: { not: QuoteType.HADITH } },
          { grade: { in: allowed } },
        ],
      });
    });

    it('includes null-grade HADITH when UNGRADED is allowed', () => {
      const allowed = [
        HadithGrade.SAHIH,
        HadithGrade.HASAN,
        HadithGrade.UNGRADED,
      ];
      expect(GradePolicy.whereClause(allowed)).toEqual({
        OR: [
          { type: { not: QuoteType.HADITH } },
          { grade: { in: allowed } },
          { type: QuoteType.HADITH, grade: null },
        ],
      });
    });

    it('does not include null-grade HADITH when UNGRADED is not allowed', () => {
      const clause = GradePolicy.whereClause([
        HadithGrade.SAHIH,
        HadithGrade.HASAN,
      ]);
      const or = clause.OR as object[];
      expect(or).toHaveLength(2);
      expect(or).not.toContainEqual({
        type: QuoteType.HADITH,
        grade: null,
      });
    });
  });
});
