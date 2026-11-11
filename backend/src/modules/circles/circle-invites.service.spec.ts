import { HttpException } from '@nestjs/common';
import { CIRCLE_MAX_MEMBERS } from './circles.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  CircleInvitesService,
  INVITE_TTL_DAYS,
  INVITES_ACTIVE_MAX,
  INVITES_PER_PERIOD_MAX,
  inviteStatus,
} from './circle-invites.service.js';
import type { CirclesService } from './circles.service.js';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const INVITER = 'u0000000-0000-4000-8000-000000000001';
const GUEST = 'u0000000-0000-4000-8000-000000000002';
const CIRCLE = 'c0000000-0000-4000-8000-000000000001';
const INVITE = 'i0000000-0000-4000-8000-000000000001';

const codeOf = (error: unknown) => ((error as HttpException).getResponse() as { code: string }).code;
const statusOf = (error: unknown) => (error as HttpException).getStatus();

const activeInvite = (overrides: Record<string, unknown> = {}) => ({
  id: INVITE,
  inviterId: INVITER,
  circleId: null as string | null,
  redeemedById: null as string | null,
  redeemedAt: null as Date | null,
  revokedAt: null as Date | null,
  expiresAt: new Date(NOW.getTime() + 86_400_000),
  circle: null as { name: string } | null,
  ...overrides,
});

function setup() {
  const prisma = {
    circleInvite: {
      findUnique: vi.fn().mockResolvedValue(activeInvite()),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: INVITE, code: data['code'], redeemedAt: null, revokedAt: null, expiresAt: data['expiresAt'], createdAt: NOW, circle: null }),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue({ displayName: 'سالم' }) },
    circleMember: { count: vi.fn().mockResolvedValue(1), findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  const circles = {
    isEnabled: vi.fn().mockResolvedValue(true),
    ownerOf: vi.fn().mockResolvedValue({ id: 'm1', isOwner: true }),
    addMember: vi.fn().mockResolvedValue(undefined),
    findOne: vi.fn().mockResolvedValue({ id: CIRCLE, name: 'صحبة الفجر' }),
  };
  const service = new CircleInvitesService(prisma as unknown as PrismaService, circles as unknown as CirclesService);
  return { prisma, circles, service };
}

describe('inviteStatus', () => {
  it('redeemed, revoked, expired, else active', () => {
    const later = new Date(NOW.getTime() + 1000);
    expect(inviteStatus({ redeemedAt: NOW, revokedAt: null, expiresAt: later }, NOW)).toBe('redeemed');
    expect(inviteStatus({ redeemedAt: null, revokedAt: NOW, expiresAt: later }, NOW)).toBe('revoked');
    expect(inviteStatus({ redeemedAt: null, revokedAt: null, expiresAt: NOW }, NOW)).toBe('expired');
    expect(inviteStatus({ redeemedAt: null, revokedAt: null, expiresAt: later }, NOW)).toBe('active');
  });
});

