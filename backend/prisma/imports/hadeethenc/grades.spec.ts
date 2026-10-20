import { HadithGrade } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { mapHadeethencGrade, referenceLine } from './grades.js';

describe('mapHadeethencGrade', () => {
  it('maps صحيح / Authentic to publishable SAHIH', () => {
    expect(mapHadeethencGrade('صحيح')).toEqual({ grade: HadithGrade.SAHIH, publishable: true });
    expect(mapHadeethencGrade('Authentic')).toEqual({ grade: HadithGrade.SAHIH, publishable: true });
  });

  it('maps حسن / Good to publishable HASAN', () => {
    expect(mapHadeethencGrade('حسن')).toEqual({ grade: HadithGrade.HASAN, publishable: true });
    expect(mapHadeethencGrade('Good')).toEqual({ grade: HadithGrade.HASAN, publishable: true });
  });

  it('keeps weaker grades stored but not publishable via HADEETHENC', () => {
    expect(mapHadeethencGrade('ضعيف')).toEqual({ grade: HadithGrade.DAIF, publishable: false });
    expect(mapHadeethencGrade('unknown')).toEqual({ grade: HadithGrade.UNGRADED, publishable: false });
  });
});

describe('referenceLine', () => {
  it('returns the first non-empty line', () => {
    expect(referenceLine('صحيح مسلم (1/ 545) (791).\nرياض الصالحين')).toBe('صحيح مسلم (1/ 545) (791).');
    expect(referenceLine(null)).toBeNull();
  });
});
