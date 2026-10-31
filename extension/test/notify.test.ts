import { describe, expect, it } from 'vitest';
import { formatAmount, type Habit } from '../src/catalog.js';
import { messageKeys, translator } from '../src/i18n.js';
import { buildNotification, MAX_QUOTE_CHARS, pickQuote, quoteDisplay, toQuoteLite, type QuoteLite } from '../src/quotes.js';

const ar = translator('ar');
const en = translator('en');

const ID1 = '93f7d1ab-b6f7-4521-bae8-f37cc1ff06a2';
const ID2 = 'aa18c734-8541-4cea-a9b9-f3efcf432b31';
const ID3 = '9b96171e-8218-49a3-bfdd-c94f65b126a1';

/** A QuoteDto-like object as the API returns it (more fields than the extension keeps). */
function dto(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: ID1,
    type: 'HADITH',
    origin: 'LOCAL',
    textAr: 'نص من القاعدة',
    translation: null,
    quran: null,
    hadith: { narrator: null, narratorAr: null, grade: 'SAHIH', reference: 'صحيح مسلم 720', outsideSahihayn: false },
    book: null,
    citation: { volume: null, page: null, gradeAuthority: null, gradeReference: null, alsoIn: null },
    source: { id: 's', name: 'x' },
    tags: [],
    isAthar: false,
    atharSpeakerKey: null,
    atharSpeakerAr: null,
    ...over,
  };
}

function lite(over: Record<string, unknown>): QuoteLite {
  const q = toQuoteLite(dto(over));
  if (!q) throw new Error('fixture is not a valid quote');
  return q;
}

describe('toQuoteLite', () => {
  it('keeps only the known fields', () => {
    const q = lite({ secret: 'x', source: { id: 'y' } });
    expect(Object.keys(q).sort()).toEqual(
      ['atharSpeakerAr', 'ayahNumber', 'id', 'isAthar', 'paraphrase', 'reference', 'surahName', 'surahNameAr', 'textAr', 'translationEn', 'type'].sort(),
    );
    expect(q.reference).toBe('صحيح مسلم 720');
  });

  it('rejects quotes without id, a known type or Arabic text', () => {
    expect(toQuoteLite(dto({ textAr: '  ' }))).toBeNull();
    expect(toQuoteLite(dto({ id: 'not-a-uuid' }))).toBeNull();
    expect(toQuoteLite(dto({ type: 'OTHER' }))).toBeNull();
    expect(toQuoteLite(null)).toBeNull();
  });

  it('keeps an English translation only when the source supplied one in English', () => {
    expect(lite({ translation: { languageCode: 'en', text: 'From the source' } }).translationEn).toBe('From the source');
    expect(lite({ translation: { languageCode: 'fr', text: 'Texte' } }).translationEn).toBeNull();
  });
});

describe('quoteDisplay', () => {
  it('shows a hadith with its reference, and never without one', () => {
    expect(quoteDisplay(lite({}), 'ar', ar)).toEqual({ text: '«نص من القاعدة»', source: 'صحيح مسلم 720' });
    expect(quoteDisplay(lite({ hadith: { reference: null } }), 'ar', ar)).toBeNull();
    const retold = lite({ citation: { volume: null, page: null, gradeAuthority: 'الأستاذ أنس شيخ اكريم', gradeReference: 'رواه بمعناه', alsoIn: null } });
    expect(quoteDisplay(retold, 'ar', ar)?.source).toBe('بمعناه — صحيح مسلم 720');
  });

  it('always labels an athar «أثر، وليس حديثًا», whatever its type', () => {
    const q = lite({ type: 'SCHOLAR_QUOTE', isAthar: true, atharSpeakerAr: 'ابن مسعود', hadith: null });
    expect(quoteDisplay(q, 'ar', ar)).toEqual({ text: '«نص من القاعدة»', source: 'أثر، وليس حديثًا — ابن مسعود' });
    const typedAsHadith = lite({ isAthar: true, atharSpeakerAr: null });
    expect(quoteDisplay(typedAsHadith, 'ar', ar)?.source).toBe('أثر، وليس حديثًا');
    expect(quoteDisplay(typedAsHadith, 'en', en)?.source).toBe('A saying, not a hadith');
  });

  it('shows a verse with surah and ayah', () => {
    const q = lite({ type: 'QURAN_VERSE', hadith: null, quran: { surahNumber: 2, surahName: 'Al-Baqarah', surahNameAr: 'البقرة', ayahNumber: 286 } });
    expect(quoteDisplay(q, 'ar', ar)).toEqual({ text: '﴿نص من القاعدة﴾', source: 'البقرة: 286' });
    expect(quoteDisplay(q, 'en', en)?.source).toBe('Al-Baqarah: 286');
    expect(quoteDisplay(lite({ type: 'QURAN_VERSE', hadith: null, quran: { surahNameAr: 'البقرة', ayahNumber: null } }), 'ar', ar)).toBeNull();
  });

  it('skips other quote kinds that are not athar', () => {
    expect(quoteDisplay(lite({ type: 'BOOK_EXCERPT' }), 'ar', ar)).toBeNull();
  });

  it('uses the source translation in English, else the Arabic text (no machine translation)', () => {
    expect(quoteDisplay(lite({ translation: { languageCode: 'en', text: 'Source text' } }), 'en', en)?.text).toBe('«Source text»');
    expect(quoteDisplay(lite({}), 'en', en)?.text).toBe('«نص من القاعدة»');
  });
});

