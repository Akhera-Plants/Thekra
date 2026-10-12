import { describe, expect, it } from 'vitest';
import { cleanInline, readBlocks, readRecords } from './openiti.js';

// Synthetic mARkdown with placeholder Arabic — no real book text.
const FIXTURE = [
  '######OpenITI#',
  '#META# 020.BookTITLE\t:: كتاب تجريبي',
  '#META#Header#End#',
  '# PageV01P010',
  '### | باب تجريبي أول',
  '### | 1 - ',
  '# نص تجريبي ms0001 أول',
  '~~يكمل السطر هنا',
  '### | [ص: 11]',
  '# فقرة ثانية <span>مع وسم</span>',
  '# PageV00P000',
  '### | 2 - ',
  '# نص تجريبي ثان PageV01P012',
  '# بعد الصفحة',
].join('\n');

describe('cleanInline', () => {
  it('strips milestones, page tokens and HTML, and collapses whitespace', () => {
    expect(cleanInline('  كلمة ms0012 أخرى PageV02P005 <b>ثالثة</b>  ')).toBe('كلمة أخرى ثالثة');
  });
});

describe('readBlocks', () => {
  it('skips the header, joins continuation lines and tracks pages', () => {
    const blocks = readBlocks(FIXTURE);
    expect(blocks.map((block) => [block.kind, block.text, block.page])).toEqual([
      ['heading', 'باب تجريبي أول', 10],
      ['heading', '1 -', 10],
      ['paragraph', 'نص تجريبي أول يكمل السطر هنا', 10],
      ['paragraph', 'فقرة ثانية مع وسم', 11],
      ['heading', '2 -', 11],
      ['paragraph', 'نص تجريبي ثان', 11],
      ['paragraph', 'بعد الصفحة', 12],
    ]);
    expect(blocks[0]?.volume).toBe(1);
  });

  it('ignores a PageV marker that lags behind the page breaks', () => {
    const text = ['#META#Header#End#', '# PageV01P020', '### | [ص: 22]', '# PageV01P021', '# فقرة'].join('\n');
    expect(readBlocks(text)[0]?.page).toBe(22);
  });

  it('starts the next volume when a page break drops far below the current page', () => {
    const text = ['#META#Header#End#', '# PageV03P400', '# فقرة', '### | [ص: 6]', '# فقرة أخرى'].join('\n');
    expect(readBlocks(text).map((block) => [block.volume, block.page])).toEqual([
      [3, 400],
      [4, 6],
    ]);
  });
});

describe('readRecords', () => {
  it('groups paragraphs under their heading with a joined body', () => {
    const records = readRecords(FIXTURE);
    expect(records.map((record) => record.heading)).toEqual(['باب تجريبي أول', '1 -', '2 -']);
    expect(records[1]?.body).toBe('نص تجريبي أول يكمل السطر هنا\nفقرة ثانية مع وسم');
  });
});
