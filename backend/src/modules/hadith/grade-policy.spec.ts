import { UnprocessableEntityException } from '@nestjs/common';
import { GradeSource, HadithGrade, QuoteType, TextSource } from '@prisma/client';
import {
  DEFAULT_ALLOWED_GRADES,
  GradePolicy,
  PUBLISHABLE_GRADE_SOURCES,
  atharMayPublish,
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
      const hadith = { type: QuoteType.HADITH, isAthar: false, atharSpeakerKey: null, atharReviewDecision: null };
      expect(GradePolicy.isPublishable({ ...hadith, gradeSource: GradeSource.SAHIHAYN })).toBe(true);
      expect(GradePolicy.isPublishable({ ...hadith, gradeSource: GradeSource.AUTO_SAHIHAYN })).toBe(true);
      expect(GradePolicy.isPublishable({ ...hadith, gradeSource: GradeSource.MANUAL })).toBe(true);
      expect(GradePolicy.isPublishable({ ...hadith, gradeSource: GradeSource.SUNAN_TAHQIQ })).toBe(true);
      expect(GradePolicy.isPublishable({ ...hadith, gradeSource: GradeSource.HADEETHENC })).toBe(true);
      expect(GradePolicy.isPublishable({ ...hadith, gradeSource: GradeSource.IBN_RAJAB })).toBe(false);
      expect(GradePolicy.isPublishable({ ...hadith, gradeSource: GradeSource.AUTHORITY_LEGACY })).toBe(false);
      expect(
        GradePolicy.isPublishable({ ...hadith, type: QuoteType.QURAN_VERSE, gradeSource: GradeSource.AUTHORITY_LEGACY }),
      ).toBe(true);
      // Athar stay hidden until ATHAR_PUBLIC_ENABLED=true (audit gate).
      expect(
        GradePolicy.isPublishable(
          {
            type: QuoteType.HADITH,
            gradeSource: GradeSource.AUTHORITY_LEGACY,
            isAthar: true,
            atharSpeakerKey: 'umar',
            atharReviewDecision: 'KEEP',
          },
          false,
        ),
      ).toBe(false);
      expect(GradePolicy.readerClause()).toEqual({
        AND: [
          GradePolicy.publicTextClause(),
          GradePolicy.publishableClause(),
          { NOT: { apiProvider: 'book-structure', type: QuoteType.BOOK_EXCERPT } },
        ],
      });
    });

    it('holds an athar to the athar rule whatever its grade source or type', () => {
      const athar = { type: QuoteType.HADITH, isAthar: true as const };
      // A publishable grade source does not publish an athar the reviewer dropped or never decided.
      for (const gradeSource of [GradeSource.AUTO_SAHIHAYN, GradeSource.SUNAN_TAHQIQ, GradeSource.HADEETHENC]) {
        expect(GradePolicy.isPublishable({ ...athar, gradeSource, atharSpeakerKey: 'aisha', atharReviewDecision: 'DROP' }, true)).toBe(false);
        expect(GradePolicy.isPublishable({ ...athar, gradeSource, atharSpeakerKey: null, atharReviewDecision: null }, true)).toBe(false);
        expect(GradePolicy.isPublishable({ ...athar, gradeSource, atharSpeakerKey: 'aisha', atharReviewDecision: 'KEEP' }, true)).toBe(true);
        expect(GradePolicy.isPublishable({ ...athar, gradeSource, atharSpeakerKey: 'aisha', atharReviewDecision: 'KEEP' }, false)).toBe(false);
      }
      // An athar stored as a book excerpt answers to the same rule.
      expect(
        GradePolicy.isPublishable(
          { type: QuoteType.BOOK_EXCERPT, gradeSource: GradeSource.AUTHORITY_LEGACY, isAthar: true, atharSpeakerKey: null, atharReviewDecision: null },
          true,
        ),
      ).toBe(false);
    });

    it('builds the publish clause so a graded athar still needs a kept, listed speaker', () => {
      const flagged = { flags: { none: { status: 'OPEN', severity: 'HIGH' } } };
      const nonAthar = {
        isAthar: false,
        OR: [
          { type: { not: QuoteType.HADITH } },
          { gradeSource: { in: [...PUBLISHABLE_GRADE_SOURCES] } },
        ],
      };
      const kept = { isAthar: true, atharSpeakerKey: { not: null }, atharReviewDecision: 'KEEP' };
      expect(GradePolicy.publishableClause(true)).toEqual({ AND: [{ OR: [nonAthar, kept] }, flagged] });
      expect(GradePolicy.publishableClause(false)).toEqual({ AND: [{ OR: [nonAthar] }, flagged] });
    });

    it('publishes a listed athar only when the reviewer kept it and the flag is on', () => {
      const listed = { isAthar: true, atharSpeakerKey: 'umar' as const };
      expect(atharMayPublish({ ...listed, atharReviewDecision: 'KEEP' }, true)).toBe(true);
      expect(atharMayPublish({ ...listed, atharReviewDecision: null }, true)).toBe(false);
      expect(atharMayPublish({ ...listed, atharReviewDecision: 'DROP' }, true)).toBe(false);
      expect(atharMayPublish({ ...listed, atharReviewDecision: 'KEEP' }, false)).toBe(false);
      expect(atharMayPublish({ isAthar: true, atharReviewDecision: 'KEEP' }, true)).toBe(false);
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

    it('admits a kept, listed athar (no hadith grade) only when the athar section is on', () => {
      const allowed = [HadithGrade.SAHIH, HadithGrade.HASAN];
      const kept = { isAthar: true, atharSpeakerKey: { not: null }, atharReviewDecision: 'KEEP' };
      expect(GradePolicy.whereClause(allowed, true).OR).toContainEqual(kept);
      expect(GradePolicy.whereClause(allowed, false).OR).not.toContainEqual(kept);
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
