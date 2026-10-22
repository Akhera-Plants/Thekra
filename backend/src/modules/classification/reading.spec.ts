import { compareReading, readingTier, type ReadingRow } from './reading.js';

function row(partial: Partial<ReadingRow> & Pick<ReadingRow, 'id' | 'basis'>): ReadingRow {
  return {
    relevanceScore: 50,
    quoteId: partial.id,
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

describe('reading order', () => {
  it('puts a verse before a Sahihayn hadith and that before another hadith', () => {
    const ayah = row({ id: 'a', basis: 'CHAPTER_AYAH', quote: { type: 'QURAN_VERSE', sourceId: null, grade: null, createdAt: new Date(0) }, relevanceScore: 10 });
    const sahih = row({
      id: 'b',
      basis: 'CHAPTER',
      quote: { type: 'HADITH', sourceId: '10000000-0000-4000-8000-000000000002', grade: 'SAHIH', createdAt: new Date(0) },
      relevanceScore: 99,
    });
    const other = row({ id: 'c', basis: 'REVIEWER_SECTION', relevanceScore: 100 });
    const ordered = [other, sahih, ayah].sort(compareReading);
    expect(ordered.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(readingTier(ayah)).toBe(0);
    expect(readingTier(sahih)).toBe(1);
    expect(readingTier(other)).toBe(2);
  });

  it('keeps a higher score ahead inside the same band, and a null score last', () => {
    const low = row({ id: 'low', basis: 'MANUAL', relevanceScore: 10 });
    const high = row({ id: 'high', basis: 'MANUAL', relevanceScore: 80 });
    const missing = row({ id: 'none', basis: 'MANUAL', relevanceScore: null });
    expect([low, missing, high].sort(compareReading).map((item) => item.id)).toEqual(['high', 'low', 'none']);
  });
});
