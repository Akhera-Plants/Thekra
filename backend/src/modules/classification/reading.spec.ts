import {
  basisPriority,
  compareReading,
  firstReadingQuoteId,
  pageReadingIds,
  readingHasNext,
  readingTier,
  type ReadingRow,
} from './reading.js';

const BUKHARI = '10000000-0000-4000-8000-000000000002';

function row(partial: Partial<ReadingRow> & Pick<ReadingRow, 'id' | 'basis'>): ReadingRow {
  return {
    relevanceScore: 50,
    quoteId: partial.id,
    classifiedBy: 'BOOK',
    note: null,
    ...partial,
    quote: {
      type: 'HADITH',
      sourceId: null,
      grade: 'SAHIH',
      createdAt: new Date('2020-01-01'),
      ...partial.quote,
    },
  };
}

function verse(partial: Partial<ReadingRow> & Pick<ReadingRow, 'id' | 'basis'>): ReadingRow {
  return row({ ...partial, quote: { type: 'QURAN_VERSE', sourceId: null, grade: null, createdAt: new Date(0), ...partial.quote } });
}

const order = (rows: ReadingRow[]) => [...rows].sort(compareReading).map((item) => item.id);

const TARGHIB = 'أورده المنذري في باب: الترغيب في قيام الليل — صحيح الترغيب والترهيب';
const RIYAD = 'أورده النووي في باب: باب الإصلاح بين الناس — رياض الصالحين';

describe('reading order', () => {
  it('puts a verse before a Sahihayn hadith and that before another hadith', () => {
    const ayah = verse({ id: 'a', basis: 'REVIEWER_SECTION', relevanceScore: 10 });
    const sahih = row({
      id: 'b',
      basis: 'CHAPTER',
      quote: { type: 'HADITH', sourceId: BUKHARI, grade: 'SAHIH', createdAt: new Date(0) },
      relevanceScore: 99,
    });
    const other = row({ id: 'c', basis: 'REVIEWER_SECTION', relevanceScore: 100 });
    expect(order([other, sahih, ayah])).toEqual(['a', 'b', 'c']);
    expect(readingTier(ayah)).toBe(0);
    expect(readingTier(sahih)).toBe(1);
    expect(readingTier(other)).toBe(2);
  });

  it('keeps a higher score ahead inside the same band and basis, and a null score last', () => {
    const low = row({ id: 'low', basis: 'MANUAL', relevanceScore: 10 });
    const high = row({ id: 'high', basis: 'MANUAL', relevanceScore: 80 });
    const missing = row({ id: 'none', basis: 'MANUAL', relevanceScore: null });
    expect(order([low, missing, high])).toEqual(['high', 'low', 'none']);
  });

  // Owner, 2026-11-01: al-Falaq 113:4 (a verse inside a hadith of al-Mundhiri's qiyam chapter) opened «النوافل وقيام الليل».
  it('puts a CHAPTER_AYAH verse after every other text, even with a higher score', () => {
    const falaq = verse({ id: 'falaq', basis: 'CHAPTER_AYAH', note: TARGHIB, relevanceScore: 90 });
    const chapter = row({ id: 'chapter', basis: 'CHAPTER', relevanceScore: 50 });
    const ai = row({ id: 'ai', basis: 'AI_ITEM', relevanceScore: 10, quote: { type: 'HADITH', sourceId: null, grade: 'HASAN', createdAt: new Date(0) } });
    const takhrij = row({ id: 'takhrij', basis: 'TAKHRIJ', relevanceScore: 80, quote: { type: 'HADITH', sourceId: BUKHARI, grade: 'SAHIH', createdAt: new Date(0) } });
    const reviewerVerse = verse({ id: 'reviewer-verse', basis: 'REVIEWER_SECTION', relevanceScore: 90 });
    expect(order([falaq, chapter, ai, takhrij, reviewerVerse])).toEqual(['reviewer-verse', 'takhrij', 'chapter', 'ai', 'falaq']);
    expect(order([falaq, chapter])).toEqual(['chapter', 'falaq']);
    // It sits in the last band, so a list's bands still only go up.
    expect(readingTier(falaq)).toBe(2);
  });

  it('keeps a chapter verse the author chose (Riyad al-Salihin) with the verses; only Targhib in-hadith verses go last', () => {
    const riyad = verse({ id: 'riyad', basis: 'CHAPTER_AYAH', note: RIYAD, relevanceScore: 90 });
    const targhib = verse({ id: 'targhib', basis: 'CHAPTER_AYAH', note: TARGHIB, relevanceScore: 95 });
    const hadith = row({ id: 'hadith', basis: 'CHAPTER', relevanceScore: 50 });
    expect(order([targhib, hadith, riyad])).toEqual(['riyad', 'hadith', 'targhib']);
    expect(firstReadingQuoteId([targhib, hadith, riyad])).toBe(riyad.quoteId);
  });

  it('orders bases inside a band: reviewer, manual, chapter, takhrij, author, AI, then CHAPTER_AYAH', () => {
    const bases = ['CHAPTER_AYAH', 'AI_ITEM', 'AUTHOR_CITATION', 'TAKHRIJ', 'CHAPTER', 'MANUAL', 'REVIEWER_SECTION'];
    const rows = bases.map((basis) => row({ id: basis, basis, note: TARGHIB, relevanceScore: basis === 'CHAPTER_AYAH' ? 100 : 50 }));
    // TAKHRIJ is a Sahihayn copy: it leads the list from its own band, the rest share the «other» band.
    expect(order(rows)).toEqual(['TAKHRIJ', 'REVIEWER_SECTION', 'MANUAL', 'CHAPTER', 'AUTHOR_CITATION', 'AI_ITEM', 'CHAPTER_AYAH']);
    expect([...bases].sort((a, b) => basisPriority(a) - basisPriority(b))).toEqual([
      'REVIEWER_SECTION', 'MANUAL', 'CHAPTER', 'TAKHRIJ', 'AUTHOR_CITATION', 'AI_ITEM', 'CHAPTER_AYAH',
    ]);
  });

  it('pages CHAPTER_AYAH verses after the other texts across pages', () => {
    const rows = [
      verse({ id: 'v1', basis: 'CHAPTER_AYAH', note: TARGHIB, relevanceScore: 90 }),
      verse({ id: 'v2', basis: 'CHAPTER_AYAH', note: TARGHIB, relevanceScore: 90 }),
      row({ id: 'h1', basis: 'CHAPTER', relevanceScore: 80 }),
      row({ id: 'h2', basis: 'CHAPTER', relevanceScore: 70 }),
      row({ id: 'h3', basis: 'REVIEWER_SECTION', relevanceScore: 50 }),
    ];
    expect(pageReadingIds(rows, 1, 2)).toEqual(['h3', 'h1']);
    expect(pageReadingIds(rows, 2, 2)).toEqual(['h2', 'v1']);
    expect(pageReadingIds(rows, 3, 2)).toEqual(['v2']);
  });
});

