import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CircleMember } from '@prisma/client';
import { addDays, diffDays, eachDay, isValidDate, type LocalDate } from '@thekra/practice-core';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCircleDto } from './dto/create-circle.dto.js';
import type { JoinCircleDto } from './dto/join-circle.dto.js';
import type { CheerMessage, SendCheerDto } from './dto/send-cheer.dto.js';
import type { UpdateMembershipDto } from './dto/update-membership.dto.js';
import type { CircleDetailDto, CircleSummaryDto } from './entities/circle.entity.js';

export const CIRCLE_MAX_MEMBERS = 12;
export const CIRCLES_PER_USER_MAX = 5;
/** No 0/O, 1/I/L: a code read aloud or copied by hand still works. 31^10 ≈ 8·10^14 codes. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 10;
const CODE_ATTEMPTS = 3;
const RECENT_DAYS = 7;
const RECENT_CHEERS = 10;
/** Local dates accepted from a client: server UTC today ±1 day covers every time zone. */
const DATE_WINDOW_DAYS = 1;
const WHOLE_CIRCLE = 'circle';

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Upper case, spaces and dashes removed: the form people type a shared code in. */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

const utcToday = (now: Date): LocalDate => now.toISOString().slice(0, 10);
const toDbDate = (date: LocalDate): Date => new Date(`${date}T00:00:00.000Z`);
const fromDbDate = (date: Date): LocalDate => date.toISOString().slice(0, 10);

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const notFound = () => new NotFoundException({ code: 'CIRCLE_NOT_FOUND', message: 'Circle not found' });

/**
 * رفقة: private, invite-only circles (roadmap §0.5 note of 2026-10-29). A member shares a display name and, when
 * they turn it on, a bare «حضرت اليوم» mark per day; nothing about which habit, how much, the sin program or
 * relatives ever reaches this module. Non-members get 404 for every circle (its existence is not revealed).
 */
