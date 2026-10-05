/**
 * E2E spec: rawPayload never serialised in any public response.
 *
 * Iterates every public GET endpoint with lang=en and asserts that
 * the JSON response body never contains the string "rawPayload".
 *
 * This is the sweep test demanded by P1-9.4 of the review.
 * Seeds Q01 (QURAN_VERSE, API_CACHED with rawPayload) and Q09
 * (HADITH, API_CACHED with rawPayload) are the primary targets.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

// Known fixed IDs from seed.ts
const Q01 = '00000000-0000-4000-8000-000000000001'; // QURAN_VERSE API_CACHED (has rawPayload)
const Q09 = '00000000-0000-4000-8000-000000000009'; // HADITH API_CACHED (has rawPayload)
const SRC_BUKHARI = '10000000-0000-4000-8000-000000000002';
const TAG_BACKBITING_ID = 'c0000000-0000-4000-8000-000000000009';

/** Checks a URL: requests it with lang=en and asserts no rawPayload in body. */
async function assertNoRawPayload(
  app: INestApplication,
  path: string,
  expectedStatus: number = 200,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .get(path)
    .expect(expectedStatus);

  const bodyString = JSON.stringify(res.body);
  if (bodyString.includes('rawPayload')) {
    throw new Error(
      `rawPayload found in response for ${path}:\n${bodyString.slice(0, 500)}`,
    );
  }
}

describe('rawPayload never serialised (all public GETs sweep)', () => {
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

  // Sins
  it('GET /v1/sins?lang=en', () =>
    assertNoRawPayload(app, '/v1/sins?lang=en'));

  it('GET /v1/sins/ghibah?lang=en', () =>
    assertNoRawPayload(app, '/v1/sins/ghibah?lang=en'));

  it('GET /v1/sins/ghibah/quotes?lang=en', () =>
    assertNoRawPayload(app, '/v1/sins/ghibah/quotes?lang=en'));

  it('GET /v1/sins/ghibah/good-deeds?lang=en', () =>
    assertNoRawPayload(app, '/v1/sins/ghibah/good-deeds?lang=en'));

  // Good deeds
  it('GET /v1/good-deeds?lang=en', () =>
    assertNoRawPayload(app, '/v1/good-deeds?lang=en'));

  it('GET /v1/good-deeds/hifz-al-lisan?lang=en', () =>
    assertNoRawPayload(app, '/v1/good-deeds/hifz-al-lisan?lang=en'));

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?lang=en', () =>
    assertNoRawPayload(app, '/v1/good-deeds/hifz-al-lisan/quotes?lang=en'));

  // Quotes (public)
  it('GET /v1/quotes?lang=en', () =>
    assertNoRawPayload(app, '/v1/quotes?lang=en'));

  it('GET /v1/quotes/:id (QURAN_VERSE API_CACHED, has rawPayload in DB)', () =>
    assertNoRawPayload(app, `/v1/quotes/${Q01}?lang=en`));

  it('GET /v1/quotes/:id (HADITH API_CACHED, has rawPayload in DB)', () =>
    assertNoRawPayload(app, `/v1/quotes/${Q09}?lang=en`));

  it('GET /v1/quotes?lang=en&limit=100 (all quotes, catches any API_CACHED rows)', () =>
    assertNoRawPayload(app, '/v1/quotes?lang=en&limit=100'));

  // Quran
  it('GET /v1/quran/surahs?lang=en', () =>
    assertNoRawPayload(app, '/v1/quran/surahs?lang=en'));

  it('GET /v1/quran/surahs/49/ayahs?lang=en', () =>
    assertNoRawPayload(app, '/v1/quran/surahs/49/ayahs?lang=en'));

  it('GET /v1/quran/ayahs/49/12?lang=en (API_CACHED verse, has rawPayload in DB)', () =>
    assertNoRawPayload(app, '/v1/quran/ayahs/49/12?lang=en'));

  // Hadith
  it('GET /v1/hadith?lang=en', () =>
    assertNoRawPayload(app, '/v1/hadith?lang=en'));

  it('GET /v1/hadith?lang=en&includeWeak=true (wider set)', () =>
    assertNoRawPayload(app, '/v1/hadith?lang=en&includeWeak=true'));

  it('GET /v1/hadith/collections?lang=en', () =>
    assertNoRawPayload(app, '/v1/hadith/collections?lang=en'));

  // Tags
  it('GET /v1/tags?lang=en', () =>
    assertNoRawPayload(app, '/v1/tags?lang=en'));

  it('GET /v1/tags/backbiting?lang=en', () =>
    assertNoRawPayload(app, '/v1/tags/backbiting?lang=en'));

  // Sources
  it('GET /v1/sources?lang=en', () =>
    assertNoRawPayload(app, '/v1/sources?lang=en'));

  it('GET /v1/sources/:id?lang=en', () =>
    assertNoRawPayload(app, `/v1/sources/${SRC_BUKHARI}?lang=en`));

  // Health (unprefixed)
  it('GET /health', () => assertNoRawPayload(app, '/health'));

  // Suppress unused import warning
  void TAG_BACKBITING_ID;
});
