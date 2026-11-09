/**
 * E2E spec for the public «أبلغ عن خطأ» endpoint (POST /v1/quotes/:id/reports) and its abuse limits (round 6,
 * C-01s): body size, dedupe, per-reporter limits, the global daily cap, and that no address is stored.
 * Throttling (@Throttle 5/min) is skipped under NODE_ENV=test; throttle.e2e-spec.ts covers it.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { QuoteReportsService, REPORT_LIMITS } from '../src/modules/quotes/quote-reports.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures, TEST_USER_ID } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminAuthHeaders, closeTestApp, createTestApp, userAuthHeaders } from './helpers/test-app.js';

/** Seed hadith (prisma/seed.ts): Q10 Bukhari 6018, Q11 envy warning, Q01 a verse. */
const Q10 = '00000000-0000-4000-8000-000000000010';
const Q11 = '00000000-0000-4000-8000-000000000011';
const Q01 = '00000000-0000-4000-8000-000000000001';

describe('Quote reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let reports: QuoteReportsService;
  const http = () => request(app.getHttpServer());
  const url = (id: string) => `/v1/quotes/${id}/reports`;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    reports = app.get(QuoteReportsService);
    await truncateAll(prisma);
    await seedTestFixtures();
  });

  beforeEach(async () => {
    await prisma.quoteReport.deleteMany();
    await prisma.quoteFlag.deleteMany({ where: { type: 'USER_REPORT' } });
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('201 { accepted: true }; one row, no address in the row or the flag', async () => {
    const res = await http().post(url(Q10)).set('X-Forwarded-For', '203.0.113.7').send({ reason: 'TEXT', note: '  لفظة ‮ناقصة ' }).expect(201);
    expect(res.body.data).toEqual({ accepted: true });
    const rows = await prisma.quoteReport.findMany({ where: { quoteId: Q10 } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: 'TEXT', note: 'لفظة ناقصة' });
    expect(rows[0]!.reporterKey).toMatch(/^a:[0-9a-f]{32}$/);
    const flag = await prisma.quoteFlag.findFirst({ where: { quoteId: Q10, type: 'USER_REPORT' } });
    expect(flag).toMatchObject({ severity: 'MEDIUM', status: 'OPEN', details: { total: 1, reporters: 1 } });
    const stored = JSON.stringify([rows, flag]);
    expect(stored).not.toMatch(/[0-9]{1,3}(\.[0-9]{1,3}){3}|::1|::ffff/);
  });

  it('the same reporter, text and reason again is accepted and not stored twice; another reason is', async () => {
    for (let i = 0; i < 3; i++) await http().post(url(Q10)).send({ reason: 'TEXT' }).expect(201);
    await http().post(url(Q10)).send({ reason: 'GRADE' }).expect(201);
    expect(await prisma.quoteReport.count({ where: { quoteId: Q10 } })).toBe(2);
    const flag = await prisma.quoteFlag.findFirst({ where: { quoteId: Q10, type: 'USER_REPORT' } });
    expect(flag?.severity).toBe('MEDIUM');
  });

  it('413 PAYLOAD_TOO_LARGE for a body over 2 KB; 400 for a note over 400 characters or an unknown field', async () => {
    const big = await http().post(url(Q10)).send({ reason: 'TEXT', note: 'ا'.repeat(1200) }).expect(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    await http().post(url(Q10)).send({ reason: 'TEXT', note: 'x'.repeat(401) }).expect(400);
    await http().post(url(Q10)).send({ reason: 'TEXT', extra: true }).expect(400);
    await http().post(url(Q10)).send({ reason: 'NOPE' }).expect(400);
    expect(await prisma.quoteReport.count()).toBe(0);
  });

  it('404 for a verse or an unknown text', async () => {
    await http().post(url(Q01)).send({ reason: 'TEXT' }).expect(404);
    await http().post(url('00000000-0000-4000-8000-0000000000aa')).send({ reason: 'TEXT' }).expect(404);
  });

  it(`a signed-in reporter is limited per account: 429 REPORT_RATE_LIMITED after ${REPORT_LIMITS.perReporterHour} in an hour`, async () => {
    const key = reports.reporterKey({ userId: TEST_USER_ID }, new Date());
    await prisma.quoteReport.createMany({
      data: Array.from({ length: REPORT_LIMITS.perReporterHour }, () => ({ quoteId: Q11, reason: 'OTHER', reporterKey: key })),
    });
    const user = await userAuthHeaders(app);
    const res = await http().post(url(Q10)).set(user).send({ reason: 'TEXT' }).expect(429);
    expect(res.body.error.code).toBe('REPORT_RATE_LIMITED');
    // Anonymous reports from the same address are a different reporter.
    await http().post(url(Q10)).send({ reason: 'TEXT' }).expect(201);
  });

  it(`429 REPORTS_PAUSED once ${REPORT_LIMITS.globalDaily} reports arrived today; nothing more is stored`, async () => {
    await prisma.quoteReport.createMany({
      data: Array.from({ length: REPORT_LIMITS.globalDaily }, (_, i) => ({ quoteId: Q11, reason: 'OTHER', reporterKey: `a:seed${i}` })),
    });
    const res = await http().post(url(Q10)).send({ reason: 'TEXT' }).expect(429);
    expect(res.body.error).toMatchObject({ code: 'REPORTS_PAUSED' });
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(await prisma.quoteReport.count()).toBe(REPORT_LIMITS.globalDaily);
  });

  it('three distinct reporters turn the flag HIGH and the text is hidden until reviewed; a repeat does not count', async () => {
    await http().post(url(Q11)).send({ reason: 'TEXT' }).expect(201);
    // Without TRUST_PROXY a forwarded address is ignored: this is the same anonymous reporter (and deduped).
    await http().post(url(Q11)).set('X-Forwarded-For', '198.51.100.1').send({ reason: 'TEXT' }).expect(201);
    await http().post(url(Q11)).send({ reason: 'ISNAD' }).expect(201);
    const user = await userAuthHeaders(app);
    const admin = await adminAuthHeaders(app);
    await http().post(url(Q11)).set(user).send({ reason: 'TEXT' }).expect(201);
    expect((await prisma.quoteFlag.findFirst({ where: { quoteId: Q11, type: 'USER_REPORT' } }))?.severity).toBe('MEDIUM');
    await http().get(`/v1/quotes/${Q11}`).expect(200);
    await http().post(url(Q11)).set(admin).send({ reason: 'TEXT' }).expect(201);
    const flag = await prisma.quoteFlag.findFirst({ where: { quoteId: Q11, type: 'USER_REPORT' } });
    expect(flag).toMatchObject({ severity: 'HIGH', details: { total: 4, reporters: 3 } });
    await http().get(`/v1/quotes/${Q11}`).expect(404);
  });
});
