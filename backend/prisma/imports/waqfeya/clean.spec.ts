import { describe, expect, it } from 'vitest';
import { cleanOcrPage, foldArabic, gradeToken, runningHeaderKeys, splitLeadingGrade, stripInlineGrades } from './clean.js';

describe('cleanOcrPage', () => {
  it('drops Thai and Latin glyphs and leaves the Arabic word as it was', () => {
    const cleaned = cleanOcrPage('abc สวัสดี صَلَوة وَالصَّلَاةُ');
    expect(cleaned).toContain('صَلَوة');
    expect(cleaned).toContain('وَالصَّلَاةُ');
    expect(cleaned).not.toMatch(/[A-Za-z]/);
    expect(cleaned).not.toMatch(/[\u0E00-\u0E7F]/);
  });

  it('drops lone digit lines, folio lines, and punctuation lines', () => {
    const cleaned = cleanOcrPage('قال رسول الله\n٨٢\n-٨١-\n1.1\n.\n!\n(r),\nصلى الله عليه وسلم');
    expect(cleaned).toBe('قال رسول الله\nصلى الله عليه وسلم');
  });

  it('drops a running header and keeps a one-line grade token', () => {
    const cleaned = cleanOcrPage('مقدمة الطبعة الأولى\nصحيح\nعن ابن عمر', new Set([foldArabic('مقدمة الطبعة الأولى')]));
    expect(cleaned).not.toContain('مقدمة');
    expect(cleaned).toContain('صحيح');
    expect(gradeToken('صحیح')).toBe('صحيح');
    expect(gradeToken('ص لغيره')).toBe('ص لغيره');
    expect(gradeToken('رواه البخاري بإسناد صحيح')).toBeNull();
    expect(splitLeadingGrade('ص لغيره كنا عند النبي')).toEqual({ token: 'ص لغيره', rest: 'كنا عند النبي' });
    expect(splitLeadingGrade('صحيح الترغيب والترهيب')).toBeNull();
    expect(stripInlineGrades('في سبيل ص لغيره الله').text).toBe('في سبيل الله');
    expect(stripInlineGrades('في سبيل ص لغيره الله').token).toBe('ص لغيره');
    expect(stripInlineGrades('هذا حسن خلقه').text).toBe('هذا حسن خلقه');
    expect(splitLeadingGrade('صحيح')).toEqual({ token: 'صحيح', rest: '' });
  });

  it('counts a short line that opens many pages as a header', () => {
    const pages = Array.from({ length: 8 }, () => 'بَابُ الإخلاص\n٤٤\nمتن');
    const headers = runningHeaderKeys(pages);
    expect(headers.has(foldArabic('بَابُ الإخلاص'))).toBe(true);
    expect(cleanOcrPage(pages[0]!, headers)).toBe('متن');
  });
});
