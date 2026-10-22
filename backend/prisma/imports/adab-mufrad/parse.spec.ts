import { HadithGrade } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  adabExternalId,
  gradeFromRuling,
  isAcceptanceDispute,
  matchChapterTitle,
  parseAdabMufrad,
  parseAlbaniSplit,
  resolveGrade,
  verifyAlbaniEntries,
  type AlbaniEntry,
  type NamedEntity,
} from './parse.js';

// Synthetic fixtures in the Shamela0012991 / Shamela0001341 markup.
// Placeholder Arabic only — not text from either book.
const BOOK = [
  '######OpenITI#',
  '#META#Header#End#',
  '# PageV00P000',
  '### | باب أول تجريبي',
  '# PageV01P014',
  '### | 1 - ',
  '# حدثنا فلان قال: حدثنا فلان عن صاحب القصة قال: كلمات تجريبية عن الحديقة والنهر والشجرة الخضراء',
  '### | [قال الشيخ الألباني] : ',
  '# صحيح',
  '# تتمة تجريبية للرواية بعد الحكم',
  '### | 2 - ',
  '# حدثنا فلان عن فلان قال: جملة مختلفة تماما عن السوق والتاجر والميزان',
  '### | [قال الشيخ الألباني] : ',
  '# ضعيف',
  '### | ',
  '### | باب ',
  '# الكبر تجريبي</span>',
  '### | 2 - ',
  '# حدثنا فلان قال: نص مكرر الرقم عن الجبل والوادي والصخرة',
  '### | [قال الشيخ الألباني] : ',
  '# حسن',
].join('\n');

const SAHIH = [
  '#META#Header#End#',
  '### $ 1- باب أول تجريبي - 1',
  '# 1/1 (2) (صحيح) عن صاحب القصة قال: كلمات تجريبية عن الحديقة والنهر والشجرة الخضراء',
  '### | 2/2 -',
  '# (حسن الإسناد) عن فلان قال: نص مكرر الرقم عن الجبل والوادي والصخرة',
  '# 3/9 (صحيح) عن فلان قال: نص لا يوجد في الكتاب أبدا عن الفضاء والكواكب',
  '# 4/ ( ... ) - رقم محذوف',
].join('\n');

const DAIF = ['#META#Header#End#', '### | 1/2-', '# (ضعيف) عن فلان قال: جملة مختلفة تماما عن السوق والتاجر والميزان'].join('\n');

describe('parseAdabMufrad', () => {
  const book = parseAdabMufrad(BOOK);

  it('reads narrations, repeated numbers, pages and the printed ruling', () => {
    expect(book.narrations.map((n) => [adabExternalId(n), n.page, n.embeddedRuling])).toEqual([
      ['abdulbaqi:1', 14, 'صحيح'],
      ['abdulbaqi:2', 14, 'ضعيف'],
      ['abdulbaqi:2-2', 14, 'حسن'],
    ]);
    expect(book.repeatedNumbers).toEqual([2]);
  });

  it('keeps narration text that continues after the printed ruling, without the ruling', () => {
    expect(book.narrations[0]?.textAr.split('\n')).toEqual([
      'حدثنا فلان قال: حدثنا فلان عن صاحب القصة قال: كلمات تجريبية عن الحديقة والنهر والشجرة الخضراء',
      'تتمة تجريبية للرواية بعد الحكم',
    ]);
  });

  it('keeps chapter titles, including a title split onto the next line', () => {
    expect(book.chapters).toEqual([
      { key: 'abdulbaqi:bab@1', titleAr: 'باب أول تجريبي', firstNumber: 1 },
      { key: 'abdulbaqi:bab@2', titleAr: 'باب الكبر تجريبي', firstNumber: 2 },
    ]);
    expect(book.narrations[2]?.chapterTitle).toBe('باب الكبر تجريبي');
  });
});

describe('parseAlbaniSplit', () => {
  it('reads albani/original numbers and the ruling word, skipping footnote marks', () => {
    const { entries, unparsed } = parseAlbaniSplit(SAHIH, 'sahih');
    expect(entries.map((e) => [e.albaniNumber, e.originalNumber, e.ruling])).toEqual([
      [1, 1, 'صحيح'],
      [2, 2, 'حسن الإسناد'],
      [3, 9, 'صحيح'],
    ]);
    expect(unparsed).toHaveLength(1);
  });
});

