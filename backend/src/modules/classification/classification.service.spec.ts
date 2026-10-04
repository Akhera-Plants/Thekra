import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HadithGrade, QuoteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ClassificationService } from './classification.service.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SIN = { id: 'sin-1', slug: 'ghibah', name: 'Backbiting', nameAr: 'الغيبة' };
const GOOD_DEED = { id: 'gd-1', slug: 'sadaqah', name: 'Charity', nameAr: 'الصدقة' };
const QUOTE_SAHIH = {
  id: 'q-1',
  type: QuoteType.HADITH,
  textAr: 'نص',
  grade: HadithGrade.SAHIH,
};
const QUOTE_VERSE = {
  id: 'q-2',
  type: QuoteType.QURAN_VERSE,
  textAr: 'آية',
  grade: null,
};
const QUOTE_MAWDU = {
  id: 'q-3',
  type: QuoteType.HADITH,
  textAr: 'موضوع',
  grade: HadithGrade.MAWDU,
};

// ─── Prisma mock ──────────────────────────────────────────────────────────────

function makePrismaMock() {
  return {
    sin: { findUnique: vi.fn() },
    goodDeed: { findUnique: vi.fn() },
    quote: { findUnique: vi.fn(), findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    sinQuote: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    goodDeedQuote: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    quoteTag: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ClassificationService', () => {
  let service: ClassificationService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ClassificationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── linkSinQuote ────────────────────────────────────────────────────────────

  describe('linkSinQuote', () => {
    it('returns created=true when the link is new', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_VERSE);
      prisma.sinQuote.findUnique.mockResolvedValue(null); // no existing link
      const upsertResult = { id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 80, note: null, sin: SIN, quote: QUOTE_VERSE };
      prisma.sinQuote.upsert.mockResolvedValue(upsertResult);

      const result = await service.linkSinQuote({
        sinId: SIN.id,
        quoteId: QUOTE_VERSE.id,
        relevanceScore: 80,
      });

      expect(result.created).toBe(true);
      expect(result.link.id).toBe('link-1');
    });

    it('returns created=false (updated) when the link already exists', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_VERSE);
      prisma.sinQuote.findUnique.mockResolvedValue({ id: 'link-1' }); // existing
      const upsertResult = { id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 90, note: null, sin: SIN, quote: QUOTE_VERSE };
      prisma.sinQuote.upsert.mockResolvedValue(upsertResult);

      const result = await service.linkSinQuote({
        sinId: SIN.id,
        quoteId: QUOTE_VERSE.id,
        relevanceScore: 90,
      });

      expect(result.created).toBe(false);
      expect(prisma.sinQuote.upsert).toHaveBeenCalledTimes(1); // no duplicate error
    });

    it('throws 422 RELATED_RESOURCE_INVALID when sinId does not exist', async () => {
      prisma.sin.findUnique.mockResolvedValue(null);

      await expect(
        service.linkSinQuote({ sinId: 'missing', quoteId: QUOTE_VERSE.id }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      const err = await service
        .linkSinQuote({ sinId: 'missing', quoteId: QUOTE_VERSE.id })
        .catch((e: UnprocessableEntityException) => e);
      expect((err as UnprocessableEntityException).getResponse()).toMatchObject({
        code: 'RELATED_RESOURCE_INVALID',
      });
    });

    it('throws 422 RELATED_RESOURCE_INVALID when quoteId does not exist', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique.mockResolvedValue(null);

      await expect(
        service.linkSinQuote({ sinId: SIN.id, quoteId: 'missing' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws 422 GRADE_NOT_PERMITTED when linking a MAWDU hadith', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_MAWDU);

      const err = await service
        .linkSinQuote({ sinId: SIN.id, quoteId: QUOTE_MAWDU.id })
        .catch((e: UnprocessableEntityException) => e);

      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect((err as UnprocessableEntityException).getResponse()).toMatchObject({
        code: 'GRADE_NOT_PERMITTED',
      });
    });

    it('accepts QURAN_VERSE links without grade check', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_VERSE);
      prisma.sinQuote.findUnique.mockResolvedValue(null);
      const upsertResult = { id: 'link-2', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 0, note: null, sin: SIN, quote: QUOTE_VERSE };
      prisma.sinQuote.upsert.mockResolvedValue(upsertResult);

      await expect(
        service.linkSinQuote({ sinId: SIN.id, quoteId: QUOTE_VERSE.id }),
      ).resolves.toMatchObject({ created: true });
    });

    it('validates relevanceScore upper bound via DTO (service accepts 0–100)', async () => {
      // The service itself doesn't validate bounds (DTO does), but confirm upsert uses the passed score
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_SAHIH);
      prisma.sinQuote.findUnique.mockResolvedValue(null);
      const upsertResult = { id: 'link-3', sinId: SIN.id, quoteId: QUOTE_SAHIH.id, relevanceScore: 100, note: null, sin: SIN, quote: QUOTE_SAHIH };
      prisma.sinQuote.upsert.mockResolvedValue(upsertResult);

      const result = await service.linkSinQuote({
        sinId: SIN.id,
        quoteId: QUOTE_SAHIH.id,
        relevanceScore: 100,
      });

      expect(prisma.sinQuote.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ relevanceScore: 100 }),
        }),
      );
      expect(result.link.relevanceScore).toBe(100);
    });
  });

  // ─── updateSinLink ───────────────────────────────────────────────────────────

  describe('updateSinLink', () => {
    it('throws 404 when link does not exist', async () => {
      prisma.sinQuote.findUnique.mockResolvedValue(null);

      await expect(service.updateSinLink('missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates relevanceScore and note', async () => {
      prisma.sinQuote.findUnique.mockResolvedValue({ id: 'link-1' });
      const updated = { id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 75, note: 'new note', sin: SIN, quote: QUOTE_VERSE };
      prisma.sinQuote.update.mockResolvedValue(updated);

      const result = await service.updateSinLink('link-1', {
        relevanceScore: 75,
        note: 'new note',
      });

      expect(result.relevanceScore).toBe(75);
      expect(result.note).toBe('new note');
    });
  });

  // ─── unlinkSinQuote ──────────────────────────────────────────────────────────

  describe('unlinkSinQuote', () => {
    it('throws 404 when link does not exist', async () => {
      prisma.sinQuote.findUnique.mockResolvedValue(null);
      await expect(service.unlinkSinQuote('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes the link (quote survives)', async () => {
      prisma.sinQuote.findUnique.mockResolvedValue({ id: 'link-1' });
      prisma.sinQuote.delete.mockResolvedValue({ id: 'link-1' });

      await service.unlinkSinQuote('link-1');

      expect(prisma.sinQuote.delete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
    });
  });

  // ─── bulkLinkSinQuotes ────────────────────────────────────────────────────────

  describe('bulkLinkSinQuotes', () => {
    it('throws 422 when sinId does not exist', async () => {
      prisma.sin.findUnique.mockResolvedValue(null);

      await expect(
        service.bulkLinkSinQuotes({ sinId: 'missing', links: [] }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('reports partial failure for missing quoteId', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique
        .mockResolvedValueOnce(QUOTE_VERSE) // first item ok
        .mockResolvedValueOnce(null);       // second item missing
      prisma.sinQuote.findUnique.mockResolvedValue(null);
      prisma.sinQuote.upsert.mockResolvedValue({
        id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 0, note: null,
      });

      const result = await service.bulkLinkSinQuotes({
        sinId: SIN.id,
        links: [
          { quoteId: QUOTE_VERSE.id },
          { quoteId: 'missing-quote' },
        ],
      });

      expect(result.data.created).toBe(1);
      expect(result.data.failed).toHaveLength(1);
      expect(result.data.failed[0]).toMatchObject({
        quoteId: 'missing-quote',
        reason: 'RELATED_RESOURCE_INVALID',
      });
    });

    it('reports partial failure for MAWDU grade', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique
        .mockResolvedValueOnce(QUOTE_VERSE)
        .mockResolvedValueOnce(QUOTE_MAWDU);
      prisma.sinQuote.findUnique.mockResolvedValue(null);
      prisma.sinQuote.upsert.mockResolvedValue({
        id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 0, note: null,
      });

      const result = await service.bulkLinkSinQuotes({
        sinId: SIN.id,
        links: [{ quoteId: QUOTE_VERSE.id }, { quoteId: QUOTE_MAWDU.id }],
      });

      expect(result.data.created).toBe(1);
      expect(result.data.failed).toHaveLength(1);
      expect(result.data.failed[0]).toMatchObject({ reason: 'GRADE_NOT_PERMITTED' });
    });

    it('correctly counts created vs updated', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findUnique
        .mockResolvedValueOnce(QUOTE_VERSE)
        .mockResolvedValueOnce(QUOTE_SAHIH);
      prisma.sinQuote.findUnique
        .mockResolvedValueOnce(null)                // first: new link
        .mockResolvedValueOnce({ id: 'existing' }); // second: existing link
      prisma.sinQuote.upsert.mockResolvedValue({ id: 'x', sinId: SIN.id, quoteId: 'q', relevanceScore: 0, note: null });

      const result = await service.bulkLinkSinQuotes({
        sinId: SIN.id,
        links: [{ quoteId: QUOTE_VERSE.id }, { quoteId: QUOTE_SAHIH.id }],
      });

      expect(result.data.created).toBe(1);
      expect(result.data.updated).toBe(1);
      expect(result.data.failed).toHaveLength(0);
    });
  });

  // ─── linkGoodDeedQuote ────────────────────────────────────────────────────────

  describe('linkGoodDeedQuote', () => {
    it('returns created=true for a new link', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(GOOD_DEED);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_VERSE);
      prisma.goodDeedQuote.findUnique.mockResolvedValue(null);
      const upsertResult = { id: 'gdl-1', goodDeedId: GOOD_DEED.id, quoteId: QUOTE_VERSE.id, relevanceScore: 70, note: null, goodDeed: GOOD_DEED, quote: QUOTE_VERSE };
      prisma.goodDeedQuote.upsert.mockResolvedValue(upsertResult);

      const result = await service.linkGoodDeedQuote({
        goodDeedId: GOOD_DEED.id,
        quoteId: QUOTE_VERSE.id,
        relevanceScore: 70,
      });

      expect(result.created).toBe(true);
    });

    it('returns created=false (updated) when the link already exists', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(GOOD_DEED);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_VERSE);
      prisma.goodDeedQuote.findUnique.mockResolvedValue({ id: 'gdl-1' });
      const upsertResult = { id: 'gdl-1', goodDeedId: GOOD_DEED.id, quoteId: QUOTE_VERSE.id, relevanceScore: 85, note: null, goodDeed: GOOD_DEED, quote: QUOTE_VERSE };
      prisma.goodDeedQuote.upsert.mockResolvedValue(upsertResult);

      const result = await service.linkGoodDeedQuote({
        goodDeedId: GOOD_DEED.id,
        quoteId: QUOTE_VERSE.id,
        relevanceScore: 85,
      });

      expect(result.created).toBe(false);
    });

    it('throws 422 GRADE_NOT_PERMITTED for MAWDU quote', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(GOOD_DEED);
      prisma.quote.findUnique.mockResolvedValue(QUOTE_MAWDU);

      await expect(
        service.linkGoodDeedQuote({ goodDeedId: GOOD_DEED.id, quoteId: QUOTE_MAWDU.id }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

});

