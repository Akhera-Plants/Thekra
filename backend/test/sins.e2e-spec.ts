/**
 * E2E spec for /v1/sins endpoints — endpoints #1, #2, #3, #4.
 *
 * Acceptance tests from the review:
 *   P0-1 — includeWeak=false → appliedGrades == ["SAHIH","HASAN"]
 *   P0-3 — Arabic search: q=الغيبة AND q=الغيبه both find ghibah
 *   P1-2 — shuffle same seed → deterministic order; seeds differ → different order
 *   P1-3 — grades=MAWDU → 422 GRADE_NOT_PERMITTED
 *   P1-8 — sin detail returns all 4 opposite good deeds (not capped at 3)
 *          relevanceScore ordering desc (nulls last)
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { QF_MAWDU, QF_UNGRADED, SIN_TEST_MANY, seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

function assertReadingBands(items: Array<{ link: { band?: string; relevanceScore: number | null } }>) {
  const rank = (band: string | undefined) => (band === 'ayah' ? 0 : band === 'sahihayn' ? 1 : 2);
  const bands = items.map((item) => rank(item.link.band));
  for (let i = 1; i < bands.length; i += 1) {
    expect(bands[i]).toBeGreaterThanOrEqual(bands[i - 1] ?? 0);
  }
  let previous: number | null = null;
  let previousBand = -1;
  let seenNull = false;
  for (const item of items) {
    const band = rank(item.link.band);
    const score = item.link.relevanceScore;
    if (band !== previousBand) {
      previous = null;
      previousBand = band;
      seenNull = false;
    }
    if (score == null) {
      seenNull = true;
      continue;
    }
    if (seenNull) throw new Error('Non-null relevanceScore after null');
    if (previous != null) expect(score).toBeLessThanOrEqual(previous);
    previous = score;
  }
}

describe('Sins endpoints (e2e)', () => {
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

  // ── §1  GET /v1/sins — list ─────────────────────────────────────────────────

  it('GET /v1/sins → 200 with envelope and pagination meta', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins?includeEmpty=true').expect(200);

    expect(res.body).toMatchObject({
      data: expect.any(Array),
      meta: {
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      },
    });
    expect(Array.isArray(res.body.data)).toBe(true);
    // At minimum the 8 dev-seed sins + test sin. The default list hides a sin with no public text.
    expect(res.body.meta.total).toBeGreaterThanOrEqual(8);
    const published = await request(app.getHttpServer()).get('/v1/sins').expect(200);
    expect(published.body.meta.total).toBeLessThanOrEqual(res.body.meta.total);
  });

  it('GET /v1/sins → each item has required fields', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins?limit=5').expect(200);
    const sins: unknown[] = res.body.data;
    expect(sins.length).toBeGreaterThan(0);
    for (const sin of sins) {
      expect(sin).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        nameAr: expect.any(String),
        slug: expect.any(String),
      });
    }
  });

  it('GET /v1/sins?category=speech → filters by category', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins?category=speech').expect(200);
    const sins: Array<{ category: string }> = res.body.data;
    for (const sin of sins) {
      expect(sin.category).toBe('speech');
    }
    // ghibah and namimah are in "speech"
    expect(sins.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /v1/sins omits the editorial severity score', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins?limit=5').expect(200);
    for (const sin of res.body.data as Array<Record<string, unknown>>) {
      expect(sin).not.toHaveProperty('severity');
    }
  });

  it('GET /v1/sins?sort=severity → 400 (public sort has no severity)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins?sort=severity&limit=50').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  // ── §2  Arabic search (P0-3) ────────────────────────────────────────────────

  it('GET /v1/sins?q=الغيبة → finds ghibah (exact Arabic match)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins?q=%D8%A7%D9%84%D8%BA%D9%8A%D8%A8%D8%A9')
      .expect(200);
    const slugs: string[] = res.body.data.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain('ghibah');
  });

  it('GET /v1/sins?q=الغيبه → finds ghibah (normalised Arabic match — ta-marbuta folded)', async () => {
    // "الغيبه" is the normalised form (ة → ه); stored is "الغيبة"
    // The arabic-search normalisation should match both
    const res = await request(app.getHttpServer())
      .get('/v1/sins?q=%D8%A7%D9%84%D8%BA%D9%8A%D8%A8%D9%87')
      .expect(200);
    const slugs: string[] = res.body.data.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain('ghibah');
  });

  it('GET /v1/sins?q=Backbiting → finds ghibah (Latin search)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins?q=Backbiting')
      .expect(200);
    const slugs: string[] = res.body.data.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain('ghibah');
  });

  // ── §3  GET /v1/sins/:slug — detail ────────────────────────────────────────

  it('GET /v1/sins/ghibah → 200 with full sin detail', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah').expect(200);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      name: 'Backbiting',
      nameAr: 'الغيبة',
      slug: 'ghibah',
      // sin-programs.yaml: only availability and category are exposed here.
      program: { available: true, category: 'haqq_ibad' },
    });
  });

  it('GET /v1/sins/does-not-exist → 404', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET /v1/sins/test-sin-many-opposites → detail returns all 4 opposite good deeds (P1-8)', async () => {
    // SIN_TEST_MANY has 4 opposite good deeds seeded by seedTestFixtures
    const res = await request(app.getHttpServer())
      .get('/v1/sins/test-sin-many-opposites')
      .expect(200);

    const relatedGoodDeeds: unknown[] = res.body.data.relatedGoodDeeds;
    expect(Array.isArray(relatedGoodDeeds)).toBe(true);
    // Must return all 4, not capped at 3 (P1-8 fix)
    expect(relatedGoodDeeds.length).toBe(4);
  });

  // ── §4  GET /v1/sins/:slug/quotes — grade policy & ordering ────────────────

  it('GET /v1/sins/ghibah/quotes → 200 with items and meta', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes').expect(200);
    expect(res.body).toMatchObject({
      data: {
        items: expect.any(Array),
      },
      meta: expect.objectContaining({
        total: expect.any(Number),
        appliedGrades: expect.any(Array),
      }),
    });
  });

  it('GET /v1/sins/ghibah/quotes default → only SAHIH and HASAN in appliedGrades (P0-1)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes').expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    // Default: no weak → only SAHIH + HASAN allowed
    expect(appliedGrades).not.toContain('DAIF');
    expect(appliedGrades).not.toContain('MAWDU');
    expect(appliedGrades).not.toContain('UNGRADED');
    expect(appliedGrades).toContain('SAHIH');
  });

  it('GET /v1/sins/ghibah/quotes?includeWeak=false → same as default (P0-1 fix)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?includeWeak=false')
      .expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    expect(appliedGrades).not.toContain('DAIF');
    expect(appliedGrades).not.toContain('MAWDU');
    expect(appliedGrades).not.toContain('UNGRADED');
  });

  it('GET /v1/sins/ghibah/quotes?includeWeak=false → MAWDU and UNGRADED test quotes not in response', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?includeWeak=false&limit=50')
      .expect(200);
    const quoteIds: string[] = res.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);
    expect(quoteIds).not.toContain(QF_MAWDU);
    expect(quoteIds).not.toContain(QF_UNGRADED);
  });

  it('GET /v1/sins/ghibah/quotes?includeWeak=true → DAIF and UNGRADED appear, still no MAWDU', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?includeWeak=true&limit=50')
      .expect(200);
    const appliedGrades: string[] = res.body.meta.appliedGrades;
    expect(appliedGrades).not.toContain('MAWDU');
    const quoteIds: string[] = res.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);
    // UNGRADED test quote linked to ghibah (score=90) should appear
    expect(quoteIds).toContain(QF_UNGRADED);
    // MAWDU test quote must still be excluded
    expect(quoteIds).not.toContain(QF_MAWDU);
  });

  it('GET /v1/sins/ghibah/quotes → ayah, then Sahihayn, then other texts; score desc inside a band', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?limit=50')
      .expect(200);
    assertReadingBands(res.body.data.items);
  });

  // ── §5  MAWDU → 422 (P1-3) ─────────────────────────────────────────────────

  it('GET /v1/sins/ghibah/quotes?grades=MAWDU → 422 GRADE_NOT_PERMITTED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?grades=MAWDU')
      .expect(422);
    expect(res.body.error.code).toBe('GRADE_NOT_PERMITTED');
  });

  it('GET /v1/sins/ghibah/quotes?grades=SAHIH,MAWDU → 422 GRADE_NOT_PERMITTED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?grades=SAHIH,MAWDU')
      .expect(422);
    expect(res.body.error.code).toBe('GRADE_NOT_PERMITTED');
  });

  // ── §6  Shuffle determinism (P1-2) ─────────────────────────────────────────

  it('GET /v1/sins/ghibah/quotes?shuffle=true&seed=X → same seed → identical order', async () => {
    const url = '/v1/sins/ghibah/quotes?shuffle=true&seed=test-seed-alpha&limit=50';
    const res1 = await request(app.getHttpServer()).get(url).expect(200);
    const res2 = await request(app.getHttpServer()).get(url).expect(200);

    const ids1: string[] = res1.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);
    const ids2: string[] = res2.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);
    expect(ids1).toEqual(ids2);
  });

  it('GET /v1/sins/ghibah/quotes?shuffle=true → different seeds → different order (with ≥4 items ≥70)', async () => {
    const url1 = '/v1/sins/ghibah/quotes?shuffle=true&seed=seed-aaa&limit=50';
    const url2 = '/v1/sins/ghibah/quotes?shuffle=true&seed=seed-zzz&limit=50';
    const res1 = await request(app.getHttpServer()).get(url1).expect(200);
    const res2 = await request(app.getHttpServer()).get(url2).expect(200);

    const ids1: string[] = res1.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);
    const ids2: string[] = res2.body.data.items.map((i: { quote: { id: string } }) => i.quote.id);

    // Both calls should return items; if there are ≥ 4 items ≥ 70 in score band they should differ
    // (extremely unlikely to be identical with two different seeds)
    if (ids1.length >= 4 && ids2.length >= 4) {
      expect(ids1).not.toEqual(ids2);
    }
  });

  it('GET /v1/sins/ghibah/quotes?shuffle=false → the reading order, not a shuffle', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?shuffle=false&limit=50')
      .expect(200);
    assertReadingBands(res.body.data.items);
  });

  // ── §7  GET /v1/sins/:slug/good-deeds ──────────────────────────────────────

  it('GET /v1/sins/ghibah/good-deeds → 200 with list', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/good-deeds')
      .expect(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v1/sins/test-sin-many-opposites/good-deeds → returns all 4 opposite deeds', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/test-sin-many-opposites/good-deeds')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Expect 4 good deeds linked to this sin
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
  });

  // ── §8  rawPayload never leaked ─────────────────────────────────────────────

  it('GET /v1/sins response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  it('GET /v1/sins/ghibah/quotes response never contains rawPayload', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?limit=50')
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  // ── §9  kind filter + countsByKind ─────────────────────────────────────────

  it('GET /v1/sins/ghibah/quotes → meta.countsByKind present with all/verse/hadith/athar keys', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?limit=50')
      .expect(200);
    const ck = res.body.meta.countsByKind as { all: number; verse: number; hadith: number; athar: number };
    expect(typeof ck.all).toBe('number');
    expect(typeof ck.verse).toBe('number');
    expect(typeof ck.hadith).toBe('number');
    expect(typeof ck.athar).toBe('number');
    // all === sum of the other three
    expect(ck.all).toBe(ck.verse + ck.hadith + ck.athar);
  });

  it('GET /v1/sins/ghibah/quotes?kind=verse → only QURAN_VERSE items', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?kind=verse&limit=50')
      .expect(200);
    const items: Array<{ quote: { type: string } }> = res.body.data.items;
    for (const item of items) {
      expect(item.quote.type).toBe('QURAN_VERSE');
    }
  });

  it('GET /v1/sins/ghibah/quotes?kind=hadith → only non-athar HADITH items', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?kind=hadith&limit=50')
      .expect(200);
    const items: Array<{ quote: { type: string; isAthar?: boolean } }> = res.body.data.items;
    for (const item of items) {
      expect(item.quote.type).toBe('HADITH');
      expect(item.quote.isAthar).not.toBe(true);
    }
  });

  it('GET /v1/sins/ghibah/quotes?kind=invalid → 400 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?kind=invalid')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /v1/sins/ghibah/quotes?kind=verse&limit=50 → countsByKind unchanged (counts whole topic)', async () => {
    const base = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?limit=50')
      .expect(200);
    const filtered = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?kind=verse&limit=50')
      .expect(200);
    // countsByKind.verse should be the same regardless of active kind filter
    expect(filtered.body.meta.countsByKind.verse).toBe(base.body.meta.countsByKind.verse);
    expect(filtered.body.meta.countsByKind.hadith).toBe(base.body.meta.countsByKind.hadith);
  });

  // Suppress unused import warning — SIN_TEST_MANY is used in test descriptions
  void SIN_TEST_MANY;
});
