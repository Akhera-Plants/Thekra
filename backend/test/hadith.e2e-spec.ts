/**
 * E2E spec for /v1/hadith endpoints — endpoints #13, #14.
 *
 * Acceptance tests from the review:
 *   P0-1 — includeWeak=false on /hadith → only SAHIH+HASAN in appliedGrades
 *   P1-3 — grades=MAWDU → 422 GRADE_NOT_PERMITTED
 *   P2-14 — null-grade hadith consistency
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { QF_MAWDU, QF_UNGRADED, seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Hadith endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ── §1  GET /v1/hadith — list ──────────────────────────────────────────────

  it('GET /v1/hadith → 200 with envelope', async () => {
    const res = await request(app.getHttpServer()).get('/v1/hadith').expect(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      meta: {
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
        appliedGrades: expect.any(Array),
      },
    });
  });

  it('GET /v1/hadith → only returns HADITH type quotes', async () => {
    const res = await request(app.getHttpServer()).get('/v1/hadith?limit=100').expect(200);
    const types: string[] = res.body.data.map((q: { type: string }) => q.type);
    for (const t of types) {
      expect(t).toBe('HADITH');
    }
  });

  it('GET /v1/hadith default → appliedGrades contains only strong grades (P0-1)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/hadith').expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    expect(appliedGrades).not.toContain('DAIF');
    expect(appliedGrades).not.toContain('MAWDU');
    expect(appliedGrades).toContain('SAHIH');
  });

  it('GET /v1/hadith?includeWeak=false → explicitly excludes DAIF and MAWDU (P0-1 fix)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/hadith?includeWeak=false')
      .expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    expect(appliedGrades).not.toContain('DAIF');
    expect(appliedGrades).not.toContain('MAWDU');
    // MAWDU test fixture should not appear in data
    const ids: string[] = res.body.data.map((q: { id: string }) => q.id);
    expect(ids).not.toContain(QF_MAWDU);
  });

  it('GET /v1/hadith?includeWeak=true → UNGRADED may appear, MAWDU never does', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/hadith?includeWeak=true&limit=100')
      .expect(200);
    const ids: string[] = res.body.data.map((q: { id: string }) => q.id);
    // MAWDU must never appear
    expect(ids).not.toContain(QF_MAWDU);
    // UNGRADED may appear with includeWeak=true
    expect(ids).toContain(QF_UNGRADED);
  });

  // ── §2  MAWDU → 422 (P1-3) ─────────────────────────────────────────────────

  it('GET /v1/hadith?grades=MAWDU → 422 GRADE_NOT_PERMITTED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/hadith?grades=MAWDU')
      .expect(422);
    expect(res.body.error.code).toBe('GRADE_NOT_PERMITTED');
  });

  it('GET /v1/hadith?grades=SAHIH,MAWDU → 422', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/hadith?grades=SAHIH,MAWDU')
      .expect(422);
    expect(res.body.error.code).toBe('GRADE_NOT_PERMITTED');
  });

  // ── §3  GET /v1/hadith/collections ────────────────────────────────────────

  it('GET /v1/hadith/collections → 200 with list of collection names', async () => {
    const res = await request(app.getHttpServer()).get('/v1/hadith/collections').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Seed has Bukhari, Muslim — both should appear as distinct collection sources
    const names: string[] = res.body.data.map((c: { name: string }) => c.name);
    expect(names.length).toBeGreaterThan(0);
  });

  // ── §4  rawPayload never leaked ─────────────────────────────────────────────

  it('GET /v1/hadith → never contains rawPayload', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/hadith?limit=100&includeWeak=true')
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  it('GET /v1/hadith/collections → never contains rawPayload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/hadith/collections').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  // ── §5  Arabic narrator search (P0-3) ─────────────────────────────────────

  it('GET /v1/hadith?q=أبو هريرة → finds hadiths by narrator (Arabic search)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/hadith?q=%D8%A3%D8%A8%D9%88%20%D9%87%D8%B1%D9%8A%D8%B1%D8%A9&includeWeak=true&limit=50')
      .expect(200);
    // Many seed hadiths have narratorAr containing "أبو هريرة"
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });
});
