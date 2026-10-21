import { readThemedPage, summariseThemes } from './theme-reading.js';
import type { TopicTheme } from './topic-themes.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const theme = (key: string): TopicTheme => ({ topic: 't', key, ar: key, en: key, match: [key], order: 0 });

function summaryRow(quoteId: string, themeKeys: string[], type = 'HADITH', isAthar = false, atharReviewDecision: string | null = null) {
  return { quoteId, themeKeys, quote: { type, isAthar, atharReviewDecision } };
}

function readingRow(id: string, quoteId: string, type = 'HADITH', relevanceScore: number | null = 50) {
  return { id, quoteId, basis: 'CHAPTER', relevanceScore, classifiedBy: 'BOOK', note: null, quote: { type, sourceId: null, grade: 'SAHIH', createdAt: new Date('2026-01-01') } };
}

describe('summariseThemes', () => {
  it('counts distinct texts per theme across both sides and kind counts for the active one', async () => {
    const sinFindMany = vi.fn().mockResolvedValue([summaryRow('q1', ['a']), summaryRow('q2', ['a', 'b'], 'QURAN_VERSE')]);
    const prisma = {
      sinQuote: { findMany: sinFindMany },
      goodDeedQuote: { findMany: vi.fn().mockResolvedValue([summaryRow('q1', ['a']), summaryRow('q3', ['b'], 'HADITH', true, 'KEEP')]) },
    } as unknown as PrismaService;
    const result = await summariseThemes(prisma, { sin: { sinId: 's' }, deed: { goodDeedId: 'd' } }, [theme('a'), theme('b'), theme('c')], 'b');
    expect(result.themes.map((row) => [row.key, row.count])).toEqual([['a', 2], ['b', 2], ['c', 0]]);
    expect(result.countsByKind).toEqual({ all: 2, verse: 1, hadith: 0, athar: 1 });
    const where = sinFindMany.mock.calls[0]?.[0].where;
    expect(where.themeKeys).toEqual({ hasSome: ['a', 'b', 'c'] });
  });

  it('skips the queries when the page has no themes', async () => {
    const findMany = vi.fn();
    const prisma = { sinQuote: { findMany }, goodDeedQuote: { findMany } } as unknown as PrismaService;
    expect(await summariseThemes(prisma, { sin: {} }, [], null)).toEqual({ themes: [], countsByKind: null });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('readThemedPage', () => {
  it('merges both sides in reading order, drops a duplicate text and pages the result', async () => {
    const sinQuote = {
      findMany: vi.fn()
        .mockResolvedValueOnce([readingRow('s1', 'q1', 'HADITH', 80), readingRow('s2', 'q2', 'HADITH', 10)])
        .mockImplementation(({ where }: { where: { id: { in: string[] } } }) => Promise.resolve(where.id.in.map((id) => ({ id, quote: {} })))),
    };
    const goodDeedQuote = {
      findMany: vi.fn()
        .mockResolvedValueOnce([readingRow('d1', 'q1', 'HADITH', 90), readingRow('d2', 'q3', 'QURAN_VERSE', 5)])
        .mockImplementation(({ where }: { where: { id: { in: string[] } } }) => Promise.resolve(where.id.in.map((id) => ({ id, quote: {} })))),
    };
    const prisma = { sinQuote, goodDeedQuote } as unknown as PrismaService;
    const page = await readThemedPage(prisma, { sin: {}, deed: {} }, { page: 1, limit: 2, include: {}, present: (row) => (row as { id: string }).id });
    // Verse first (tier 0), then q1 once (the deed link scores higher), q2 on page 2.
    expect(page.items).toEqual(['d2', 'd1']);
    expect(page.total).toBe(3);
    expect(page.countsByType).toMatchObject({ QURAN_VERSE: 1, HADITH: 2 });
  });
});
