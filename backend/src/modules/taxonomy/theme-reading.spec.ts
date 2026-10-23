import { findActiveTheme, mergePageThemes, readThemedPage, summariseThemes, type PageTheme } from './theme-reading.js';
import type { TopicTheme } from './topic-themes.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const theme = (key: string): PageTheme => ({ key, ar: key, en: key, keys: [key] });
const topicTheme = (topic: string, key: string, ar: string, en = ar): TopicTheme => ({ topic, key, ar, en, match: [key], order: 0 });

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
    const result = await summariseThemes(prisma, { sin: { sinId: 's' }, deed: { goodDeedId: 'd' } }, [theme('a'), theme('b'), theme('c')], theme('b'));
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

describe('mergePageThemes', () => {
  const themes = [
    topicTheme('ghadab', 'ghadab-milk', 'من يملك نفسه عند الغضب', 'Controlling oneself when angry'),
    topicTheme('ghadab', 'ghadab-hadhar', 'الحذر من الغضب', 'Beware of anger'),
    topicTheme('kaff', 'kaff-milk', 'من يملك نفسه عند الغضب', 'Controlling oneself when angry'),
    topicTheme('kaff', 'kaff-adha', 'احتمال الأذى', 'Bearing harm'),
  ];

  it('shows one chip per shared label, keyed by the sin-side theme, in page order', () => {
    expect(mergePageThemes(themes, 'ghadab').map((row) => [row.key, row.keys])).toEqual([
      ['ghadab-milk', ['ghadab-milk', 'kaff-milk']],
      ['ghadab-hadhar', ['ghadab-hadhar']],
      ['kaff-adha', ['kaff-adha']],
    ]);
    // The deed page lists its own side first but keeps the same chip key.
    const deedPage = [themes[2], themes[3], themes[0], themes[1]] as TopicTheme[];
    expect(mergePageThemes(deedPage, 'ghadab').map((row) => row.key)).toEqual(['ghadab-milk', 'kaff-adha', 'ghadab-hadhar']);
  });

  it('compares the folded Arabic label (tashkeel, hamza seats)', () => {
    const merged = mergePageThemes([topicTheme('a', 'a-1', 'الأذى'), topicTheme('b', 'b-1', 'الاذى')], 'a');
    expect(merged).toHaveLength(1);
  });

  it('keeps themes that share no label and never merges two themes of one topic', () => {
    const same = [topicTheme('a', 'a-1', 'x'), topicTheme('a', 'a-2', 'x'), topicTheme('b', 'b-1', 'y')];
    expect(mergePageThemes(same, 'a').map((row) => row.keys)).toEqual([['a-1'], ['a-2'], ['b-1']]);
  });

  it('resolves ?theme= by the chip key or any merged key', () => {
    const merged = mergePageThemes(themes, 'ghadab');
    expect(findActiveTheme(merged, 'kaff-milk')?.key).toBe('ghadab-milk');
    expect(findActiveTheme(merged, 'ghadab-milk')?.key).toBe('ghadab-milk');
    expect(findActiveTheme(merged, 'nope')).toBeNull();
    expect(findActiveTheme(merged, undefined)).toBeNull();
  });

  it('counts a text linked under both keys once', async () => {
    const chip: PageTheme = { key: 'a', ar: 'x', en: 'x', keys: ['a', 'b'] };
    const prisma = {
      sinQuote: { findMany: vi.fn().mockResolvedValue([summaryRow('q1', ['a']), summaryRow('q2', ['a'])]) },
      goodDeedQuote: { findMany: vi.fn().mockResolvedValue([summaryRow('q2', ['b']), summaryRow('q3', ['b'])]) },
    } as unknown as PrismaService;
    const result = await summariseThemes(prisma, { sin: {}, deed: {} }, [chip], chip);
    expect(result.themes).toEqual([{ key: 'a', ar: 'x', en: 'x', count: 3 }]);
    expect(result.countsByKind?.all).toBe(3);
  });
});

describe('readThemedPage', () => {
  it('merges both sides in reading order, drops a duplicate text and pages the result', async () => {
    const sinQuote = { findMany: vi.fn().mockResolvedValue([readingRow('s1', 'q1', 'HADITH', 80), readingRow('s2', 'q2', 'HADITH', 10)]) };
    const goodDeedQuote = { findMany: vi.fn().mockResolvedValue([readingRow('d1', 'q1', 'HADITH', 90), readingRow('d2', 'q3', 'QURAN_VERSE', 5)]) };
    const prisma = { sinQuote, goodDeedQuote } as unknown as PrismaService;
    const hydrate = vi.fn().mockImplementation((rows: { id: string }[]) => Promise.resolve(rows));
    const page = await readThemedPage(prisma, { sin: {}, deed: {} }, { page: 1, limit: 2, hydrate, present: (row) => (row as { id: string }).id });
    // Verse first (tier 0), then q1 once (the deed link scores higher), q2 on page 2.
    expect(page.items).toEqual(['d2', 'd1']);
    expect(page.total).toBe(3);
    expect(page.countsByType).toMatchObject({ QURAN_VERSE: 1, HADITH: 2 });
    // One ranked query per side, then one hydrate for the page only.
    expect(sinQuote.findMany).toHaveBeenCalledTimes(1);
    expect(goodDeedQuote.findMany).toHaveBeenCalledTimes(1);
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(hydrate.mock.calls[0]?.[0]).toHaveLength(2);
  });
});
