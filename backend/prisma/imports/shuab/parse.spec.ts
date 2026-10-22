import { describe, expect, it } from 'vitest';
import { extractTitle, parseShuab, repairNumbers, shuabVolumeOf } from './parse.js';

// Synthetic fixture in the Shamela0010660 markup. Placeholder Arabic only —
// branch titles and narrations are invented filler, not book text.
const FIXTURE = [
  '######OpenITI#',
  '#META#Header#End#',
  '# PageV01P083',
  '### | مقدمة',
  '# نص المقدمة التجريبي',
  '### | 1 - ',
  '# نص تجريبي للرواية الأولى',
  '~~يكمل هنا',
  '# الأول من شعب الإيمان، وهو باب في موضوع تجريبي أول قال المؤلف: شرح تجريبي',
  '### | 2 - ',
  '# نص تجريبي للرواية الثانية',
  '### | [ص: 84]',
  '# تتمة الرواية الثانية',
  '# الثاني من شعب الإيمان "',
  '# وهو باب في موضوع تجريبي ثان، قال المؤلف',
  '### | 3 ms0002 - ',
  '# نص تجريبي للرواية الثالثة',
  '# PageV00P000',
  '# وهو باب في موضوع بلا رقم " قال المؤلف',
  '### | 4 - ',
  '# نص تجريبي للرواية الرابعة',
  '### | فصل تجريبي',
  '# شرح الفصل ليس من الرواية',
  '### | 5 - ',
  '# نص تجريبي للرواية الخامسة',
  '# الرابع من شعب الإيمان وهو باب في " عنوان بين علامتين " قال',
  '### | 6 - ',
  '# نص تجريبي للرواية السادسة يقول: " وتقيم',
  '### | الكلمة،',
  '# وتكمل الجملة "',
  '### | عنوان فرعي تجريبي',
  '### | 7 - ',
  '# نص تجريبي للرواية السابعة',
].join('\n');

describe('parseShuab', () => {
  const result = parseShuab(FIXTURE);

  it('reads every numbered narration with its page and volume', () => {
    expect(result.narrations.map((n) => [n.number, n.volume, n.page])).toEqual([
      [1, 1, 83],
      [2, 1, 83],
      [3, 1, 84],
      [4, 1, 84],
      [5, 1, 84],
      [6, 1, 84],
      [7, 1, 84],
    ]);
  });

  it('ends a narration at a branch heading or a chapter heading', () => {
    expect(result.narrations[0]?.textAr).toBe('نص تجريبي للرواية الأولى يكمل هنا');
    expect(result.narrations[1]?.textAr).toBe('نص تجريبي للرواية الثانية\nتتمة الرواية الثانية');
    expect(result.narrations[3]?.textAr).toBe('نص تجريبي للرواية الرابعة');
  });

  it('keeps a word the conversion turned into a heading mid-sentence', () => {
    expect(result.narrations[5]?.textAr).toBe('نص تجريبي للرواية السادسة يقول: " وتقيم الكلمة، وتكمل الجملة "');
    expect(result.narrations[6]?.chapterTitle).toBe('عنوان فرعي تجريبي');
  });

  it('assigns narrations to the branch they fall under; the introduction has none', () => {
    expect(result.narrations.map((n) => n.branchNumber)).toEqual([null, 1, 2, 3, 3, 4, 4]);
    expect(result.narrations[4]?.chapterTitle).toBe('فصل تجريبي');
  });

  it('takes branch titles verbatim, including titles on the next line', () => {
    expect(result.branches.map((b) => [b.number, b.titleAr, b.numberedBy])).toEqual([
      [1, 'موضوع تجريبي أول', 'ordinal'],
      [2, 'موضوع تجريبي ثان', 'ordinal'],
      [3, 'موضوع بلا رقم', 'position'],
      [4, 'عنوان بين علامتين', 'ordinal'],
    ]);
    expect(result.branches[0]?.headingText).toBe('الأول من شعب الإيمان، وهو باب في موضوع تجريبي أول');
    expect(result.branches[1]?.headingText).toBe('الثاني من شعب الإيمان " / وهو باب في موضوع تجريبي ثان');
  });

  it('lists the branches it could not locate', () => {
    expect(result.unlocatedBranches).toHaveLength(77 - 4);
    expect(result.unlocatedBranches[0]).toBe(5);
  });
});

describe('extractTitle', () => {
  it('stops at commentary, quotations and clause boundaries', () => {
    expect(extractTitle(' وهو باب في موضوع أ " شرح').text).toBe('موضوع أ');
    expect(extractTitle(' وهو باب في موضوع ب قال: شرح').text).toBe('موضوع ب');
    expect(extractTitle(' وهو باب في حق تجريبي وهو شرح له').text).toBe('حق تجريبي');
    expect(extractTitle(' وهو').text).toBe('');
  });
});

describe('repairNumbers', () => {
  it('repairs an unambiguous one-digit typo that breaks the order', () => {
    expect(repairNumbers([420, 421, 422, 223, 224, 425]).numbers).toEqual([420, 421, 422, 423, 424, 425]);
    expect(repairNumbers([10, 11, 11, 13]).numbers).toEqual([10, 11, 12, 13]);
  });

  it('keeps real gaps and lettered duplicates as written', () => {
    expect(repairNumbers([76, 77, 78, 80, 81]).numbers).toEqual([76, 77, 78, 80, 81]);
    expect(repairNumbers([761, 764, 765]).numbers).toEqual([761, 764, 765]);
    expect(repairNumbers([54, 55, 55, 56]).numbers).toEqual([54, 55, 55, 56]);
  });
});

describe('shuabVolumeOf', () => {
  it('maps narration numbers to the printed volumes', () => {
    expect(shuabVolumeOf(1)).toBe(1);
    expect(shuabVolumeOf(399)).toBe(1);
    expect(shuabVolumeOf(400)).toBe(2);
    expect(shuabVolumeOf(9869)).toBe(13);
    expect(shuabVolumeOf(10757)).toBeNull();
  });
});