describe('firstReadingQuoteId («الميزان» source top)', () => {
  it('skips a CHAPTER_AYAH verse while the topic has any other text', () => {
    const rows = [
      verse({ id: 'falaq-link', basis: 'CHAPTER_AYAH', note: TARGHIB, quoteId: 'falaq', relevanceScore: 90 }),
      row({ id: 'weakest-link', basis: 'AI_ITEM', quoteId: 'weakest', relevanceScore: 10 }),
    ];
    expect(firstReadingQuoteId(rows)).toBe('weakest');
  });

  it('is the first text of the list in reading order', () => {
    const rows = [
      row({ id: 'h', basis: 'CHAPTER', quoteId: 'hadith', relevanceScore: 80 }),
      verse({ id: 'v', basis: 'AUTHOR_CITATION', quoteId: 'verse', relevanceScore: 90 }),
      verse({ id: 'c', basis: 'CHAPTER_AYAH', note: TARGHIB, quoteId: 'chapter-ayah', relevanceScore: 90 }),
    ];
    expect(firstReadingQuoteId(rows)).toBe('verse');
    expect(firstReadingQuoteId(rows)).toBe([...rows].sort(compareReading)[0]?.quoteId);
  });

  it('falls back to a CHAPTER_AYAH verse only when it is all the topic has, and null when empty', () => {
    expect(firstReadingQuoteId([verse({ id: 'c', basis: 'CHAPTER_AYAH', note: TARGHIB, quoteId: 'only' })])).toBe('only');
    expect(firstReadingQuoteId([])).toBeNull();
  });
});

describe('readingHasNext', () => {
  it('continues while any list of the page has more texts', () => {
    // ghibah: 23 own texts and 20+ on the paired side, 20 per page.
    expect(readingHasNext(1, 20, [23, 20])).toBe(true);
    // The paired side is longer than the topic's own list.
    expect(readingHasNext(2, 20, [23, 60])).toBe(true);
    expect(readingHasNext(3, 20, [23, 60])).toBe(false);
  });

  it('continues when a derived group filled the page', () => {
    expect(readingHasNext(1, 20, [0], [20])).toBe(true);
    expect(readingHasNext(1, 20, [0], [7])).toBe(false);
  });
});
