import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { verify as argon2verify } from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { DUMMY_PASSWORD_HASH } from './password-hash.js';

export interface AccountExport {
  exportedAt: string;
  user: { id: string; email: string; displayName: string | null; createdAt: Date };
  favorites: { quoteId: string; createdAt: Date }[];
  /** The synced practice store (never sin programs), or null when the account never synced one. */
  practice: unknown;
}

/**
 * Account self-service: export everything stored for the user and delete the account
 * (Apple requires in-app deletion). Reads favorites and the practice store directly
 * (read-only); the User row is deleted through UsersService and the rest cascades.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /** Re-checks the password (unknown user and wrong password look the same), then deletes the user. */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.users.findById(userId);
    const valid = await argon2verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password);
    if (!user || !valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    await this.users.deleteById(user.id);
  }

  async exportAccount(userId: string, now = new Date()): Promise<AccountExport> {
    const [user, favorites, practice] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, createdAt: true },
      }),
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { quoteId: true, createdAt: true },
      }),
      this.prisma.userPracticeStore.findUnique({ where: { userId }, select: { data: true } }),
    ]);
    if (!user) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
    return { exportedAt: now.toISOString(), user, favorites, practice: practice?.data ?? null };
  }
}
