import { describe, expect, it } from 'vitest';
import { parseLeadingOrdinal } from './arabic-ordinal.js';

describe('parseLeadingOrdinal', () => {
  it.each([
    ['الأول من', 1],
    ['الأولى الشرك', 1],
    ['العاشر من', 10],
    ['الحادي عشر من', 11],
    ['الحادية عشرة اللواط', 11],
    ['الرابعة عشر الكذب', 14],
    ['العشرون من', 20],
    ['السابع والعشرون من', 27],
    ['الحاديثة والثلاثون القاضي', 31],
    ['الخمسون من', 50],
    ['السابع والسبعون من', 77],
  ])('reads «%s» as %i', (text, value) => {
    expect(parseLeadingOrdinal(text)?.value).toBe(value);
  });

  it('reports how much text it consumed', () => {
    const text = 'الثاني والعشرون من شعب';
    const match = parseLeadingOrdinal(text);
    expect(text.slice(match?.length)).toBe(' من شعب');
  });

  it('does not match a word that merely starts like an ordinal', () => {
    expect(parseLeadingOrdinal('الأولاد')).toBeNull();
    expect(parseLeadingOrdinal('باب')).toBeNull();
  });
});
