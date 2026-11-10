import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CircleFeedService, FEED_LIMITS } from './circle-feed.service.js';
import { CirclesService } from './circles.service.js';
import { cleanRoundLabel, PRESET_GROUPS, ReportDto, SendMessageDto, StartRoundDto } from './dto/companion.dto.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const USER = 'u0000000-0000-4000-8000-000000000001';
const OTHER_USER = 'u0000000-0000-4000-8000-000000000002';
const CIRCLE = 'c0000000-0000-4000-8000-000000000001';
const ME = 'a0000000-0000-4000-8000-000000000001';
const OTHER = 'a0000000-0000-4000-8000-000000000002';
const MSG = 'b0000000-0000-4000-8000-000000000001';
const ROUND = 'd0000000-0000-4000-8000-000000000001';
const TODAY = new Date('2026-11-10T00:00:00.000Z');

const me = {
  id: ME,
  circleId: CIRCLE,
  userId: USER,
  displayName: 'أبو عمر',
  isOwner: true,
  sharesPresence: true,
  joinedAt: new Date('2026-10-01T00:00:00.000Z'),
};

const codeOf = (error: unknown) => ((error as HttpException).getResponse() as { code: string }).code;
const statusOf = (error: unknown) => (error as HttpException).getStatus();

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MSG,
    circleId: CIRCLE,
    kind: 'PRESET',
    key: 'thabat',
    senderId: OTHER,
    receiverId: null,
    roundId: null,
    data: null,
    day: TODAY,
    createdAt: new Date('2026-11-10T11:00:00.000Z'),
    sender: { displayName: 'سالم' },
    receiver: null,
    round: null,
    saves: [],
    ...overrides,
  };
}

function roundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROUND,
    circleId: CIRCLE,
    memberId: ME,
    kind: 'study',
    label: 'compiler design',
    minutes: 60,
    day: TODAY,
    number: 4,
    startedAt: new Date('2026-11-10T11:30:00.000Z'),
    endedAt: null,
    outcome: null,
    member: { displayName: 'أبو عمر' },
    messages: [],
    ...overrides,
  };
}

