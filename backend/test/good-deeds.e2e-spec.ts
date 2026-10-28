/**
 * E2E spec for /v1/good-deeds endpoints — endpoints #5, #6, #7.
 *
 * Mirrors the sins spec: list, detail, quotes with grade policy.
 *
 * Acceptance tests from the review:
 *   P0-1 — includeWeak=false → only SAHIH + HASAN
 *   P0-3 — Arabic search
 *   P1-2 — shuffle determinism
 *   P1-3 — grades=MAWDU → 422
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Good-deeds endpoints (e2e)', () => {
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

  // ── §1  GET /v1/good-deeds — list ─────────────────────────────────────────

  it('GET /v1/good-deeds → 200 with envelope and pagination', async () => {
    const res = await request(app.getHttpServer()).get('/v1/good-deeds?includeEmpty=true').expect(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      meta: {
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      },
    });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(8);
    const published = await request(app.getHttpServer()).get('/v1/good-deeds').expect(200);
    expect(published.body.meta.total).toBeLessThanOrEqual(res.body.meta.total);
  });

  it('GET /v1/good-deeds → each item has required fields', async () => {
    const res = await request(app.getHttpServer()).get('/v1/good-deeds?limit=5').expect(200);
    const deeds: unknown[] = res.body.data;
    expect(deeds.length).toBeGreaterThan(0);
    for (const deed of deeds) {
      expect(deed).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        nameAr: expect.any(String),
        slug: expect.any(String),
      });
    }
  });

  // ── §2  Arabic search (P0-3) ────────────────────────────────────────────────

  it('GET /v1/good-deeds?q=حفظ → finds hifz-al-lisan', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds?q=%D8%AD%D9%81%D8%B8')
      .expect(200);
    const slugs: string[] = res.body.data.map((d: { slug: string }) => d.slug);
    expect(slugs).toContain('hifz-al-lisan');
  });

  it('GET /v1/good-deeds?q=Charity → finds sadaqah (Latin search)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds?q=Charity')
      .expect(200);
    const slugs: string[] = res.body.data.map((d: { slug: string }) => d.slug);
    expect(slugs).toContain('sadaqah');
  });

  // ── §3  GET /v1/good-deeds/:slug — detail ──────────────────────────────────

  it('GET /v1/good-deeds/hifz-al-lisan → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan')
      .expect(200);
    expect(res.body.data).toMatchObject({
      name: 'Guarding the Tongue',
      nameAr: 'حفظ اللسان',
      slug: 'hifz-al-lisan',
      // deed-schedules.yaml has no habit or occasion for this deed.
      schedule: { habits: [], occasions: [] },
    });
  });

  it('GET /v1/good-deeds/does-not-exist → 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/does-not-exist')
      .expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  // ── §4  GET /v1/good-deeds/:slug/quotes — grade policy ────────────────────

  it('GET /v1/good-deeds/hifz-al-lisan/quotes → 200 with items', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes')
      .expect(200);
    expect(res.body).toMatchObject({
      data: { items: expect.any(Array) },
      meta: expect.objectContaining({ appliedGrades: expect.any(Array) }),
    });
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes default → no DAIF/MAWDU/UNGRADED in appliedGrades (P0-1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes')
      .expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    expect(appliedGrades).not.toContain('DAIF');
    expect(appliedGrades).not.toContain('MAWDU');
    expect(appliedGrades).not.toContain('UNGRADED');
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?includeWeak=false → same as default (P0-1 fix)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?includeWeak=false')
      .expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    expect(appliedGrades).not.toContain('DAIF');
    expect(appliedGrades).not.toContain('MAWDU');
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?includeWeak=true → DAIF may appear, never MAWDU', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?includeWeak=true')
      .expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    expect(appliedGrades).not.toContain('MAWDU');
    // DAIF/UNGRADED can appear when includeWeak=true
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes → ayah, then Sahihayn, then other texts', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?limit=50')
      .expect(200);
    const items = res.body.data.items as Array<{ link: { band?: string; relevanceScore: number | null } }>;
    const rank = (band: string | undefined) => (band === 'ayah' ? 0 : band === 'sahihayn' ? 1 : 2);
    const bands = items.map((item) => rank(item.link.band));
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i]).toBeGreaterThanOrEqual(bands[i - 1] ?? 0);
    }
  });

  // ── §5  MAWDU → 422 (P1-3) ─────────────────────────────────────────────────

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?grades=MAWDU → 422 GRADE_NOT_PERMITTED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?grades=MAWDU')
      .expect(422);
    expect(res.body.error.code).toBe('GRADE_NOT_PERMITTED');
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?grades=SAHIH,MAWDU → 422', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?grades=SAHIH,MAWDU')
      .expect(422);
    expect(res.body.error.code).toBe('GRADE_NOT_PERMITTED');
  });

  // ── §6  Shuffle determinism (P1-2) ─────────────────────────────────────────

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?shuffle=true same seed → identical order', async () => {
    const url = '/v1/good-deeds/hifz-al-lisan/quotes?shuffle=true&seed=test-seed-beta&limit=50';
    const res1 = await request(app.getHttpServer()).get(url).expect(200);
    const res2 = await request(app.getHttpServer()).get(url).expect(200);
    const ids1 = res1.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);
    const ids2 = res2.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);
    expect(ids1).toEqual(ids2);
  });

  // ── §7  rawPayload never leaked ─────────────────────────────────────────────

  it('GET /v1/good-deeds response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/good-deeds').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?limit=50')
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  // ── §8  kind filter + countsByKind ─────────────────────────────────────────

  it('GET /v1/good-deeds/hifz-al-lisan/quotes → meta.countsByKind present', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?limit=50')
      .expect(200);
    const ck = res.body.meta.countsByKind as { all: number; verse: number; hadith: number; athar: number };
    expect(typeof ck.all).toBe('number');
    expect(typeof ck.verse).toBe('number');
    expect(typeof ck.hadith).toBe('number');
    expect(typeof ck.athar).toBe('number');
    expect(ck.all).toBe(ck.verse + ck.hadith + ck.athar);
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?kind=verse → only QURAN_VERSE items', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?kind=verse&limit=50')
      .expect(200);
    const items: Array<{ quote: { type: string } }> = res.body.data.items;
    for (const item of items) {
      expect(item.quote.type).toBe('QURAN_VERSE');
    }
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?kind=invalid → 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/good-deeds/hifz-al-lisan/quotes?kind=invalid')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
