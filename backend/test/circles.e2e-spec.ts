/**
 * E2E spec for رفقة (/v1/circles): auth, the envelope and status codes, who sees the invite code, that no user
 * id or email leaves the API, presence marks, cheers, and the owner-only actions.
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
  let inviteCode: string;

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

  it('POST /v1/circles → 201 with Location, the owner sees the invite code', async () => {
    const res = await http()
      .post('/v1/circles')
      .set(owner)
      .send({ name: '  رفقة الفجر ', intention: 'نتعاون على الثبات', displayName: 'أبو عمر' })
      .expect(201);
    circleId = res.body.data.id;
    inviteCode = res.body.data.inviteCode;
    expect(res.headers['location']).toBe(`/v1/circles/${circleId}`);
    expect(res.body.data).toMatchObject({ name: 'رفقة الفجر', memberCount: 1, me: { isOwner: true, sharesPresence: false } });
    expect(inviteCode).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
  });

  it('400 for a name over 40 characters or a direction override', async () => {
    await http().post('/v1/circles').set(owner).send({ name: 'ا'.repeat(41), displayName: 'x' }).expect(400);
    await http().post('/v1/circles').set(owner).send({ name: 'abc‮def', displayName: 'x' }).expect(400);
  });

  it('a non-member gets 404 for the circle', async () => {
    const res = await http().get(`/v1/circles/${circleId}`).set(friend).expect(404);
    expect(res.body.error.code).toBe('CIRCLE_NOT_FOUND');
  });

  it('POST /v1/circles/join with a typed code → the member never sees the code, ids or emails', async () => {
    const typed = `${inviteCode.slice(0, 5).toLowerCase()}-${inviteCode.slice(5)}`;
    const res = await http().post('/v1/circles/join').set(friend).send({ code: typed, displayName: 'سالم' }).expect(200);
    expect(res.body.data).toMatchObject({ id: circleId, memberCount: 2, inviteCode: null, me: { isOwner: false } });
    const json = JSON.stringify(res.body);
    for (const secret of [TEST_USER_ID, TEST_ADMIN_ID, 'e2e-user@thekra.test', 'e2e-admin@thekra.test']) {
      expect(json).not.toContain(secret);
    }
  });

  it('404 CIRCLE_INVITE_INVALID for a wrong code', async () => {
    const res = await http().post('/v1/circles/join').set(friend).send({ code: 'ZZZZZZZZZZ', displayName: 'x' }).expect(404);
    expect(res.body.error.code).toBe('CIRCLE_INVITE_INVALID');
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

  it('cheers: one per target per day, the receiver sees it', async () => {
    const detail = await http().get(`/v1/circles/${circleId}`).set(friend).expect(200);
    const ownerMember = detail.body.data.members.find((m: { isOwner: boolean }) => m.isOwner).memberId;
    await http().post(`/v1/circles/${circleId}/cheers`).set(friend).send({ message: 'thabat', toMemberId: ownerMember }).expect(201);
    const again = await http()
      .post(`/v1/circles/${circleId}/cheers`)
      .set(friend)
      .send({ message: 'jazak', toMemberId: ownerMember })
      .expect(409);
    expect(again.body.error.code).toBe('CIRCLE_CHEER_ALREADY_SENT');
    await http().post(`/v1/circles/${circleId}/cheers`).set(friend).send({ message: 'free text' }).expect(400);
    const seen = await http().get(`/v1/circles/${circleId}`).set(owner).expect(200);
    expect(seen.body.data.cheers).toEqual([expect.objectContaining({ message: 'thabat', fromName: 'سالم', toMe: true })]);
  });

  it('owner-only actions answer 403 to a member; rotating invalidates the old code', async () => {
    expect((await http().post(`/v1/circles/${circleId}/invite-code`).set(friend).expect(403)).body.error.code).toBe('CIRCLE_OWNER_ONLY');
    await http().delete(`/v1/circles/${circleId}`).set(friend).expect(403);
    const rotated = await http().post(`/v1/circles/${circleId}/invite-code`).set(owner).expect(200);
    expect(rotated.body.data.inviteCode).not.toBe(inviteCode);
    await http().post('/v1/circles/join').set(friend).send({ code: inviteCode, displayName: 'x' }).expect(404);
  });

  it('leave, then the owner deletes the circle and everything in it', async () => {
    await http().delete(`/v1/circles/${circleId}/membership`).set(friend).expect(204);
    expect((await http().get('/v1/circles').set(friend).expect(200)).body.data).toEqual([]);
    await http().delete(`/v1/circles/${circleId}`).set(owner).expect(204);
    expect((await http().get('/v1/circles').set(owner).expect(200)).body.data).toEqual([]);
    expect(await prisma.circleCheer.count()).toBe(0);
    expect(await prisma.circleMember.count()).toBe(0);
  });

  it('deleting the account removes the memberships; a circle left empty is gone, its code no longer works', async () => {
    const email = 'e2e-circle-leaver@thekra.test';
    await http().post('/v1/auth/register').send({ email, password: TEST_PASSWORD }).expect(201);
    const leaver = await authHeaders(app, email, TEST_PASSWORD);
    const created = await http().post('/v1/circles').set(leaver).send({ name: 'وحدي', displayName: 'م' }).expect(201);
    await http().patch(`/v1/circles/${created.body.data.id}/membership`).set(leaver).send({ sharesPresence: true }).expect(200);
    await http().put('/v1/circles/presence').set(leaver).send({ date: today() }).expect(200);

    await http().delete('/v1/auth/me').set(leaver).send({ password: TEST_PASSWORD }).expect(204);
    expect(await prisma.circleMember.count()).toBe(0);
    expect(await prisma.circlePresence.count()).toBe(0);

    await http().post('/v1/circles/join').set(friend).send({ code: created.body.data.inviteCode, displayName: 'x' }).expect(404);
    expect(await prisma.circle.count()).toBe(0);
  });
});
