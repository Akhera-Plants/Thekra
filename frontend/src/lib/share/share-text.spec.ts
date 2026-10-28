import { describe, expect, it } from 'vitest';
import type { QuoteDto } from '@/lib/types/api';
import {
  displayedBody,
  quoteSharePayload,
  shareIntents,
  shareText,
  type ShareLabels,
} from './share-text';

const AR: ShareLabels = {
  siteName: 'ذكرى',
  narrator: 'الراوي',
  type: { quran: 'آية قرآنية', hadith: 'حديث نبوي', athar: 'أثر', scholar: 'قول عالم', book: 'مقتطف كتاب' },
  grade: { sahih: 'صحيح', hasan: 'حسن', daif: 'ضعيف', mawdu: 'موضوع' },
  weakNotice: 'هذا الحديث ضعيف',
  outsideSahihayn: 'ليس من الصحيحين',
  atharNotice: 'أثر، وليس حديثًا',
  atharNarrated: (speaker) => `رواه ${speaker}`,
};

const EN: ShareLabels = {
  siteName: 'Thekra',
  narrator: 'Narrator',
  type: { quran: 'Quran verse', hadith: 'Prophetic hadith', athar: 'Athar', scholar: 'Scholar', book: 'Book' },
  grade: { sahih: 'Sahih', hasan: 'Hasan', daif: "Da'if", mawdu: 'Mawdu' },
  weakNotice: 'This narration is weak (da\'if)',
  outsideSahihayn: 'Not from the two Sahihs',
  atharNotice: 'A saying, not a hadith',
  atharNarrated: (speaker) => `Narrated by ${speaker}`,
};

