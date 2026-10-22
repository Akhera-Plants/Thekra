/**
 * E2E spec for admin classification endpoints (sin-quotes + good-deed-quotes).
 * Acceptance tests for D-2, P1-7 (updated for Phase 4 JWT auth).
 *
 * Checks:
 *   Guard  — JwtAuthGuard + RolesGuard (replaces D-1 AdminApiKeyGuard):
 *              no token → 401, USER role → 403, ADMIN role → 200
 *   D-2    — sort=newest accepted (restored after adding createdAt column)
 *   P1-7   — Bulk link: first call creates, second call updates; unknown quoteId → failed entry
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures, TEST_PASSWORD } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminAuthHeaders, authHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Admin Classification endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminHdrs: Record<string, string>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    adminHdrs = await adminAuthHeaders(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ── §0  Guard: JWT replaces AdminApiKeyGuard ──────────────────────────────

  it('GET /v1/admin/sin-quotes without token → 401 UNAUTHENTICATED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /v1/admin/good-deed-quotes without token → 401 UNAUTHENTICATED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/good-deed-quotes')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /v1/admin/sin-quotes with USER token → 403 FORBIDDEN', async () => {
    const userHdrs = await authHeaders(app, 'e2e-user@thekra.test', TEST_PASSWORD);
    const res = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes')
      .set(userHdrs)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // ── §1  D-2: sort=newest restored after adding createdAt ───────────────────

  it('GET /v1/admin/sin-quotes?sort=newest → 200 (D-2: newest restored)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?sort=newest')
      .set(adminHdrs)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v1/admin/good-deed-quotes?sort=newest → 200 (D-2: newest restored)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/good-deed-quotes?sort=newest')
      .set(adminHdrs)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v1/admin/sin-quotes?sort=score → 200 (still valid)', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?sort=score')
      .set(adminHdrs)
      .expect(200);
  });

  it('GET /v1/admin/sin-quotes?sort=invalid → 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?sort=invalid')
      .set(adminHdrs)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('D-2: sort=newest returns links in createdAt DESC order', async () => {
    const SIN_GHIBAH = 'a0000000-0000-4000-8000-000000000001';
    const Q01 = '00000000-0000-4000-8000-000000000001';
    const Q02 = '00000000-0000-4000-8000-000000000002';

    await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes')
      .set(adminHdrs)
      .send({ sinId: SIN_GHIBAH, quoteId: Q01, relevanceScore: 1 });
    await new Promise((r) => setTimeout(r, 20));
    await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes')
      .set(adminHdrs)
      .send({ sinId: SIN_GHIBAH, quoteId: Q02, relevanceScore: 1 });

    const res = await request(app.getHttpServer())
      .get(`/v1/admin/sin-quotes?sort=newest&sinId=${SIN_GHIBAH}&limit=2`)
      .set(adminHdrs)
      .expect(200);

    const items: Array<{ quoteId: string; createdAt: string }> = res.body.data;
    if (items.length >= 2) {
      const t0 = new Date(items[0]!.createdAt).getTime();
      const t1 = new Date(items[1]!.createdAt).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);
    }
  });

  // ── §2  Bulk link happy-path (P1-7) ────────────────────────────────────────

  it('POST /v1/admin/sin-quotes/bulk: first call creates, second call updates', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?limit=5')
      .set(adminHdrs)
      .expect(200);

    const links: Array<{ id: string; sinId: string; quoteId: string }> = listRes.body.data;
    if (links.length === 0) return;

    const sinId: string = links[0]!.sinId;
    const quoteIds: string[] = links.slice(0, 2).map((l) => l.quoteId);

    for (const l of links.slice(0, 2)) {
      await request(app.getHttpServer())
        .delete(`/v1/admin/sin-quotes/${l.id}`)
        .set(adminHdrs)
        .expect(204);
    }

    const createRes = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes/bulk')
      .set(adminHdrs)
      .send({ sinId, links: quoteIds.map((quoteId) => ({ quoteId, relevanceScore: 50 })) })
      .expect(200);

    expect(createRes.body.data.created).toBe(quoteIds.length);
    expect(createRes.body.data.updated).toBe(0);
    expect(createRes.body.data.failed).toHaveLength(0);

    const updateRes = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes/bulk')
      .set(adminHdrs)
      .send({ sinId, links: quoteIds.map((quoteId) => ({ quoteId, relevanceScore: 60 })) })
      .expect(200);

    expect(updateRes.body.data.updated).toBe(quoteIds.length);
    expect(updateRes.body.data.created).toBe(0);
    expect(updateRes.body.data.failed).toHaveLength(0);
  });

  it('POST /v1/admin/sin-quotes/bulk: unknown quoteId → failed entry, not a crash', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?limit=1')
      .set(adminHdrs)
      .expect(200);

    if (listRes.body.data.length === 0) return;

    const sinId: string = listRes.body.data[0]!.sinId;
    const GHOST_ID = '00000000-0000-4000-8000-000000000099';

    const res = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes/bulk')
      .set(adminHdrs)
      .send({ sinId, links: [{ quoteId: GHOST_ID, relevanceScore: 50 }] })
      .expect(200);

    expect(res.body.data.created).toBe(0);
    expect(res.body.data.failed).toHaveLength(1);
    expect(res.body.data.failed[0].reason).toBe('RELATED_RESOURCE_INVALID');
  });
});
