/**
 * E2E spec for صحبة (/v1/circles): auth, the envelope and status codes, invite-only access (round 6, C-01k), personal circle invites (round 8: no permanent code), that no user id or email leaves the API, presence marks, the round-7 feed (lines, rounds, keep, report, hide), and the owner-only actions.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures, TEST_ADMIN_ID, TEST_PASSWORD, TEST_USER_ID } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { authHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

const today = () => new Date().toISOString().slice(0, 10);

describe('Circles endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: Record<string, string>;
  let friend: Record<string, string>;
  let circleId: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    owner = await authHeaders(app, 'e2e-user@thekra.test', TEST_PASSWORD);
    friend = await authHeaders(app, 'e2e-admin@thekra.test', TEST_PASSWORD);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('401 without a token', async () => {
    const res = await http().get('/v1/circles').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  const register = async (email: string) => {
    await http().post('/v1/auth/register').send({ email, password: TEST_PASSWORD, displayName: 'Test User' }).expect(201);
    return authHeaders(app, email, TEST_PASSWORD);
  };

  it('صحبة is off for a plain account: no circle, no invite (403 CIRCLES_NOT_ENABLED)', async () => {
    const access = await http().get('/v1/circles/access').set(owner).expect(200);
    expect(access.headers['cache-control']).toContain('no-store');
    expect(access.body.data).toEqual({ enabled: false, inCircle: false, invites: null });
    for (const res of [
      await http().post('/v1/circles').set(owner).send({ name: 'x', displayName: 'y' }),
      await http().post('/v1/circles/invites').set(owner).send({}),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CIRCLES_NOT_ENABLED');
    }
  });

  it('an ADMIN account is on; its invite turns صحبة on for the one who redeems it, once', async () => {
    const adminAccess = await http().get('/v1/circles/access').set(friend).expect(200);
    expect(adminAccess.body.data).toMatchObject({ enabled: true, inCircle: false, invites: { active: 0, remaining: 5, ttlDays: 7 } });

    const created = await http().post('/v1/circles/invites').set(friend).send({}).expect(201);
    const code: string = created.body.data.code;
    expect(created.headers['location']).toBe(`/v1/circles/invites/${created.body.data.id}`);
    expect(created.body.data).toMatchObject({ status: 'active', circle: null });
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);

    expect((await http().post('/v1/circles/invites/redeem').set(friend).send({ code }).expect(400)).body.error.code).toBe('CIRCLE_INVITE_OWN');
    const redeemed = await http().post('/v1/circles/invites/redeem').set(owner).send({ code: code.toLowerCase() }).expect(200);
    expect(redeemed.body.data).toEqual({ enabled: true, circle: null });
    expect((await http().get('/v1/circles/access').set(owner).expect(200)).body.data.enabled).toBe(true);

    const late = await register('e2e-circle-late@thekra.test');
    expect((await http().post('/v1/circles/invites/redeem').set(late).send({ code }).expect(410)).body.error.code).toBe('CIRCLE_INVITE_USED');
    expect((await http().get('/v1/circles/access').set(late).expect(200)).body.data.enabled).toBe(false);

    const mine = await http().get('/v1/circles/invites').set(friend).expect(200);
    expect(mine.body.data).toEqual([expect.objectContaining({ status: 'redeemed', code: null })]);
    const json = JSON.stringify(mine.body);
    for (const secret of [TEST_USER_ID, 'e2e-user@thekra.test']) expect(json).not.toContain(secret);
  });

  it('invites: revoke an unused one; 400 for a bad circle id or code', async () => {
    const created = await http().post('/v1/circles/invites').set(friend).send({}).expect(201);
    await http().delete(`/v1/circles/invites/${created.body.data.id}`).set(owner).expect(404);
    await http().delete(`/v1/circles/invites/${created.body.data.id}`).set(friend).expect(204);
    await http().delete(`/v1/circles/invites/${created.body.data.id}`).set(friend).expect(404);
    const other = await register('e2e-circle-revoked@thekra.test');
    expect((await http().post('/v1/circles/invites/redeem').set(other).send({ code: created.body.data.code }).expect(410)).body.error.code).toBe('CIRCLE_INVITE_REVOKED');
    expect((await http().post('/v1/circles/invites/redeem').set(other).send({ code: 'ZZZZZZZZZZ' }).expect(404)).body.error.code).toBe('CIRCLE_INVITE_INVALID');
    await http().post('/v1/circles/invites').set(friend).send({ circleId: 'not-a-uuid' }).expect(400);
    await http().post('/v1/circles/invites/redeem').set(other).send({ code: '<script>' }).expect(400);
    await http().post('/v1/circles/invites/redeem').set(other).send({ code: 'ABCDEFGHJK', extra: 1 }).expect(400);
  });

  it('POST /v1/circles → 201 with Location, and no permanent code anywhere', async () => {
    const res = await http()
      .post('/v1/circles')
      .set(owner)
      .send({ name: '  صحبة الفجر ', intention: 'نتعاون على الثبات', displayName: 'أبو عمر' })
      .expect(201);
    circleId = res.body.data.id;
    expect(res.headers['location']).toBe(`/v1/circles/${circleId}`);
    expect(res.body.data).toMatchObject({ name: 'صحبة الفجر', memberCount: 1, me: { isOwner: true, sharesPresence: false } });
    expect(JSON.stringify(res.body)).not.toContain('inviteCode');
    // Now in a circle: the website may show «شارك تطورك مع الصحبة».
    expect((await http().get('/v1/circles/access').set(owner).expect(200)).body.data.inCircle).toBe(true);
  });

  it('400 for a name over 40 characters or a direction override', async () => {
    await http().post('/v1/circles').set(owner).send({ name: 'ا'.repeat(41), displayName: 'x' }).expect(400);
    await http().post('/v1/circles').set(owner).send({ name: 'abc‮def', displayName: 'x' }).expect(400);
  });

  it('a non-member gets 404 for the circle', async () => {
    const res = await http().get(`/v1/circles/${circleId}`).set(friend).expect(404);
    expect(res.body.error.code).toBe('CIRCLE_NOT_FOUND');
  });

  it('the old permanent code is gone: no join route, no rotate route', async () => {
    await http().post('/v1/circles/join').set(friend).send({ code: 'ABCDEFGHJK', displayName: 'x' }).expect(404);
    await http().post(`/v1/circles/${circleId}/invite-code`).set(owner).expect(404);
  });

  it('a personal circle invite joins in one step for an account that has not turned صحبة on; the member never sees ids or emails', async () => {
    const created = await http().post('/v1/circles/invites').set(owner).send({ circleId }).expect(201);
    const typed = `${created.body.data.code.slice(0, 5).toLowerCase()}-${created.body.data.code.slice(5)}`;
    const res = await http().post('/v1/circles/invites/redeem').set(friend).send({ code: typed, displayName: 'سالم' }).expect(200);
    expect(res.body.data).toMatchObject({ enabled: true, circle: { id: circleId, memberCount: 2, me: { isOwner: false } } });
    expect(JSON.stringify(res.body)).not.toContain('inviteCode');
    const json = JSON.stringify(res.body);
    for (const secret of [TEST_USER_ID, TEST_ADMIN_ID, 'e2e-user@thekra.test', 'e2e-admin@thekra.test']) {
      expect(json).not.toContain(secret);
    }
  });

  it('presence shows only after sharing is turned on', async () => {
    expect((await http().put('/v1/circles/presence').set(friend).send({ date: today() }).expect(200)).body.data).toEqual({ circles: 0 });
    await http().patch(`/v1/circles/${circleId}/membership`).set(friend).send({ sharesPresence: true }).expect(200);
    expect((await http().put('/v1/circles/presence').set(friend).send({ date: today() }).expect(200)).body.data).toEqual({ circles: 1 });
    await http().put('/v1/circles/presence').set(friend).send({ date: today() }).expect(200);
    const res = await http().get(`/v1/circles/${circleId}`).set(owner).expect(200);
    expect(res.headers['cache-control']).toContain('no-store');
    const salem = res.body.data.members.find((m: { displayName: string }) => m.displayName === 'سالم');
    expect(salem.presentDays).toEqual([today()]);
    expect(res.body.data.days).toHaveLength(7);
  });

  it('400 CIRCLE_DATE_OUT_OF_RANGE for a date far from today', async () => {
    const res = await http().put('/v1/circles/presence').set(friend).send({ date: '2020-01-01' }).expect(400);
    expect(res.body.error.code).toBe('CIRCLE_DATE_OUT_OF_RANGE');
  });

  it('DELETE /v1/circles/presence/:date clears the mark', async () => {
    await http().delete(`/v1/circles/presence/${today()}`).set(friend).expect(204);
    const res = await http().get(`/v1/circles/${circleId}`).set(owner).expect(200);
    expect(res.body.data.members.every((m: { presentDays: string[] }) => m.presentDays.length === 0)).toBe(true);
  });

  it('suggested lines: once per line and target a day; a line to one member stays between the two', async () => {
    const detail = await http().get(`/v1/circles/${circleId}`).set(friend).expect(200);
    const ownerMember = detail.body.data.members.find((m: { isOwner: boolean }) => m.isOwner).memberId;
    await http().post(`/v1/circles/${circleId}/messages`).set(friend).send({ key: 'thabat', toMemberId: ownerMember }).expect(201);
    const again = await http().post(`/v1/circles/${circleId}/messages`).set(friend).send({ key: 'thabat', toMemberId: ownerMember }).expect(409);
    expect(again.body.error.code).toBe('CIRCLE_CHEER_ALREADY_SENT');
    await http().post(`/v1/circles/${circleId}/messages`).set(friend).send({ key: 'jazak', toMemberId: ownerMember }).expect(201);
    await http().post(`/v1/circles/${circleId}/messages`).set(friend).send({ key: 'free text' }).expect(400);
    // «شارك تقدّمي» goes to the whole صحبة with two counts only.
    const target = await http().post(`/v1/circles/${circleId}/messages`).set(friend).send({ key: 'progress', toMemberId: ownerMember, progress: { done: 1, total: 2 } });
    expect(target.status).toBe(400);
    await http().post(`/v1/circles/${circleId}/messages`).set(friend).send({ key: 'progress', progress: { done: 2, total: 3 } }).expect(201);
    const seen = await http().get(`/v1/circles/${circleId}/messages`).set(owner).expect(200);
    expect(seen.headers['cache-control']).toContain('no-store');
    expect(seen.body.data.items.map((m: { key: string }) => m.key)).toEqual(['progress', 'jazak', 'thabat']);
    expect(seen.body.data.items[0]).toMatchObject({ progress: { done: 2, total: 3 }, to: null, from: { name: 'سالم', isMe: false } });
    expect((await http().get(`/v1/circles/${circleId}`).set(friend).expect(200)).body.data.sentToday).toContain(`thabat:${ownerMember}`);
  });

  it('rounds: start, one at a time, «تم», the others congratulate; the label is cleaned', async () => {
    const started = await http()
      .post(`/v1/circles/${circleId}/rounds`)
      .set(owner)
      .send({ kind: 'study', label: '  compiler\u202Edesign  ', minutes: 60, today: today() })
      .expect(201);
    expect(started.body.data).toMatchObject({ kind: 'study', label: 'compiler design', minutes: 60, number: 1, outcome: null, closed: false });
    const roundId = started.body.data.id as string;
    const second = await http().post(`/v1/circles/${circleId}/rounds`).set(owner).send({ kind: 'focus', minutes: 25, today: today() }).expect(409);
    expect(second.body.error.code).toBe('CIRCLE_ROUND_OPEN');
    expect((await http().get(`/v1/circles/${circleId}`).set(owner).expect(200)).body.data.myOpenRound).toMatchObject({ id: roundId });
    await http().post(`/v1/circles/${circleId}/rounds/${roundId}/replies`).set(friend).send({ key: 'go' }).expect(201);
    await http().post(`/v1/circles/${circleId}/rounds/${roundId}/end`).set(friend).send({ outcome: 'done' }).expect(404);
    await http().post(`/v1/circles/${circleId}/rounds/${roundId}/end`).set(owner).send({ outcome: 'done' }).expect(200);
    await http().post(`/v1/circles/${circleId}/rounds/${roundId}/end`).set(owner).send({ outcome: 'done' }).expect(409);
    const wrong = await http().post(`/v1/circles/${circleId}/rounds/${roundId}/replies`).set(friend).send({ key: 'go' }).expect(400);
    expect(wrong.body.error.code).toBe('CIRCLE_REPLY_KIND');
    await http().post(`/v1/circles/${circleId}/rounds/${roundId}/replies`).set(friend).send({ key: 'mashallah' }).expect(201);
    const next = await http().post(`/v1/circles/${circleId}/rounds`).set(owner).send({ kind: 'study', minutes: 30, today: today() }).expect(201);
    expect(next.body.data.number).toBe(2);
    const feed = await http().get(`/v1/circles/${circleId}/messages?limit=4`).set(friend).expect(200);
    expect(feed.body.data.items.map((m: { kind: string }) => m.kind)).toEqual(['round_start', 'reply', 'round_end', 'reply']);
    expect(feed.body.data.nextBefore).toEqual(feed.body.data.items[3].id);
    const older = await http().get(`/v1/circles/${circleId}/messages?limit=50&before=${feed.body.data.nextBefore}`).set(friend).expect(200);
    expect(older.body.data.items[0].kind).toBe('round_start');
    expect(older.body.data.nextBefore).toBeNull();
  });

  it('keep a message, report it and hide its sender: only the reporter’s own feed changes', async () => {
    const feed = await http().get(`/v1/circles/${circleId}/messages`).set(owner).expect(200);
    const fromSalem = feed.body.data.items.find((m: { from: { name: string } }) => m.from.name === 'سالم');
    await http().put(`/v1/circles/${circleId}/messages/${fromSalem.id}/save`).set(owner).expect(200);
    const saved = await http().get(`/v1/circles/${circleId}/messages?saved=true`).set(owner).expect(200);
    expect(saved.body.data.items.map((m: { id: string }) => m.id)).toEqual([fromSalem.id]);

    const report = { kind: 'message', messageId: fromSalem.id, reason: 'offensive', note: 'ملاحظة' };
    expect((await http().post(`/v1/circles/${circleId}/reports`).set(owner).send(report).expect(200)).body.data).toEqual({ received: true, muted: false });
    await http().post(`/v1/circles/${circleId}/reports`).set(owner).send(report).expect(200);
    expect(await prisma.circleReport.count()).toBe(1);
    const after = await http().get(`/v1/circles/${circleId}/messages?limit=50`).set(owner).expect(200);
    expect(after.body.data.items.some((m: { id: string }) => m.id === fromSalem.id)).toBe(false);
    // Nothing changes for the others.
    const theirs = await http().get(`/v1/circles/${circleId}/messages?limit=50`).set(friend).expect(200);
    expect(theirs.body.data.items.some((m: { id: string }) => m.id === fromSalem.id)).toBe(true);

    const salemId = fromSalem.from.memberId as string;
    await http().post(`/v1/circles/${circleId}/reports`).set(owner).send({ kind: 'member', memberId: salemId, reason: 'harassment', mute: true }).expect(200);
    const muted = await http().get(`/v1/circles/${circleId}/messages?limit=50`).set(owner).expect(200);
    expect(muted.body.data.items.some((m: { from: { memberId: string } }) => m.from.memberId === salemId)).toBe(false);
    expect((await http().get(`/v1/circles/${circleId}`).set(owner).expect(200)).body.data.mutedMemberIds).toEqual([salemId]);
    await http().delete(`/v1/circles/${circleId}/mutes/${salemId}`).set(owner).expect(204);

    // The owner of Thekra reads them; a plain account cannot.
    await http().get('/v1/admin/circle-reports').set(owner).expect(403);
    const list = await http().get('/v1/admin/circle-reports').set(friend).expect(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[1]).toMatchObject({ kind: 'message', reason: 'offensive', note: 'ملاحظة', reported: { name: 'سالم', stillMember: true } });
    expect(list.body.data[1]).toMatchObject({ status: 'open', handledAt: null });
    expect(list.body.counts).toEqual({ open: 2, handled: 0 });

    // Marking handled: admin only, validated, one report at a time; nothing is removed.
    const target = list.body.data[1].id as string;
    await http().patch(`/v1/admin/circle-reports/${target}`).set(owner).send({ status: 'handled' }).expect(403);
    await http().patch(`/v1/admin/circle-reports/${target}`).set(friend).send({ status: 'removed' }).expect(400);
    await http().patch('/v1/admin/circle-reports/nope').set(friend).send({ status: 'handled' }).expect(400);
    await http().patch('/v1/admin/circle-reports/00000000-0000-4000-8000-0000000000ff').set(friend).send({ status: 'handled' }).expect(404);
    const done = await http().patch(`/v1/admin/circle-reports/${target}`).set(friend).send({ status: 'handled' }).expect(200);
    expect(done.body.data).toMatchObject({ id: target, status: 'handled', handledAt: expect.any(String) });
    const open = await http().get('/v1/admin/circle-reports').set(friend).expect(200);
    expect(open.body.data.map((r: { id: string }) => r.id)).not.toContain(target);
    expect(open.body.counts).toEqual({ open: 1, handled: 1 });
    const handled = await http().get('/v1/admin/circle-reports?status=handled').set(friend).expect(200);
    expect(handled.body.data).toHaveLength(1);
    expect(handled.body.data[0]).toMatchObject({ id: target, status: 'handled' });
    expect((await http().get('/v1/admin/circle-reports?status=all').set(friend).expect(200)).body.data).toHaveLength(2);
    await http().get('/v1/admin/circle-reports?status=zzz').set(friend).expect(400);
    await http().patch(`/v1/admin/circle-reports/${target}`).set(friend).send({ status: 'open' }).expect(200);
    expect(await prisma.circleReport.count()).toBe(2);
    expect(await prisma.circleMember.count({ where: { id: salemId } })).toBe(1);
  });

  it('an owner’s circle invite turns صحبة on and joins the circle; a member cannot invite to it', async () => {
    expect((await http().post('/v1/circles/invites').set(friend).send({ circleId }).expect(403)).body.error.code).toBe('CIRCLE_OWNER_ONLY');
    const created = await http().post('/v1/circles/invites').set(owner).send({ circleId }).expect(201);
    expect(created.body.data.circle).toEqual({ id: circleId, name: 'صحبة الفجر' });

    const guest = await register('e2e-circle-guest@thekra.test');
    // The account has a name («Test User»), so the invite joins in ONE step with it; the code works once.
    const joined = await http().post('/v1/circles/invites/redeem').set(guest).send({ code: created.body.data.code }).expect(200);
    expect(joined.body.data).toMatchObject({ enabled: true, circle: { id: circleId, memberCount: 3 } });
    expect(joined.body.data.circle.members.map((m: { displayName: string }) => m.displayName)).toContain('Test User');
    const json = JSON.stringify(joined.body);
    for (const secret of [TEST_USER_ID, TEST_ADMIN_ID, 'e2e-user@thekra.test', 'e2e-admin@thekra.test']) expect(json).not.toContain(secret);
    const again = await register('e2e-circle-second@thekra.test');
    expect((await http().post('/v1/circles/invites/redeem').set(again).send({ code: created.body.data.code }).expect(410)).body.error.code).toBe('CIRCLE_INVITE_USED');
    expect((await http().get('/v1/circles/access').set(again).expect(200)).body.data.enabled).toBe(false);

    // Expired: the same answer a week later, with its own code, and صحبة stays off.
    const old = await http().post('/v1/circles/invites').set(owner).send({ circleId }).expect(201);
    await prisma.circleInvite.update({ where: { id: old.body.data.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await http().post('/v1/circles/invites/redeem').set(again).send({ code: old.body.data.code }).expect(410)).body.error.code).toBe('CIRCLE_INVITE_EXPIRED');
    expect((await http().get('/v1/circles/access').set(again).expect(200)).body.data.enabled).toBe(false);

    const detail = await http().get(`/v1/circles/${circleId}`).set(guest).expect(200);
    await http().delete(`/v1/circles/${circleId}/membership`).set(guest).expect(204);
    expect(detail.body.data.members).toHaveLength(3);
  });

  it('owner-only actions answer 403 to a member', async () => {
    await http().delete(`/v1/circles/${circleId}`).set(friend).expect(403);
  });

  it('leave, then the owner deletes the circle and everything in it', async () => {
    await http().delete(`/v1/circles/${circleId}/membership`).set(friend).expect(204);
    expect((await http().get('/v1/circles').set(friend).expect(200)).body.data).toEqual([]);
    await http().delete(`/v1/circles/${circleId}`).set(owner).expect(204);
    expect((await http().get('/v1/circles').set(owner).expect(200)).body.data).toEqual([]);
    expect(await prisma.circleMessage.count()).toBe(0);
    expect(await prisma.circleRound.count()).toBe(0);
    expect(await prisma.circleMember.count()).toBe(0);
    // Reports stay for the owner of Thekra, unlinked from the deleted circle.
    expect(await prisma.circleReport.count({ where: { circleId: null } })).toBe(2);
  });

  it('deleting the account removes the memberships; a circle left empty is gone', async () => {
    const leaver = await register('e2e-circle-leaver@thekra.test');
    const invite = await http().post('/v1/circles/invites').set(friend).send({}).expect(201);
    await http().post('/v1/circles/invites/redeem').set(leaver).send({ code: invite.body.data.code }).expect(200);
    const created = await http().post('/v1/circles').set(leaver).send({ name: 'وحدي', displayName: 'م' }).expect(201);
    await http().patch(`/v1/circles/${created.body.data.id}/membership`).set(leaver).send({ sharesPresence: true }).expect(200);
    await http().put('/v1/circles/presence').set(leaver).send({ date: today() }).expect(200);

    await http().delete('/v1/auth/me').set(leaver).send({ password: TEST_PASSWORD }).expect(204);
    expect(await prisma.circleMember.count()).toBe(0);
    // The invite the leaver redeemed stays the inviter's (status only), without a pointer to the deleted account.
    const used = await prisma.circleInvite.findUnique({ where: { code: invite.body.data.code } });
    expect(used).toMatchObject({ inviterId: TEST_ADMIN_ID, redeemedById: null });
    expect(used?.redeemedAt).not.toBeNull();
    expect(await prisma.circlePresence.count()).toBe(0);

    // The empty circle is swept the next time anyone starts one.
    const next = await http().post('/v1/circles').set(friend).send({ name: 'جديدة', displayName: 'س' }).expect(201);
    expect(await prisma.circle.findMany({ select: { id: true } })).toEqual([{ id: next.body.data.id }]);
  });
});