function quote(overrides: Partial<QuoteDto>): QuoteDto {
  return {
    id: 'q1',
    type: 'HADITH',
    origin: 'CURATED',
    textAr: 'إنما الأعمال بالنيات',
    translation: null,
    quran: null,
    hadith: null,
    book: null,
    citation: { volume: null, page: null, gradeAuthority: null, gradeReference: null },
    source: {
      id: 's1',
      name: 'Sahih al-Bukhari',
      nameAr: 'صحيح البخاري',
      type: 'HADITH_COLLECTION',
      author: null,
      authorAr: null,
      isExternalApi: false,
      apiProvider: null,
    },
    tags: [],
    external: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as QuoteDto;
}

const hadith = quote({
  textAr: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى',
  translation: { languageCode: 'en', text: 'Actions are only by intentions.' },
  hadith: {
    narrator: "'Umar ibn al-Khattab",
    narratorAr: 'عمر بن الخطاب',
    grade: 'SAHIH',
    reference: '١',
    outsideSahihayn: false,
  },
  citation: { volume: null, page: null, gradeAuthority: 'رواه البخاري', gradeReference: '1' },
});

const verse = quote({
  type: 'QURAN_VERSE',
  textAr: 'لِمَن كَانَ لَهُۥ قَلْبٌ',
  translation: { languageCode: 'en', text: 'for whoever has a heart' },
  quran: { surahNumber: 50, surahName: 'Qaf', surahNameAr: 'ق', ayahNumber: 37 },
  source: {
    id: 's2',
    name: 'The Noble Quran',
    nameAr: 'القرآن الكريم',
    type: 'QURAN',
    author: null,
    authorAr: null,
    isExternalApi: false,
    apiProvider: null,
  },
});

const athar = quote({
  isAthar: true,
  textAr: 'حاسبوا أنفسكم قبل أن تحاسبوا',
  atharSpeakerAr: 'عمر بن الخطاب',
  atharAttributionKind: 'SAID',
  hadith: { narrator: null, narratorAr: null, grade: 'SAHIH', reference: 'الزهد 1', outsideSahihayn: false },
  source: {
    id: 's3',
    name: 'Al-Zuhd',
    nameAr: 'الزهد لابن المبارك',
    type: 'BOOK',
    author: null,
    authorAr: null,
    isExternalApi: false,
    apiProvider: null,
  },
});

describe('displayedBody', () => {
  it('shows the Arabic on the Arabic UI', () => {
    expect(displayedBody(hadith, 'ar')).toEqual({ body: hadith.textAr, bodyLang: 'ar' });
  });

  it('shows a sourced English translation on the English UI', () => {
    expect(displayedBody(hadith, 'en')).toEqual({
      body: 'Actions are only by intentions.',
      bodyLang: 'en',
    });
  });

  it('keeps the Arabic on the English UI when no sourced translation exists (no machine translation)', () => {
    const untranslated = quote({ ...hadith, translation: null });
    expect(displayedBody(untranslated, 'en')).toEqual({ body: untranslated.textAr, bodyLang: 'ar' });
  });
});

describe('quoteSharePayload: hadith', () => {
  it('Arabic: text as displayed, then source · reference · grade, narrator and grade line', () => {
    const payload = quoteSharePayload(hadith, { locale: 'ar', labels: AR });
    expect(payload.title).toBe('ذكرى');
    expect(payload.heading).toBe('حديث نبوي');
    expect(payload.body).toBe(hadith.textAr);
    expect(payload.bodyFace).toBe('arabic');
    expect(payload.attribution).toEqual([
      'صحيح البخاري · 1 · صحيح',
      'الراوي: عمر بن الخطاب',
      'رواه البخاري، رقم 1',
    ]);
    expect(payload.isAthar).toBe(false);
  });

  it('English: shares the sourced translation with English attribution', () => {
    const payload = quoteSharePayload(hadith, { locale: 'en', labels: EN });
    expect(payload.body).toBe('Actions are only by intentions.');
    expect(payload.bodyLang).toBe('en');
    expect(payload.bodyFace).toBe('english');
    expect(payload.attribution[0]).toBe('Sahih al-Bukhari · 1 · Sahih');
    expect(payload.attribution).toContain("Narrator: 'Umar ibn al-Khattab");
    expect(payload.attribution.join('\n')).not.toMatch(/[؀-ۿ]/);
  });

  it('uses Western digits in every attribution line', () => {
    const payload = quoteSharePayload(hadith, { locale: 'ar', labels: AR });
    expect(payload.attribution.join('\n')).not.toMatch(/[٠-٩]/);
  });

  it('carries the weak notice when the card shows it', () => {
    const weak = quote({ ...hadith, hadith: { ...hadith.hadith!, grade: 'DAIF' } });
    const payload = quoteSharePayload(weak, { locale: 'ar', labels: AR });
    expect(payload.attribution).toContain('هذا الحديث ضعيف');
  });
});

describe('quoteSharePayload: athar', () => {
  it('Arabic: always labelled «أثر، وليس حديثًا», never with a hadith grade', () => {
    const payload = quoteSharePayload(athar, { locale: 'ar', labels: AR });
    expect(payload.heading).toBe('أثر');
    expect(payload.isAthar).toBe(true);
    expect(payload.attribution).toEqual([
      'الزهد لابن المبارك · الزهد 1',
      '— عمر بن الخطاب',
      'أثر، وليس حديثًا · الزهد 1',
    ]);
    expect(payload.attribution.join('\n')).not.toContain('صحيح');
  });

  it('narrated athar use «رواه»', () => {
    const narrated = quote({ ...athar, atharAttributionKind: 'NARRATED' });
    const payload = quoteSharePayload(narrated, { locale: 'ar', labels: AR });
    expect(payload.attribution).toContain('رواه عمر بن الخطاب');
  });

  it('English: carries the card\'s English athar label and keeps the Arabic body', () => {
    const payload = quoteSharePayload(athar, { locale: 'en', labels: EN });
    expect(payload.body).toBe(athar.textAr);
    expect(payload.bodyLang).toBe('ar');
    expect(payload.attribution.some((line) => line.startsWith('A saying, not a hadith'))).toBe(true);
  });

  it('a surface with its own attribution still gets the athar label', () => {
    const payload = quoteSharePayload(athar, {
      locale: 'ar',
      labels: AR,
      display: { body: athar.textAr, bodyLang: 'ar', attribution: ['الزهد لابن المبارك'] },
    });
    expect(payload.attribution).toEqual(['الزهد لابن المبارك', 'أثر، وليس حديثًا']);
  });
});

describe('quoteSharePayload: verse', () => {
  it('Arabic: surah name and number:ayah, Quran face', () => {
    const payload = quoteSharePayload(verse, { locale: 'ar', labels: AR });
    expect(payload.body).toBe('لِمَن كَانَ لَهُۥ قَلْبٌ');
    expect(payload.bodyFace).toBe('quran');
    expect(payload.heading).toBe('آية قرآنية');
    expect(payload.attribution).toEqual(['ق 50:37 · القرآن الكريم']);
  });

  it('English: sourced translation and English surah name', () => {
    const payload = quoteSharePayload(verse, { locale: 'en', labels: EN });
    expect(payload.body).toBe('for whoever has a heart');
    expect(payload.attribution).toEqual(['Qaf 50:37 · The Noble Quran']);
  });

  it('the display override folds digits and drops empty lines', () => {
    const payload = quoteSharePayload(verse, {
      locale: 'ar',
      labels: AR,
      display: { body: ' نص ', bodyLang: 'ar', attribution: ['القرآن الكريم', 'سورة ق، الآية ٣٧', ''] },
    });
    expect(payload.body).toBe('نص');
    expect(payload.attribution).toEqual(['القرآن الكريم', 'سورة ق، الآية 37']);
  });
});

describe('shareText and shareIntents', () => {
  const payload = quoteSharePayload(verse, { locale: 'ar', labels: AR });
  const url = 'https://thekra-web.vercel.app/quotes/q1';

  it('body, blank line, attribution, blank line, URL', () => {
    expect(shareText(payload, url)).toBe(
      'لِمَن كَانَ لَهُۥ قَلْبٌ\n\nق 50:37 · القرآن الكريم\n\nhttps://thekra-web.vercel.app/quotes/q1',
    );
    expect(shareText(payload)).toBe('لِمَن كَانَ لَهُۥ قَلْبٌ\n\nق 50:37 · القرآن الكريم');
  });

  it('builds plain intent URLs; URL-field targets do not repeat the URL in the text', () => {
    const intents = shareIntents(payload, url);
    expect(intents.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(shareText(payload, url))}`);
    expect(intents.telegram).toBe(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText(payload))}`,
    );
    expect(intents.x).toBe(
      `https://x.com/intent/post?text=${encodeURIComponent(shareText(payload))}&url=${encodeURIComponent(url)}`,
    );
    expect(intents.facebook).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    );
  });
});