function makePrisma(member: typeof me | null = me) {
  const prisma = {
    circle: { findUnique: vi.fn().mockResolvedValue({ name: 'صحبة الفجر' }) },
    circleMember: {
      findUnique: vi.fn().mockResolvedValue(member),
      findFirst: vi.fn().mockResolvedValue({ id: OTHER, userId: OTHER_USER, displayName: 'سالم' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    circleMessage: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({
        ...messageRow(),
        sender: { id: OTHER, userId: OTHER_USER, displayName: 'سالم' },
        round: null,
      }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(messageRow({ ...data, id: 'new', senderId: ME, sender: { displayName: 'أبو عمر' }, data: data.data ?? null })),
      ),
    },
    circleRound: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: ROUND, memberId: OTHER, outcome: null }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(roundRow({ endedAt: NOW, outcome: 'DONE' })),
      count: vi.fn().mockResolvedValue(3),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(roundRow({ ...data, id: ROUND }))),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    circleMessageSave: { upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    circleMute: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    circleReport: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'rep-1' }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  return prisma;
}

function feed(prisma: ReturnType<typeof makePrisma>) {
  const db = prisma as unknown as PrismaService;
  return new CircleFeedService(db, new CirclesService(db));
}

const fail = (p: Promise<unknown>) => p.catch((e: unknown) => e);

describe('CircleFeedService', () => {
  describe('messages (D7)', () => {
    it('404 for a non-member', async () => {
      const error = await fail(feed(makePrisma(null)).messages(OTHER_USER, CIRCLE, {}, NOW));
      expect(statusOf(error)).toBe(404);
      expect(codeOf(error)).toBe('CIRCLE_NOT_FOUND');
    });

    it('newest first; lines to the whole صحبة, to me, from me and replies; not what I reported or whom I hid', async () => {
      const prisma = makePrisma();
      prisma.circleMute.findMany.mockResolvedValue([{ mutedId: OTHER }]);
      prisma.circleMessage.findMany.mockResolvedValue([messageRow({ saves: [{ memberId: ME }], receiverId: ME, receiver: { displayName: 'أبو عمر' } })]);
      const page = await feed(prisma).messages(USER, CIRCLE, { saved: 'true' }, NOW);
      expect(prisma.circleMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            circleId: CIRCLE,
            AND: [
              { OR: [{ receiverId: null }, { receiverId: ME }, { senderId: ME }, { kind: 'REPLY' }] },
              { reports: { none: { reporterId: USER } } },
              { senderId: { notIn: [OTHER] } },
              { saves: { some: { memberId: ME } } },
            ],
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: FEED_LIMITS.pageSize + 1,
        }),
      );
      expect(page.items[0]).toEqual({
        id: MSG,
        kind: 'preset',
        key: 'thabat',
        from: { memberId: OTHER, name: 'سالم', isMe: false },
        to: { memberId: ME, name: 'أبو عمر', isMe: true },
        progress: null,
        round: null,
        saved: true,
        createdAt: '2026-11-10T11:00:00.000Z',
      });
      expect(page.nextBefore).toBeNull();
      expect(JSON.stringify(page)).not.toContain(USER);
    });

    it('pages with `before`; `nextBefore` is the last id when more remain', async () => {
      const prisma = makePrisma();
      prisma.circleMessage.findMany.mockResolvedValue([messageRow({ id: 'x1' }), messageRow({ id: 'x2' }), messageRow({ id: 'x3' })]);
      const page = await feed(prisma).messages(USER, CIRCLE, { before: MSG, limit: 2 }, NOW);
      expect(prisma.circleMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3, cursor: { id: MSG }, skip: 1 }));
      expect(page.items.map((m) => m.id)).toEqual(['x1', 'x2']);
      expect(page.nextBefore).toBe('x2');
    });
  });

  describe('suggested lines (D6)', () => {
    it('a line to one member (encourage / remind groups only), stored by key', async () => {
      const prisma = makePrisma();
      const sent = await feed(prisma).send(USER, CIRCLE, { key: 'thabbatak', toMemberId: OTHER }, NOW);
      expect(prisma.circleMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ circleId: CIRCLE, senderId: ME, receiverId: OTHER, kind: 'PRESET', key: 'thabbatak', day: TODAY }),
        }),
      );
      expect(sent.kind).toBe('preset');
      const error = await fail(feed(makePrisma()).send(USER, CIRCLE, { key: 'ask_dua', toMemberId: OTHER }, NOW));
      expect(codeOf(error)).toBe('CIRCLE_MESSAGE_TARGET');
    });

    it('progress carries two counts and goes with the progress line only', async () => {
      const prisma = makePrisma();
      const sent = await feed(prisma).send(USER, CIRCLE, { key: 'progress', progress: { done: 2, total: 3 } }, NOW);
      expect(sent.progress).toEqual({ done: 2, total: 3 });
      for (const dto of [
        { key: 'progress' as const },
        { key: 'thabat' as const, progress: { done: 1, total: 1 } },
        { key: 'progress' as const, progress: { done: 4, total: 3 } },
      ]) {
        expect(codeOf(await fail(feed(makePrisma()).send(USER, CIRCLE, dto, NOW)))).toBe('VALIDATION_FAILED');
      }
    });

    it('the same line to the same target once a day (progress a few times); a daily cap on all lines', async () => {
      const prisma = makePrisma();
      prisma.circleMessage.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
      const again = await fail(feed(prisma).send(USER, CIRCLE, { key: 'jazak' }, NOW));
      expect([statusOf(again), codeOf(again)]).toEqual([409, 'CIRCLE_CHEER_ALREADY_SENT']);

      prisma.circleMessage.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
      await feed(prisma).send(USER, CIRCLE, { key: 'progress', progress: { done: 3, total: 3 } }, NOW);

      prisma.circleMessage.count.mockResolvedValueOnce(FEED_LIMITS.messagesPerDay).mockResolvedValueOnce(0);
      const capped = await fail(feed(prisma).send(USER, CIRCLE, { key: 'niyya' }, NOW));
      expect([statusOf(capped), codeOf(capped)]).toEqual([429, 'CIRCLE_MESSAGES_LIMIT']);
    });

    it('refuses oneself and a member of another circle', async () => {
      expect(codeOf(await fail(feed(makePrisma()).send(USER, CIRCLE, { key: 'thabat', toMemberId: ME }, NOW)))).toBe('CIRCLE_CHEER_SELF');
      const prisma = makePrisma();
      prisma.circleMember.findFirst.mockResolvedValue(null);
      expect(codeOf(await fail(feed(prisma).send(USER, CIRCLE, { key: 'thabat', toMemberId: OTHER }, NOW)))).toBe('CIRCLE_MEMBER_NOT_FOUND');
    });
  });

  describe('rounds (D5)', () => {
    it('starts round n+1 of my day and posts it to the feed', async () => {
      const prisma = makePrisma();
      const round = await feed(prisma).startRound(USER, CIRCLE, { kind: 'study', label: 'compiler design', minutes: 60, today: '2026-11-10' }, NOW);
      expect(prisma.circleRound.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { circleId: CIRCLE, memberId: ME, kind: 'study', label: 'compiler design', minutes: 60, day: TODAY, number: 4, startedAt: NOW },
        }),
      );
      expect(prisma.circleMessage.create).toHaveBeenCalledWith({
        data: { circleId: CIRCLE, senderId: ME, kind: 'ROUND_START', roundId: ROUND, day: TODAY, createdAt: NOW },
      });
      expect(round).toMatchObject({ number: 4, isMine: true, endsAt: '2026-11-10T13:00:00.000Z', closed: false, outcome: null });
    });

    it('one running round at a time; a forgotten one stops counting after its time and the grace period', async () => {
      const prisma = makePrisma();
      prisma.circleRound.findMany.mockResolvedValue([{ id: 'r0', startedAt: new Date('2026-11-10T11:50:00.000Z'), minutes: 25, endedAt: null }]);
      const error = await fail(feed(prisma).startRound(USER, CIRCLE, { kind: 'focus', minutes: 25, today: '2026-11-10' }, NOW));
      expect([statusOf(error), codeOf(error)]).toEqual([409, 'CIRCLE_ROUND_OPEN']);

      prisma.circleRound.findMany.mockResolvedValue([{ id: 'r0', startedAt: new Date('2026-11-10T05:00:00.000Z'), minutes: 25, endedAt: null }]);
      await feed(prisma).startRound(USER, CIRCLE, { kind: 'focus', minutes: 25, today: '2026-11-10' }, NOW);
      expect(prisma.circleRound.create).toHaveBeenCalled();
    });

    it('a daily cap on rounds, and the local date must be today ±1', async () => {
      const prisma = makePrisma();
      prisma.circleRound.count.mockResolvedValue(FEED_LIMITS.roundsPerDay);
      expect(codeOf(await fail(feed(prisma).startRound(USER, CIRCLE, { kind: 'task', minutes: 15, today: '2026-11-10' }, NOW)))).toBe(
        'CIRCLE_ROUNDS_LIMIT',
      );
      expect(codeOf(await fail(feed(makePrisma()).startRound(USER, CIRCLE, { kind: 'task', minutes: 15, today: '2026-11-13' }, NOW)))).toBe(
        'CIRCLE_DATE_OUT_OF_RANGE',
      );
    });

    it('«تم الحمد لله» by the round’s member, once', async () => {
      const prisma = makePrisma();
      const round = await feed(prisma).endRound(USER, CIRCLE, ROUND, { outcome: 'done' }, NOW);
      expect(prisma.circleRound.updateMany).toHaveBeenCalledWith({
        where: { id: ROUND, circleId: CIRCLE, memberId: ME, endedAt: null },
        data: { endedAt: NOW, outcome: 'DONE' },
      });
      expect(prisma.circleMessage.create).toHaveBeenCalledWith({
        data: { circleId: CIRCLE, senderId: ME, kind: 'ROUND_END', roundId: ROUND, day: TODAY, createdAt: NOW },
      });
      expect(round).toMatchObject({ outcome: 'done', closed: true });

      prisma.circleRound.updateMany.mockResolvedValue({ count: 0 });
      prisma.circleRound.findFirst.mockResolvedValue({ id: ROUND });
      expect(codeOf(await fail(feed(prisma).endRound(USER, CIRCLE, ROUND, { outcome: 'not_done' }, NOW)))).toBe('CIRCLE_ROUND_ENDED');
      prisma.circleRound.findFirst.mockResolvedValue(null);
      expect(codeOf(await fail(feed(prisma).endRound(USER, CIRCLE, ROUND, { outcome: 'not_done' }, NOW)))).toBe('CIRCLE_ROUND_NOT_FOUND');
    });

    it('replies: encouragement before «تم», congratulations after it, each once, never to my own round', async () => {
      const prisma = makePrisma();
      await feed(prisma).replyToRound(USER, CIRCLE, ROUND, { key: 'with_you' }, NOW);
      expect(prisma.circleMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { circleId: CIRCLE, senderId: ME, receiverId: OTHER, kind: 'REPLY', key: 'with_you', roundId: ROUND, day: TODAY },
        }),
      );
      expect(codeOf(await fail(feed(prisma).replyToRound(USER, CIRCLE, ROUND, { key: 'barak' }, NOW)))).toBe('CIRCLE_REPLY_KIND');
      prisma.circleRound.findFirst.mockResolvedValue({ id: ROUND, memberId: OTHER, outcome: 'DONE' });
      expect(codeOf(await fail(feed(prisma).replyToRound(USER, CIRCLE, ROUND, { key: 'go' }, NOW)))).toBe('CIRCLE_REPLY_KIND');
      prisma.circleMessage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      expect(codeOf(await fail(feed(prisma).replyToRound(USER, CIRCLE, ROUND, { key: 'barak' }, NOW)))).toBe('CIRCLE_CHEER_ALREADY_SENT');
      prisma.circleRound.findFirst.mockResolvedValue({ id: ROUND, memberId: ME, outcome: null });
      expect(codeOf(await fail(feed(prisma).replyToRound(USER, CIRCLE, ROUND, { key: 'go' }, NOW)))).toBe('CIRCLE_CHEER_SELF');
    });
  });

  describe('keep and hide', () => {
    it('keeps only a message I can see, idempotently', async () => {
      const prisma = makePrisma();
      expect(await feed(prisma).save(USER, CIRCLE, MSG)).toEqual({ saved: true });
      expect(prisma.circleMessageSave.upsert).toHaveBeenCalledWith({
        where: { memberId_messageId: { memberId: ME, messageId: MSG } },
        create: { memberId: ME, messageId: MSG },
        update: {},
      });
      prisma.circleMessage.findFirst.mockResolvedValue(null);
      expect(codeOf(await fail(feed(prisma).save(USER, CIRCLE, MSG)))).toBe('CIRCLE_MESSAGE_NOT_FOUND');
    });

    it('hides another member for me only; never myself', async () => {
      const prisma = makePrisma();
      await feed(prisma).mute(USER, CIRCLE, OTHER);
      expect(prisma.circleMute.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { memberId: ME, mutedId: OTHER } }));
      expect(codeOf(await fail(feed(prisma).mute(USER, CIRCLE, ME)))).toBe('CIRCLE_MUTE_SELF');
      await feed(prisma).unmute(USER, CIRCLE, OTHER);
      expect(prisma.circleMute.deleteMany).toHaveBeenCalledWith({ where: { memberId: ME, mutedId: OTHER } });
    });
  });

  describe('reports (D8)', () => {
    it('a message report keeps what it said and who sent it; nothing is removed', async () => {
      const prisma = makePrisma();
      const result = await feed(prisma).report(USER, CIRCLE, { kind: 'message', messageId: MSG, reason: 'offensive', note: 'ملاحظة' }, NOW);
      expect(result).toEqual({ received: true, muted: false });
      expect(prisma.circleReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'MESSAGE',
          circleId: CIRCLE,
          circleName: 'صحبة الفجر',
          reporterId: USER,
          reporterName: 'أبو عمر',
          reportedMemberId: OTHER,
          reportedUserId: OTHER_USER,
          reportedName: 'سالم',
          messageId: MSG,
          messageSnapshot: expect.objectContaining({ kind: 'PRESET', key: 'thabat' }),
          reason: 'offensive',
          note: 'ملاحظة',
        }),
      });
      expect(prisma.circleMessage).not.toHaveProperty('delete');
    });

    it('a member report can hide them from my feed at once', async () => {
      const prisma = makePrisma();
      expect(await feed(prisma).report(USER, CIRCLE, { kind: 'member', memberId: OTHER, reason: 'harassment', mute: true }, NOW)).toEqual({
        received: true,
        muted: true,
      });
      expect(prisma.circleMute.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { memberId: ME, mutedId: OTHER } }));
    });

    it('the same report again is answered the same and not stored; a daily cap; never oneself', async () => {
      const prisma = makePrisma();
      prisma.circleReport.findFirst.mockResolvedValue({ id: 'old' });
      await feed(prisma).report(USER, CIRCLE, { kind: 'member', memberId: OTHER, reason: 'spam' }, NOW);
      expect(prisma.circleReport.create).not.toHaveBeenCalled();

      prisma.circleReport.findFirst.mockResolvedValue(null);
      prisma.circleReport.count.mockResolvedValue(FEED_LIMITS.reportsPerDay);
      const capped = await fail(feed(prisma).report(USER, CIRCLE, { kind: 'member', memberId: OTHER, reason: 'spam' }, NOW));
      expect([statusOf(capped), codeOf(capped)]).toEqual([429, 'CIRCLE_REPORTS_LIMIT']);

      expect(codeOf(await fail(feed(makePrisma()).report(USER, CIRCLE, { kind: 'member', memberId: ME, reason: 'spam' }, NOW)))).toBe(
        'CIRCLE_REPORT_SELF',
      );
      const own = makePrisma();
      own.circleMessage.findFirst.mockResolvedValue({ ...messageRow({ senderId: ME }), sender: { id: ME, userId: USER, displayName: 'أبو عمر' } });
      expect(codeOf(await fail(feed(own).report(USER, CIRCLE, { kind: 'message', messageId: MSG, reason: 'spam' }, NOW)))).toBe(
        'CIRCLE_REPORT_SELF',
      );
      expect(codeOf(await fail(feed(makePrisma()).report(USER, CIRCLE, { kind: 'message', memberId: OTHER, reason: 'spam' }, NOW)))).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('the admin list says who, where, what, and how many reports about the same account', async () => {
      const prisma = makePrisma();
      prisma.circleReport.findMany.mockResolvedValue([
        {
          id: 'rep-1',
          kind: 'MESSAGE',
          circleId: CIRCLE,
          circleName: 'صحبة الفجر',
          reporterId: USER,
          reporterName: 'أبو عمر',
          reportedMemberId: OTHER,
          reportedUserId: OTHER_USER,
          reportedName: 'سالم',
          messageId: MSG,
          messageSnapshot: { kind: 'PRESET', key: 'thabat' },
          reason: 'offensive',
          note: null,
          createdAt: NOW,
        },
      ]);
      prisma.circleReport.groupBy.mockResolvedValue([{ reportedUserId: OTHER_USER, _count: { _all: 3 } }]);
      prisma.circleMember.findMany.mockResolvedValue([{ id: OTHER }]);
      const { data, nextBefore } = await feed(prisma).adminReports({});
      expect(nextBefore).toBeNull();
      expect(data[0]).toEqual({
        id: 'rep-1',
        kind: 'message',
        reason: 'offensive',
        note: null,
        createdAt: NOW.toISOString(),
        circle: { id: CIRCLE, name: 'صحبة الفجر' },
        reporter: { userId: USER, name: 'أبو عمر' },
        reported: { userId: OTHER_USER, memberId: OTHER, name: 'سالم', stillMember: true },
        message: { id: MSG, snapshot: { kind: 'PRESET', key: 'thabat' } },
        reportsAboutSame: 3,
      });
    });
  });
});

