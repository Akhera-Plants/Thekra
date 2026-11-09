import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CirclesService, generateInviteCode, normalizeInviteCode, notEnabled } from './circles.service.js';
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

const invalidInvite = () => new NotFoundException({ code: 'CIRCLE_INVITE_INVALID', message: 'This invite code is not valid' });

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
 * رفقة invites (round 6, C-01k). A member whose رفقة is on hands someone a one-use code that expires; redeeming it
 * turns رفقة on for the redeemer and, when the invite names a circle the inviter owns, joins that circle. The
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

  /** An invite to رفقة, or (owner only) to one of the inviter's circles. */
  async create(userId: string, dto: CreateCircleInviteDto, now = new Date()): Promise<CircleInviteDto> {
    if (!(await this.circles.isEnabled(userId))) throw notEnabled();
    if (dto.circleId !== undefined) await this.circles.ownerOf(userId, dto.circleId);

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
   * Redeems a code: one use, before it expires, not one's own. A wrong, used, revoked or expired code all answer
   * the same 404. Redeeming the same invite again is harmless. When the invite names a circle and joining fails
   * (full, or the redeemer is in too many circles), رفقة is still turned on and `joinError` says why.
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
    if (!again && inviteStatus(invite, now) !== 'active') throw invalidInvite();
    if (invite.circleId && dto.displayName === undefined) {
      throw new BadRequestException({
        code: 'CIRCLE_DISPLAY_NAME_REQUIRED',
        message: 'This invite also joins a circle: send the name to show there',
        details: { circleName: invite.circle?.name ?? null },
      });
    }

    const joinError = await this.prisma.$transaction(async (tx) => {
      if (!again) {
        // The conditions make the claim atomic: of two people redeeming at once, one gets count 1.
        const claimed = await tx.circleInvite.updateMany({
          where: { id: invite.id, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { redeemedAt: now, redeemedById: userId },
        });
        if (claimed.count === 0) throw invalidInvite();
      }
      await tx.user.updateMany({ where: { id: userId, circlesEnabledAt: null }, data: { circlesEnabledAt: now } });
      if (!invite.circleId || dto.displayName === undefined) return null;
      // The circle is joined only while the inviter still belongs to it.
      const inviterStillMember = await tx.circleMember.count({ where: { circleId: invite.circleId, userId: invite.inviterId } });
      if (inviterStillMember === 0) return 'CIRCLE_INVITE_CIRCLE_GONE';
      try {
        await this.circles.addMember(tx, invite.circleId, userId, dto.displayName);
        return null;
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === 409) {
          return (error.getResponse() as { code: string }).code;
        }
        throw error;
      }
    });

    const circle = invite.circleId && joinError === null && dto.displayName !== undefined
      ? await this.circles.findOne(userId, invite.circleId, undefined, now)
      : null;
    return { enabled: true, circle, joinError: invite.circleId ? joinError : null };
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
