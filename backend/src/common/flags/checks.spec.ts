import { describe, expect, it } from 'vitest';
import {
  duplicateDifferentGrade,
  isWeakMatch,
  ocrSuspect,
  quranMismatch,
  referenceMismatch,
} from './checks.js';

describe('flag checks', () => {
  it('marks only the ambiguous band as a weak match', () => {
    expect(isWeakMatch(null)).toBe(false);
    expect(isWeakMatch(0.2)).toBe(false);
    expect(isWeakMatch(0.55)).toBe(true);
    expect(isWeakMatch(0.9)).toBe(false);
  });

  it('groups one matn that carries two grades', () => {
    const ids = duplicateDifferentGrade([
      { id: 'a', normalizedMatn: 'من كان يومن بالله واليوم الاخر فليقل خيرا او ليصمت', grade: 'SAHIH' },
      { id: 'b', normalizedMatn: 'من كان يومن بالله واليوم الاخر فليقل خيرا او ليصمت', grade: 'HASAN' },
      { id: 'c', normalizedMatn: 'من كان يومن بالله واليوم الاخر فليقل خيرا او ليصمت', grade: 'SAHIH' },
      { id: 'd', normalizedMatn: 'متن قصير', grade: 'DAIF' },
      { id: 'e', normalizedMatn: 'متن آخر طويل يكفي للتجميع ولا يختلف في الحكم عن اخيه', grade: 'UNGRADED' },
      { id: 'f', normalizedMatn: 'متن آخر طويل يكفي للتجميع ولا يختلف في الحكم عن اخيه', grade: null },
    ]);
    expect(ids.sort()).toEqual(['a', 'b', 'c']);
  });

  it('flags a Quranic span that is not the canonical wording', () => {
    const canon = new Map([['2:255', 'الله لا اله الا هو الحي القيوم لا تاخذه سنه ولا نوم']]);
    expect(quranMismatch('قال الله الله لا اله الا هو الحي القيوم لا تاخذه سنه ولا نوم', ['2:255'], canon)).toEqual([]);
    expect(quranMismatch('قال الله لا اله الا هو الحي القيوم وهو يرزق', ['2:255'], canon)).toEqual(['2:255']);
    expect(quranMismatch('لا شيء', ['9:9'], canon)).toEqual([]);
  });

  it('flags noisy OCR and leaves a clean digital text alone', () => {
    expect(ocrSuspect('إنما الأعمال بالنيات وإنما لكل امرئ ما نوى', 'OCR').suspect).toBe(false);
    expect(ocrSuspect('إنما الأعمال Page 12 بالنيات OCR', 'OCR').suspect).toBe(true);
    expect(ocrSuspect('text with latin only', 'DIGITAL').suspect).toBe(false);
    const broken = 'ا ل م ا ع م ا ل ب ا ل ن ي ا ت و ا ن م ا ل ك ل ا م ر ئ';
    expect(ocrSuspect(broken, 'OCR').suspect).toBe(true);
  });

  it('flags a reference whose text does not match', () => {
    expect(referenceMismatch(null)).toBe(false);
    expect(referenceMismatch(0.2)).toBe(true);
    expect(referenceMismatch(0.8)).toBe(false);
  });
});
