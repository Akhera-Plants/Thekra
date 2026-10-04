import { normalizeArabic } from './arabic-normalizer.js';

describe('normalizeArabic', () => {
  it('treats الغيبه as equivalent to الغِيبة', () => {
    expect(normalizeArabic('الغيبه')).toBe(normalizeArabic('الغِيبة'));
  });

  it('strips tashkeel and tatweel', () => {
    expect(normalizeArabic('الـلَّهُ')).toBe('الله');
  });

  it('folds alef variants and ya/ta-marbuta', () => {
    expect(normalizeArabic('إيمان')).toBe('ايمان');
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('صلاة')).toBe('صلاه');
  });
});
