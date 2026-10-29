/**
 * E2E spec for the practice module: the public catalog, evidence, occasion calendar and ICS feed,
 * practice sync (/me/practice), the encrypted sin vault (/me/sin-vault), and account export / deletion
 * (/auth/me).
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { QF_MAWDU, QF_OCR, QF_OCR_VERIFIED, QF_UNGRADED, seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

const SEED_VERSE = '00000000-0000-4000-8000-000000000001'; // Al-Hujurat 49:12
const UNKNOWN = '00000000-0000-4000-8000-00000000dead';
const PLAN_ID = '11111111-1111-4111-8111-111111111111';
const PLAN2_ID = '11111111-1111-4111-8111-111111111112';
const REL_ID = '22222222-2222-4222-8222-222222222222';
const T = (minute: number) => `2026-10-28T10:${String(minute).padStart(2, '0')}:00.000Z`;
const PLAN = {
  id: PLAN_ID,
  habitKey: 'duha',
  deedSlug: 'nawafil',
  title: 'Duha',
  unit: 'times',
  amount: 1,
  ceiling: null,
  activeDaysPerWeek: 3,
  slots: ['09:30', '11:00'],
  anchors: null,
  rule: { kind: 'daily' },
  createdOn: '2026-10-28',
  amountChangedOn: '2026-10-28',
  ebbSince: null,
  season: null,
  clientUpdatedAt: T(0),
  deletedAt: null,
};
const RELATIVE = {
  id: REL_ID,
  name: 'خالتي',
  relation: 'خالة',
  rule: { kind: 'everyNWeeks', n: 1, weekday: 5, anchor: '2026-10-30' },
  lastContactedOn: null,
  clientUpdatedAt: T(0),
  deletedAt: null,
};
const b64 = (bytes: number) => Buffer.alloc(bytes, 9).toString('base64');
const VAULT = { ciphertext: b64(300), iv: b64(12), salt: b64(16), kdf: 'pbkdf2-sha256', iterations: 210000 };

describe('Practice, calendar and account endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ── Public catalog and evidence ────────────────────────────────────────────

  it('GET /v1/practice/catalog → 200 { data: { occasions, habits, sinPrograms, tazkiya } }, CDN-cached', async () => {
    const res = await request(server()).get('/v1/practice/catalog').expect(200);
    expect(Object.keys(res.body.data)).toEqual(['occasions', 'habits', 'sinPrograms', 'tazkiya']);
    expect(Object.keys(res.body.data.tazkiya)).toEqual(['review', 'niyyah', 'muhasaba', 'freshStarts', 'celebrations']);
    expect(Object.keys(res.body.data.sinPrograms)).toEqual(['review', 'common', 'programs']);
    expect(res.body.data.occasions.find((o: { key: string }) => o.key === 'arafah')).toMatchObject({
      deed: 'siyam',
      rule: { kind: 'hijriYearly', month: 12, day: 9 },
    });
    expect(res.headers['cache-control']).toBe('public, s-maxage=600, stale-while-revalidate=3600');
  });

  it('GET /v1/practice/evidence → only published texts, in the order asked', async () => {
    const ids = [QF_OCR_VERIFIED, UNKNOWN, QF_MAWDU, QF_UNGRADED, QF_OCR, SEED_VERSE].join(',');
    const res = await request(server()).get(`/v1/practice/evidence?ids=${ids}&lang=en`).expect(200);
    expect(res.body.data.map((q: { id: string }) => q.id)).toEqual([QF_OCR_VERIFIED, SEED_VERSE]);
    expect(res.body.data[1]).toMatchObject({ id: SEED_VERSE, type: 'QURAN_VERSE', textAr: expect.any(String) });
    expect(res.body.data[1]).not.toHaveProperty('rawPayload');
    expect(res.headers['cache-control']).toContain('public, s-maxage=120');
  });

  it('GET /v1/practice/evidence rejects no ids, a bad id and more than 50 ids', async () => {
    expect((await request(server()).get('/v1/practice/evidence').expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    await request(server()).get('/v1/practice/evidence?ids=not-a-uuid').expect(400);
    const many = Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`).join(',');
    await request(server()).get(`/v1/practice/evidence?ids=${many}`).expect(400);
  });

  // ── Occasion calendar ───────────────────────────────────────────────────────

  it('GET /v1/calendar/occasions → Arafah 1448 on 2027-05-15, sorted by date', async () => {
    const res = await request(server()).get('/v1/calendar/occasions?from=2027-05-10&to=2027-05-20').expect(200);
    const days: Array<{ key: string; date: string }> = res.body.data;
    expect(days.find((d) => d.key === 'arafah')).toEqual({
      key: 'arafah',
      date: '2027-05-15',
      titleAr: 'صيام يوم عرفة (9 ذو الحجة)',
      titleEn: 'Fasting the Day of Arafah (9 Dhu al-Hijja)',
      deed: 'siyam',
      basis: 'text',
      hijri: { year: 1448, month: 12, day: 9 },
    });
    expect(days.map((d) => d.date)).toEqual(days.map((d) => d.date).sort());
    expect(res.headers['cache-control']).toBe('public, s-maxage=300, stale-while-revalidate=60');
  });

  it('GET /v1/calendar/occasions applies hijriOffset and rejects bad input', async () => {
    const shifted = await request(server()).get('/v1/calendar/occasions?from=2027-05-10&to=2027-05-20&hijriOffset=-1').expect(200);
    expect(shifted.body.data.find((d: { key: string }) => d.key === 'arafah').date).toBe('2027-05-16');
    const tooLong = await request(server()).get('/v1/calendar/occasions?from=2027-01-01&to=2028-03-01').expect(400);
    expect(tooLong.body.error.code).toBe('DATE_RANGE_TOO_LONG');
    const reversed = await request(server()).get('/v1/calendar/occasions?from=2027-01-02&to=2027-01-01').expect(400);
    expect(reversed.body.error.code).toBe('DATE_RANGE_INVALID');
    await request(server()).get('/v1/calendar/occasions?hijriOffset=3').expect(400);
    await request(server()).get('/v1/calendar/occasions?from=2027-1-1').expect(400);
  });

  it('GET /v1/calendar/occasions accepts the ?lang= every client adds, and still rejects an unknown one', async () => {
    await request(server()).get('/v1/calendar/occasions?from=2027-05-10&to=2027-05-20&lang=ar').expect(200);
    await request(server()).get('/v1/calendar/occasions?lang=en').expect(200);
    await request(server()).get('/v1/calendar/occasions?lang=fr').expect(400);
  });

  it('GET /v1/calendar/occasions.ics → text/calendar, CRLF, cached, not wrapped in JSON (GET and HEAD)', async () => {
    const res = await request(server())
      .get('/v1/calendar/occasions.ics?lang=en&months=2')
      .buffer(true)
      .parse((response, done) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => done(null, text));
      })
      .expect(200);
    const body = res.body as string;
    expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('inline; filename="thekra-occasions-en.ics"');
    expect(res.headers['cache-control']).toBe('public, s-maxage=600, stale-while-revalidate=3600');
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(body.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(body).toContain('BEGIN:VEVENT\r\n');
    expect(body).toContain('X-WR-CALNAME:Thekra: sunnah occasions');
    expect(body).toMatch(/URL:https:\/\/thekra-web\.vercel\.app\/en\/good-deeds\//);
    await request(server()).head('/v1/calendar/occasions.ics').expect(200);
    const bad = await request(server()).get('/v1/calendar/occasions.ics?months=25').expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
  });

  // ── Topic details ───────────────────────────────────────────────────────────

  it('GET /v1/good-deeds/dhikr → schedule { habits, occasions } for that deed', async () => {
    const res = await request(server()).get('/v1/good-deeds/dhikr').expect(200);
    expect(res.body.data.slug).toBe('dhikr');
    expect(res.body.data.schedule.habits.map((h: { key: string }) => h.key)).toEqual(['adhkar-sabah-masa', 'tasbih-after-salah']);
    expect(res.body.data.schedule.occasions).toEqual([]);
  });

  it('GET /v1/sins/:slug → program { available, category } and nothing else about it', async () => {
    const ghibah = await request(server()).get('/v1/sins/ghibah').expect(200);
    expect(ghibah.body.data.program).toEqual({ available: true, category: 'haqq_ibad' });
    const namimah = await request(server()).get('/v1/sins/namimah').expect(200);
    expect(namimah.body.data.program).toEqual({ available: false, category: null });
  });

  // ── Account: practice sync, sin vault, export, delete ──────────────────────

  it('/me/practice, /me/sin-vault, /auth/me/export and DELETE /auth/me require a token', async () => {
    expect((await request(server()).get('/v1/me/practice').expect(401)).body.error.code).toBe('UNAUTHENTICATED');
    await request(server()).post('/v1/me/practice/sync').send({ since: null, changes: {} }).expect(401);
    await request(server()).get('/v1/me/sin-vault').expect(401);
    await request(server()).put('/v1/me/sin-vault').send({ ...VAULT, version: 0 }).expect(401);
    await request(server()).delete('/v1/me/sin-vault').expect(401);
    await request(server()).get('/v1/auth/me/export').expect(401);
    await request(server()).delete('/v1/auth/me').send({ password: 'x' }).expect(401);
  });

  async function register(): Promise<{ email: string; password: string; userId: string; auth: Record<string, string>; refreshToken: string }> {
    const email = `practice-${Date.now()}-${Math.random().toString(36).slice(2)}@thekra.test`;
    const password = 'password123456';
    const res = await request(server()).post('/v1/auth/register').send({ email, password }).expect(201);
    return {
      email,
      password,
      userId: res.body.data.user.id,
      auth: { Authorization: `Bearer ${res.body.data.accessToken}` },
      refreshToken: res.body.data.refreshToken,
    };
  }

  const sync = (auth: Record<string, string>, body: unknown) => request(server()).post('/v1/me/practice/sync').set(auth).send(body as object);

  it('stores the prayer anchors of a plan and returns them to every device', async () => {
    const { auth } = await register();
    const anchors = [{ slot: '09:30', prayer: 'fajr', offset: 10 }];
    const planWithAnchors = { ...PLAN, id: PLAN2_ID, anchors };
    const first = await sync(auth, { since: null, changes: { plans: [planWithAnchors] } }).expect(200);
    expect(first.body.data.plans).toEqual([planWithAnchors]);
    const view = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(view.body.data.plans).toEqual([planWithAnchors]);
    // Removing the anchors (a newer edit) clears the column.
    const cleared = { ...PLAN, id: PLAN2_ID, anchors: null, clientUpdatedAt: T(5) };
    await sync(auth, { since: null, changes: { plans: [cleared] } }).expect(200);
    const after = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(after.body.data.plans).toEqual([cleared]);
    await sync(auth, { since: null, changes: { plans: [{ ...PLAN, id: PLAN2_ID, anchors: [{ slot: '09:30', prayer: 'noon', offset: 1 }] }] } }).expect(400);
  });

  it('syncs settings, plans, logs, relatives and contacts with the merge rules', async () => {
    const { auth } = await register();
    const empty = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(empty.body.data).toMatchObject({ settings: null, plans: [], logs: [], relatives: [], contacts: [] });
    expect(empty.headers['cache-control']).toBe('private, no-store');

    const first = await sync(auth, {
      since: null,
      changes: {
        settings: { hijriOffset: 1, reminderTimes: ['07:00'], freeMinutesPerDay: 60, clientUpdatedAt: T(0) },
        plans: [PLAN],
        logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 2 }],
        relatives: [RELATIVE],
        contacts: [{ relativeId: REL_ID, date: '2026-10-20' }],
      },
    }).expect(200);
    expect(first.headers['cache-control']).toBe('private, no-store');
    const data = first.body.data;
    expect(data.serverTime).toEqual(expect.any(String));
    expect(data.settings).toMatchObject({ hijriOffset: 1, reminderTimes: ['07:00'], freeMinutesPerDay: 60, clientUpdatedAt: T(0) });
    expect(data.plans).toEqual([PLAN]);
    expect(data.logs).toEqual([{ planId: PLAN_ID, date: '2026-10-28', amount: 2 }]);
    expect(data.relatives).toEqual([RELATIVE]);
    expect(data.contacts).toEqual([{ relativeId: REL_ID, date: '2026-10-20', deleted: false }]);

    // Older writes lose (and come back with the winning copy); a smaller log never lowers the amount.
    const stale = await sync(auth, {
      since: data.serverTime,
      changes: {
        settings: { hijriOffset: 0, clientUpdatedAt: '2026-10-27T00:00:00.000Z' },
        plans: [{ ...PLAN, title: 'old', clientUpdatedAt: '2026-10-27T00:00:00.000Z' }],
        logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 1 }],
      },
    }).expect(200);
    expect(stale.body.data.settings.hijriOffset).toBe(1);
    expect(stale.body.data.plans).toEqual([PLAN]);
    expect(stale.body.data.logs).toEqual([{ planId: PLAN_ID, date: '2026-10-28', amount: 2 }]);

    // Newer writes win; a larger log raises it; a contact undo is a tombstone; a plan tombstone wins when newer.
    await sync(auth, {
      since: null,
      changes: {
        plans: [{ ...PLAN, title: 'Duha (2)', amount: 2, clientUpdatedAt: T(5) }, { ...PLAN, id: PLAN2_ID, clientUpdatedAt: T(5) }],
        logs: [{ planId: PLAN_ID, date: '2026-10-28', amount: 5 }],
        contacts: [{ relativeId: REL_ID, date: '2026-10-20', deleted: true }],
      },
    }).expect(200);
    await sync(auth, { since: null, changes: { plans: [{ id: PLAN2_ID, clientUpdatedAt: T(6), deletedAt: T(6) }] } }).expect(200);
    // A tombstone for a plan the server never saw is kept, so a stale device cannot bring it back.
    const unseen = '99999999-9999-4999-8999-999999999999';
    const tomb = await sync(auth, { since: null, changes: { plans: [{ id: unseen, clientUpdatedAt: T(7), deletedAt: T(7) }] } }).expect(200);
    expect(tomb.body.data.plans.find((p: { id: string }) => p.id === unseen)).toEqual({ id: unseen, clientUpdatedAt: T(7), deletedAt: T(7) });
    await sync(auth, { since: null, changes: { plans: [{ ...PLAN, id: unseen, clientUpdatedAt: T(2) }] } }).expect(200);
    const all = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    const plans = all.body.data.plans as Array<{ id: string; title: string; deletedAt: string | null }>;
    expect(plans.find((p) => p.id === PLAN_ID)).toMatchObject({ title: 'Duha (2)', amount: 2, deletedAt: null });
    expect(plans.find((p) => p.id === PLAN2_ID)).toEqual({ id: PLAN2_ID, clientUpdatedAt: T(6), deletedAt: T(6) });
    expect(all.body.data.logs).toEqual([{ planId: PLAN_ID, date: '2026-10-28', amount: 5 }]);
    expect(all.body.data.contacts).toEqual([{ relativeId: REL_ID, date: '2026-10-20', deleted: true }]);

    // A later non-deleted contact clears the tombstone; an older plan write cannot resurrect the tombstone.
    await sync(auth, {
      since: null,
      changes: {
        contacts: [{ relativeId: REL_ID, date: '2026-10-20' }],
        plans: [{ ...PLAN, id: PLAN2_ID, clientUpdatedAt: T(1) }],
      },
    }).expect(200);
    const after = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(after.body.data.contacts).toEqual([{ relativeId: REL_ID, date: '2026-10-20', deleted: false }]);
    expect(after.body.data.plans.find((p: { id: string }) => p.id === PLAN2_ID).deletedAt).toBe(T(6));
    expect(after.body.data.plans.find((p: { id: string }) => p.id === '99999999-9999-4999-8999-999999999999').deletedAt).toBe(T(7));

    // ?since returns only what changed after it.
    const later = await request(server()).get(`/v1/me/practice?since=${encodeURIComponent('2999-01-01T00:00:00.000Z')}`).set(auth).expect(200);
    expect(later.body.data).toMatchObject({ settings: null, plans: [], logs: [], relatives: [], contacts: [] });
    await request(server()).get('/v1/me/practice?since=yesterday').set(auth).expect(400);
  });

  it('orders equal times like practice-core, keeps fractional amounts and the logs of a deleted plan', async () => {
    const { auth } = await register();
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const plan = { ...PLAN, id, amount: 2.5, ceiling: 7.5, clientUpdatedAt: T(20) };
    await sync(auth, { since: null, changes: { plans: [{ ...plan, title: 'B' }], logs: [{ planId: id, date: '2026-10-28', amount: 1.5 }] } }).expect(200);
    // Equal time, smaller canonical JSON: loses; larger: wins.
    const smaller = await sync(auth, { since: null, changes: { plans: [{ ...plan, title: 'A' }] } }).expect(200);
    expect(smaller.body.data.plans.find((p: { id: string }) => p.id === id)).toMatchObject({ title: 'B', amount: 2.5, ceiling: 7.5 });
    await sync(auth, { since: null, changes: { plans: [{ ...plan, title: 'C' }] } }).expect(200);
    // Equal time: a tombstone beats the live record; the logs stay.
    await sync(auth, { since: null, changes: { plans: [{ id, clientUpdatedAt: T(20), deletedAt: T(20) }], logs: [{ planId: id, date: '2026-10-29', amount: 0.5 }] } }).expect(200);
    let view = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(view.body.data.plans).toEqual([{ id, clientUpdatedAt: T(20), deletedAt: T(20) }]);
    expect(view.body.data.logs).toEqual([
      { planId: id, date: '2026-10-28', amount: 1.5 },
      { planId: id, date: '2026-10-29', amount: 0.5 },
    ]);
    // A newer edit restores the plan, with its logs.
    await sync(auth, { since: null, changes: { plans: [{ ...plan, title: 'restored', clientUpdatedAt: T(21) }] } }).expect(200);
    view = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(view.body.data.plans).toEqual([{ ...plan, title: 'restored', clientUpdatedAt: T(21) }]);
    expect(view.body.data.logs).toHaveLength(2);
    // Settings: the client time is stored and echoed.
    const settings = await sync(auth, {
      since: null,
      changes: { settings: { hijriOffset: -1, reminderTimes: ['06:30'], freeMinutesPerDay: null, clientUpdatedAt: T(22) } },
    }).expect(200);
    expect(settings.body.data.settings).toMatchObject({ hijriOffset: -1, reminderTimes: ['06:30'], freeMinutesPerDay: null, clientUpdatedAt: T(22) });
  });

  it('rejects programs, invalid items, oversize requests, other users\' items and too many plans, applying nothing', async () => {
    // Ids are global: these differ from the other tests' items, which belong to other users.
    const planA = { ...PLAN, id: '77777777-7777-4777-8777-777777777777' };
    const relA = { ...RELATIVE, id: '88888888-8888-4888-8888-888888888888' };
    const owner = await register();
    const other = await register();
    await sync(owner.auth, { since: null, changes: { plans: [planA], relatives: [relA] } }).expect(200);

    const programs = await sync(other.auth, { since: null, changes: { plans: [], programs: [] } }).expect(400);
    expect(programs.body.error.code).toBe('PRACTICE_PROGRAMS_NOT_ALLOWED');
    const top = await sync(other.auth, { since: null, programs: [] }).expect(400);
    expect(top.body.error.code).toBe('PRACTICE_PROGRAMS_NOT_ALLOWED');

    const bad = await sync(other.auth, {
      since: null,
      changes: { relatives: [{ ...relA, id: '22222222-2222-4222-8222-222222222299', name: 'call 0791234567' }] },
    }).expect(400);
    expect(bad.body.error).toMatchObject({ code: 'PRACTICE_INVALID', details: { kind: 'relatives', index: 0 } });
    expect(JSON.stringify(bad.body)).not.toContain('0791234567');

    const tooMany = Array.from({ length: 501 }, () => ({ planId: planA.id, date: '2026-10-28', amount: 1 }));
    expect((await sync(other.auth, { since: null, changes: { logs: tooMany } }).expect(413)).body.error.code).toBe('PRACTICE_TOO_LARGE');

    // Another user's plan / relative: 404, and nothing in the request is applied.
    const mine = '33333333-3333-4333-8333-333333333333';
    for (const changes of [
      { plans: [{ ...PLAN, id: mine }], logs: [{ planId: planA.id, date: '2026-10-28', amount: 9 }] },
      { plans: [{ ...PLAN, id: mine }, { ...planA, title: 'hijack', clientUpdatedAt: T(30) }] },
      { plans: [{ ...PLAN, id: mine }], contacts: [{ relativeId: relA.id, date: '2026-10-21' }] },
    ]) {
      expect((await sync(other.auth, { since: null, changes }).expect(404)).body.error.code).toBe('RESOURCE_NOT_FOUND');
    }
    expect((await request(server()).get('/v1/me/practice').set(other.auth).expect(200)).body.data.plans).toEqual([]);
    const ownerView = await request(server()).get('/v1/me/practice').set(owner.auth).expect(200);
    expect(ownerView.body.data.plans).toEqual([planA]);
    expect(ownerView.body.data.logs).toEqual([]);
    expect(ownerView.body.data.contacts).toEqual([]);

    // 51 live plans → 422, nothing applied.
    const plans = Array.from({ length: 51 }, (_, i) => ({ ...PLAN, id: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}` }));
    expect((await sync(other.auth, { since: null, changes: { plans } }).expect(422)).body.error.code).toBe('PRACTICE_LIMIT_REACHED');
    expect((await request(server()).get('/v1/me/practice').set(other.auth).expect(200)).body.data.plans).toEqual([]);
    await sync(other.auth, { since: null, changes: { plans: plans.slice(0, 50) } }).expect(200);
  });

  it('stores the sin vault opaquely with an optimistic version', async () => {
    const { auth } = await register();
    const none = await request(server()).get('/v1/me/sin-vault').set(auth).expect(200);
    expect(none.body).toEqual({ data: { vault: null } });
    expect(none.headers['cache-control']).toBe('private, no-store');

    expect((await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, version: 0 }).expect(200)).body).toEqual({
      data: { version: 1 },
    });
    const stale = await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, version: 0 }).expect(409);
    expect(stale.body.error).toMatchObject({ code: 'SIN_VAULT_CONFLICT', details: { vault: { ...VAULT, version: 1 } } });
    await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, ciphertext: b64(400), version: 1 }).expect(200);
    const read = await request(server()).get('/v1/me/sin-vault').set(auth).expect(200);
    expect(read.body.data.vault).toMatchObject({ ...VAULT, ciphertext: b64(400), version: 2, updatedAt: expect.any(String) });

    const invalid = await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, iv: b64(16), version: 2 }).expect(400);
    expect(invalid.body.error.code).toBe('SIN_VAULT_INVALID');
    await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, kdf: 'sha1', version: 2 }).expect(400);
    await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, iterations: 1000, version: 2 }).expect(400);
    await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, version: 2, programs: [] }).expect(400);
    const big = await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, ciphertext: b64(128 * 1024 + 3), version: 2 }).expect(413);
    expect(big.body.error.code).toBe('SIN_VAULT_TOO_LARGE');

    await request(server()).delete('/v1/me/sin-vault').set(auth).expect(204);
    expect((await request(server()).get('/v1/me/sin-vault').set(auth).expect(200)).body.data.vault).toBeNull();
  });

  it('export carries practice data and the vault ciphertext; DELETE /auth/me cascades all of it', async () => {
    const { email, password, userId, auth, refreshToken } = await register();
    await sync(auth, {
      since: null,
      changes: {
        settings: { hijriOffset: 0, reminderTimes: [], clientUpdatedAt: T(0) },
        plans: [{ ...PLAN, id: '55555555-5555-4555-8555-555555555555' }],
        logs: [{ planId: '55555555-5555-4555-8555-555555555555', date: '2026-10-28', amount: 1 }],
        relatives: [{ ...RELATIVE, id: '66666666-6666-4666-8666-666666666666' }],
        contacts: [{ relativeId: '66666666-6666-4666-8666-666666666666', date: '2026-10-20' }],
      },
    }).expect(200);
    await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, version: 0 }).expect(200);
    await request(server()).post('/v1/favorites').set(auth).send({ quoteId: SEED_VERSE }).expect(201);

    const exported = await request(server()).get('/v1/auth/me/export').set(auth).expect(200);
    expect(exported.body.data).toMatchObject({
      exportedAt: expect.any(String),
      user: { id: userId, email, displayName: null, createdAt: expect.any(String) },
      favorites: [{ quoteId: SEED_VERSE, createdAt: expect.any(String) }],
      practice: {
        settings: { hijriOffset: 0, reminderTimes: [] },
        plans: [{ id: '55555555-5555-4555-8555-555555555555', title: 'Duha' }],
        logs: [{ planId: '55555555-5555-4555-8555-555555555555', date: '2026-10-28', amount: 1 }],
        relatives: [{ id: '66666666-6666-4666-8666-666666666666', name: 'خالتي' }],
        contacts: [{ relativeId: '66666666-6666-4666-8666-666666666666', date: '2026-10-20', deleted: false }],
      },
      sinVault: { ...VAULT, version: 1 },
    });
    expect(JSON.stringify(exported.body)).not.toMatch(/passwordHash|argon2/);
    expect(exported.headers['cache-control']).toBe('private, no-store');
    expect(exported.headers['content-disposition']).toBe('attachment; filename="thekra-export.json"');

    const wrong = await request(server()).delete('/v1/auth/me').set(auth).send({ password: 'not-my-password' }).expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    await request(server()).delete('/v1/auth/me').set(auth).send({}).expect(400);
    const deleted = await request(server()).delete('/v1/auth/me').set(auth).send({ password }).expect(204);
    expect(deleted.text).toBe('');

    const where = { userId };
    expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
    expect(await prisma.favorite.count({ where })).toBe(0);
    expect(await prisma.practiceSettings.count({ where })).toBe(0);
    expect(await prisma.habitPlan.count({ where })).toBe(0);
    expect(await prisma.habitLog.count({ where: { planId: '55555555-5555-4555-8555-555555555555' } })).toBe(0);
    expect(await prisma.relative.count({ where })).toBe(0);
    expect(await prisma.relativeContact.count({ where: { relativeId: '66666666-6666-4666-8666-666666666666' } })).toBe(0);
    expect(await prisma.sinVault.count({ where })).toBe(0);

    // The access token is stateless and still verifies, but the account is gone.
    expect((await request(server()).get('/v1/me/practice').set(auth).expect(404)).body.error.code).toBe('RESOURCE_NOT_FOUND');
    await sync(auth, { since: null, changes: { plans: [PLAN] } }).expect(404);
    await request(server()).get('/v1/me/sin-vault').set(auth).expect(404);
    await request(server()).put('/v1/me/sin-vault').set(auth).send({ ...VAULT, version: 0 }).expect(404);
    await request(server()).get('/v1/auth/me/export').set(auth).expect(404);
    await request(server()).delete('/v1/auth/me').set(auth).send({ password }).expect(401);
    await request(server()).post('/v1/auth/login').send({ email, password }).expect(401);
    await request(server()).post('/v1/auth/refresh').send({ refreshToken }).expect(401);
  });
});
