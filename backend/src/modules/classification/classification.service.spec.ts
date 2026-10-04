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

  // ─── bulkLinkSinQuotes (P1-7) ─────────────────────────────────────────────────
  //
  // Acceptance: duplicate quoteId→skipped; unknown quoteId→failed with stable code;
  // MAWDU→GRADE_NOT_PERMITTED (code, never raw message); all upserts in $transaction.

  describe('bulkLinkSinQuotes', () => {
    it('throws 422 when sinId does not exist', async () => {
      prisma.sin.findUnique.mockResolvedValue(null);

      await expect(
        service.bulkLinkSinQuotes({ sinId: 'missing', links: [{ quoteId: QUOTE_VERSE.id }] }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('unknown quoteId → failed with RELATED_RESOURCE_INVALID (not a raw Prisma message)', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      // Only QUOTE_VERSE found — 'missing-quote' is not in the result
      prisma.quote.findMany.mockResolvedValue([QUOTE_VERSE]);
      prisma.sinQuote.findMany.mockResolvedValue([]); // no existing pairs
      prisma.sinQuote.upsert.mockResolvedValue({ id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 0, note: null });
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

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
      // Must be the stable code, never a raw error message
      expect(result.data.failed[0]?.reason).not.toContain('Prisma');
    });

    it('MAWDU hadith → failed with GRADE_NOT_PERMITTED (stable code)', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findMany.mockResolvedValue([QUOTE_VERSE, QUOTE_MAWDU]);
      prisma.sinQuote.findMany.mockResolvedValue([]);
      prisma.sinQuote.upsert.mockResolvedValue({ id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 0, note: null });
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

      const result = await service.bulkLinkSinQuotes({
        sinId: SIN.id,
        links: [{ quoteId: QUOTE_VERSE.id }, { quoteId: QUOTE_MAWDU.id }],
      });

      expect(result.data.created).toBe(1);
      expect(result.data.failed).toHaveLength(1);
      expect(result.data.failed[0]).toMatchObject({
        quoteId: QUOTE_MAWDU.id,
        reason: 'GRADE_NOT_PERMITTED',
      });
    });

    it('duplicate quoteId in one payload → first kept, rest skipped (not failed)', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findMany.mockResolvedValue([QUOTE_VERSE]);
      prisma.sinQuote.findMany.mockResolvedValue([]);
      prisma.sinQuote.upsert.mockResolvedValue({ id: 'link-1', sinId: SIN.id, quoteId: QUOTE_VERSE.id, relevanceScore: 0, note: null });
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

      const result = await service.bulkLinkSinQuotes({
        sinId: SIN.id,
        links: [
          { quoteId: QUOTE_VERSE.id, relevanceScore: 80 },  // first — kept
          { quoteId: QUOTE_VERSE.id, relevanceScore: 60 },  // duplicate — skipped
          { quoteId: QUOTE_VERSE.id, relevanceScore: 40 },  // duplicate — skipped
        ],
      });

      // One upsert issued (the first occurrence)
      expect(result.data.created).toBe(1);
      expect(result.data.skipped).toBe(2);
      expect(result.data.failed).toHaveLength(0);
      // Only one upsert should have been added to the transaction
      expect(prisma.sinQuote.upsert).toHaveBeenCalledTimes(1);
    });

    it('correctly counts created vs updated using a batch pre-fetch', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findMany.mockResolvedValue([QUOTE_VERSE, QUOTE_SAHIH]);
      // QUOTE_SAHIH already has a link — QUOTE_VERSE is new
      prisma.sinQuote.findMany.mockResolvedValue([{ quoteId: QUOTE_SAHIH.id }]);
      prisma.sinQuote.upsert.mockResolvedValue({ id: 'x', sinId: SIN.id, quoteId: 'q', relevanceScore: 0, note: null });
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

      const result = await service.bulkLinkSinQuotes({
        sinId: SIN.id,
        links: [{ quoteId: QUOTE_VERSE.id }, { quoteId: QUOTE_SAHIH.id }],
      });

      expect(result.data.created).toBe(1);
      expect(result.data.updated).toBe(1);
      expect(result.data.failed).toHaveLength(0);
    });

    it('runs all upserts in ONE $transaction (nothing written if transaction throws)', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      prisma.quote.findMany.mockResolvedValue([QUOTE_VERSE, QUOTE_SAHIH]);
      prisma.sinQuote.findMany.mockResolvedValue([]);
      // Simulate transaction failure
      const txError = new Error('DB failure');
      prisma.$transaction.mockRejectedValue(txError);

      await expect(
        service.bulkLinkSinQuotes({
          sinId: SIN.id,
          links: [{ quoteId: QUOTE_VERSE.id }, { quoteId: QUOTE_SAHIH.id }],
        }),
      ).rejects.toThrow('DB failure');

      // Transaction was attempted exactly once
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not call $transaction when all items fail validation', async () => {
      prisma.sin.findUnique.mockResolvedValue(SIN);
      // No quotes found — all items will fail with RELATED_RESOURCE_INVALID
      prisma.quote.findMany.mockResolvedValue([]);
      prisma.sinQuote.findMany.mockResolvedValue([]);

      const result = await service.bulkLinkSinQuotes({
        sinId: SIN.id,
        links: [{ quoteId: 'ghost-1' }, { quoteId: 'ghost-2' }],
      });

      expect(result.data.created).toBe(0);
      expect(result.data.failed).toHaveLength(2);
      expect(prisma.$transaction).not.toHaveBeenCalled();
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

  // ─── bulkLinkGoodDeedQuotes (P1-7) ────────────────────────────────────────────

  describe('bulkLinkGoodDeedQuotes', () => {
    it('duplicate quoteId in payload → first kept, rest skipped', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(GOOD_DEED);
      prisma.quote.findMany.mockResolvedValue([QUOTE_VERSE]);
      prisma.goodDeedQuote.findMany.mockResolvedValue([]);
      prisma.goodDeedQuote.upsert.mockResolvedValue({ id: 'gdl-1', goodDeedId: GOOD_DEED.id, quoteId: QUOTE_VERSE.id, relevanceScore: 0, note: null });
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

      const result = await service.bulkLinkGoodDeedQuotes({
        goodDeedId: GOOD_DEED.id,
        links: [
          { quoteId: QUOTE_VERSE.id },
          { quoteId: QUOTE_VERSE.id }, // duplicate
        ],
      });

      expect(result.data.created).toBe(1);
      expect(result.data.skipped).toBe(1);
      expect(result.data.failed).toHaveLength(0);
    });

    it('unknown quoteId → failed with RELATED_RESOURCE_INVALID', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(GOOD_DEED);
      prisma.quote.findMany.mockResolvedValue([]); // none found
      prisma.goodDeedQuote.findMany.mockResolvedValue([]);

      const result = await service.bulkLinkGoodDeedQuotes({
        goodDeedId: GOOD_DEED.id,
        links: [{ quoteId: 'no-such-quote' }],
      });

      expect(result.data.failed).toHaveLength(1);
      expect(result.data.failed[0]).toMatchObject({ reason: 'RELATED_RESOURCE_INVALID' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('MAWDU hadith → GRADE_NOT_PERMITTED (not raw Prisma message)', async () => {
      prisma.goodDeed.findUnique.mockResolvedValue(GOOD_DEED);
      prisma.quote.findMany.mockResolvedValue([QUOTE_MAWDU]);
      prisma.goodDeedQuote.findMany.mockResolvedValue([]);

      const result = await service.bulkLinkGoodDeedQuotes({
        goodDeedId: GOOD_DEED.id,
        links: [{ quoteId: QUOTE_MAWDU.id }],
      });

      expect(result.data.failed[0]).toMatchObject({ reason: 'GRADE_NOT_PERMITTED' });
      // Must be the stable code, never a raw Prisma or JS error message
      expect(result.data.failed[0]?.reason).not.toContain('Error');
    });
  });
});
