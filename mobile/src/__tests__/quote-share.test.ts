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
    expect(text).toBe('نص الحديث\n\nصحيح البخاري · صحيح البخاري 6464 · صحيح\n\nhttps://thekra-web.vercel.app/quotes/q1');
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
