import { describe, expect, it } from 'vitest';
import { quotedTitle } from './pledges';

describe('quotedTitle', () => {
  it('quotes a plain title in the page language', () => {
    expect(quotedTitle('ورد القرآن', false)).toBe('«ورد القرآن»');
    expect(quotedTitle('Daily Quran reading', true)).toBe('“Daily Quran reading”');
  });

  it('never doubles the marks of a title that already has them', () => {
    expect(quotedTitle('«سبحان الله وبحمده» صباحًا ومساءً', false)).toBe('«سبحان الله وبحمده» صباحًا ومساءً');
    expect(quotedTitle('«Subhan Allah wa bihamdih» morning and evening', true)).toBe('«Subhan Allah wa bihamdih» morning and evening');
  });
});
