/**
 * E2E spec for /v1/tags endpoints — endpoints #15, #16.
 *
 * Acceptance tests from the review:
 *   P0-3 — Arabic search: q=الحسد returns "envy" tag
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

// Tag IDs from seed (seed.ts)
const TAG_ENVY_SLUG = 'envy'; // nameAr: 'الحسد'

describe('Tags endpoints (e2e)', () => {
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

  // ── §1  GET /v1/tags — list ────────────────────────────────────────────────

  it('GET /v1/tags → 200 with envelope', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tags').expect(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      meta: {
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      },
    });
    // Seed has 12 tags
    expect(res.body.meta.total).toBeGreaterThanOrEqual(12);
  });

  it('GET /v1/tags → each item has required fields', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tags?limit=5').expect(200);
    for (const tag of res.body.data) {
      expect(tag).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        category: expect.any(String),
      });
    }
  });

  it('GET /v1/tags?category=EMOTION → only EMOTION tags returned', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tags?category=EMOTION').expect(200);
    const tags: Array<{ category: string }> = res.body.data;
    for (const tag of tags) {
      expect(tag.category).toBe('EMOTION');
    }
    // Seed has 4 EMOTION tags
    expect(tags.length).toBeGreaterThanOrEqual(4);
  });

  // ── §2  Arabic search (P0-3) ────────────────────────────────────────────────

  it('GET /v1/tags?q=الحسد → returns envy tag (P0-3)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/tags?q=%D8%A7%D9%84%D8%AD%D8%B3%D8%AF')
      .expect(200);
    const slugs: string[] = res.body.data.map((t: { slug: string }) => t.slug);
    expect(slugs).toContain(TAG_ENVY_SLUG);
  });

  it('GET /v1/tags?q=Anger → finds anger tag (Latin search)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/tags?q=Anger')
      .expect(200);
    const slugs: string[] = res.body.data.map((t: { slug: string }) => t.slug);
    expect(slugs).toContain('anger');
  });

  // ── §3  GET /v1/tags/:slug — detail ────────────────────────────────────────

  it('GET /v1/tags/envy → 200 with tag detail', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tags/envy').expect(200);
    expect(res.body.data).toMatchObject({
      name: 'Envy',
      nameAr: 'الحسد',
      slug: 'envy',
      category: 'EMOTION',
    });
  });

  it('GET /v1/tags/backbiting → 200 (has linked quotes)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tags/backbiting').expect(200);
    expect(res.body.data).toMatchObject({
      slug: 'backbiting',
    });
  });

  it('GET /v1/tags/does-not-exist → 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/tags/does-not-exist')
      .expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  // ── §4  rawPayload never leaked ─────────────────────────────────────────────

  it('GET /v1/tags response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tags').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  it('GET /v1/tags/:slug response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/tags/envy').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });
});
