import { describe, it, expect } from 'vitest';
import { QuoteType, HadithGrade, TagCategory, SourceType } from '@/lib/types/enums';

describe('Enum smoke tests', () => {
  it('exports all QuoteType values', () => {
    expect(QuoteType.QURAN_VERSE).toBe('QURAN_VERSE');
    expect(QuoteType.HADITH).toBe('HADITH');
    expect(QuoteType.SCHOLAR_QUOTE).toBe('SCHOLAR_QUOTE');
    expect(QuoteType.BOOK_EXCERPT).toBe('BOOK_EXCERPT');
  });

  it('exports all HadithGrade values', () => {
    expect(HadithGrade.SAHIH).toBe('SAHIH');
    expect(HadithGrade.HASAN).toBe('HASAN');
    expect(HadithGrade.DAIF).toBe('DAIF');
    expect(HadithGrade.MAWDU).toBe('MAWDU');
    expect(HadithGrade.UNGRADED).toBe('UNGRADED');
  });

  it('exports TagCategory values', () => {
    expect(TagCategory.EMOTION).toBe('EMOTION');
    expect(TagCategory.SIN).toBe('SIN');
    expect(TagCategory.GOOD_DEED).toBe('GOOD_DEED');
  });

  it('exports SourceType values', () => {
    expect(SourceType.QURAN).toBe('QURAN');
    expect(SourceType.HADITH_COLLECTION).toBe('HADITH_COLLECTION');
    expect(SourceType.BOOK).toBe('BOOK');
  });
});
