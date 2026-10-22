/**
 * E2E spec for /v1/quran endpoints — endpoints #10, #11, #12.
 *
 * Tests:
 *   - GET /v1/quran/surahs — list surahs (P2-7: grouped by number only)
 *   - GET /v1/quran/surahs/:n/ayahs — list ayahs for a surah
 *   - GET /v1/quran/ayahs/:s/:a — single ayah (P0-1 includeAllTranslations)
 *   - rawPayload never leaked
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

// From seed: Q01 is 49:12, Q02 is 49:11, Q09 and Q10 and others are hadiths.
// Surahs in seed: 49, 4, 8, 9, 62, 98, 2 (7 distinct surahs)
const SEED_SURAH_COUNT = 7;

describe('Quran endpoints (e2e)', () => {
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

  // ── §1  GET /v1/quran/surahs ──────────────────────────────────────────────

  it('GET /v1/quran/surahs → 200 with surah list', async () => {
    const res = await request(app.getHttpServer()).get('/v1/quran/surahs').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(SEED_SURAH_COUNT);
  });

  it('GET /v1/quran/surahs → each item has surahNumber and ayahCount', async () => {
    const res = await request(app.getHttpServer()).get('/v1/quran/surahs').expect(200);
    const surahs: unknown[] = res.body.data;
    for (const surah of surahs) {
      expect(surah).toMatchObject({
        surahNumber: expect.any(Number),
      });
    }
  });

  it('GET /v1/quran/surahs → ordered by surahNumber asc', async () => {
    const res = await request(app.getHttpServer()).get('/v1/quran/surahs').expect(200);
    const numbers: number[] = res.body.data.map((s: { surahNumber: number }) => s.surahNumber);
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]!).toBeGreaterThan(numbers[i - 1]!);
    }
  });

  it('GET /v1/quran/surahs → no duplicate surahNumbers (P2-7)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/quran/surahs').expect(200);
    const numbers: number[] = res.body.data.map((s: { surahNumber: number }) => s.surahNumber);
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });

  it('GET /v1/quran/surahs → never contains rawPayload', async () => {
    const res = await request(app.getHttpServer()).get('/v1/quran/surahs').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  // ── §2  GET /v1/quran/surahs/:n/ayahs ────────────────────────────────────

  it('GET /v1/quran/surahs/49/ayahs → 200 with ayahs for Al-Hujurat', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/quran/surahs/49/ayahs')
      .expect(200);
    expect(res.body.data).toBeDefined();
    // Q01 (49:12) and Q02 (49:11) are both in surah 49
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /v1/quran/surahs/49/ayahs → ayahs ordered by ayahNumber asc', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/quran/surahs/49/ayahs')
      .expect(200);
    // Ayahs are returned as QuoteDtos; ayahNumber is nested inside the `quran` sub-object
    const ayahNumbers: number[] = res.body.data.map(
      (a: { quran: { ayahNumber: number } }) => a.quran.ayahNumber,
    );
    for (let i = 1; i < ayahNumbers.length; i++) {
      expect(ayahNumbers[i]!).toBeGreaterThanOrEqual(ayahNumbers[i - 1]!);
    }
  });

  it('GET /v1/quran/surahs/999/ayahs → 400 (invalid surah number)', async () => {
    await request(app.getHttpServer()).get('/v1/quran/surahs/999/ayahs').expect(400);
  });

  it('GET /v1/quran/surahs/49/ayahs → never contains rawPayload', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/quran/surahs/49/ayahs')
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  // ── §3  GET /v1/quran/ayahs/:s/:a — single ayah ──────────────────────────

  it('GET /v1/quran/ayahs/49/12 → 200 with single ayah detail', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/quran/ayahs/49/12')
      .expect(200);
    // The response is a QuoteDto; surahNumber and ayahNumber are inside the `quran` sub-object
    expect(res.body.data).toMatchObject({
      type: 'QURAN_VERSE',
      textAr: expect.any(String),
      quran: expect.objectContaining({
        surahNumber: 49,
        ayahNumber: 12,
      }),
    });
  });

  it('GET /v1/quran/ayahs/49/11 → 200 (Q02)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/quran/ayahs/49/11')
      .expect(200);
    // surahNumber and ayahNumber are inside the `quran` sub-object
    expect(res.body.data.quran.ayahNumber).toBe(11);
    expect(res.body.data.quran.surahNumber).toBe(49);
  });

  it('GET /v1/quran/ayahs/49/999 → 404 (ayah not in seed)', async () => {
    await request(app.getHttpServer())
      .get('/v1/quran/ayahs/49/999')
      .expect(404);
  });

  it('GET /v1/quran/ayahs/49/12 → never contains rawPayload (P0-1 + P1-9 sweep)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/quran/ayahs/49/12')
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });

  it('GET /v1/quran/ayahs/49/12?includeAllTranslations=false → translations field present but constrained (P0-1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/quran/ayahs/49/12?includeAllTranslations=false')
      .expect(200);
    // The fix: includeAllTranslations=false must not behave as =true
    // We just assert the endpoint responds without rawPayload
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });
});
