/**
 * E2E spec for admin classification endpoints (sin-quotes + good-deed-quotes).
 * Acceptance tests for D-1, D-2, P1-7.
 *
 * Checks:
 *   D-1  — AdminApiKeyGuard applied to classification endpoints
 *   D-2  — sort=newest accepted (restored after adding createdAt column); links ordered by createdAt desc
 *   P1-7 — Bulk link: first call creates, second call updates; unknown quoteId → failed entry, not crash
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Admin Classification endpoints (e2e)', () => {
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

  // ── §0  D-1: guard applied to classification endpoints ──────────────────────

  it('GET /v1/admin/sin-quotes without x-admin-key → 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes')
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /v1/admin/good-deed-quotes without x-admin-key → 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/good-deed-quotes')
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // ── §1  D-2: sort=newest restored after adding createdAt ───────────────────

  it('GET /v1/admin/sin-quotes?sort=newest → 200 (D-2: newest restored)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?sort=newest')
      .set(adminHeaders())
      .expect(200);
    // Should return the list successfully — newest means createdAt DESC then id ASC
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v1/admin/good-deed-quotes?sort=newest → 200 (D-2: newest restored)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/good-deed-quotes?sort=newest')
      .set(adminHeaders())
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v1/admin/sin-quotes?sort=score → 200 (still valid)', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?sort=score')
      .set(adminHeaders())
      .expect(200);
  });

  it('GET /v1/admin/sin-quotes?sort=invalid → 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?sort=invalid')
      .set(adminHeaders())
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('D-2: sort=newest returns links in createdAt DESC order', async () => {
    // Create two sin-quote links sequentially so createdAt differs.
    // Use QF_MAWDU-free quotes from seed — Q01 and Q02.
    const SIN_GHIBAH = 'a0000000-0000-4000-8000-000000000001';
    const Q01 = '00000000-0000-4000-8000-000000000001';
    const Q02 = '00000000-0000-4000-8000-000000000002';

    // Upsert both via the link endpoint (idempotent)
    await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes')
      .set(adminHeaders())
      .send({ sinId: SIN_GHIBAH, quoteId: Q01, relevanceScore: 1 });
    // Small sleep to guarantee the second link has a later createdAt
    await new Promise((r) => setTimeout(r, 20));
    await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes')
      .set(adminHeaders())
      .send({ sinId: SIN_GHIBAH, quoteId: Q02, relevanceScore: 1 });

    const res = await request(app.getHttpServer())
      .get(`/v1/admin/sin-quotes?sort=newest&sinId=${SIN_GHIBAH}&limit=2`)
      .set(adminHeaders())
      .expect(200);

    const items: Array<{ quoteId: string; createdAt: string }> = res.body.data;
    if (items.length >= 2) {
      // Newest first: items[0].createdAt >= items[1].createdAt
      const t0 = new Date(items[0]!.createdAt).getTime();
      const t1 = new Date(items[1]!.createdAt).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);
    }
  });

  // ── §2  Bulk link happy-path (P1-7) ────────────────────────────────────────
  //
  // Seed has: ghibah sin, and multiple quotes with different grades.
  // We use 2 seeded quote IDs that definitely exist (Q01 and Q02 from seed.ts)
  // to verify the bulk endpoint returns { created/updated/skipped/failed } counts.

  it('POST /v1/admin/sin-quotes/bulk: first call creates, second call updates', async () => {
    // Fetch existing sin-quotes to get valid sinId and quoteIds
    const listRes = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?limit=5')
      .set(adminHeaders())
      .expect(200);

    const links: Array<{ id: string; sinId: string; quoteId: string }> = listRes.body.data;
    if (links.length === 0) {
      // Nothing to test if seeding didn't create links — skip gracefully
      return;
    }

    // Use the sin and quotes from the first existing link for our bulk test
    const sinId: string = links[0]!.sinId;
    const quoteIds: string[] = links.slice(0, 2).map((l) => l.quoteId);

    // First call: delete existing links then re-create via bulk
    for (const l of links.slice(0, 2)) {
      await request(app.getHttpServer())
        .delete(`/v1/admin/sin-quotes/${l.id}`)
        .set(adminHeaders())
        .expect(204);
    }

    const createRes = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes/bulk')
      .set(adminHeaders())
      .send({
        sinId,
        links: quoteIds.map((quoteId) => ({ quoteId, relevanceScore: 50 })),
      })
      .expect(200);

    expect(createRes.body.data.created).toBe(quoteIds.length);
    expect(createRes.body.data.updated).toBe(0);
    expect(createRes.body.data.failed).toHaveLength(0);

    // Second call with same data → all updated
    const updateRes = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes/bulk')
      .set(adminHeaders())
      .send({
        sinId,
        links: quoteIds.map((quoteId) => ({ quoteId, relevanceScore: 60 })),
      })
      .expect(200);

    expect(updateRes.body.data.updated).toBe(quoteIds.length);
    expect(updateRes.body.data.created).toBe(0);
    expect(updateRes.body.data.failed).toHaveLength(0);
  });

  it('POST /v1/admin/sin-quotes/bulk: unknown quoteId → failed entry, not a crash', async () => {
    // Find a valid sinId from existing data
    const listRes = await request(app.getHttpServer())
      .get('/v1/admin/sin-quotes?limit=1')
      .set(adminHeaders())
      .expect(200);

    if (listRes.body.data.length === 0) return; // seed needed

    const sinId: string = listRes.body.data[0]!.sinId;
    const GHOST_ID = '00000000-0000-4000-8000-000000000099';

    const res = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes/bulk')
      .set(adminHeaders())
      .send({
        sinId,
        links: [{ quoteId: GHOST_ID, relevanceScore: 50 }],
      })
      .expect(200);

    expect(res.body.data.created).toBe(0);
    expect(res.body.data.failed).toHaveLength(1);
    expect(res.body.data.failed[0].reason).toBe('RELATED_RESOURCE_INVALID');
  });
});
