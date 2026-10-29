/**
 * «التفسير» / «الشرح» tabs: the same tab ids and row rules as the website's study panel.
 */

import {
  LONG_PREVIEW_CHARS,
  availableStudyTabs,
  explanationSegments,
  foldedText,
  hadithTabsForLocale,
  isArabicRow,
  pickTabRows,
  studyCaption,
  studyTabsForQuote,
  verseTabsForLocale,
  type ExplanationRow,
} from '../lib/study/tabs';

function row(over: Partial<ExplanationRow> & Pick<ExplanationRow, 'id' | 'kind'>): ExplanationRow {
  return {
    languageCode: 'ar',
    text: 'نص',
    reference: null,
    source: { name: 'Source', nameAr: null },
    ...over,
  };
}

const mukhtasarAr = row({ id: 'm-ar', kind: 'TAFSIR', source: { name: 'Al-Mukhtasar', nameAr: 'المختصر في التفسير' } });
const mukhtasarEn = row({ id: 'm-en', kind: 'TAFSIR', languageCode: 'en', text: 'Meaning', source: { name: 'Al-Mukhtasar', nameAr: null } });
const sadi = row({ id: 'sadi', kind: 'TAFSIR', source: { name: "Tafsir al-Sa'di", nameAr: 'تفسير السعدي' } });
const ashur = row({ id: 'ashur', kind: 'TAFSIR', source: { name: 'Al-Tahrir wa al-Tanwir', nameAr: 'التحرير والتنوير' } });
const sharh = row({ id: 'sharh', kind: 'SHARH', source: { name: 'HadeethEnc', nameAr: 'موسوعة الأحاديث النبوية' } });
const sharhOther = row({ id: 'sharh-other', kind: 'SHARH', source: { name: 'Another book', nameAr: null } });
const fawaid = row({ id: 'fawaid', kind: 'FAWAID' });
const gharib = row({ id: 'gharib', kind: 'GHARIB' });
const fath = row({ id: 'fath', kind: 'SHARH_LONG', source: { name: 'Fath al-Bari', nameAr: 'فتح الباري' } });
const nawawi = row({ id: 'nawawi', kind: 'SHARH_LONG', source: { name: 'Sharh Sahih Muslim', nameAr: 'شرح النووي على مسلم' } });

const ids = (rows: ExplanationRow[]) => rows.map((r) => r.id);

describe('study tabs per locale', () => {
  it('verses: three tafsir in Arabic, the meaning only in English', () => {
    expect(verseTabsForLocale('ar')).toEqual(['mukhtasar', 'sadi', 'ashur']);
    expect(verseTabsForLocale('en')).toEqual(['mukhtasar']);
  });

  it('hadith: five readings in Arabic, three in English', () => {
    expect(hadithTabsForLocale('ar')).toEqual(['sharh', 'fawaid', 'gharib', 'fath', 'nawawi']);
    expect(hadithTabsForLocale('en')).toEqual(['sharh', 'fawaid', 'gharib']);
  });

  it('other texts have no tabs', () => {
    expect(studyTabsForQuote('SCHOLAR_QUOTE', 'ar')).toEqual([]);
    expect(studyTabsForQuote('BOOK_EXCERPT', 'en')).toEqual([]);
    expect(studyTabsForQuote('QURAN_VERSE', 'ar')).toEqual(verseTabsForLocale('ar'));
  });
});