describe('round-7 DTOs', () => {
  it('a round label is trimmed, its control and direction characters removed, at most 60 characters', async () => {
    expect(cleanRoundLabel('  compiler‮design\n ')).toBe('compiler design');
    expect(cleanRoundLabel(' ⁦ ')).toBeUndefined();
    const ok = plainToInstance(StartRoundDto, { kind: 'study', label: ' سلسلة التحرر ', minutes: 30, today: '2026-11-10' });
    expect(await validate(ok)).toEqual([]);
    expect(ok.label).toBe('سلسلة التحرر');
    const long = plainToInstance(StartRoundDto, { kind: 'study', label: 'x'.repeat(61), minutes: 30, today: '2026-11-10' });
    expect((await validate(long)).map((e) => e.property)).toEqual(['label']);
    const bad = plainToInstance(StartRoundDto, { kind: 'gaming', minutes: 0, today: 'today' });
    expect((await validate(bad)).map((e) => e.property).sort()).toEqual(['kind', 'minutes', 'today']);
  });

  it('lines are keys only; a report note loses control characters', async () => {
    expect((await validate(plainToInstance(SendMessageDto, { key: 'اكتب ما تشاء' }))).map((e) => e.property)).toEqual(['key']);
    const report = plainToInstance(ReportDto, { kind: 'message', messageId: MSG, reason: 'other', note: ' a‮b\u0007 ' });
    expect(await validate(report)).toEqual([]);
    expect(report.note).toBe('ab');
  });

  it('the round-6 cheers are the first encourage lines (their stored keys keep working)', () => {
    expect(PRESET_GROUPS.encourage.slice(0, 3)).toEqual(['thabat', 'jazak', 'dhakkarani']);
  });
});
