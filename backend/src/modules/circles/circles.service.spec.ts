import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  CIRCLE_MAX_MEMBERS,
  CIRCLES_PER_USER_MAX,
  CirclesService,
  generateInviteCode,
  normalizeInviteCode,
} from './circles.service.js';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const USER = 'u0000000-0000-4000-8000-000000000001';
const OTHER_USER = 'u0000000-0000-4000-8000-000000000002';
const CIRCLE = 'c0000000-0000-4000-8000-000000000001';
const ME = 'm0000000-0000-4000-8000-000000000001';
const OTHER = 'm0000000-0000-4000-8000-000000000002';

type Member = {
  id: string;
  circleId: string;
  userId: string;
  displayName: string;
  isOwner: boolean;
  sharesPresence: boolean;
  joinedAt: Date;
};

const member = (overrides: Partial<Member> = {}): Member => ({
  id: ME,
  circleId: CIRCLE,
  userId: USER,
  displayName: 'أبو عمر',
  isOwner: true,
  sharesPresence: true,
  joinedAt: new Date('2026-10-01T00:00:00.000Z'),
  ...overrides,
});

const p2002 = () => new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '6' });
const codeOf = (error: unknown) => ((error as HttpException).getResponse() as { code: string }).code;
const statusOf = (error: unknown) => (error as HttpException).getStatus();

function makePrisma(me: Member | null = member()) {
  const prisma = {
    circle: {
      findUnique: vi.fn().mockResolvedValue({
        id: CIRCLE,
        name: 'رفقة الفجر',
        intention: null,
        inviteCode: 'ABCDEFGHJK',
        members: [
          { ...member(), presences: [{ date: new Date('2026-10-28T00:00:00.000Z') }] },
          {
            ...member({ id: OTHER, userId: OTHER_USER, displayName: 'سالم', isOwner: false, sharesPresence: false }),
            presences: [{ date: new Date('2026-10-29T00:00:00.000Z') }],
          },
        ],
      }),
      create: vi.fn().mockResolvedValue({ id: CIRCLE }),
      update: vi.fn().mockResolvedValue({ inviteCode: 'NEWCODE234' }),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    circleMember: {
      findUnique: vi.fn().mockResolvedValue(me),
      findFirst: vi.fn().mockResolvedValue({ id: OTHER }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ displayName: 'أبو عمر', sharesPresence: true, ...JSON.parse(JSON.stringify(data)) }),
      ),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    circlePresence: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    circleCheer: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'cheer-1' }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  return prisma;
}

const service = (prisma: ReturnType<typeof makePrisma>) => new CirclesService(prisma as unknown as PrismaService);

