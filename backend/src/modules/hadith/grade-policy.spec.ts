import { UnprocessableEntityException } from '@nestjs/common';
import { GradeSource, HadithGrade, QuoteType, TextSource } from '@prisma/client';
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

  describe('publicTextClause', () => {
    it('hides unverified OCR and keeps verified OCR', () => {
      expect(GradePolicy.isPublicText({ textSource: TextSource.OCR, textVerifiedAt: null })).toBe(false);
      expect(
        GradePolicy.isPublicText({ textSource: TextSource.OCR, textVerifiedAt: new Date() }),
      ).toBe(true);
      expect(GradePolicy.isPublicText({ textSource: TextSource.DIGITAL, textVerifiedAt: null })).toBe(true);
      expect(GradePolicy.isPublicText({ textSource: TextSource.MANUAL, textVerifiedAt: null })).toBe(true);
      expect(GradePolicy.publicTextClause()).toEqual({
        OR: [{ textSource: { not: TextSource.OCR } }, { textVerifiedAt: { not: null } }],
      });
    });
  });

  describe('readerClause', () => {
    it('publishes a hadith from a sahihayn match, a manual grade, or a sunan tahqiq grade, and hides an open high flag', () => {
      expect(GradePolicy.isPublishable({ type: QuoteType.HADITH, gradeSource: GradeSource.SAHIHAYN })).toBe(true);
      expect(GradePolicy.isPublishable({ type: QuoteType.HADITH, gradeSource: GradeSource.AUTO_SAHIHAYN })).toBe(true);
      expect(GradePolicy.isPublishable({ type: QuoteType.HADITH, gradeSource: GradeSource.MANUAL })).toBe(true);
      expect(GradePolicy.isPublishable({ type: QuoteType.HADITH, gradeSource: GradeSource.SUNAN_TAHQIQ })).toBe(true);
      expect(GradePolicy.isPublishable({ type: QuoteType.HADITH, gradeSource: GradeSource.HADEETHENC })).toBe(true);
      expect(GradePolicy.isPublishable({ type: QuoteType.HADITH, gradeSource: GradeSource.IBN_RAJAB })).toBe(false);
      expect(GradePolicy.isPublishable({ type: QuoteType.HADITH, gradeSource: GradeSource.AUTHORITY_LEGACY })).toBe(false);
      expect(GradePolicy.isPublishable({ type: QuoteType.QURAN_VERSE, gradeSource: GradeSource.AUTHORITY_LEGACY })).toBe(true);
      // Athar stay hidden until ATHAR_PUBLIC_ENABLED=true (audit gate).
      expect(
        GradePolicy.isPublishable({
          type: QuoteType.HADITH,
          gradeSource: GradeSource.AUTHORITY_LEGACY,
          isAthar: true,
          atharSpeakerKey: 'umar',
        }),
      ).toBe(false);
      expect(GradePolicy.readerClause()).toEqual({
        AND: [
          GradePolicy.publicTextClause(),
          GradePolicy.publishableClause(),
          { NOT: { apiProvider: 'book-structure', type: QuoteType.BOOK_EXCERPT } },
        ],
      });
    });
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
