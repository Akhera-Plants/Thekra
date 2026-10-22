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
import { adminAuthHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Error envelope & HTTP contract (e2e)', () => {
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
      .set(adminHdrs)
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
      .set(adminHdrs)
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

  // ── §6  Body coercion guard (P2-16) ────────────────────────────────────────
  // Body DTO numeric fields must reject string numbers ("5") with 400.
  // Query string numerics must still be accepted (implicit conversion for query
  // params is the correct and expected behaviour).

  it('PATCH /v1/admin/sins/:id with {"severity":"5"} (string) → 400', async () => {
    // Find a sin id to PATCH (ghibah is seeded by seedTestFixtures)
    const listRes = await request(app.getHttpServer()).get('/v1/sins?limit=1').expect(200);
    const sinId: string = (listRes.body.data as Array<{ id: string }>)[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/sins/${sinId}`)
      .set(adminHdrs)
      .send({ severity: '5' }) // string instead of number
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('POST /v1/admin/sin-quotes with {"relevanceScore":"50"} (string) → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/sin-quotes')
      .set(adminHdrs)
      .send({
        sinId: '00000000-0000-4000-8000-000000000001',
        quoteId: '00000000-0000-4000-8000-000000000001',
        relevanceScore: '50', // string instead of number
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /v1/sins?severityMin=3 → 400 (severity is not a public filter)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins?severityMin=3').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET ?page=1&limit=5 (query string numbers) → 200', async () => {
    await request(app.getHttpServer()).get('/v1/sins?page=1&limit=5').expect(200);
  });

  // ── §7  Request-id safety (P2-12) ──────────────────────────────────────────
  // AllExceptionsFilter must use request.id (set by pino-http's validated genReqId)
  // rather than re-reading the raw header.

  it('error response requestId matches the echoed x-request-id header', async () => {
    const validId = 'my-safe-req-id';
    const res = await request(app.getHttpServer())
      .get('/v1/sins/slug-does-not-exist')
      .set('x-request-id', validId)
      .expect(404);

    expect(res.body.error.requestId).toBe(validId);
    expect(res.headers['x-request-id']).toBe(validId);
  });

  it('unsafe x-request-id is NOT echoed in error requestId', async () => {
    const unsafeId = '../../../etc/passwd';
    const res = await request(app.getHttpServer())
      .get('/v1/sins/slug-does-not-exist')
      .set('x-request-id', unsafeId)
      .expect(404);

    expect(res.body.error.requestId).not.toBe(unsafeId);
    // Must be a UUID
    expect(res.body.error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
