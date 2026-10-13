import { describe, expect, it } from 'vitest';
import { extractCitations } from './citations.js';

describe('verse citations', () => {
  it('reads the three verses that open the ghibah chapter', () => {
    const text =
      'قال الله تعالى: {ولا يغتب بعضكم بعضا} [الحجرات: 12]، وقال تعالى: {ولا تقف ما ليس لك به علم} [الإسراء: 36]، وقال تعالى: {ما يلفظ من قول} [ق: 18].';
    expect(extractCitations(text)).toEqual([
      { from: '49:12', to: '49:12' },
      { from: '17:36', to: '17:36' },
      { from: '50:18', to: '50:18' },
    ]);
  });

  it('reads a range and an eastern-arabic number', () => {
    expect(extractCitations('[البقرة: 183 إلى 185]')).toEqual([{ from: '2:183', to: '2:185' }]);
    expect(extractCitations('[التوبة: ٥]')).toEqual([{ from: '9:5', to: '9:5' }]);
  });

  it('drops a citation that runs past the surah', () => {
    expect(extractCitations('[ق: 90]')).toEqual([]);
  });
});
