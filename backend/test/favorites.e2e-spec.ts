/**
 * E2E spec for favorites endpoints (phase 4).
 * Tests endpoints #24–#27: list, quote-ids, add, remove.
 *
 * Checks:
 * - All endpoints require a valid access token (401 UNAUTHENTICATED without)
 * - add returns 409 ALREADY_FAVORITED on duplicate
 * - add returns 422 RELATED_RESOURCE_INVALID on unknown quoteId
 * - remove returns 404 RESOURCE_NOT_FOUND when not favorited
 * - delete is keyed by quoteId (not favorite.id)
 * - /favorites/quote-ids returns a flat string[] useful for heart-marking
 * - isFavorite enrichment works on optional-auth endpoints
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures, TEST_PASSWORD } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { authHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

// Quote ID from the dev seed that we can safely favorite.
const SEED_QUOTE_ID = '00000000-0000-4000-8000-000000000001'; // Al-Hujurat 49:12

describe('Favorites endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userToken: Record<string, string>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    userToken = await authHeaders(app, 'e2e-user@thekra.test', TEST_PASSWORD);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ── §1 Guard: all endpoints require authentication ─────────────────────────

  it('GET /v1/favorites → 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/v1/favorites').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /v1/favorites/quote-ids → 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/v1/favorites/quote-ids').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /v1/favorites → 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/favorites')
      .send({ quoteId: SEED_QUOTE_ID })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('DELETE /v1/favorites/:quoteId → 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/favorites/${SEED_QUOTE_ID}`)
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  // ── §2 Empty state ────────────────────────────────────────────────────────

  it('GET /v1/favorites → 200 empty list initially', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/favorites')
      .set(userToken)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it('GET /v1/favorites/quote-ids → 200 empty array initially', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/favorites/quote-ids')
      .set(userToken)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  // ── §3 Add ────────────────────────────────────────────────────────────────

  it('POST /v1/favorites → 201 creates a favorite', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/favorites')
      .set(userToken)
      .send({ quoteId: SEED_QUOTE_ID })
      .expect(201);

    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      quoteId: SEED_QUOTE_ID,
      createdAt: expect.any(String),
    });
    expect(res.headers.location).toContain(SEED_QUOTE_ID);
  });

  it('POST /v1/favorites → 409 ALREADY_FAVORITED on duplicate', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/favorites')
      .set(userToken)
      .send({ quoteId: SEED_QUOTE_ID })
      .expect(409);

    expect(res.body.error.code).toBe('ALREADY_FAVORITED');
  });

  it('POST /v1/favorites → 422 RELATED_RESOURCE_INVALID on unknown quoteId', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/favorites')
      .set(userToken)
      .send({ quoteId: '00000000-0000-4000-8000-000000000099' })
      .expect(422);

    expect(res.body.error.code).toBe('RELATED_RESOURCE_INVALID');
  });

  it('POST /v1/favorites → 400 VALIDATION_FAILED on malformed quoteId', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/favorites')
      .set(userToken)
      .send({ quoteId: 'not-a-uuid' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  // ── §4 List after adding ──────────────────────────────────────────────────

  it('GET /v1/favorites → 200 with favorited quote', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/favorites')
      .set(userToken)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].quote.id).toBe(SEED_QUOTE_ID);
    expect(res.body.data[0].quote.isFavorite).toBe(true);
    // rawPayload must never be serialised
    expect(res.body.data[0].quote.rawPayload).toBeUndefined();
  });

  it('GET /v1/favorites/quote-ids → 200 with the favorited ID', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/favorites/quote-ids')
      .set(userToken)
      .expect(200);

    expect(res.body.data).toContain(SEED_QUOTE_ID);
  });

  // ── §5 isFavorite on optional-auth endpoints ──────────────────────────────

  it('GET /v1/quotes/:id with token → isFavorite: true for favorited quote', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/quotes/${SEED_QUOTE_ID}`)
      .set(userToken)
      .expect(200);

    expect(res.body.data.isFavorite).toBe(true);
  });

  it('GET /v1/quotes/:id without token → isFavorite omitted', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/quotes/${SEED_QUOTE_ID}`)
      .expect(200);

    expect(res.body.data.isFavorite).toBeUndefined();
  });

  it('GET /v1/sins/ghibah/quotes with token → isFavorite set on items', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes')
      .set(userToken)
      .expect(200);

    const favorited = res.body.data.items.find(
      (i: { quote: { id: string } }) => i.quote.id === SEED_QUOTE_ID,
    );
    expect(favorited?.quote.isFavorite).toBe(true);
  });

  // ── §6 Remove ────────────────────────────────────────────────────────────

  it('DELETE /v1/favorites/:quoteId → 204 removes the favorite', async () => {
    await request(app.getHttpServer())
      .delete(`/v1/favorites/${SEED_QUOTE_ID}`)
      .set(userToken)
      .expect(204);
  });

  it('DELETE /v1/favorites/:quoteId → 404 RESOURCE_NOT_FOUND when not favorited', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/favorites/${SEED_QUOTE_ID}`)
      .set(userToken)
      .expect(404);

    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET /v1/favorites/quote-ids → empty after remove', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/favorites/quote-ids')
      .set(userToken)
      .expect(200);

    expect(res.body.data).not.toContain(SEED_QUOTE_ID);
  });
});
