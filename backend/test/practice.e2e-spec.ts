/**
 * E2E spec for the practice module: the public catalog, evidence, occasion calendar and ICS feed,
 * the synced practice store (/me/practice), and account export / deletion (/auth/me).
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
const PLAN = {
  id: 'plan-1',
  deedSlug: 'dhikr',
  title: 'Morning dhikr',
  unit: 'minutes',
  amount: 5,
  activeDaysPerWeek: 3,
  slots: ['07:00'],
  createdOn: '2026-10-01',
  amountChangedOn: '2026-10-01',
  log: { '2026-10-02': 5 },
};
const STORE = { v: 1, plans: [PLAN], relatives: [], settings: { hijriOffset: 0 } };

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

  it('GET /v1/practice/catalog → 200 { data: { occasions, habits, sinPrograms } }, CDN-cached', async () => {
    const res = await request(server()).get('/v1/practice/catalog').expect(200);
    expect(Object.keys(res.body.data)).toEqual(['occasions', 'habits', 'sinPrograms']);
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

  // ── Account: sync, export, delete ───────────────────────────────────────────

  it('/me/practice, /auth/me/export and DELETE /auth/me require a token', async () => {
    expect((await request(server()).get('/v1/me/practice').expect(401)).body.error.code).toBe('UNAUTHENTICATED');
    await request(server()).put('/v1/me/practice').send({ store: STORE, version: 0 }).expect(401);
    await request(server()).get('/v1/auth/me/export').expect(401);
    await request(server()).delete('/v1/auth/me').send({ password: 'x' }).expect(401);
  });

  it('register → PUT practice → GET → conflict → export → DELETE me → 401/404 after', async () => {
    const email = `practice-${Date.now()}@thekra.test`;
    const password = 'password123456';
    const registered = await request(server()).post('/v1/auth/register').send({ email, password }).expect(201);
    const userId: string = registered.body.data.user.id;
    const auth = { Authorization: `Bearer ${registered.body.data.accessToken}` };

    const empty = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(empty.body).toEqual({ data: { store: null, version: 0 } });
    expect(empty.headers['cache-control']).toBe('private, no-store');

    const programs = await request(server())
      .put('/v1/me/practice')
      .set(auth)
      .send({ store: { ...STORE, programs: [] }, version: 0 })
      .expect(400);
    expect(programs.body.error.code).toBe('PRACTICE_PROGRAMS_NOT_ALLOWED');
    const nested = await request(server())
      .put('/v1/me/practice')
      .set(auth)
      .send({ store: { ...STORE, settings: { hijriOffset: 0, programs: 1 } }, version: 0 })
      .expect(400);
    expect(nested.body.error.code).toBe('PRACTICE_PROGRAMS_NOT_ALLOWED');

    const saved = await request(server())
      .put('/v1/me/practice')
      .set(auth)
      .send({ store: { ...STORE, junk: 'dropped' }, version: 0 })
      .expect(200);
    expect(saved.body).toEqual({ data: { version: 1 } });
    expect(saved.headers['cache-control']).toBe('private, no-store');

    const read = await request(server()).get('/v1/me/practice').set(auth).expect(200);
    expect(read.body.data).toEqual({ store: STORE, version: 1 });

    const stale = await request(server()).put('/v1/me/practice').set(auth).send({ store: STORE, version: 0 }).expect(409);
    expect(stale.body.error.code).toBe('PRACTICE_VERSION_CONFLICT');
    expect(stale.body.error.details).toEqual({ store: STORE, version: 1 });

    // A ~200 kB store passes the JSON body limit; over 256 kB is refused by the service, far over by the parser.
    const padded = (bytes: number) => ({ ...STORE, settings: { hijriOffset: 0, pad: 'x'.repeat(bytes) } });
    const big = await request(server()).put('/v1/me/practice').set(auth).send({ store: padded(200_000), version: 1 }).expect(200);
    expect(big.body.data.version).toBe(2);
    const tooBig = await request(server()).put('/v1/me/practice').set(auth).send({ store: padded(270_000), version: 2 }).expect(413);
    expect(tooBig.body.error.code).toBe('PRACTICE_STORE_TOO_LARGE');
    const huge = await request(server()).put('/v1/me/practice').set(auth).send({ store: padded(400_000), version: 2 }).expect(413);
    expect(huge.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    await request(server()).put('/v1/me/practice').set(auth).send({ store: STORE, version: '2' }).expect(400);

    await request(server()).post('/v1/favorites').set(auth).send({ quoteId: SEED_VERSE }).expect(201);
    const exported = await request(server()).get('/v1/auth/me/export').set(auth).expect(200);
    expect(exported.body.data).toMatchObject({
      exportedAt: expect.any(String),
      user: { id: userId, email, displayName: null, createdAt: expect.any(String) },
      favorites: [{ quoteId: SEED_VERSE, createdAt: expect.any(String) }],
      practice: STORE,
    });
    expect(JSON.stringify(exported.body)).not.toMatch(/passwordHash|argon2/);
    expect(exported.headers['cache-control']).toBe('private, no-store');
    expect(exported.headers['content-disposition']).toBe('attachment; filename="thekra-export.json"');

    const wrong = await request(server()).delete('/v1/auth/me').set(auth).send({ password: 'not-my-password' }).expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    await request(server()).delete('/v1/auth/me').set(auth).send({}).expect(400);
    const deleted = await request(server()).delete('/v1/auth/me').set(auth).send({ password }).expect(204);
    expect(deleted.text).toBe('');

    expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
    expect(await prisma.userPracticeStore.count({ where: { userId } })).toBe(0);
    expect(await prisma.favorite.count({ where: { userId } })).toBe(0);

    // The access token is stateless and still verifies, but the account is gone.
    expect((await request(server()).get('/v1/me/practice').set(auth).expect(404)).body.error.code).toBe('RESOURCE_NOT_FOUND');
    await request(server()).put('/v1/me/practice').set(auth).send({ store: STORE, version: 0 }).expect(404);
    await request(server()).get('/v1/auth/me/export').set(auth).expect(404);
    await request(server()).delete('/v1/auth/me').set(auth).send({ password }).expect(401);
    await request(server()).post('/v1/auth/login').send({ email, password }).expect(401);
    await request(server()).post('/v1/auth/refresh').send({ refreshToken: registered.body.data.refreshToken }).expect(401);
  });
});
