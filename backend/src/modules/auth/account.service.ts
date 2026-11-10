import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { verify as argon2verify } from 'argon2';
import { PrismaService } from '../../prisma/prisma.service.js';
import { readPracticeChanges, type PracticeChangesDto } from '../practice/practice-sync.js';
import { PushService } from '../push/push.service.js';
import { UsersService } from '../users/users.service.js';
import { DUMMY_PASSWORD_HASH } from './password-hash.js';

export interface AccountExport {
  exportedAt: string;
  user: { id: string; email: string; displayName: string | null; createdAt: Date };
  favorites: { quoteId: string; createdAt: Date }[];
  /** Synced practice data, tombstones included (contract §2). */
  practice: Omit<PracticeChangesDto, 'serverTime'>;
  /** The encrypted sin program as stored: still unreadable without the user's privacy code. */
  sinVault: { ciphertext: string; iv: string; salt: string; kdf: string; iterations: number; version: number; updatedAt: Date } | null;
  /**
   * صحبة (round 7): my memberships and what I put in them — the lines I sent, my rounds, what I kept, whom I hid
   * and the reports I filed. Other members' messages are theirs and are not exported.
   */
  circles: {
    memberships: { circleId: string; circleName: string; displayName: string; isOwner: boolean; sharesPresence: boolean; joinedAt: Date }[];
    messages: { id: string; circleId: string; kind: string; key: string | null; data: unknown; roundId: string | null; createdAt: Date }[];
    rounds: {
      id: string;
      circleId: string;
      kind: string;
      label: string | null;
      minutes: number;
      day: string;
      number: number;
      startedAt: Date;
      endedAt: Date | null;
      outcome: string | null;
    }[];
    kept: { messageId: string; circleId: string; createdAt: Date }[];
    hidden: { circleId: string; memberName: string; createdAt: Date }[];
    reportsFiled: { kind: string; circleName: string; reportedName: string; reason: string; note: string | null; createdAt: Date }[];
  };
}

/**
 * Account self-service: export everything stored for the user and delete the account
 * (Apple requires in-app deletion). Reads favorites, practice data and the sin vault
 * directly (read-only); the User row is deleted through UsersService and the rest cascades.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly push: PushService,
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
    await this.push.forgetUser(user.id); // scheduled reminders would otherwise still fire after the rows are gone
    await this.users.deleteById(user.id);
  }

  async exportAccount(userId: string, now = new Date()): Promise<AccountExport> {
    const [user, favorites, sinVault, circles] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, createdAt: true },
      }),
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { quoteId: true, createdAt: true },
      }),
      this.prisma.sinVault.findUnique({
        where: { userId },
        select: { ciphertext: true, iv: true, salt: true, kdf: true, iterations: true, version: true, updatedAt: true },
      }),
      this.exportCircles(userId),
    ]);
    if (!user) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
    const { serverTime: _serverTime, ...practice } = await readPracticeChanges(this.prisma, userId, null, now);
    return { exportedAt: now.toISOString(), user, favorites, practice, sinVault, circles };
  }

  private async exportCircles(userId: string): Promise<AccountExport['circles']> {
    const mine = { member: { userId } };
    const [memberships, messages, rounds, kept, hidden, reportsFiled] = await Promise.all([
      this.prisma.circleMember.findMany({
        where: { userId },
        orderBy: { joinedAt: 'asc' },
        select: { circleId: true, displayName: true, isOwner: true, sharesPresence: true, joinedAt: true, circle: { select: { name: true } } },
      }),
      this.prisma.circleMessage.findMany({
        where: { sender: { userId } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, circleId: true, kind: true, key: true, data: true, roundId: true, createdAt: true },
      }),
      this.prisma.circleRound.findMany({
        where: mine,
        orderBy: { startedAt: 'asc' },
        select: { id: true, circleId: true, kind: true, label: true, minutes: true, day: true, number: true, startedAt: true, endedAt: true, outcome: true },
      }),
      this.prisma.circleMessageSave.findMany({
        where: mine,
        orderBy: { createdAt: 'asc' },
        select: { messageId: true, createdAt: true, message: { select: { circleId: true } } },
      }),
      this.prisma.circleMute.findMany({
        where: mine,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, muted: { select: { circleId: true, displayName: true } } },
      }),
      this.prisma.circleReport.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: 'asc' },
        select: { kind: true, circleName: true, reportedName: true, reason: true, note: true, createdAt: true },
      }),
    ]);
    return {
      memberships: memberships.map(({ circle, ...m }) => ({ ...m, circleName: circle.name })),
      messages,
      rounds: rounds.map((r) => ({ ...r, day: r.day.toISOString().slice(0, 10) })),
      kept: kept.map((k) => ({ messageId: k.messageId, circleId: k.message.circleId, createdAt: k.createdAt })),
      hidden: hidden.map((h) => ({ circleId: h.muted.circleId, memberName: h.muted.displayName, createdAt: h.createdAt })),
      reportsFiled,
    };
  }
}
