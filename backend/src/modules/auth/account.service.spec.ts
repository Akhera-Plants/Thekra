import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import type { PushService } from '../push/push.service.js';
import { AccountService } from './account.service.js';
import { hashPassword } from './password-hash.js';

const USER_ID = 'd0000000-0000-4000-8000-0000000000f1';
const createdAt = new Date('2026-10-01T00:00:00Z');
const VAULT = { ciphertext: 'AAAA', iv: 'AAAAAAAAAAAAAAAA', salt: 'AAAAAAAAAAAAAAAAAAAAAA==', kdf: 'pbkdf2-sha256', iterations: 210000, version: 1, updatedAt: createdAt };

async function makeService(userExists = true) {
  const passwordHash = await hashPassword('password123456');
  const users = {
    findById: vi.fn().mockResolvedValue(userExists ? { id: USER_ID, passwordHash } : null),
    deleteById: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(userExists ? { id: USER_ID, email: 'a@b.test', displayName: null, createdAt } : null),
    },
    favorite: { findMany: vi.fn().mockResolvedValue([{ quoteId: 'q1', createdAt }]) },
    sinVault: { findUnique: vi.fn().mockResolvedValue(VAULT) },
    practiceSettings: { findFirst: vi.fn().mockResolvedValue(null) },
    habitPlan: { findMany: vi.fn().mockResolvedValue([]) },
    habitLog: { findMany: vi.fn().mockResolvedValue([{ planId: 'p1', date: new Date('2026-10-27T00:00:00Z'), amount: 3 }]) },
    relative: { findMany: vi.fn().mockResolvedValue([]) },
    relativeContact: { findMany: vi.fn().mockResolvedValue([]) },
    fardMark: {
      findMany: vi.fn().mockResolvedValue([
        { userId: USER_ID, date: new Date('2026-10-27T00:00:00Z'), prayer: 'fajr', status: 'qada', clientUpdatedAt: new Date('2026-10-27T05:00:00Z') },
      ]),
    },
    // Round 6: reflections, «قضاء الفوائت» and read marks are exported too.
    habitReflection: {
      findMany: vi.fn().mockResolvedValue([
        { planId: 'p1', date: new Date('2026-10-27T00:00:00Z'), helped: 'صحبة', hard: null, note: null, clientUpdatedAt: new Date('2026-10-27T05:00:00Z') },
      ]),
    },
    qadaLog: {
      findMany: vi.fn().mockResolvedValue([
        { userId: USER_ID, date: new Date('2026-10-27T00:00:00Z'), prayer: 'any', count: 2, clientUpdatedAt: new Date('2026-10-27T05:00:00Z') },
      ]),
    },
    quoteRead: { findMany: vi.fn().mockResolvedValue([]) },
    circleMember: {
      findMany: vi.fn().mockResolvedValue([
        { circleId: 'c1', displayName: 'أبو عمر', isOwner: true, sharesPresence: false, joinedAt: createdAt, circle: { name: 'صحبة الفجر' } },
      ]),
    },
    circleMessage: {
      findMany: vi.fn().mockResolvedValue([{ id: 'm1', circleId: 'c1', kind: 'PRESET', key: 'thabat', data: null, roundId: null, createdAt }]),
    },
    circleRound: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          circleId: 'c1',
          kind: 'study',
          label: 'compiler design',
          minutes: 60,
          day: new Date('2026-10-27T00:00:00Z'),
          number: 4,
          startedAt: createdAt,
          endedAt: null,
          outcome: null,
        },
      ]),
    },
    circleMessageSave: { findMany: vi.fn().mockResolvedValue([{ messageId: 'm2', createdAt, message: { circleId: 'c1' } }]) },
    circleMute: { findMany: vi.fn().mockResolvedValue([]) },
    circleReport: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const push = { forgetUser: vi.fn().mockResolvedValue(undefined) };
  return {
    users,
    prisma,
    push,
    service: new AccountService(prisma as unknown as PrismaService, users as unknown as UsersService, push as unknown as PushService),
  };
}

describe('AccountService', () => {
  it('deletes the account when the password is right', async () => {
    const { service, users, push } = await makeService();
    await service.deleteAccount(USER_ID, 'password123456');
    expect(push.forgetUser).toHaveBeenCalledWith(USER_ID);
    expect(users.deleteById).toHaveBeenCalledWith(USER_ID);
  });

  it('401 INVALID_CREDENTIALS for a wrong password or a user that is already gone, and deletes nothing', async () => {
    for (const exists of [true, false]) {
      const { service, users } = await makeService(exists);
      const error = await service.deleteAccount(USER_ID, 'wrong-password').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(((error as UnauthorizedException).getResponse() as { code: string }).code).toBe('INVALID_CREDENTIALS');
      expect(users.deleteById).not.toHaveBeenCalled();
    }
  });

  it('exports the user, favorites, practice data, the vault ciphertext and my صحبة data, and never the password hash', async () => {
    const { service } = await makeService();
    const result = await service.exportAccount(USER_ID, new Date('2026-10-28T00:00:00Z'));
    expect(result).toEqual({
      exportedAt: '2026-10-28T00:00:00.000Z',
      user: { id: USER_ID, email: 'a@b.test', displayName: null, createdAt },
      favorites: [{ quoteId: 'q1', createdAt }],
      practice: {
        settings: null,
        plans: [],
        logs: [{ planId: 'p1', date: '2026-10-27', amount: 3 }],
        relatives: [],
        contacts: [],
        fard: [{ date: '2026-10-27', prayer: 'fajr', status: 'qada', clientUpdatedAt: '2026-10-27T05:00:00.000Z' }],
        reflections: [{ planId: 'p1', date: '2026-10-27', helped: 'صحبة', hard: null, note: null, clientUpdatedAt: '2026-10-27T05:00:00.000Z' }],
        qadaLogs: [{ date: '2026-10-27', prayer: 'any', count: 2, clientUpdatedAt: '2026-10-27T05:00:00.000Z' }],
        reads: [],
      },
      sinVault: VAULT,
      circles: {
        memberships: [{ circleId: 'c1', circleName: 'صحبة الفجر', displayName: 'أبو عمر', isOwner: true, sharesPresence: false, joinedAt: createdAt }],
        messages: [{ id: 'm1', circleId: 'c1', kind: 'PRESET', key: 'thabat', data: null, roundId: null, createdAt }],
        rounds: [
          {
            id: 'r1',
            circleId: 'c1',
            kind: 'study',
            label: 'compiler design',
            minutes: 60,
            day: '2026-10-27',
            number: 4,
            startedAt: createdAt,
            endedAt: null,
            outcome: null,
          },
        ],
        kept: [{ messageId: 'm2', circleId: 'c1', createdAt }],
        hidden: [],
        reportsFiled: [],
      },
    });
    expect(JSON.stringify(result)).not.toContain('argon2');
  });

  it('export 404s for a deleted user', async () => {
    const { service } = await makeService(false);
    await expect(service.exportAccount(USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