describe('pickTabRows', () => {
  const verseRows = [mukhtasarAr, mukhtasarEn, sadi, ashur];
  const hadithRows = [sharh, sharhOther, fawaid, gharib, fath, nawawi];

  it('matches tafsir by source name, Latin or Arabic', () => {
    expect(ids(pickTabRows(verseRows, 'mukhtasar', 'ar'))).toEqual(['m-ar']);
    expect(ids(pickTabRows(verseRows, 'sadi', 'ar'))).toEqual(['sadi']);
    expect(ids(pickTabRows(verseRows, 'ashur', 'ar'))).toEqual(['ashur']);
  });

  it('English keeps English rows only', () => {
    expect(ids(pickTabRows(verseRows, 'mukhtasar', 'en'))).toEqual(['m-en']);
    expect(pickTabRows(verseRows, 'sadi', 'en')).toEqual([]);
  });

  it('sharh is the encyclopedia only; the long commentaries go by book', () => {
    expect(ids(pickTabRows(hadithRows, 'sharh', 'ar'))).toEqual(['sharh']);
    expect(ids(pickTabRows(hadithRows, 'fawaid', 'ar'))).toEqual(['fawaid']);
    expect(ids(pickTabRows(hadithRows, 'gharib', 'ar'))).toEqual(['gharib']);
    expect(ids(pickTabRows(hadithRows, 'fath', 'ar'))).toEqual(['fath']);
    expect(ids(pickTabRows(hadithRows, 'nawawi', 'ar'))).toEqual(['nawawi']);
  });

  it('a tafsir row never lands in a hadith tab', () => {
    expect(pickTabRows([sadi], 'sharh', 'ar')).toEqual([]);
    expect(pickTabRows([sharh], 'mukhtasar', 'ar')).toEqual([]);
  });
});

describe('availableStudyTabs', () => {
  it('keeps only tabs with rows, in order', () => {
    expect(availableStudyTabs([ashur, mukhtasarAr], 'QURAN_VERSE', 'ar')).toEqual(['mukhtasar', 'ashur']);
    expect(availableStudyTabs([gharib, sharh], 'HADITH', 'ar')).toEqual(['sharh', 'gharib']);
  });

  it('no rows, no tabs', () => {
    expect(availableStudyTabs([], 'HADITH', 'ar')).toEqual([]);
    expect(availableStudyTabs([sadi], 'QURAN_VERSE', 'en')).toEqual([]);
  });
});

describe('reading helpers', () => {
  it('splits quoted verses out of the text, without their brackets', () => {
    expect(explanationSegments('قال تعالى: ﴿الحمد لله﴾ ثم {رب العالمين}.')).toEqual([
      { start: 0, text: 'قال تعالى: ', quran: false },
      { start: 11, text: 'الحمد لله', quran: true },
      { start: 22, text: ' ثم ', quran: false },
      { start: 26, text: 'رب العالمين', quran: true },
      { start: 39, text: '.', quran: false },
    ]);
    expect(explanationSegments('plain')).toEqual([{ start: 0, text: 'plain', quran: false }]);
  });

  it('folds long texts only', () => {
    expect(foldedText('short')).toBe('short');
    const long = 'ا'.repeat(LONG_PREVIEW_CHARS + 50);
    expect(foldedText(long)).toBe(`${'ا'.repeat(LONG_PREVIEW_CHARS)}…`);
  });

  it('Arabic rows read right to left', () => {
    expect(isArabicRow(mukhtasarAr)).toBe(true);
    expect(isArabicRow(mukhtasarEn)).toBe(false);
  });

  it('caption: source and reference, once each', () => {
    expect(studyCaption(row({ id: 'a', kind: 'TAFSIR', reference: 'البقرة ٢٥٥', source: { name: "Sa'di", nameAr: 'تفسير السعدي' } }), true)).toBe(
      'تفسير السعدي · البقرة ٢٥٥',
    );
    expect(studyCaption(row({ id: 'b', kind: 'SHARH_LONG', reference: 'فتح الباري ١/٩', source: { name: 'Fath', nameAr: 'فتح الباري' } }), true)).toBe(
      'فتح الباري ١/٩',
    );
    expect(studyCaption(row({ id: 'c', kind: 'SHARH', languageCode: 'en', source: { name: 'HadeethEnc', nameAr: 'موسوعة' } }), false)).toBe('HadeethEnc');
  });
});
