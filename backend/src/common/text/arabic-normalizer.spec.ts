import { escapeIlikePattern, normalizeArabic } from './arabic-normalizer.js';

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

  it('folds alef wasla ٱ (U+0671) to ا', () => {
    // ٱلرَّحْمَٰنِ → الرحمن  (Basmala opening alef wasla)
    expect(normalizeArabic('\u0671\u0644\u0631\u064E\u0651\u062D\u0652\u0645\u064E\u0670\u0646\u0650')).toBe('الرحمن');
    // Plain ٱ alone maps to ا
    expect(normalizeArabic('\u0671')).toBe('\u0627');
  });

  it('strips extended Arabic marks (U+06D6-U+06ED)', () => {
    // U+06D6 is a Quranic annotation mark
    expect(normalizeArabic('الله\u06D6')).toBe('الله');
  });
});

describe('escapeIlikePattern', () => {
  it('escapes ILIKE metacharacters', () => {
    expect(escapeIlikePattern('50%')).toBe('50\\%');
    expect(escapeIlikePattern('user_name')).toBe('user\\_name');
    expect(escapeIlikePattern('a\\b')).toBe('a\\\\b');
  });

  it('leaves plain Arabic text unchanged', () => {
    expect(escapeIlikePattern('الغيبه')).toBe('الغيبه');
  });

  it('handles combined special characters', () => {
    expect(escapeIlikePattern('100%_off\\deal')).toBe('100\\%\\_off\\\\deal');
  });
});