describe('invite codes', () => {
  it('are 10 characters from the non-ambiguous alphabet and differ between calls', () => {
    const codes = new Set(Array.from({ length: 50 }, generateInviteCode));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
  });

  it('normalise what people type', () => {
    expect(normalizeInviteCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
  });
});

describe('CirclesService', () => {
  describe('create', () => {
    it('makes the creator the owner and returns the invite code', async () => {
      const prisma = makePrisma();
      const detail = await service(prisma).create(USER, { name: 'رفقة الفجر', displayName: 'أبو عمر' }, NOW);
      expect(prisma.circle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ members: { create: { userId: USER, displayName: 'أبو عمر', isOwner: true } } }),
        }),
      );
      expect(detail.inviteCode).toBe('ABCDEFGHJK');
    });

    it(`refuses a ${CIRCLES_PER_USER_MAX + 1}th circle`, async () => {
      const prisma = makePrisma();
      prisma.circleMember.count.mockResolvedValue(CIRCLES_PER_USER_MAX);
      const error = await service(prisma).create(USER, { name: 'x', displayName: 'y' }, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(409);
      expect(codeOf(error)).toBe('CIRCLE_LIMIT_REACHED');
      expect(prisma.circle.create).not.toHaveBeenCalled();
    });

    it('retries with a new code when the code collides', async () => {
      const prisma = makePrisma();
      prisma.circle.create.mockRejectedValueOnce(p2002()).mockResolvedValueOnce({ id: CIRCLE });
      await service(prisma).create(USER, { name: 'x', displayName: 'y' }, NOW);
      expect(prisma.circle.create).toHaveBeenCalledTimes(2);
      const [first, second] = prisma.circle.create.mock.calls.map(([arg]) => (arg as { data: { inviteCode: string } }).data.inviteCode);
      expect(first).not.toBe(second);
    });
  });

  describe('join', () => {
    const dto = { code: 'abcde-fghjk', displayName: 'سالم' };

    function joining() {
      const prisma = makePrisma(member({ id: OTHER, userId: OTHER_USER, isOwner: false }));
      prisma.circle.findUnique.mockResolvedValueOnce({ id: CIRCLE });
      prisma.circleMember.findUnique.mockResolvedValueOnce(null);
      return prisma;
    }

    it('finds the circle by the normalised code, locks it and adds a plain member', async () => {
      const prisma = joining();
      await service(prisma).join(OTHER_USER, dto, NOW);
      expect(prisma.circle.findUnique).toHaveBeenNthCalledWith(1, { where: { inviteCode: 'ABCDEFGHJK' }, select: { id: true } });
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.circle.deleteMany).toHaveBeenCalledWith({ where: { members: { none: {} } } });
      expect(prisma.circleMember.create).toHaveBeenCalledWith({ data: { circleId: CIRCLE, userId: OTHER_USER, displayName: 'سالم' } });
    });

    it('404 CIRCLE_INVITE_INVALID for an unknown code', async () => {
      const prisma = makePrisma();
      prisma.circle.findUnique.mockResolvedValueOnce(null);
      expect(codeOf(await service(prisma).join(OTHER_USER, dto, NOW).catch((e: unknown) => e))).toBe('CIRCLE_INVITE_INVALID');
    });

    it(`409 CIRCLE_FULL at ${CIRCLE_MAX_MEMBERS} members`, async () => {
      const prisma = joining();
      prisma.circleMember.count.mockImplementation(({ where }: { where: { circleId?: string } }) =>
        Promise.resolve(where.circleId ? CIRCLE_MAX_MEMBERS : 0),
      );
      expect(codeOf(await service(prisma).join(OTHER_USER, dto, NOW).catch((e: unknown) => e))).toBe('CIRCLE_FULL');
      expect(prisma.circleMember.create).not.toHaveBeenCalled();
    });

    it(`409 CIRCLE_LIMIT_REACHED when the user is already in ${CIRCLES_PER_USER_MAX} circles`, async () => {
      const prisma = joining();
      prisma.circleMember.count.mockImplementation(({ where }: { where: { userId?: string } }) =>
        Promise.resolve(where.userId ? CIRCLES_PER_USER_MAX : 1),
      );
      expect(codeOf(await service(prisma).join(OTHER_USER, dto, NOW).catch((e: unknown) => e))).toBe('CIRCLE_LIMIT_REACHED');
    });

    it('a member joining again gets the circle, no second row', async () => {
      const prisma = makePrisma();
      prisma.circle.findUnique.mockResolvedValueOnce({ id: CIRCLE });
      await service(prisma).join(USER, dto, NOW);
      expect(prisma.circleMember.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('404 for a non-member (the circle is not revealed)', async () => {
      const error = await service(makePrisma(null)).findOne(OTHER_USER, CIRCLE, undefined, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(404);
      expect(codeOf(error)).toBe('CIRCLE_NOT_FOUND');
    });

    it('shows 7 days ending today, marks only of sharing members, no user ids', async () => {
      const detail = await service(makePrisma()).findOne(USER, CIRCLE, undefined, NOW);
      expect(detail.days).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
      expect(detail.members.map((m) => [m.memberId, m.isMe, m.presentDays])).toEqual([
        [ME, true, ['2026-10-28']],
        [OTHER, false, []],
      ]);
      const json = JSON.stringify(detail);
      expect(json).not.toContain(USER);
      expect(json).not.toContain(OTHER_USER);
    });

    it('gives the invite code to the owner only', async () => {
      expect((await service(makePrisma()).findOne(USER, CIRCLE, undefined, NOW)).inviteCode).toBe('ABCDEFGHJK');
      const prisma = makePrisma(member({ id: OTHER, userId: OTHER_USER, isOwner: false }));
      prisma.circleMember.count.mockResolvedValue(1);
      expect((await service(prisma).findOne(OTHER_USER, CIRCLE, undefined, NOW)).inviteCode).toBeNull();
    });

    it('an ownerless circle (owner deleted the account) passes to the earliest member', async () => {
      const prisma = makePrisma(member({ id: OTHER, userId: OTHER_USER, isOwner: false }));
      prisma.circleMember.count.mockResolvedValue(0);
      prisma.circleMember.findFirst.mockResolvedValue({ id: OTHER });
      const detail = await service(prisma).findOne(OTHER_USER, CIRCLE, undefined, NOW);
      expect(prisma.circleMember.update).toHaveBeenCalledWith({ where: { id: OTHER }, data: { isOwner: true } });
      expect(detail.me.isOwner).toBe(true);
      expect(detail.inviteCode).toBe('ABCDEFGHJK');
    });

    it('accepts the viewer’s today within ±1 day only', async () => {
      const detail = await service(makePrisma()).findOne(USER, CIRCLE, '2026-10-30', NOW);
      expect(detail.days.at(-1)).toBe('2026-10-30');
      const error = await service(makePrisma()).findOne(USER, CIRCLE, '2026-11-01', NOW).catch((e: unknown) => e);
      expect(codeOf(error)).toBe('CIRCLE_DATE_OUT_OF_RANGE');
    });
  });

  describe('presence', () => {
    it('marks the date in every sharing circle, idempotently', async () => {
      const prisma = makePrisma();
      prisma.circleMember.findMany.mockResolvedValue([{ id: ME }, { id: OTHER }]);
      expect(await service(prisma).markPresence(USER, '2026-10-29', NOW)).toEqual({ circles: 2 });
      expect(prisma.circleMember.findMany).toHaveBeenCalledWith({ where: { userId: USER, sharesPresence: true }, select: { id: true } });
      expect(prisma.circlePresence.createMany).toHaveBeenCalledWith({
        data: [
          { memberId: ME, date: new Date('2026-10-29T00:00:00.000Z') },
          { memberId: OTHER, date: new Date('2026-10-29T00:00:00.000Z') },
        ],
        skipDuplicates: true,
      });
    });

    it('writes nothing when the user shares nowhere', async () => {
      const prisma = makePrisma();
      expect(await service(prisma).markPresence(USER, '2026-10-29', NOW)).toEqual({ circles: 0 });
      expect(prisma.circlePresence.createMany).not.toHaveBeenCalled();
    });

    it.each(['2026-10-28', '2026-10-30'])('accepts %s (server today ±1)', async (date) => {
      await expect(service(makePrisma()).markPresence(USER, date, NOW)).resolves.toEqual({ circles: 0 });
    });

    it.each(['2026-10-27', '2026-10-31', '2026-02-30', 'yesterday'])('refuses %s', async (date) => {
      const error = await service(makePrisma()).markPresence(USER, date, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(400);
      expect(codeOf(error)).toBe('CIRCLE_DATE_OUT_OF_RANGE');
    });

    it('clears the date in all the user’s circles', async () => {
      const prisma = makePrisma();
      await service(prisma).clearPresence(USER, '2026-10-29', NOW);
      expect(prisma.circlePresence.deleteMany).toHaveBeenCalledWith({
        where: { date: new Date('2026-10-29T00:00:00.000Z'), member: { userId: USER } },
      });
    });

    it('turning sharing off deletes the marks already shared', async () => {
      const prisma = makePrisma();
      expect(await service(prisma).updateMembership(USER, CIRCLE, { sharesPresence: false })).toEqual({
        displayName: 'أبو عمر',
        sharesPresence: false,
      });
      expect(prisma.circlePresence.deleteMany).toHaveBeenCalledWith({ where: { memberId: ME } });
      await service(prisma).updateMembership(USER, CIRCLE, { displayName: 'عمر' });
      expect(prisma.circlePresence.deleteMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('cheers', () => {
    it('to a member: one per target per day', async () => {
      const prisma = makePrisma();
      expect(await service(prisma).sendCheer(USER, CIRCLE, { message: 'thabat', toMemberId: OTHER }, NOW)).toEqual({ id: 'cheer-1' });
      expect(prisma.circleCheer.create).toHaveBeenCalledWith({
        data: {
          circleId: CIRCLE,
          senderId: ME,
          receiverId: OTHER,
          target: OTHER,
          message: 'thabat',
          day: new Date('2026-10-29T00:00:00.000Z'),
        },
        select: { id: true },
      });
      prisma.circleCheer.create.mockRejectedValueOnce(p2002());
      const error = await service(prisma).sendCheer(USER, CIRCLE, { message: 'jazak', toMemberId: OTHER }, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(409);
      expect(codeOf(error)).toBe('CIRCLE_CHEER_ALREADY_SENT');
    });

    it('to the whole circle targets `circle`', async () => {
      const prisma = makePrisma();
      await service(prisma).sendCheer(USER, CIRCLE, { message: 'dhakkarani' }, NOW);
      expect(prisma.circleCheer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ receiverId: null, target: 'circle' }) }),
      );
    });

    it('refuses oneself, a member of another circle and a non-member sender', async () => {
      expect(codeOf(await service(makePrisma()).sendCheer(USER, CIRCLE, { message: 'thabat', toMemberId: ME }, NOW).catch((e: unknown) => e))).toBe(
        'CIRCLE_CHEER_SELF',
      );
      const prisma = makePrisma();
      prisma.circleMember.findFirst.mockResolvedValue(null);
      expect(codeOf(await service(prisma).sendCheer(USER, CIRCLE, { message: 'thabat', toMemberId: OTHER }, NOW).catch((e: unknown) => e))).toBe(
        'CIRCLE_MEMBER_NOT_FOUND',
      );
      expect(prisma.circleMember.findFirst).toHaveBeenCalledWith({ where: { id: OTHER, circleId: CIRCLE }, select: { id: true } });
      expect(codeOf(await service(makePrisma(null)).sendCheer(OTHER_USER, CIRCLE, { message: 'thabat' }, NOW).catch((e: unknown) => e))).toBe(
        'CIRCLE_NOT_FOUND',
      );
    });
  });

  describe('leaving and owner actions', () => {
    it('the owner leaving hands the circle to the earliest member', async () => {
      const prisma = makePrisma();
      await service(prisma).leave(USER, CIRCLE);
      expect(prisma.circleMember.delete).toHaveBeenCalledWith({ where: { id: ME } });
      expect(prisma.circleMember.update).toHaveBeenCalledWith({ where: { id: OTHER }, data: { isOwner: true } });
      expect(prisma.circle.delete).not.toHaveBeenCalled();
    });

    it('the last member leaving deletes the circle', async () => {
      const prisma = makePrisma();
      prisma.circleMember.findFirst.mockResolvedValue(null);
      await service(prisma).leave(USER, CIRCLE);
      expect(prisma.circle.delete).toHaveBeenCalledWith({ where: { id: CIRCLE } });
    });

    it('only the owner removes members, rotates the code or deletes the circle', async () => {
      const plain = () => {
        const prisma = makePrisma(member({ id: OTHER, userId: OTHER_USER, isOwner: false }));
        prisma.circleMember.count.mockResolvedValue(1);
        return prisma;
      };
      for (const action of [
        (s: CirclesService) => s.removeMember(OTHER_USER, CIRCLE, ME),
        (s: CirclesService) => s.rotateInviteCode(OTHER_USER, CIRCLE),
        (s: CirclesService) => s.deleteCircle(OTHER_USER, CIRCLE),
      ]) {
        const prisma = plain();
        const error = await action(service(prisma)).catch((e: unknown) => e);
        expect(statusOf(error)).toBe(403);
        expect(codeOf(error)).toBe('CIRCLE_OWNER_ONLY');
        expect(prisma.circle.update).not.toHaveBeenCalled();
        expect(prisma.circle.delete).not.toHaveBeenCalled();
        expect(prisma.circleMember.deleteMany).not.toHaveBeenCalled();
      }
    });

    it('the owner removes a member of this circle only, never themself', async () => {
      const prisma = makePrisma();
      await service(prisma).removeMember(USER, CIRCLE, OTHER);
      expect(prisma.circleMember.deleteMany).toHaveBeenCalledWith({ where: { id: OTHER, circleId: CIRCLE } });
      prisma.circleMember.deleteMany.mockResolvedValue({ count: 0 });
      expect(codeOf(await service(prisma).removeMember(USER, CIRCLE, OTHER).catch((e: unknown) => e))).toBe('CIRCLE_MEMBER_NOT_FOUND');
      expect(codeOf(await service(prisma).removeMember(USER, CIRCLE, ME).catch((e: unknown) => e))).toBe('CIRCLE_OWNER_REMOVE_SELF');
    });

    it('the owner rotates the code and deletes the circle', async () => {
      const prisma = makePrisma();
      expect(await service(prisma).rotateInviteCode(USER, CIRCLE)).toEqual({ inviteCode: 'NEWCODE234' });
      expect(prisma.circle.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CIRCLE }, data: { inviteCode: expect.stringMatching(/^[2-9A-Z]{10}$/) } }),
      );
      await service(prisma).deleteCircle(USER, CIRCLE);
      expect(prisma.circle.delete).toHaveBeenCalledWith({ where: { id: CIRCLE } });
    });
  });
});
