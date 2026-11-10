/**
 * QuoteCard share text: displayed text + attribution (+ «أثر، وليس حديثًا» for an athar) + public link.
 */

import { gradeCitationLine, quotePageUrl, quoteShareText, type QuoteShareLabels } from '../lib/share/quote-share';
import type { QuoteDto } from '../lib/types/api';

const labels: QuoteShareLabels = {
  atharNotice: 'أثر، وليس حديثًا',
  atharNarrated: (s) => `رواه ${s}`,
  grade: { SAHIH: 'صحيح', HASAN: 'حسن' },
};

function quote(over: Partial<QuoteDto>): QuoteDto {
  return {
    id: 'q1',
    type: 'HADITH',
    origin: 'LOCAL',
    textAr: 'نص الحديث',
    translation: { languageCode: 'en', text: 'The hadith text' },
    quran: null,
    hadith: { narrator: null, narratorAr: null, grade: 'SAHIH', reference: 'صحيح البخاري ٦٤٦٤' },
    book: null,
    citation: { volume: null, page: null, gradeAuthority: null, gradeReference: null },
    source: { id: 's', name: 'Sahih al-Bukhari', nameAr: 'صحيح البخاري', type: 'HADITH_COLLECTION', author: null, authorAr: null, isExternalApi: false, apiProvider: null },
    tags: [],
    external: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  } as QuoteDto;
}

describe('quote share text', () => {
  it('hadith: text, attribution with grade in Western digits, canonical /quotes link', () => {
    const text = quoteShareText(quote({}), { locale: 'ar', showTranslation: false, labels });
    expect(text).toBe('«نص الحديث»\n\nصحيح البخاري · صحيح البخاري 6464 · صحيح\n\nhttps://thekra-web.vercel.app/quotes/q1');
  });

  it('round 6 (C-08): one flowing paragraph in its marks, then «بواسطة تطبيق ذكرى» and the link under it', () => {
    const text = quoteShareText(quote({ textAr: 'سطر أول\n\nسطر   ثان' }), { locale: 'ar', showTranslation: false, labels: { ...labels, sharedVia: 'بواسطة تطبيق ذكرى' } });
    expect(text.startsWith('«سطر أول سطر ثان»\n\n')).toBe(true);
    expect(text.endsWith('\n\nبواسطة تطبيق ذكرى\nhttps://thekra-web.vercel.app/quotes/q1')).toBe(true);
    const verse = quoteShareText(quote({ type: 'QURAN_VERSE', textAr: 'آية', hadith: null }), { locale: 'ar', showTranslation: false, labels });
    expect(verse.startsWith('﴿آية﴾')).toBe(true);
    expect(quoteShareText(quote({ textAr: '«قال»' }), { locale: 'ar', showTranslation: false, labels }).startsWith('«قال»\n')).toBe(true);
  });

  it('athar: always labelled, never with a hadith grade', () => {
    const text = quoteShareText(
      quote({ isAthar: true, atharSpeakerAr: 'عمر بن الخطاب', atharAttributionKind: 'SAID', hadith: { narrator: null, narratorAr: null, grade: null, reference: null } }),
      { locale: 'ar', showTranslation: false, labels },
    );
    expect(text).toContain('أثر، وليس حديثًا');
    expect(text).toContain('— عمر بن الخطاب');
    expect(text).not.toContain('صحيح ·');
  });

  it('shares the translation only when the card shows it; English links are under /en', () => {
    expect(quoteShareText(quote({}), { locale: 'en', showTranslation: true, labels })).toContain('The hadith text');
    expect(quoteShareText(quote({}), { locale: 'en', showTranslation: false, labels })).not.toContain('The hadith text');
    expect(quotePageUrl('q1', 'en')).toBe('https://thekra-web.vercel.app/en/quotes/q1');
  });
});

describe('grade citation line (lecturer retellings)', () => {
  const retold = quote({
    hadith: { narrator: null, narratorAr: null, grade: 'SAHIH', reference: null },
    citation: {
      volume: null,
      page: null,
      gradeAuthority: 'الأستاذ أنس شيخ اكريم',
      gradeReference: 'رواه بمعناه، في محاضرة بناء العادات',
    },
  });

  it('Arabic: «<gradeReference> · حكمه <gradeAuthority>» on the card and in the share text', () => {
    const line = 'رواه بمعناه، في محاضرة بناء العادات · حكمه الأستاذ أنس شيخ اكريم';
    expect(gradeCitationLine(retold, 'ar')).toBe(line);
    expect(quoteShareText(retold, { locale: 'ar', showTranslation: false, labels })).toContain(line);
  });

  it('«حسّنه» for a hasan grade; no line without a gradeReference or for an athar', () => {
    expect(gradeCitationLine({ ...retold, hadith: { ...retold.hadith!, grade: 'HASAN' } }, 'ar')).toBe(
      'رواه بمعناه، في محاضرة بناء العادات · حسّنه الأستاذ أنس شيخ اكريم',
    );
    expect(gradeCitationLine(quote({}), 'ar')).toBeNull();
    expect(gradeCitationLine({ ...retold, isAthar: true }, 'ar')).toBeNull();
  });

  it('English UI hides an Arabic-only line', () => {
    expect(gradeCitationLine(retold, 'en')).toBeNull();
    expect(quoteShareText(retold, { locale: 'en', showTranslation: false, labels })).not.toContain('رواه بمعناه');
  });
});

describe('grade line beside the source (owner round 7, B4)', () => {
  const bukhari = quote({
    hadith: { narrator: null, narratorAr: null, grade: 'SAHIH', reference: 'صحيح البخاري، رقم 2595' },
    citation: { volume: null, page: null, gradeAuthority: 'رواه البخاري', gradeReference: 'البخاري 2595' },
  });
  it('says the two Sahihs in their short form', () => {
    expect(gradeCitationLine(bukhari, 'ar')).toBe('رواه البخاري، رقم 2595');
  });
  it('drops the line when the source beside it names the same book and number', () => {
    expect(gradeCitationLine(bukhari, 'ar', { besideSource: bukhari.hadith!.reference })).toBeNull();
  });
  it('keeps it when the source is another book', () => {
    expect(gradeCitationLine(bukhari, 'ar', { besideSource: 'رياض الصالحين، رقم 1200' })).toBe('رواه البخاري، رقم 2595');
  });
  it('keeps only the grader when the book is already shown', () => {
    const arnaut = quote({
      hadith: { narrator: null, narratorAr: null, grade: 'SAHIH', reference: 'سنن أبي داود، رقم 5186' },
      citation: { volume: null, page: null, gradeAuthority: 'شعيب الأرنؤوط', gradeReference: 'سنن ابي داود، رقم 5186' },
    });
    expect(gradeCitationLine(arnaut, 'ar', { besideSource: arnaut.hadith!.reference })).toBe('حكمه شعيب الأرنؤوط');
  });
  it('shares a verse without «القرآن الكريم»', () => {
    const text = quoteShareText(
      quote({ type: 'QURAN_VERSE', textAr: 'آية', hadith: null, quran: { surahNumber: 31, ayahNumber: 13, surahName: 'Luqman', surahNameAr: 'لقمان' } as QuoteDto['quran'], source: { id: 's', name: 'The Quran', nameAr: 'القرآن الكريم' } as QuoteDto['source'] }),
      { locale: 'ar', showTranslation: false, labels },
    );
    expect(text).toContain('لقمان (31:13)');
    expect(text).not.toContain('القرآن الكريم');
  });
});
