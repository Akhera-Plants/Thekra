import { describe, expect, it } from 'vitest';
import { splitKabairBlock, versesInBraces } from './kabair.js';

const NAMIMA = [
  'وهو من ينقل الحديث بين الناس على جهة الإفساد بينهم هذا بيانها وأما',
  'أحكامها فهي حرام بإجماع المسلمين وقد تظاهرت على تحريمها الدلائل الشرعية',
  'من الكتاب والسنة قال الله تعالى {ولا تطع كل حلاف مهين هماز مشاء بنميم}',
  'وفي الصحيحين أن رسول الله صلى الله عليه وسلم قال لا يدخل الجنة نمام وفي',
  'الحديث أن رسول الله صلى الله عليه وسلم مر بقبرين',
].join(' ');

describe('splitKabairBlock', () => {
  it('keeps the definition as prose and lifts the verse and the report', () => {
    const pieces = splitKabairBlock(NAMIMA);
    expect(pieces[0]).toMatchObject({ kind: 'AUTHOR_TEXT' });
    expect(pieces[0]?.text.startsWith('وهو من ينقل الحديث')).toBe(true);
    expect(pieces[1]).toEqual({ kind: 'BRACE', text: 'ولا تطع كل حلاف مهين هماز مشاء بنميم' });
    const hadith = pieces.find((piece) => piece.kind === 'HADITH' && piece.text.includes('لا يدخل الجنة نمام'));
    expect(hadith?.text.startsWith('وفي الصحيحين')).toBe(true);
    expect(pieces.some((piece) => piece.kind === 'HADITH' && piece.text.startsWith('وهو من ينقل'))).toBe(false);
  });
});

describe('versesInBraces', () => {
  it('assigns each detected span to the brace that contains it', () => {
    const braces = ['ولا تطع كل حلاف مهين هماز مشاء بنميم', 'ولا تجسسوا'];
    const keys = versesInBraces(braces, [
      { startWord: 0, endWord: 8, surah: 68, ayahStart: 10, ayahEnd: 11 },
      { startWord: 8, endWord: 10, surah: 49, ayahStart: 12, ayahEnd: 12 },
    ]);
    expect(keys).toEqual([['68:10', '68:11'], ['49:12']]);
  });
});
