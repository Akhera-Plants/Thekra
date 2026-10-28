import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import { AccountService } from './account.service.js';
import { hashPassword } from './password-hash.js';

const USER_ID = 'd0000000-0000-4000-8000-0000000000f1';
const createdAt = new Date('2026-10-01T00:00:00Z');

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
    userPracticeStore: { findUnique: vi.fn().mockResolvedValue({ data: { v: 1, plans: [] } }) },
  };
  return { users, prisma, service: new AccountService(prisma as unknown as PrismaService, users as unknown as UsersService) };
}

describe('AccountService', () => {
  it('deletes the account when the password is right', async () => {
    const { service, users } = await makeService();
    await service.deleteAccount(USER_ID, 'password123456');
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

  it('exports the user, favorites and the practice store, and never the password hash', async () => {
    const { service } = await makeService();
    const result = await service.exportAccount(USER_ID, new Date('2026-10-28T00:00:00Z'));
    expect(result).toEqual({
      exportedAt: '2026-10-28T00:00:00.000Z',
      user: { id: USER_ID, email: 'a@b.test', displayName: null, createdAt },
      favorites: [{ quoteId: 'q1', createdAt }],
      practice: { v: 1, plans: [] },
    });
    expect(JSON.stringify(result)).not.toContain('argon2');
  });

  it('export 404s for a deleted user', async () => {
    const { service } = await makeService(false);
    await expect(service.exportAccount(USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
