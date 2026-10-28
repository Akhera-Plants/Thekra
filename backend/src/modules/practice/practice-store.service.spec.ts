import { ConflictException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { containsProgramsKey, PRACTICE_STORE_MAX_BYTES, PracticeStoreService } from './practice-store.service.js';

const USER = 'd0000000-0000-4000-8000-0000000000f1';
const PLAN = {
  id: 'p1',
  deedSlug: 'dhikr',
  title: 'Dhikr',
  unit: 'minutes',
  amount: 5,
  activeDaysPerWeek: 3,
  slots: ['07:00'],
  createdOn: '2026-10-01',
  amountChangedOn: '2026-10-01',
  log: { '2026-10-02': 5 },
};
const STORE = { v: 1, plans: [PLAN], relatives: [], settings: { hijriOffset: 1 } };

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '6.19.3' });
}

function makePrisma(current: { data: unknown; version: number } | null = null, userExists = true) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(userExists ? { practiceStore: current } : null) },
    userPracticeStore: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

function errorBody(error: unknown): { code?: string; details?: unknown } {
  return (error as ConflictException).getResponse() as { code?: string; details?: unknown };
}

describe('PracticeStoreService', () => {
  it('find: null store and version 0 before the first save; 404 for a deleted user', async () => {
    expect(await new PracticeStoreService(makePrisma() as unknown as PrismaService).find(USER)).toEqual({ store: null, version: 0 });
    await expect(new PracticeStoreService(makePrisma(null, false) as unknown as PrismaService).find(USER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('save', () => {
    it('rejects any `programs` key, top-level or nested, before anything is stored', async () => {
      const prisma = makePrisma();
      const service = new PracticeStoreService(prisma as unknown as PrismaService);
      for (const store of [{ ...STORE, programs: [] }, { ...STORE, plans: [{ ...PLAN, programs: 1 }] }]) {
        const error = await service.save(USER, { store, version: 0 }).catch((e: unknown) => e);
        expect(errorBody(error).code).toBe('PRACTICE_PROGRAMS_NOT_ALLOWED');
      }
      expect(prisma.userPracticeStore.create).not.toHaveBeenCalled();
      expect(containsProgramsKey({ a: [{ b: { c: 1 } }] })).toBe(false);
    });

    it('rejects a store over the size limit and one that is not a v1 store', async () => {
      const service = new PracticeStoreService(makePrisma() as unknown as PrismaService);
      const big = { ...STORE, settings: { hijriOffset: 0, pad: 'x'.repeat(PRACTICE_STORE_MAX_BYTES) } };
      await expect(service.save(USER, { store: big, version: 0 })).rejects.toBeInstanceOf(PayloadTooLargeException);
      const error = await service.save(USER, { store: { v: 2 }, version: 0 }).catch((e: unknown) => e);
      expect(errorBody(error).code).toBe('PRACTICE_STORE_INVALID');
    });

    it('creates the first version and stores exportForSync(parseStore(store)) only', async () => {
      const prisma = makePrisma();
      const service = new PracticeStoreService(prisma as unknown as PrismaService);
      const store = { ...STORE, extra: 'dropped', relatives: [{ bad: true }] };
      expect(await service.save(USER, { store, version: 0 })).toEqual({ version: 1 });
      expect(prisma.userPracticeStore.create).toHaveBeenCalledWith({
        data: { userId: USER, version: 1, data: { v: 1, plans: [PLAN], relatives: [], settings: { hijriOffset: 1 } } },
      });
    });

    it('updates when the version matches and returns version + 1', async () => {
      const prisma = makePrisma({ data: STORE, version: 3 });
      const service = new PracticeStoreService(prisma as unknown as PrismaService);
      expect(await service.save(USER, { store: STORE, version: 3 })).toEqual({ version: 4 });
      expect(prisma.userPracticeStore.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER, version: 3 }, data: expect.objectContaining({ version: 4 }) }),
      );
    });

    it('409 PRACTICE_VERSION_CONFLICT with the current { store, version } when the version is stale', async () => {
      const prisma = makePrisma({ data: STORE, version: 5 });
      prisma.userPracticeStore.updateMany.mockResolvedValue({ count: 0 });
      const service = new PracticeStoreService(prisma as unknown as PrismaService);
      const error = await service.save(USER, { store: STORE, version: 4 }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(errorBody(error)).toMatchObject({ code: 'PRACTICE_VERSION_CONFLICT', details: { store: STORE, version: 5 } });
    });

    it('409 when version 0 is sent but a store already exists; 404 when the user is gone', async () => {
      const prisma = makePrisma({ data: STORE, version: 1 });
      prisma.userPracticeStore.create.mockRejectedValue(knownError('P2002'));
      const service = new PracticeStoreService(prisma as unknown as PrismaService);
      expect(errorBody(await service.save(USER, { store: STORE, version: 0 }).catch((e: unknown) => e)).code).toBe(
        'PRACTICE_VERSION_CONFLICT',
      );
      prisma.userPracticeStore.create.mockRejectedValue(knownError('P2003'));
      await expect(service.save(USER, { store: STORE, version: 0 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
