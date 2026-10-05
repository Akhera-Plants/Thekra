import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FavoritesService } from './favorites.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

// ── Prisma mock ──────────────────────────────────────────────────────────────

function makePrisma(overrides?: Record<string, unknown>): PrismaService {
  return {
    $transaction: vi.fn().mockImplementation((arr: Array<unknown>) => Promise.all(arr)),
    favorite: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    quote: {
      findUnique: vi.fn().mockResolvedValue({ id: 'quote-uuid-1' }),
    },
    ...overrides,
  } as unknown as PrismaService;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FavoritesService', () => {
  let prisma: PrismaService;
  let svc: FavoritesService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new FavoritesService(prisma);
  });

  // ── add ───────────────────────────────────────────────────────────────────

  describe('add', () => {
    it('creates a favorite when quote exists and not yet favorited', async () => {
      const created = { id: 'fav-1', quoteId: 'quote-uuid-1', createdAt: new Date() };
      vi.mocked(prisma.favorite.create).mockResolvedValue(created as never);

      const result = await svc.add('user-1', 'quote-uuid-1');
      expect(result.id).toBe('fav-1');
    });

    it('throws 409 ALREADY_FAVORITED on unique-constraint violation', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      vi.mocked(prisma.favorite.create).mockRejectedValue(p2002);

      await expect(svc.add('user-1', 'quote-uuid-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws 422 RELATED_RESOURCE_INVALID when quote does not exist', async () => {
      vi.mocked(prisma.quote.findUnique).mockResolvedValue(null);

      await expect(svc.add('user-1', 'nonexistent-uuid')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes and succeeds when favorite exists', async () => {
      vi.mocked(prisma.favorite.deleteMany).mockResolvedValue({ count: 1 } as never);
      await expect(svc.remove('user-1', 'quote-uuid-1')).resolves.toBeUndefined();
    });

    it('throws 404 RESOURCE_NOT_FOUND when not favorited', async () => {
      vi.mocked(prisma.favorite.deleteMany).mockResolvedValue({ count: 0 } as never);
      await expect(svc.remove('user-1', 'not-favorited')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── listQuoteIds ──────────────────────────────────────────────────────────

  describe('listQuoteIds', () => {
    it('returns an array of quote ID strings', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([
        { quoteId: 'q1' },
        { quoteId: 'q2' },
      ] as never);

      const ids = await svc.listQuoteIds('user-1');
      expect(ids).toEqual(['q1', 'q2']);
    });

    it('returns empty array when no favorites', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([]);
      const ids = await svc.listQuoteIds('user-1');
      expect(ids).toEqual([]);
    });
  });
});
