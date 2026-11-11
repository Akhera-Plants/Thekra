import { BadRequestException, ConflictException, GoneException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CIRCLE_MAX_MEMBERS, CirclesService, generateInviteCode, normalizeInviteCode, notEnabled } from './circles.service.js';
import { safeMemberName } from './dto/circle-text.decorator.js';
import { CIRCLE_DISPLAY_NAME_MAX } from './dto/create-circle.dto.js';
import type { CreateCircleInviteDto } from './dto/create-circle-invite.dto.js';
import type { RedeemCircleInviteDto } from './dto/redeem-circle-invite.dto.js';
import type { CircleAccessDto, CircleInviteDto, CircleInviteStatus, RedeemCircleInviteResultDto } from './entities/circle.entity.js';

/** A personal invite works for 7 days, once. */
export const INVITE_TTL_DAYS = 7;
/** Unused, unexpired invites a member may hold at once. */
export const INVITES_ACTIVE_MAX = 5;
/** Invites a member may create in any 30 days (used, revoked or expired ones count too). */
export const INVITES_PER_PERIOD_MAX = 10;
export const INVITE_PERIOD_DAYS = 30;
/** The «دعواتي» list: the newest invites only. */
const INVITES_LISTED = 20;
const CODE_ATTEMPTS = 3;
const DAY_MS = 86_400_000;

/** A code nobody issued (a typo): the only refusal that is a 404. */
const invalidInvite = () => new NotFoundException({ code: 'CIRCLE_INVITE_INVALID', message: 'This invite code is not valid' });

/**
 * A code that exists but cannot be used any more says why (owner round 8, Q6: a kind, distinct sentence for each case):
 * 410 CIRCLE_INVITE_EXPIRED / CIRCLE_INVITE_USED / CIRCLE_INVITE_REVOKED. Codes are 31^10 random and a client gets 5
 * tries a minute, so telling «used» from «never issued» gives a guesser nothing.
 */
