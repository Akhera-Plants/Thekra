import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CircleMember } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CirclesService, isUniqueViolation, toDbDate, utcToday } from './circles.service.js';
import { isRoundClosed, ROUND_MAX_OPEN_MS, roundInclude, toMessageDto, toRoundDto } from './companion-view.js';
import {
  DIRECTED_GROUPS,
  presetGroupOf,
  ROUND_CHEERS,
  ROUND_CONGRATS,
  type EndRoundDto,
  type MessagesQueryDto,
  type ReplyRoundDto,
  type ReportDto,
  type SendMessageDto,
  type StartRoundDto,
} from './dto/companion.dto.js';
import type {
  AdminCircleReportDto,
  CircleMessageDto,
  CircleMessagesPageDto,
  CircleReportResultDto,
  CircleRoundDto,
} from './entities/circle.entity.js';

/**
 * Limits kept in the database, so they hold across serverless instances (the controller's @Throttle is per instance).
 */
export const FEED_LIMITS = {
  /** Suggested lines and round replies one member sends in one صحبة in a UTC day. */
  messagesPerDay: 60,
  /** The same suggested line to the same target in a UTC day (`progress`: its updated counts, a few times). */
  sameLinePerDay: 1,
  progressPerDay: 3,
  /** Rounds one member starts in one صحبة on one local date. */
  roundsPerDay: 20,
  /** Reports one account files in a UTC day (all its صحبات). */
  reportsPerDay: 10,
  /** The same reporter and the same member (or message) within this window is answered «received», not stored again. */
  reportDedupeDays: 30,
  pageSize: 30,
} as const;

const DAY_MS = 86_400_000;

const tooMany = (code: string, message: string) => new HttpException({ code, message }, HttpStatus.TOO_MANY_REQUESTS);

/** The message include for a viewer: names, the round (with my replies to it) and whether I kept it. */
function messageInclude(meId: string) {
  return {
    sender: { select: { displayName: true } },
    receiver: { select: { displayName: true } },
    round: { include: roundInclude(meId) },
    saves: { where: { memberId: meId }, select: { memberId: true } },
  } satisfies Prisma.CircleMessageInclude;
}

/**
 * Round 7 «صحبة» (docs/plan/2026-11-10-owner-round-7.md): the feed (D7), rounds (D5), suggested lines (D6),
 * «احتفظ بها», reports and hiding a member (D8). Members only: a non-member gets 404 as for the circle itself.
 *
 * Who sees a line: one to the whole صحبة, rounds and their replies are seen by every member; a suggested line to one
 * member only by the two of them. A member I hid, and a message I reported, leave my own feed only.
 */
