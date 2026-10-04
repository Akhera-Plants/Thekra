/**
 * E2E spec covering error-envelope shape, status-code contracts, and
 * cross-cutting error handling.  Acceptance tests for P1-3, P1-5, P1-6, P1-10.
 *
 * Seeding: ghibah sin must exist for the MAWDU test (#4).
 * We run a full seedTestFixtures() in beforeAll for a realistic environment.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Error envelope & HTTP contract (e2e)', () => {
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

  // ── §1  /v1 prefix enforcement (P1-10) ─────────────────────────────────────

  it('GET /sins (no /v1 prefix) → 404', async () => {
    await request(app.getHttpServer()).get('/sins').expect(404);
  });

  it('GET /v1 → 404 with RESOURCE_NOT_FOUND code', async () => {
    const res = await request(app.getHttpServer()).get('/v1').expect(404);
    // NestJS strips the global prefix before the router sees the path,
    // so request.url may be "/" — we only assert the envelope shape and code.
    expect(res.body).toMatchObject({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: expect.any(String),
        method: 'GET',
        timestamp: expect.any(String),
        requestId: expect.any(String),
      },
    });
  });

  // ── §2  Validation error details shape (P1-6) ───────────────────────────────
  // POST /v1/admin/sin-quotes with a bad sinId (not UUID) and out-of-range score.
  // The ValidationPipe exceptionFactory must produce details: [{field,constraint,message}].

  it('validation error → details array with {field, constraint, message} shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes')
      .send({ sinId: 'not-a-uuid', quoteId: 'not-a-uuid', relevanceScore: 101 })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    const details: unknown[] = res.body.error.details;
    expect(Array.isArray(details)).toBe(true);
    // Every detail item must have the three required keys
    for (const item of details) {
      expect(item).toMatchObject({
        field: expect.any(String),
        constraint: expect.any(String),
        message: expect.any(String),
      });
    }
    // sinId must fail isUuid
    expect(details).toContainEqual(
      expect.objectContaining({ field: 'sinId', constraint: 'isUuid' }),
    );
    // relevanceScore must fail max (101 > 100)
    expect(details).toContainEqual(
      expect.objectContaining({ field: 'relevanceScore', constraint: 'max' }),
    );
  });

  // ── §3  MAWDU → 422 GRADE_NOT_PERMITTED (P1-3) ─────────────────────────────

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

  // ── §4  Oversized body → 413 PAYLOAD_TOO_LARGE (P1-5) ─────────────────────
  // Default Express body-parser limit is 100 kb.  Send ~200 kb to trigger 413.

  it('oversized body → 413 PAYLOAD_TOO_LARGE', async () => {
    // Build a JSON body slightly above the 100 kb Express default limit
    const largeValue = 'a'.repeat(110_000);
    const largeBody = JSON.stringify({ note: largeValue });

    const res = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes')
      .set('Content-Type', 'application/json')
      .send(largeBody)
      .expect(413);

    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  // ── §5  Error envelope completeness ────────────────────────────────────────

  it('every error response includes code, message, path, method, requestId, timestamp', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/slug-that-does-not-exist-xyzzy')
      .expect(404);

    expect(res.body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      path: expect.any(String),
      method: 'GET',
      requestId: expect.any(String),
      timestamp: expect.any(String),
    });
  });
});
