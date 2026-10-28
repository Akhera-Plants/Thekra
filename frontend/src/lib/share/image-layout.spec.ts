import { describe, expect, it } from 'vitest';
import {
  layoutShareImage,
  SHARE_IMAGE,
  wrapLines,
  type MeasureText,
} from './image-layout';

/** Fixed-advance stub: every character is half the font size wide. */
const measure: MeasureText = (text, size) => text.length * size * 0.5;

const words = (count: number) => Array.from({ length: count }, (_, i) => `كلمة${i}`).join(' ');

describe('wrapLines', () => {
  const byChars = (value: string) => value.length;

  it('wraps greedily without losing or reordering words', () => {
    const text = 'aaa bbb ccc ddd eee';
    const lines = wrapLines(text, 7, byChars);
    expect(lines).toEqual(['aaa bbb', 'ccc ddd', 'eee']);
    expect(lines!.join(' ')).toBe(text);
  });

  it('starts a new line at each paragraph', () => {
    expect(wrapLines('one two\n\nthree', 100, byChars)).toEqual(['one two', 'three']);
  });

  it('refuses to break a word wider than the line', () => {
    expect(wrapLines('short averyveryverylongword', 10, byChars)).toBeNull();
  });
});

describe('layoutShareImage', () => {
  const contentWidth = SHARE_IMAGE.width - 2 * SHARE_IMAGE.paddingX;

  it('a short verse fits at the largest size', () => {
    const layout = layoutShareImage(
      { body: 'لِمَن كَانَ لَهُۥ قَلْبٌ', bodyFace: 'quran', attribution: ['ق 50:37'] },
      measure,
    );
    expect(layout.fits).toBe(true);
    if (!layout.fits) return;
    expect(layout.fontSize).toBe(SHARE_IMAGE.bodyMaxSize);
    expect(layout.bodyLines).toEqual(['لِمَن كَانَ لَهُۥ قَلْبٌ']);
  });

  it('a longer hadith steps down the font size and keeps every word', () => {
    const body = words(55);
    const layout = layoutShareImage(
      { body, bodyFace: 'arabic', attribution: ['صحيح البخاري · 1 · صحيح', 'الراوي: عمر بن الخطاب'] },
      measure,
    );
    expect(layout.fits).toBe(true);
    if (!layout.fits) return;
    expect(layout.fontSize).toBeLessThan(SHARE_IMAGE.bodyMaxSize);
    expect(layout.fontSize).toBeGreaterThanOrEqual(SHARE_IMAGE.bodyMinSize);
    expect(layout.bodyLines.join(' ')).toBe(body);
    for (const line of layout.bodyLines) {
      expect(measure(line, layout.fontSize, 'body')).toBeLessThanOrEqual(contentWidth);
    }
    // The body sits between the heading and the attribution, which sits above the footer.
    expect(layout.bodyTop).toBeGreaterThan(layout.headingTop);
    expect(layout.bodyTop + layout.bodyLines.length * layout.lineHeight).toBeLessThanOrEqual(
      layout.metaTop - SHARE_IMAGE.bodyMetaGap,
    );
    expect(layout.metaTop + layout.metaLines.length * layout.metaLineHeight).toBeLessThanOrEqual(
      layout.footerTop,
    );
  });

  it('a text too long for the minimum readable size does not fit (never truncated)', () => {
    const layout = layoutShareImage(
      { body: words(600), bodyFace: 'arabic', attribution: ['صحيح مسلم · 2564'] },
      measure,
    );
    expect(layout).toEqual({ fits: false });
  });

  it('more attribution lines leave less room for the body', () => {
    const body = words(40);
    const few = layoutShareImage({ body, bodyFace: 'arabic', attribution: ['a'] }, measure);
    const many = layoutShareImage(
      { body, bodyFace: 'arabic', attribution: Array.from({ length: 8 }, (_, i) => `line ${i}`) },
      measure,
    );
    expect(few.fits && many.fits).toBe(true);
    if (!few.fits || !many.fits) return;
    expect(many.fontSize).toBeLessThanOrEqual(few.fontSize);
  });

  it('the Quran face gets more line height than English', () => {
    const quran = layoutShareImage({ body: 'نص', bodyFace: 'quran', attribution: [] }, measure);
    const english = layoutShareImage({ body: 'text', bodyFace: 'english', attribution: [] }, measure);
    if (!quran.fits || !english.fits) throw new Error('expected both to fit');
    expect(quran.lineHeight / quran.fontSize).toBeGreaterThan(english.lineHeight / english.fontSize);
  });

  it('an empty body or an unbreakable word does not fit', () => {
    expect(layoutShareImage({ body: '  ', bodyFace: 'arabic', attribution: [] }, measure).fits).toBe(false);
    expect(
      layoutShareImage({ body: 'x'.repeat(200), bodyFace: 'english', attribution: [] }, measure).fits,
    ).toBe(false);
  });
});