@Injectable()
export class CircleFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly circles: CirclesService,
  ) {}

  async messages(userId: string, circleId: string, query: MessagesQueryDto, now = new Date()): Promise<CircleMessagesPageDto> {
    const me = await this.circles.memberOf(userId, circleId);
    const limit = query.limit ?? FEED_LIMITS.pageSize;
    const muted = await this.prisma.circleMute.findMany({ where: { memberId: me.id }, select: { mutedId: true } });
    const where: Prisma.CircleMessageWhereInput = {
      circleId,
      AND: [
        { OR: [{ receiverId: null }, { receiverId: me.id }, { senderId: me.id }, { kind: 'REPLY' }] },
        { reports: { none: { reporterId: userId } } },
        ...(muted.length > 0 ? [{ senderId: { notIn: muted.map((m) => m.mutedId) } }] : []),
        ...(query.saved === 'true' ? [{ saves: { some: { memberId: me.id } } }] : []),
      ],
    };
    const rows = await this.prisma.circleMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
      include: messageInclude(me.id),
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => toMessageDto(row, me.id, now)),
      nextBefore: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  /** D6: a suggested line. `progress` carries two counts; the lines about the sender go to the whole صحبة. */
  async send(userId: string, circleId: string, dto: SendMessageDto, now = new Date()): Promise<CircleMessageDto> {
    const me = await this.circles.memberOf(userId, circleId);
    const group = presetGroupOf(dto.key);
    if (dto.toMemberId !== undefined) {
      if (!group || !DIRECTED_GROUPS.includes(group)) {
        throw new BadRequestException({ code: 'CIRCLE_MESSAGE_TARGET', message: 'This line goes to the whole circle' });
      }
      if (dto.toMemberId === me.id) {
        throw new BadRequestException({ code: 'CIRCLE_CHEER_SELF', message: 'A line goes to another member or to the circle' });
      }
      await this.otherMember(circleId, dto.toMemberId);
    }
    const isProgress = dto.key === 'progress';
    if (isProgress !== (dto.progress !== undefined) || (dto.progress && dto.progress.done > dto.progress.total)) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'progress goes with the progress line only' });
    }
    const day = toDbDate(utcToday(now));
    const [today, sameLine] = await Promise.all([
      this.prisma.circleMessage.count({ where: { senderId: me.id, day, kind: { in: ['PRESET', 'REPLY'] } } }),
      this.prisma.circleMessage.count({
        where: { senderId: me.id, day, kind: 'PRESET', key: dto.key, receiverId: dto.toMemberId ?? null },
      }),
    ]);
    if (today >= FEED_LIMITS.messagesPerDay) throw tooMany('CIRCLE_MESSAGES_LIMIT', 'Enough lines for today');
    if (sameLine >= (isProgress ? FEED_LIMITS.progressPerDay : FEED_LIMITS.sameLinePerDay)) {
      throw new ConflictException({ code: 'CIRCLE_CHEER_ALREADY_SENT', message: 'Already sent to them today' });
    }
    const row = await this.prisma.circleMessage.create({
      data: {
        circleId,
        senderId: me.id,
        receiverId: dto.toMemberId ?? null,
        kind: 'PRESET',
        key: dto.key,
        data: dto.progress ? { done: dto.progress.done, total: dto.progress.total } : Prisma.DbNull,
        day,
      },
      include: messageInclude(me.id),
    });
    return toMessageDto(row, me.id, now);
  }

  /** D5: «بدأت جولة …». One running round per member and صحبة; the number counts the member's rounds of the day. */
  async startRound(userId: string, circleId: string, dto: StartRoundDto, now = new Date()): Promise<CircleRoundDto> {
    const me = await this.circles.memberOf(userId, circleId);
    const localDay = toDbDate(this.circles.assertDateInWindow(dto.today, now));
    for (let attempt = 1; ; attempt++) {
      try {
        const round = await this.prisma.$transaction(async (tx) => {
          const [recent, count] = await Promise.all([
            tx.circleRound.findMany({
              where: { memberId: me.id, endedAt: null, startedAt: { gt: new Date(now.getTime() - ROUND_MAX_OPEN_MS) } },
              select: { id: true, startedAt: true, minutes: true, endedAt: true },
            }),
            tx.circleRound.count({ where: { memberId: me.id, day: localDay } }),
          ]);
          if (recent.some((r) => !isRoundClosed(r, now))) {
            throw new ConflictException({ code: 'CIRCLE_ROUND_OPEN', message: 'End the running round first' });
          }
          if (count >= FEED_LIMITS.roundsPerDay) throw tooMany('CIRCLE_ROUNDS_LIMIT', 'Enough rounds for today');
          const created = await tx.circleRound.create({
            data: {
              circleId,
              memberId: me.id,
              kind: dto.kind,
              label: dto.label ?? null,
              minutes: dto.minutes,
              day: localDay,
              number: count + 1,
              startedAt: now,
            },
            include: roundInclude(me.id),
          });
          await tx.circleMessage.create({
            data: { circleId, senderId: me.id, kind: 'ROUND_START', roundId: created.id, day: toDbDate(utcToday(now)), createdAt: now },
          });
          return created;
        });
        return toRoundDto(round, me.id, now);
      } catch (error) {
        // Two starts at once take the same number: the second tries again and meets CIRCLE_ROUND_OPEN.
        if (!isUniqueViolation(error) || attempt >= 2) throw error;
      }
    }
  }

  /** D5: «تم الحمد لله» or «لم يتم», by the round's member, once. */
  async endRound(userId: string, circleId: string, roundId: string, dto: EndRoundDto, now = new Date()): Promise<CircleRoundDto> {
    const me = await this.circles.memberOf(userId, circleId);
    const outcome = dto.outcome === 'done' ? 'DONE' : 'NOT_DONE';
    const round = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.circleRound.updateMany({
        where: { id: roundId, circleId, memberId: me.id, endedAt: null },
        data: { endedAt: now, outcome },
      });
      if (count === 0) {
        const exists = await tx.circleRound.findFirst({ where: { id: roundId, circleId, memberId: me.id }, select: { id: true } });
        if (!exists) throw this.roundNotFound();
        throw new ConflictException({ code: 'CIRCLE_ROUND_ENDED', message: 'This round has already ended' });
      }
      await tx.circleMessage.create({
        data: { circleId, senderId: me.id, kind: 'ROUND_END', roundId, day: toDbDate(utcToday(now)), createdAt: now },
      });
      return tx.circleRound.findUniqueOrThrow({ where: { id: roundId }, include: roundInclude(me.id) });
    });
    return toRoundDto(round, me.id, now);
  }

  /**
   * D5: a preset reply to another member's round: encouragement while it runs or after «لم يتم», congratulations
   * after «تم». Each reply key once per round.
   */
  async replyToRound(userId: string, circleId: string, roundId: string, dto: ReplyRoundDto, now = new Date()): Promise<CircleMessageDto> {
    const me = await this.circles.memberOf(userId, circleId);
    const round = await this.prisma.circleRound.findFirst({
      where: { id: roundId, circleId },
      select: { id: true, memberId: true, outcome: true },
    });
    if (!round) throw this.roundNotFound();
    if (round.memberId === me.id) {
      throw new BadRequestException({ code: 'CIRCLE_CHEER_SELF', message: 'A reply goes to another member' });
    }
    const allowed: readonly string[] = round.outcome === 'DONE' ? ROUND_CONGRATS : ROUND_CHEERS;
    if (!allowed.includes(dto.key)) {
      throw new BadRequestException({ code: 'CIRCLE_REPLY_KIND', message: 'Congratulations after «تم», encouragement otherwise' });
    }
    const day = toDbDate(utcToday(now));
    const [today, same] = await Promise.all([
      this.prisma.circleMessage.count({ where: { senderId: me.id, day, kind: { in: ['PRESET', 'REPLY'] } } }),
      this.prisma.circleMessage.count({ where: { senderId: me.id, roundId, kind: 'REPLY', key: dto.key } }),
    ]);
    if (same > 0) throw new ConflictException({ code: 'CIRCLE_CHEER_ALREADY_SENT', message: 'Already sent' });
    if (today >= FEED_LIMITS.messagesPerDay) throw tooMany('CIRCLE_MESSAGES_LIMIT', 'Enough lines for today');
    const row = await this.prisma.circleMessage.create({
      data: { circleId, senderId: me.id, receiverId: round.memberId, kind: 'REPLY', key: dto.key, roundId, day },
      include: messageInclude(me.id),
    });
    return toMessageDto(row, me.id, now);
  }

  /** D7: «احتفظ بها». Idempotent. Only a message I can see. */
  async save(userId: string, circleId: string, messageId: string): Promise<{ saved: true }> {
    const me = await this.circles.memberOf(userId, circleId);
    await this.visibleMessage(me, circleId, messageId);
    await this.prisma.circleMessageSave.upsert({
      where: { memberId_messageId: { memberId: me.id, messageId } },
      create: { memberId: me.id, messageId },
      update: {},
    });
    return { saved: true };
  }

  async unsave(userId: string, circleId: string, messageId: string): Promise<void> {
    const me = await this.circles.memberOf(userId, circleId);
    await this.prisma.circleMessageSave.deleteMany({ where: { memberId: me.id, messageId } });
  }

  /** D8: hide a member's messages from my own feed (nobody is told). Idempotent. */
  async mute(userId: string, circleId: string, memberId: string): Promise<{ muted: true }> {
    const me = await this.circles.memberOf(userId, circleId);
    if (memberId === me.id) throw new BadRequestException({ code: 'CIRCLE_MUTE_SELF', message: 'You cannot hide yourself' });
    await this.otherMember(circleId, memberId);
    await this.prisma.circleMute.upsert({
      where: { memberId_mutedId: { memberId: me.id, mutedId: memberId } },
      create: { memberId: me.id, mutedId: memberId },
      update: {},
    });
    return { muted: true };
  }

  async unmute(userId: string, circleId: string, memberId: string): Promise<void> {
    const me = await this.circles.memberOf(userId, circleId);
    await this.prisma.circleMute.deleteMany({ where: { memberId: me.id, mutedId: memberId } });
  }

  /**
   * D8: report a member or one message, for the owner of Thekra. Nothing is removed or hidden for anyone else; the
   * reported message leaves the reporter's own feed, and `mute` hides the member's messages from it too. A second
   * report of the same member or message within {@link FEED_LIMITS.reportDedupeDays} days is answered the same and
   * not stored again.
   */
  async report(userId: string, circleId: string, dto: ReportDto, now = new Date()): Promise<CircleReportResultDto> {
    const me = await this.circles.memberOf(userId, circleId);
    const target = dto.kind === 'member' ? await this.memberTarget(me, circleId, dto) : await this.messageTarget(me, circleId, dto);
    const since = new Date(now.getTime() - FEED_LIMITS.reportDedupeDays * DAY_MS);
    const [today, duplicate, circle] = await Promise.all([
      this.prisma.circleReport.count({ where: { reporterId: userId, createdAt: { gte: toDbDate(utcToday(now)) } } }),
      this.prisma.circleReport.findFirst({
        where: {
          reporterId: userId,
          createdAt: { gte: since },
          ...(dto.kind === 'member'
            ? { kind: 'MEMBER', reportedMemberId: target.member.id }
            : { kind: 'MESSAGE', messageId: target.messageId! }),
        },
        select: { id: true },
      }),
      this.prisma.circle.findUnique({ where: { id: circleId }, select: { name: true } }),
    ]);
    if (!duplicate) {
      if (today >= FEED_LIMITS.reportsPerDay) throw tooMany('CIRCLE_REPORTS_LIMIT', 'Enough reports for today');
      await this.prisma.circleReport.create({
        data: {
          kind: dto.kind === 'member' ? 'MEMBER' : 'MESSAGE',
          circleId,
          circleName: circle?.name ?? '',
          reporterId: userId,
          reporterName: me.displayName,
          reportedMemberId: target.member.id,
          reportedUserId: target.member.userId,
          reportedName: target.member.displayName,
          messageId: target.messageId,
          messageSnapshot: target.snapshot ?? Prisma.DbNull,
          reason: dto.reason,
          note: dto.note ?? null,
        },
      });
    }
    if (dto.mute) {
      await this.prisma.circleMute.upsert({
        where: { memberId_mutedId: { memberId: me.id, mutedId: target.member.id } },
        create: { memberId: me.id, mutedId: target.member.id },
        update: {},
      });
    }
    return { received: true, muted: dto.mute === true };
  }

  /** GET /admin/circle-reports: newest first. */
  async adminReports(query: { before?: string; limit?: number }): Promise<{ data: AdminCircleReportDto[]; nextBefore: string | null }> {
    const limit = query.limit ?? 50;
    const rows = await this.prisma.circleReport.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const userIds = [...new Set(page.map((r) => r.reportedUserId).filter((id): id is string => id !== null))];
    const [byUser, members] = await Promise.all([
      userIds.length > 0
        ? this.prisma.circleReport.groupBy({ by: ['reportedUserId'], where: { reportedUserId: { in: userIds } }, _count: { _all: true } })
        : Promise.resolve([]),
      this.prisma.circleMember.findMany({
        where: { id: { in: page.map((r) => r.reportedMemberId).filter((id): id is string => id !== null) } },
        select: { id: true },
      }),
    ]);
    const countByUser = new Map(byUser.map((g) => [g.reportedUserId, g._count._all]));
    const stillThere = new Set(members.map((m) => m.id));
    return {
      data: page.map((r) => ({
        id: r.id,
        kind: r.kind === 'MEMBER' ? 'member' : 'message',
        reason: r.reason as AdminCircleReportDto['reason'],
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        circle: { id: r.circleId, name: r.circleName },
        reporter: { userId: r.reporterId, name: r.reporterName },
        reported: {
          userId: r.reportedUserId,
          memberId: r.reportedMemberId,
          name: r.reportedName,
          stillMember: r.reportedMemberId !== null && stillThere.has(r.reportedMemberId),
        },
        message: r.kind === 'MESSAGE' ? { id: r.messageId, snapshot: r.messageSnapshot } : null,
        reportsAboutSame: r.reportedUserId ? (countByUser.get(r.reportedUserId) ?? 1) : 1,
      })),
      nextBefore: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  private async memberTarget(me: CircleMember, circleId: string, dto: ReportDto) {
    if (!dto.memberId || dto.messageId) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'A member report names memberId only' });
    }
    if (dto.memberId === me.id) throw new BadRequestException({ code: 'CIRCLE_REPORT_SELF', message: 'You cannot report yourself' });
    const member = await this.otherMember(circleId, dto.memberId);
    return { member, messageId: null as string | null, snapshot: null as Prisma.InputJsonValue | null };
  }

  private async messageTarget(me: CircleMember, circleId: string, dto: ReportDto) {
    if (!dto.messageId || dto.memberId) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'A message report names messageId only' });
    }
    const message = await this.visibleMessage(me, circleId, dto.messageId);
    if (message.senderId === me.id) {
      throw new BadRequestException({ code: 'CIRCLE_REPORT_SELF', message: 'You cannot report your own message' });
    }
    const snapshot: Prisma.InputJsonValue = {
      kind: message.kind,
      key: message.key,
      data: message.data ?? null,
      round: message.round
        ? { kind: message.round.kind, label: message.round.label, minutes: message.round.minutes, outcome: message.round.outcome }
        : null,
      createdAt: message.createdAt.toISOString(),
    } as Prisma.InputJsonValue;
    return { member: message.sender, messageId: message.id as string | null, snapshot: snapshot as Prisma.InputJsonValue | null };
  }

  /** A message of this circle that `me` can see (the same rule as the feed), or 404. */
  private async visibleMessage(me: CircleMember, circleId: string, messageId: string) {
    const message = await this.prisma.circleMessage.findFirst({
      where: {
        id: messageId,
        circleId,
        OR: [{ receiverId: null }, { receiverId: me.id }, { senderId: me.id }, { kind: 'REPLY' }],
      },
      include: {
        sender: { select: { id: true, userId: true, displayName: true } },
        round: { select: { kind: true, label: true, minutes: true, outcome: true } },
      },
    });
    if (!message) throw new NotFoundException({ code: 'CIRCLE_MESSAGE_NOT_FOUND', message: 'Message not found' });
    return message;
  }

  private async otherMember(circleId: string, memberId: string) {
    const member = await this.prisma.circleMember.findFirst({
      where: { id: memberId, circleId },
      select: { id: true, userId: true, displayName: true },
    });
    if (!member) throw new NotFoundException({ code: 'CIRCLE_MEMBER_NOT_FOUND', message: 'Member not found' });
    return member;
  }

  private roundNotFound() {
    return new NotFoundException({ code: 'CIRCLE_ROUND_NOT_FOUND', message: 'Round not found' });
  }
}
