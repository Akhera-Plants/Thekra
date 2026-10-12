import { describe, expect, it } from 'vitest';
import { arabicLetterRatio, assertArabicText } from './guard.js';

describe('arabicLetterRatio', () => {
  it('is 1 for Arabic text and ignores digits and punctuation', () => {
    expect(arabicLetterRatio('نص تجريبي، 123!')).toBe(1);
  });

  it('is low for legacy-encoded or Latin text', () => {
    expect(arabicLetterRatio('ÇáÍãÏ ááå ÑÈ')).toBe(0);
  });
});

describe('assertArabicText', () => {
  it('passes clean Arabic and reports weak individual records', () => {
    const report = assertArabicText(['نص تجريبي طويل بما يكفي للاختبار هنا', 'نص آخر للاختبار', 'ab']);
    expect(report.lowRecords).toEqual([2]);
    expect(report.ratio).toBeGreaterThan(0.9);
  });

  it('throws when the whole input is not Arabic', () => {
    expect(() => assertArabicText(['ÇáÍãÏ ááå', 'Latin only'])).toThrow(/not clean Arabic/);
  });
});