@Injectable()
export class CirclesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string): Promise<CircleSummaryDto[]> {
    const memberships = await this.prisma.circleMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { circle: { include: { _count: { select: { members: true } } } } },
    });
    return memberships.map((m) => ({
      id: m.circle.id,
      name: m.circle.name,
      intention: m.circle.intention,
      memberCount: m.circle._count.members,
      isOwner: m.isOwner,
      displayName: m.displayName,
      sharesPresence: m.sharesPresence,
    }));
  }

  async create(userId: string, dto: CreateCircleDto, now = new Date()): Promise<CircleDetailDto> {
    await this.assertBelowCircleLimit(userId);
    await this.deleteEmptyCircles();
    const circle = await this.withFreshCode((inviteCode) =>
      this.prisma.circle.create({
        data: {
          name: dto.name,
          intention: dto.intention ?? null,
          inviteCode,
          members: { create: { userId, displayName: dto.displayName, isOwner: true } },
        },
        select: { id: true },
      }),
    );
    return this.findOne(userId, circle.id, undefined, now);
  }

  /** Joining a circle one already belongs to answers that circle (a second tap on the link is harmless). */
  async join(userId: string, dto: JoinCircleDto, now = new Date()): Promise<CircleDetailDto> {
    const inviteCode = normalizeInviteCode(dto.code);
    await this.deleteEmptyCircles();
    const circle = await this.prisma.circle.findUnique({ where: { inviteCode }, select: { id: true } });
    if (!circle) throw new NotFoundException({ code: 'CIRCLE_INVITE_INVALID', message: 'This invite code is not valid' });

    await this.prisma.$transaction(async (tx) => {
      // Serialises joins of one circle, so two people cannot both take the 12th place.
      await tx.$queryRaw`SELECT "id" FROM "Circle" WHERE "id" = ${circle.id} FOR UPDATE`;
      const existing = await tx.circleMember.findUnique({ where: { circleId_userId: { circleId: circle.id, userId } } });
      if (existing) return;
      const [memberCount, myCircles] = await Promise.all([
        tx.circleMember.count({ where: { circleId: circle.id } }),
        tx.circleMember.count({ where: { userId } }),
      ]);
      if (myCircles >= CIRCLES_PER_USER_MAX) throw this.limitReached();
      if (memberCount >= CIRCLE_MAX_MEMBERS) {
        throw new ConflictException({ code: 'CIRCLE_FULL', message: `A circle has at most ${CIRCLE_MAX_MEMBERS} members` });
      }
      await tx.circleMember.create({ data: { circleId: circle.id, userId, displayName: dto.displayName } });
    });
    return this.findOne(userId, circle.id, undefined, now);
  }

  async findOne(userId: string, circleId: string, today: string | undefined, now = new Date()): Promise<CircleDetailDto> {
    const day = today === undefined ? utcToday(now) : this.assertDateInWindow(today, now);
    const days = eachDay(addDays(day, 1 - RECENT_DAYS), day);
    const me = await this.ownerChecked(await this.memberOf(userId, circleId));
    const [circle, cheers, cheeredToday] = await Promise.all([
      this.prisma.circle.findUnique({
        where: { id: circleId },
        include: {
          members: {
            orderBy: { joinedAt: 'asc' },
            include: { presences: { where: { date: { gte: toDbDate(days[0]!), lte: toDbDate(day) } }, select: { date: true } } },
          },
        },
      }),
      this.prisma.circleCheer.findMany({
        where: { circleId, OR: [{ receiverId: me.id }, { receiverId: null }] },
        orderBy: { createdAt: 'desc' },
        take: RECENT_CHEERS,
        include: { sender: { select: { displayName: true } } },
      }),
      this.prisma.circleCheer.findMany({
        where: { senderId: me.id, day: toDbDate(utcToday(now)) },
        select: { target: true },
      }),
    ]);
    if (!circle) throw notFound();
    return {
      id: circle.id,
      name: circle.name,
      intention: circle.intention,
      memberCount: circle.members.length,
      maxMembers: CIRCLE_MAX_MEMBERS,
      inviteCode: me.isOwner ? circle.inviteCode : null,
      me: { memberId: me.id, displayName: me.displayName, isOwner: me.isOwner, sharesPresence: me.sharesPresence },
      days,
      members: circle.members.map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        isOwner: m.isOwner,
        isMe: m.id === me.id,
        presentDays: m.sharesPresence ? m.presences.map((p) => fromDbDate(p.date)).sort() : [],
      })),
      cheers: cheers.map((c) => ({
        id: c.id,
        message: c.message as CheerMessage,
        fromMemberId: c.senderId,
        fromName: c.sender.displayName,
        toMe: c.receiverId === me.id,
        createdAt: c.createdAt.toISOString(),
      })),
      cheeredToday: cheeredToday.map((c) => c.target),
    };
  }

  /** Turning sharing off also deletes the marks already shared in this circle. */
  async updateMembership(
    userId: string,
    circleId: string,
    dto: UpdateMembershipDto,
  ): Promise<{ displayName: string; sharesPresence: boolean }> {
    const me = await this.memberOf(userId, circleId);
    const updated = await this.prisma.circleMember.update({
      where: { id: me.id },
      data: { displayName: dto.displayName, sharesPresence: dto.sharesPresence },
      select: { displayName: true, sharesPresence: true },
    });
    if (dto.sharesPresence === false) await this.prisma.circlePresence.deleteMany({ where: { memberId: me.id } });
    return updated;
  }

  /** Marks the date in every circle where the user shares. Idempotent per (member, date). */
  async markPresence(userId: string, date: string, now = new Date()): Promise<{ circles: number }> {
    const day = toDbDate(this.assertDateInWindow(date, now));
    const members = await this.prisma.circleMember.findMany({ where: { userId, sharesPresence: true }, select: { id: true } });
    if (members.length > 0) {
      await this.prisma.circlePresence.createMany({ data: members.map((m) => ({ memberId: m.id, date: day })), skipDuplicates: true });
    }
    return { circles: members.length };
  }

  /** Clears the date's mark in all the user's circles (the last log of the day was undone). */
  async clearPresence(userId: string, date: string, now = new Date()): Promise<void> {
    const day = toDbDate(this.assertDateInWindow(date, now));
    await this.prisma.circlePresence.deleteMany({ where: { date: day, member: { userId } } });
  }

  /** One cheer per sender, target and server UTC day. */
  async sendCheer(userId: string, circleId: string, dto: SendCheerDto, now = new Date()): Promise<{ id: string }> {
    const me = await this.memberOf(userId, circleId);
    if (dto.toMemberId !== undefined) {
      if (dto.toMemberId === me.id) {
        throw new BadRequestException({ code: 'CIRCLE_CHEER_SELF', message: 'A cheer goes to another member or to the circle' });
      }
      const receiver = await this.prisma.circleMember.findFirst({ where: { id: dto.toMemberId, circleId }, select: { id: true } });
      if (!receiver) throw new NotFoundException({ code: 'CIRCLE_MEMBER_NOT_FOUND', message: 'Member not found' });
    }
    try {
      return await this.prisma.circleCheer.create({
        data: {
          circleId,
          senderId: me.id,
          receiverId: dto.toMemberId ?? null,
          target: dto.toMemberId ?? WHOLE_CIRCLE,
          message: dto.message,
          day: toDbDate(utcToday(now)),
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: 'CIRCLE_CHEER_ALREADY_SENT', message: 'Already sent to them today' });
      }
      throw error;
    }
  }

  /** When the owner leaves, the earliest remaining member becomes owner; the last one out deletes the circle. */
  async leave(userId: string, circleId: string): Promise<void> {
    const me = await this.memberOf(userId, circleId);
    await this.prisma.$transaction(async (tx) => {
      await tx.circleMember.delete({ where: { id: me.id } });
      const next = await tx.circleMember.findFirst({ where: { circleId }, orderBy: { joinedAt: 'asc' }, select: { id: true } });
      if (!next) {
        await tx.circle.delete({ where: { id: circleId } });
      } else if (me.isOwner) {
        await tx.circleMember.update({ where: { id: next.id }, data: { isOwner: true } });
      }
    });
  }

  async removeMember(userId: string, circleId: string, memberId: string): Promise<void> {
    const me = await this.ownerOf(userId, circleId);
    if (memberId === me.id) {
      throw new BadRequestException({ code: 'CIRCLE_OWNER_REMOVE_SELF', message: 'Leave the circle instead' });
    }
    const { count } = await this.prisma.circleMember.deleteMany({ where: { id: memberId, circleId } });
    if (count === 0) throw new NotFoundException({ code: 'CIRCLE_MEMBER_NOT_FOUND', message: 'Member not found' });
  }

  async rotateInviteCode(userId: string, circleId: string): Promise<{ inviteCode: string }> {
    await this.ownerOf(userId, circleId);
    return this.withFreshCode((inviteCode) =>
      this.prisma.circle.update({ where: { id: circleId }, data: { inviteCode }, select: { inviteCode: true } }),
    );
  }

  async deleteCircle(userId: string, circleId: string): Promise<void> {
    await this.ownerOf(userId, circleId);
    await this.prisma.circle.delete({ where: { id: circleId } });
  }

  private async memberOf(userId: string, circleId: string): Promise<CircleMember> {
    const member = await this.prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } });
    if (!member) throw notFound();
    return member;
  }

  private async ownerOf(userId: string, circleId: string): Promise<CircleMember> {
    const me = await this.ownerChecked(await this.memberOf(userId, circleId));
    if (!me.isOwner) throw new ForbiddenException({ code: 'CIRCLE_OWNER_ONLY', message: 'Only the circle owner can do this' });
    return me;
  }

  /**
   * A circle whose owner deleted their account has no owner (the membership cascaded away): the earliest member
   * takes over. Returns `me` with its possibly updated `isOwner`.
   */
  private async ownerChecked(me: CircleMember): Promise<CircleMember> {
    if (me.isOwner) return me;
    const owners = await this.prisma.circleMember.count({ where: { circleId: me.circleId, isOwner: true } });
    if (owners > 0) return me;
    const first = await this.prisma.circleMember.findFirst({
      where: { circleId: me.circleId },
      orderBy: { joinedAt: 'asc' },
      select: { id: true },
    });
    if (!first) return me;
    await this.prisma.circleMember.update({ where: { id: first.id }, data: { isOwner: true } });
    return first.id === me.id ? { ...me, isOwner: true } : me;
  }

  /**
   * A circle whose last member deleted their account keeps no member (the rows cascaded) but still holds its name,
   * intention and invite code. Account deletion lives in the auth module, which this module depends on, so the
   * leftovers are swept here, before any code is looked up and whenever a circle is created.
   */
  private async deleteEmptyCircles(): Promise<void> {
    await this.prisma.circle.deleteMany({ where: { members: { none: {} } } });
  }

  private async assertBelowCircleLimit(userId: string): Promise<void> {
    const count = await this.prisma.circleMember.count({ where: { userId } });
    if (count >= CIRCLES_PER_USER_MAX) throw this.limitReached();
  }

  private limitReached(): ConflictException {
    return new ConflictException({
      code: 'CIRCLE_LIMIT_REACHED',
      message: `A user can be in at most ${CIRCLES_PER_USER_MAX} circles`,
    });
  }

  private assertDateInWindow(date: string, now: Date): LocalDate {
    if (!isValidDate(date) || Math.abs(diffDays(utcToday(now), date)) > DATE_WINDOW_DAYS) {
      throw new BadRequestException({ code: 'CIRCLE_DATE_OUT_OF_RANGE', message: 'date must be today (YYYY-MM-DD, ±1 day)' });
    }
    return date;
  }

  /** Runs `write` with a new invite code, retrying on the (unlikely) unique-index collision. */
  private async withFreshCode<T>(write: (inviteCode: string) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await write(generateInviteCode());
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= CODE_ATTEMPTS) throw error;
      }
    }
  }
}
