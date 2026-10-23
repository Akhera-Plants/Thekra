import { QuotesService } from './quotes.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

function build() {
  const prisma = {
    quote: { findMany: vi.fn().mockResolvedValue([{ id: 'q1', sourceId: 's1' }, { id: 'q2', sourceId: 's2' }]) },
    source: { findMany: vi.fn().mockResolvedValue([{ id: 's1', name: 'One' }, { id: 's2', name: 'Two' }]) },
    translation: { findMany: vi.fn().mockResolvedValue([{ quoteId: 'q2', languageCode: 'en', text: 'hello' }]) },
    quoteTag: {
      findMany: vi.fn().mockResolvedValue([
        { quoteId: 'q1', tag: { slug: 'a' } },
        { quoteId: 'q2', tag: { slug: 'a' } },
        { quoteId: 'q1', tag: { slug: 'b' } },
      ]),
    },
    hadithMatch: {
      findMany: vi.fn().mockResolvedValue([
        { quoteId: 'q1', score: 0.99, referenceHadith: { matnText: 'best' } },
        { quoteId: 'q1', score: 0.8, referenceHadith: { matnText: 'worse' } },
      ]),
    },
  };
  const service = new QuotesService(prisma as unknown as PrismaService, { get: vi.fn() } as never);
  return { prisma, service };
}

describe('QuotesService.hydrateLinks', () => {
  it('attaches source, translations, tags and the best match to each link, in link order, with one query per relation', async () => {
    const { prisma, service } = build();
    const links = [
      { id: 'l3', quoteId: 'q2', quote: { type: 'partial' } },
      { id: 'l1', quoteId: 'q1' },
      { id: 'l2', quoteId: 'q1' },
    ];
    const rows = await service.hydrateLinks(links, 'en');
    expect(rows.map((row) => row.id)).toEqual(['l3', 'l1', 'l2']);
    expect(rows[1]?.quote).toMatchObject({
      id: 'q1',
      source: { name: 'One' },
      translations: [],
      tags: [{ tag: { slug: 'a' } }, { tag: { slug: 'b' } }],
      matches: [{ referenceHadith: { matnText: 'best' } }],
    });
    expect(rows[0]?.quote).toMatchObject({ id: 'q2', translations: [{ text: 'hello' }], matches: [] });
    // The partial `quote` of a ranked row is replaced, and a text linked twice is loaded once.
    expect((rows[0] as { quote: { type?: string } }).quote.type).toBeUndefined();
    for (const model of [prisma.quote, prisma.source, prisma.translation, prisma.quoteTag, prisma.hadithMatch]) {
      expect(model.findMany).toHaveBeenCalledTimes(1);
    }
    expect(prisma.quote.findMany.mock.calls[0]?.[0].where.id.in).toEqual(['q2', 'q1']);
  });

  it('skips the translation query for Arabic and every query for an empty page', async () => {
    const { prisma, service } = build();
    await service.hydrateLinks([{ quoteId: 'q1' }], 'ar');
    expect(prisma.translation.findMany).not.toHaveBeenCalled();
    prisma.quote.findMany.mockClear();
    expect(await service.hydrateLinks([], 'en')).toEqual([]);
    expect(prisma.quote.findMany).not.toHaveBeenCalled();
  });
});
