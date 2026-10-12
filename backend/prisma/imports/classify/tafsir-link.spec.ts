import { describe, expect, it } from 'vitest';
import { sentenceAround, tafsirSupport } from './tafsir-link.js';

describe('tafsirSupport', () => {
  it('accepts a warning that names the sin', () => {
    expect(tafsirSupport('ونهى عن الغيبة لأنها من الكبائر', 'الغيبة', 'AVOID')).toBe('ACCEPTED');
  });

  it('accepts praise that names the deed', () => {
    expect(tafsirSupport('وفي هذا فضل الصدقة على المحتاج', 'الصدقة', 'DO')).toBe('ACCEPTED');
  });

  it('does not treat praise as support for a sin', () => {
    expect(tafsirSupport('وفي هذا فضل الصدقة', 'الصدقة', 'AVOID')).toBe('NONE');
  });

  it('marks a bare mention as weak', () => {
    expect(tafsirSupport('وقد ذكر أهل العلم الغيبة في هذا الموضع', 'الغيبة', 'AVOID')).toBe('WEAK');
  });
});

describe('sentenceAround', () => {
  it('returns the sentence that names the topic', () => {
    expect(sentenceAround('مقدمة. ونهى عن الغيبة. خاتمة.', 'الغيبة')).toBe('ونهى عن الغيبة.');
  });
});