describe('CircleInvitesService', () => {
  describe('access', () => {
    it('off: no invite numbers', async () => {
      const { service, circles } = setup();
      circles.isEnabled.mockResolvedValue(false);
      expect(await service.access(GUEST, NOW)).toEqual({ enabled: false, inCircle: false, invites: null });
    });

    it('on: what is left under both limits', async () => {
      const { service, prisma } = setup();
      prisma.circleInvite.count.mockResolvedValueOnce(2).mockResolvedValueOnce(9);
      const access = await service.access(INVITER, NOW);
      expect(access.invites).toMatchObject({ active: 2, createdInPeriod: 9, remaining: 1, ttlDays: INVITE_TTL_DAYS });
      expect(access.inCircle).toBe(false);
    });

    it('inCircle: true once I belong to a circle (the website shows «شارك تطورك مع الصحبة» then)', async () => {
      const { service, prisma } = setup();
      prisma.circleMember.findFirst.mockResolvedValue({ id: 'm1' });
      expect((await service.access(INVITER, NOW)).inCircle).toBe(true);
      expect(prisma.circleMember.findFirst).toHaveBeenCalledWith({ where: { userId: INVITER }, select: { id: true } });
    });
  });

  describe('create', () => {
    it('403 CIRCLES_NOT_ENABLED for a user whose صحبة is off', async () => {
      const { service, circles, prisma } = setup();
      circles.isEnabled.mockResolvedValue(false);
      const error = await service.create(GUEST, {}, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(403);
      expect(codeOf(error)).toBe('CIRCLES_NOT_ENABLED');
      expect(prisma.circleInvite.create).not.toHaveBeenCalled();
    });

    it(`a code that expires in ${INVITE_TTL_DAYS} days, made under a lock on the inviter`, async () => {
      const { service, prisma } = setup();
      const invite = await service.create(INVITER, {}, NOW);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(invite.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
      expect(invite.status).toBe('active');
      expect(new Date(invite.expiresAt).getTime() - NOW.getTime()).toBe(INVITE_TTL_DAYS * 86_400_000);
    });

    it('an invite to a circle is for its owner only', async () => {
      const { service, circles, prisma } = setup();
      circles.ownerOf.mockRejectedValue(new HttpException({ code: 'CIRCLE_OWNER_ONLY' }, 403));
      const error = await service.create(INVITER, { circleId: CIRCLE }, NOW).catch((e: unknown) => e);
      expect(codeOf(error)).toBe('CIRCLE_OWNER_ONLY');
      expect(prisma.circleInvite.create).not.toHaveBeenCalled();
    });

    it('409 CIRCLE_FULL when the circle has no place left (no invite is made)', async () => {
      const { service, prisma } = setup();
      prisma.circleMember.count.mockResolvedValue(CIRCLE_MAX_MEMBERS);
      const error = await service.create(INVITER, { circleId: CIRCLE }, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(409);
      expect(codeOf(error)).toBe('CIRCLE_FULL');
      expect(prisma.circleInvite.create).not.toHaveBeenCalled();
    });

    it(`409 at ${INVITES_ACTIVE_MAX} unused invites, and at ${INVITES_PER_PERIOD_MAX} in the period`, async () => {
      const { service, prisma } = setup();
      prisma.circleInvite.count.mockResolvedValueOnce(INVITES_ACTIVE_MAX).mockResolvedValueOnce(0);
      expect(codeOf(await service.create(INVITER, {}, NOW).catch((e: unknown) => e))).toBe('CIRCLE_INVITES_ACTIVE_LIMIT');
      prisma.circleInvite.count.mockResolvedValueOnce(0).mockResolvedValueOnce(INVITES_PER_PERIOD_MAX);
      expect(codeOf(await service.create(INVITER, {}, NOW).catch((e: unknown) => e))).toBe('CIRCLE_INVITES_PERIOD_LIMIT');
      expect(prisma.circleInvite.create).not.toHaveBeenCalled();
    });
  });

  describe('redeem', () => {
    it('claims the invite atomically and turns صحبة on', async () => {
      const { service, prisma } = setup();
      const result = await service.redeem(GUEST, { code: 'abcde-fghjk' }, NOW);
      expect(prisma.circleInvite.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'ABCDEFGHJK' } }));
      expect(prisma.circleInvite.updateMany).toHaveBeenCalledWith({
        where: { id: INVITE, redeemedAt: null, revokedAt: null, expiresAt: { gt: NOW } },
        data: { redeemedAt: NOW, redeemedById: GUEST },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: GUEST, circlesEnabledAt: null }, data: { circlesEnabledAt: NOW } });
      expect(result).toEqual({ enabled: true, circle: null });
    });

    it('a wrong code is 404; an expired, used or cancelled one is 410 with its own code', async () => {
      const { service, prisma } = setup();
      const cases: [unknown, number, string][] = [
        [null, 404, 'CIRCLE_INVITE_INVALID'],
        [activeInvite({ redeemedAt: NOW, redeemedById: 'someone-else' }), 410, 'CIRCLE_INVITE_USED'],
        [activeInvite({ revokedAt: NOW }), 410, 'CIRCLE_INVITE_REVOKED'],
        [activeInvite({ expiresAt: NOW }), 410, 'CIRCLE_INVITE_EXPIRED'],
      ];
      for (const [row, status, code] of cases) {
        prisma.circleInvite.findUnique.mockResolvedValueOnce(row);
        const error = await service.redeem(GUEST, { code: 'ABCDEFGHJK' }, NOW).catch((e: unknown) => e);
        expect(statusOf(error)).toBe(status);
        expect(codeOf(error)).toBe(code);
      }
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('a race lost on the claim is 410 CIRCLE_INVITE_USED and enables nothing', async () => {
      const { service, prisma } = setup();
      prisma.circleInvite.updateMany.mockResolvedValue({ count: 0 });
      const error = await service.redeem(GUEST, { code: 'ABCDEFGHJK' }, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(410);
      expect(codeOf(error)).toBe('CIRCLE_INVITE_USED');
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('one’s own invite is refused', async () => {
      const { service } = setup();
      expect(codeOf(await service.redeem(INVITER, { code: 'ABCDEFGHJK' }, NOW).catch((e: unknown) => e))).toBe('CIRCLE_INVITE_OWN');
    });

    it('a circle invite joins in one step with the account name when none is sent', async () => {
      const { service, prisma, circles } = setup();
      prisma.circleInvite.findUnique.mockResolvedValue(activeInvite({ circleId: CIRCLE, circle: { name: 'صحبة الفجر' } }));
      const result = await service.redeem(GUEST, { code: 'ABCDEFGHJK' }, NOW);
      expect(circles.addMember).toHaveBeenCalledWith(prisma, CIRCLE, GUEST, 'سالم');
      expect(prisma.user.updateMany).toHaveBeenCalled();
      expect(result).toEqual({ enabled: true, circle: { id: CIRCLE, name: 'صحبة الفجر' } });
    });

    it('a name sent with the code wins over the account name', async () => {
      const { service, prisma, circles } = setup();
      prisma.circleInvite.findUnique.mockResolvedValue(activeInvite({ circleId: CIRCLE, circle: { name: 'x' } }));
      await service.redeem(GUEST, { code: 'ABCDEFGHJK', displayName: 'أبو خالد' }, NOW);
      expect(circles.addMember).toHaveBeenCalledWith(prisma, CIRCLE, GUEST, 'أبو خالد');
    });

    it('an account without a name is asked for one first and the invite stays unused', async () => {
      const { service, prisma } = setup();
      prisma.circleInvite.findUnique.mockResolvedValue(activeInvite({ circleId: CIRCLE, circle: { name: 'صحبة الفجر' } }));
      prisma.user.findUnique.mockResolvedValue({ displayName: null });
      const error = await service.redeem(GUEST, { code: 'ABCDEFGHJK' }, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(400);
      expect(codeOf(error)).toBe('CIRCLE_DISPLAY_NAME_REQUIRED');
      expect(prisma.circleInvite.updateMany).not.toHaveBeenCalled();
    });

    it('a full circle refuses with 409 CIRCLE_FULL and the invite stays valid (the transaction fails as a whole)', async () => {
      const { service, prisma, circles } = setup();
      prisma.circleInvite.findUnique.mockResolvedValue(activeInvite({ circleId: CIRCLE, circle: { name: 'x' } }));
      circles.addMember.mockRejectedValue(new HttpException({ code: 'CIRCLE_FULL' }, 409));
      const error = await service.redeem(GUEST, { code: 'ABCDEFGHJK' }, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(409);
      expect(codeOf(error)).toBe('CIRCLE_FULL');
      expect(circles.findOne).not.toHaveBeenCalled();
    });

    it('the inviter left the circle: 409 CIRCLE_INVITE_CIRCLE_GONE, nobody joined', async () => {
      const { service, prisma, circles } = setup();
      prisma.circleInvite.findUnique.mockResolvedValue(activeInvite({ circleId: CIRCLE, circle: { name: 'x' } }));
      prisma.circleMember.count.mockResolvedValue(0);
      const error = await service.redeem(GUEST, { code: 'ABCDEFGHJK', displayName: 'سالم' }, NOW).catch((e: unknown) => e);
      expect(statusOf(error)).toBe(409);
      expect(codeOf(error)).toBe('CIRCLE_INVITE_CIRCLE_GONE');
      expect(circles.addMember).not.toHaveBeenCalled();
    });

    it('redeeming one’s own used invite again is harmless', async () => {
      const { service, prisma } = setup();
      prisma.circleInvite.findUnique.mockResolvedValue(activeInvite({ redeemedAt: NOW, redeemedById: GUEST }));
      await expect(service.redeem(GUEST, { code: 'ABCDEFGHJK' }, NOW)).resolves.toMatchObject({ enabled: true });
      expect(prisma.circleInvite.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('list and revoke', () => {
    it('shows the code of an unused invite only, and never who redeemed one', async () => {
      const { service, prisma } = setup();
      const later = new Date(NOW.getTime() + 1000);
      prisma.circleInvite.findMany.mockResolvedValue([
        { id: 'a', code: 'AAAAAAAAAA', redeemedAt: null, revokedAt: null, expiresAt: later, createdAt: NOW, circle: null },
        { id: 'b', code: 'BBBBBBBBBB', redeemedAt: NOW, revokedAt: null, expiresAt: later, createdAt: NOW, circle: null },
      ]);
      const list = await service.list(INVITER, NOW);
      expect(list.map((i) => [i.status, i.code])).toEqual([['active', 'AAAAAAAAAA'], ['redeemed', null]]);
      expect(prisma.circleInvite.findMany.mock.calls[0]![0].select).not.toHaveProperty('redeemedById');
    });

    it('revokes only my own unused invite', async () => {
      const { service, prisma } = setup();
      await service.revoke(INVITER, INVITE, NOW);
      expect(prisma.circleInvite.updateMany).toHaveBeenCalledWith({
        where: { id: INVITE, inviterId: INVITER, redeemedAt: null, revokedAt: null, expiresAt: { gt: NOW } },
        data: { revokedAt: NOW },
      });
      prisma.circleInvite.updateMany.mockResolvedValue({ count: 0 });
      expect(statusOf(await service.revoke(GUEST, INVITE, NOW).catch((e: unknown) => e))).toBe(404);
    });
  });
});
