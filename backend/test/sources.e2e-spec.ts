/**
 * E2E spec for /v1/sources endpoints — endpoints #17, #18.
 *
 * Acceptance tests from the review:
 *   P0-1 — isExternalApi=false returns only non-external sources (was inverted)
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

// From seed — fixed IDs (see prisma/seed.ts)
const SRC_BUKHARI = '10000000-0000-4000-8000-000000000002';
const SRC_QURAN_COM = '10000000-0000-4000-8000-000000000005'; // isExternalApi: true

describe('Sources endpoints (e2e)', () => {
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

  // ── §1  GET /v1/sources — list ────────────────────────────────────────────

  it('GET /v1/sources → 200 with envelope', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sources').expect(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      meta: {
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      },
    });
    // Seed has 5 sources
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
  });

  it('GET /v1/sources → each item has required fields', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sources?limit=5').expect(200);
    for (const src of res.body.data) {
      expect(src).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String),
        isExternalApi: expect.any(Boolean),
      });
    }
  });

  it('GET /v1/sources?isExternalApi=false → only non-external sources (P0-1 fix)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sources?isExternalApi=false')
      .expect(200);
    const sources: Array<{ isExternalApi: boolean }> = res.body.data;
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(src.isExternalApi).toBe(false);
    }
    // The external source (Quran.com) should NOT appear
    const ids: string[] = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(SRC_QURAN_COM);
  });

  it('GET /v1/sources?isExternalApi=true → only external sources (P0-1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sources?isExternalApi=true')
      .expect(200);
    const sources: Array<{ isExternalApi: boolean }> = res.body.data;
    for (const src of sources) {
      expect(src.isExternalApi).toBe(true);
    }
    // Quran.com is the only external API source in seed
    const ids: string[] = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(SRC_QURAN_COM);
  });

  it('GET /v1/sources?type=HADITH_COLLECTION → filters correctly', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sources?type=HADITH_COLLECTION')
      .expect(200);
    const sources: Array<{ type: string }> = res.body.data;
    for (const src of sources) {
      expect(src.type).toBe('HADITH_COLLECTION');
    }
  });

  // ── §2  GET /v1/sources/:id — detail ──────────────────────────────────────

  it('GET /v1/sources/:id → 200 for Bukhari source', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/sources/${SRC_BUKHARI}`)
      .expect(200);
    expect(res.body.data).toMatchObject({
      id: SRC_BUKHARI,
      name: 'Sahih al-Bukhari',
      isExternalApi: false,
    });
  });

  it('GET /v1/sources/00000000-0000-4000-8000-000000000099 → 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sources/00000000-0000-4000-8000-000000000099')
      .expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET /v1/sources/:bad-id → 400 (invalid UUID)', async () => {
    await request(app.getHttpServer()).get('/v1/sources/not-a-uuid').expect(400);
  });

  // ── §3  rawPayload never leaked ─────────────────────────────────────────────

  it('GET /v1/sources response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sources').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  it('GET /v1/sources/:id response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/sources/${SRC_BUKHARI}`)
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });
});