describe('pickQuote', () => {
  const quotes = {
    [ID1]: lite({ id: ID1, textAr: 'ط'.repeat(MAX_QUOTE_CHARS + 1) }),
    [ID2]: lite({ id: ID2, hadith: { reference: null } }),
    [ID3]: lite({ id: ID3, textAr: 'قصير', hadith: { reference: 'صحيح البخاري 1' } }),
  };

  it('takes the first showable quote in catalog order, skipping long ones instead of cutting them', () => {
    expect(pickQuote([ID1, ID2, ID3], quotes, 'ar', ar)).toEqual({ text: '«قصير»', source: 'صحيح البخاري 1' });
  });

  it('gives nothing when offline with no cache, or when no quote qualifies', () => {
    expect(pickQuote([ID1, ID2, ID3], {}, 'ar', ar)).toBeNull();
    expect(pickQuote([ID1, ID2], quotes, 'ar', ar)).toBeNull();
  });
});

const habit = (unitLabelAr: string, unitLabelEn: string, extra: Partial<Habit> = {}): Habit => ({
  key: 'h',
  titleAr: 'ع',
  titleEn: 'h',
  deed: 'nawafil',
  unit: 'times',
  unitLabelAr,
  unitLabelEn,
  defaultRule: { kind: 'daily' },
  defaultSlots: ['09:00'],
  basis: 'text',
  evidence: [],
  ...extra,
});
const duha = habit('ركعتان', "two rak'ahs", { rakah: 'pairs' });

describe('buildNotification', () => {
  it('puts the amount first, then the quote and its source line', () => {
    const quran = habit('دقيقة', 'minutes', { unit: 'minutes' });
    const n = buildNotification({ title: 'ورد القرآن', amountText: formatAmount(2, 'minutes', quran, 'ar'), quote: { text: '«نص»', source: 'صحيح مسلم 720' }, t: ar });
    expect(n).toEqual({ title: 'ورد القرآن', message: 'المطلوب اليوم: دقيقتان\n«نص»\nصحيح مسلم 720' });
  });

  it('shows only the amount when there is no published quote', () => {
    const n = buildNotification({ title: 'Duha prayer', amountText: formatAmount(1, 'times', duha, 'en'), quote: null, t: en });
    expect(n.message).toBe("Today: 2 rak'ahs");
  });

  it('formats amounts with Western digits, prayers in rak\'ahs', () => {
    expect(formatAmount(33, 'count', habit('مرة', 'times', { unit: 'count' }), 'ar')).toBe('33 مرة');
    expect(formatAmount(2, 'times', duha, 'ar')).toBe('4 ركعات');
    expect(formatAmount(1, 'times', duha, 'ar')).toBe('ركعتان');
    expect(formatAmount(2, 'times', habit('صدقة', 'gift'), 'ar')).toBe('2 × صدقة');
    expect(formatAmount(10, 'minutes', undefined, 'ar')).toBe('10');
  });
});
