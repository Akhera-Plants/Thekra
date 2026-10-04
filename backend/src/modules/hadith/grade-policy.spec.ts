import { UnprocessableEntityException } from '@nestjs/common';
import { HadithGrade } from '@prisma/client';
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
});
