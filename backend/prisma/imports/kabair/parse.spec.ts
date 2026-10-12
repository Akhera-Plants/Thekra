import { describe, expect, it } from 'vitest';
import { kabiraReference, kabiraSlug, matchSinToKabira, parseKabair } from './parse.js';

// Synthetic fixture in the Shamela0006848 markup; the sin names are placeholders.
const FIXTURE = [
  '######OpenITI#',
  '#META#Header#End#',
  '### | الكبيرة الأولى ذنب تجريبي أول',
  '# نص تجريبي يذكر الكبيرة الثانية في وسط الكلام ولا يعد عنوانا',
  '### | فصل',
  '### | الكبيرة الثانية في ذنب تجريبي ثان',
  '# الكبيرة الرابعة عشر ذنب على سطر عادي',
  '### | الكبيرة الحاديثة والثلاثون ذنب بإملاء غريب',
  '### | الكبيرة الأولى عنوان مكرر',
].join('\n');

describe('parseKabair', () => {
  const result = parseKabair(FIXTURE);

  it('reads numbered headings, strips the ordinal and a leading «في»', () => {
    expect(result.headings.map((h) => [h.number, h.nameAr])).toEqual([
      [1, 'ذنب تجريبي أول'],
      [2, 'ذنب تجريبي ثان'],
      [14, 'ذنب على سطر عادي'],
      [31, 'ذنب بإملاء غريب'],
    ]);
  });

  it('reports missing numbers and duplicate headings', () => {
    expect(result.missingNumbers).toContain(3);
    expect(result.missingNumbers).not.toContain(14);
    expect(result.duplicates.map((h) => h.number)).toEqual([1]);
  });
});

describe('matchSinToKabira', () => {
  const { headings } = parseKabair(
    [
      '#META#Header#End#',
      '### | الكبيرة الأولى ذنب أ',
      '### | الكبيرة الثانية ذنب ب على أحد',
      '### | الكبيرة الثالثة ذنب ب في غالب أمره',
      '### | الكبيرة الرابعة في ترك شيء',
      '### | الكبيرة الخامسة النمام',
    ].join('\n'),
  );

  it('matches exactly after normalisation', () => {
    expect(matchSinToKabira('ذنبُ أ', headings)).toMatchObject({ status: 'exact', heading: { number: 1 } });
    expect(matchSinToKabira('ترك شيء', headings)).toMatchObject({ status: 'exact', heading: { number: 4 } });
  });

  it('leaves a name found in several headings ambiguous', () => {
    expect(matchSinToKabira('ذنب ب', headings)).toMatchObject({ status: 'ambiguous', heading: null });
  });

  it('uses only the explicit alias list for different wording', () => {
    expect(matchSinToKabira('النميمة', headings)).toMatchObject({ status: 'alias', heading: { number: 5 } });
    expect(matchSinToKabira('ذنب غير موجود', headings)).toMatchObject({ status: 'none' });
  });

  it('builds the slug and the citation', () => {
    const [first] = headings;
    expect(kabiraSlug(7)).toBe('kabira-7');
    expect(first && kabiraReference(first)).toBe('الكبائر للذهبي، الكبيرة رقم 1 — الكبيرة الأولى ذنب أ');
  });
});