describe('verifyAlbaniEntries', () => {
  it('trusts an original number only when the entry text is found there', () => {
    const book = parseAdabMufrad(BOOK);
    const entries = [...parseAlbaniSplit(SAHIH, 'sahih').entries, ...parseAlbaniSplit(DAIF, 'daif').entries];
    expect(verifyAlbaniEntries(entries, book.narrations).map((v) => v.externalId)).toEqual([
      'abdulbaqi:1',
      'abdulbaqi:2-2',
      null,
      'abdulbaqi:2',
    ]);
  });
});

describe('gradeFromRuling', () => {
  it.each([
    ['sahih', 'صحيح', HadithGrade.SAHIH, 'ruling'],
    ['sahih', 'صحيح لغيره', HadithGrade.SAHIH, 'ruling'],
    ['sahih', 'حسن صحيح', HadithGrade.HASAN, 'ruling'],
    ['sahih', 'حسن الإسناد', HadithGrade.HASAN, 'ruling'],
    ['sahih', 'صحيح دون جملة', HadithGrade.UNGRADED, 'qualified'],
    ['sahih', null, HadithGrade.UNGRADED, 'no-ruling'],
    ['sahih', 'موقوف، رجاله ثقات', HadithGrade.UNGRADED, 'unrecognised'],
    ['daif', 'ضعيف جدا', HadithGrade.DAIF, 'ruling'],
    ['daif', 'موضوع', HadithGrade.MAWDU, 'ruling'],
    ['daif', null, HadithGrade.DAIF, 'membership'],
  ] as const)('%s book, «%s» → %s', (book, ruling, grade, basis) => {
    expect(gradeFromRuling(book, ruling)).toEqual({ grade, basis });
  });
});

describe('resolveGrade', () => {
  const entry = (book: 'sahih' | 'daif', ruling: string, albaniNumber: number): AlbaniEntry => ({
    book,
    albaniNumber,
    albaniLabel: String(albaniNumber),
    originalNumber: 1,
    repeatMark: false,
    ruling,
    text: '',
    line: 1,
  });

  it('cites the Albani number and keeps the weakest grade within one book', () => {
    expect(resolveGrade([entry('sahih', 'صحيح', 5), entry('sahih', 'حسن', 6)])).toMatchObject({
      grade: HadithGrade.HASAN,
      gradeReference: 'صحيح الأدب المفرد 5، صحيح الأدب المفرد 6',
    });
  });

  it('leaves a narration listed in both books ungraded, even without a Sahih ruling word', () => {
    expect(resolveGrade([entry('sahih', 'صحيح', 5), entry('daif', 'ضعيف', 7)])).toMatchObject({
      grade: HadithGrade.UNGRADED,
      conflict: true,
    });
    const noRuling = { ...entry('sahih', 'صحيح', 5), ruling: null };
    expect(resolveGrade([noRuling, entry('daif', 'ضعيف', 7)])).toMatchObject({
      grade: HadithGrade.UNGRADED,
      conflict: true,
    });
  });
});

describe('isAcceptanceDispute', () => {
  it('flags accept/reject disagreements only', () => {
    expect(isAcceptanceDispute(HadithGrade.HASAN, 'ضعيف')).toBe(true);
    expect(isAcceptanceDispute(HadithGrade.DAIF, 'صحيح')).toBe(true);
    expect(isAcceptanceDispute(HadithGrade.SAHIH, 'حسن')).toBe(false);
    expect(isAcceptanceDispute(HadithGrade.SAHIH, null)).toBe(false);
  });
});

describe('matchChapterTitle', () => {
  const entities: NamedEntity[] = [
    { id: 'a', kind: 'SIN', slug: 'kibr', nameAr: 'الكبر' },
    { id: 'b', kind: 'GOOD_DEED', slug: 'silah', nameAr: 'صلة الرحم' },
  ];

  it('matches whole consecutive words and lists shared stems as near-misses', () => {
    expect(matchChapterTitle('باب الكبر تجريبي', entities).map((m) => [m.entity.id, m.kind])).toEqual([['a', 'match']]);
    expect(matchChapterTitle('باب فضل صلة الرحم', entities).map((m) => [m.entity.id, m.kind])).toEqual([['b', 'match']]);
    expect(matchChapterTitle('باب إثم قاطع الرحم', entities).map((m) => [m.entity.id, m.kind])).toEqual([
      ['b', 'near-miss'],
    ]);
    expect(matchChapterTitle('باب الكبرياء', entities)).toEqual([]);
  });
});