function unusableInvite(status: Exclude<CircleInviteStatus, 'active'>): GoneException {
  const byStatus = {
    expired: { code: 'CIRCLE_INVITE_EXPIRED', message: 'This invite has expired: ask for a new one' },
    redeemed: { code: 'CIRCLE_INVITE_USED', message: 'This invite was already used: ask for a new one' },
    revoked: { code: 'CIRCLE_INVITE_REVOKED', message: 'This invite was cancelled by the person who sent it' },
  } as const;
  return new GoneException(byStatus[status]);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function inviteStatus(
  invite: { redeemedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): CircleInviteStatus {
  if (invite.redeemedAt) return 'redeemed';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

type InviteRow = {
  id: string;
  code: string;
  redeemedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  circle: { id: string; name: string } | null;
};

/**
 * صحبة invites (round 6, C-01k). A member whose صحبة is on hands someone a one-use code that expires; redeeming it
 * turns صحبة on for the redeemer and, when the invite names a circle the inviter owns, joins that circle. The
 * inviter learns only the invite's status, never who redeemed it or anything they do.
 */
@Injectable()
export class CircleInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
  ) {}

  async access(userId: string, now = new Date()): Promise<CircleAccessDto> {
    const enabled = await this.circles.isEnabled(userId);
    if (!enabled) {
      return { enabled, inCircle: false, invites: null };
    }
    const [{ active, inPeriod }, membership] = await Promise.all([
      this.counts(this.prisma, userId, now),
      this.prisma.circleMember.findFirst({ where: { userId }, select: { id: true } }),
    ]);
    return {
      enabled,
      inCircle: membership !== null,
      invites: {
        active,
        activeMax: INVITES_ACTIVE_MAX,
        createdInPeriod: inPeriod,
        periodMax: INVITES_PER_PERIOD_MAX,
        periodDays: INVITE_PERIOD_DAYS,
        remaining: Math.max(0, Math.min(INVITES_ACTIVE_MAX - active, INVITES_PER_PERIOD_MAX - inPeriod)),
        ttlDays: INVITE_TTL_DAYS,
      },
    };
  }

  async list(userId: string, now = new Date()): Promise<CircleInviteDto[]> {
    const rows = await this.prisma.circleInvite.findMany({
      where: { inviterId: userId },
      orderBy: { createdAt: 'desc' },
      take: INVITES_LISTED,
      select: { id: true, code: true, redeemedAt: true, revokedAt: true, expiresAt: true, createdAt: true, circle: { select: { id: true, name: true } } },
    });
    return rows.map((row) => this.present(row, now));
  }

  /** An invite to صحبة, or (owner only) to one of the inviter's circles. */
  async create(userId: string, dto: CreateCircleInviteDto, now = new Date()): Promise<CircleInviteDto> {
    if (!(await this.circles.isEnabled(userId))) throw notEnabled();
    if (dto.circleId !== undefined) {
      await this.circles.ownerOf(userId, dto.circleId);
      const members = await this.prisma.circleMember.count({ where: { circleId: dto.circleId } });
      if (members >= CIRCLE_MAX_MEMBERS) {
        throw new ConflictException({ code: 'CIRCLE_FULL', message: `A circle has at most ${CIRCLE_MAX_MEMBERS} members` });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Serialises one member's invite creation, so two taps cannot both pass the limits.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const { active, inPeriod } = await this.counts(tx, userId, now);
      if (active >= INVITES_ACTIVE_MAX) {
        throw new HttpException(
          { code: 'CIRCLE_INVITES_ACTIVE_LIMIT', message: `At most ${INVITES_ACTIVE_MAX} unused invites at a time` },
          409,
        );
      }
      if (inPeriod >= INVITES_PER_PERIOD_MAX) {
        throw new HttpException(
          { code: 'CIRCLE_INVITES_PERIOD_LIMIT', message: `At most ${INVITES_PER_PERIOD_MAX} invites in ${INVITE_PERIOD_DAYS} days` },
          409,
        );
      }
      const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
      for (let attempt = 1; ; attempt++) {
        try {
          const row = await tx.circleInvite.create({
            data: { code: generateInviteCode(), inviterId: userId, circleId: dto.circleId ?? null, expiresAt, createdAt: now },
            select: { id: true, code: true, redeemedAt: true, revokedAt: true, expiresAt: true, createdAt: true, circle: { select: { id: true, name: true } } },
          });
          return this.present(row, now);
        } catch (error) {
          if (!isUniqueViolation(error) || attempt >= CODE_ATTEMPTS) throw error;
        }
      }
    });
  }

  /** Revokes one of my unused invites. A used, revoked or expired one (or another member's) is 404. */
  async revoke(userId: string, inviteId: string, now = new Date()): Promise<void> {
    const { count } = await this.prisma.circleInvite.updateMany({
      where: { id: inviteId, inviterId: userId, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (count === 0) throw invalidInvite();
  }

  /**
   * Redeems a code: one use, before it expires, not one's own. A code nobody issued is 404; one that exists but cannot
   * be used says why (410 expired / used / cancelled). Redeeming the same invite again is harmless.
   *
   * An invite that names a circle joins it in the same step, even for an account that has not turned صحبة on (the
   * invite turns it on): the name shown in the circle is the redeemer's own account name unless the request sends
   * one, and only an account with no name is asked for it (400 CIRCLE_DISPLAY_NAME_REQUIRED, invite untouched).
   * Joining is all-or-nothing: when the circle is full, the redeemer is in too many circles, or the inviter left, the
   * answer is 409 (CIRCLE_FULL, CIRCLE_LIMIT_REACHED, CIRCLE_INVITE_CIRCLE_GONE) and the invite stays unused.
   */
  async redeem(userId: string, dto: RedeemCircleInviteDto, now = new Date()): Promise<RedeemCircleInviteResultDto> {
    const code = normalizeInviteCode(dto.code);
    const invite = await this.prisma.circleInvite.findUnique({
      where: { code },
      select: { id: true, inviterId: true, circleId: true, redeemedById: true, redeemedAt: true, revokedAt: true, expiresAt: true, circle: { select: { name: true } } },
    });
    if (!invite) throw invalidInvite();
    if (invite.inviterId === userId) {
      throw new BadRequestException({ code: 'CIRCLE_INVITE_OWN', message: 'This is your own invite: share it with someone else' });
    }
    const again = invite.redeemedById === userId;
    const status = inviteStatus(invite, now);
    if (!again && status !== 'active') throw unusableInvite(status);

    let displayName: string | undefined;
    if (invite.circleId) {
      displayName = dto.displayName ?? (await this.accountName(userId));
      if (displayName === undefined) {
        throw new BadRequestException({
          code: 'CIRCLE_DISPLAY_NAME_REQUIRED',
          message: 'This invite also joins a circle: send the name to show there',
          details: { circleName: invite.circle?.name ?? null },
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (!again) {
        // The conditions make the claim atomic: of two people redeeming at once, one gets count 1.
        const claimed = await tx.circleInvite.updateMany({
          where: { id: invite.id, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { redeemedAt: now, redeemedById: userId },
        });
        if (claimed.count === 0) throw unusableInvite('redeemed');
      }
      await tx.user.updateMany({ where: { id: userId, circlesEnabledAt: null }, data: { circlesEnabledAt: now } });
      if (!invite.circleId || displayName === undefined) return;
      // The circle is joined only while the inviter still belongs to it. Any refusal below rolls the claim back.
      const inviterStillMember = await tx.circleMember.count({ where: { circleId: invite.circleId, userId: invite.inviterId } });
      if (inviterStillMember === 0) {
        throw new ConflictException({ code: 'CIRCLE_INVITE_CIRCLE_GONE', message: 'The circle this invite was for no longer exists' });
      }
      await this.circles.addMember(tx, invite.circleId, userId, displayName);
    });

    const circle = invite.circleId ? await this.circles.findOne(userId, invite.circleId, undefined, now) : null;
    return { enabled: true, circle };
  }

  /** The account's own name as a circle display name, when it has a usable one. */
  private async accountName(userId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    return safeMemberName(user?.displayName, CIRCLE_DISPLAY_NAME_MAX);
  }

  private async counts(db: Pick<PrismaService, 'circleInvite'>, userId: string, now: Date) {
    const [active, inPeriod] = await Promise.all([
      db.circleInvite.count({ where: { inviterId: userId, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
      db.circleInvite.count({ where: { inviterId: userId, createdAt: { gt: new Date(now.getTime() - INVITE_PERIOD_DAYS * DAY_MS) } } }),
    ]);
    return { active, inPeriod };
  }

  private present(row: InviteRow, now: Date): CircleInviteDto {
    const status = inviteStatus(row, now);
    return {
      id: row.id,
      // Only an unused invite still shows its code: a used or dead one cannot be shared again.
      code: status === 'active' ? row.code : null,
      status,
      circle: row.circle,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
