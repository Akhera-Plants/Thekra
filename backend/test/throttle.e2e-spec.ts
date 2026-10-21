/**
 * E2E spec for rate limiting.
 *
 * The other suites run with throttling skipped (NODE_ENV=test). This one opts
 * back in with THROTTLE_IN_TEST=true, so it exercises the real global
 * ThrottlerGuard (APP_GUARD) and the stricter per-route limits.
 * Each createTestApp() call has its own in-memory throttler storage.
 */

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  const previous = process.env['THROTTLE_IN_TEST'];

  beforeAll(async () => {
    process.env['THROTTLE_IN_TEST'] = 'true';
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app);
    if (previous === undefined) delete process.env['THROTTLE_IN_TEST'];
    else process.env['THROTTLE_IN_TEST'] = previous;
  });

  it('POST /v1/auth/login → 429 after 5 attempts per minute', async () => {
    const server = app.getHttpServer();
    const body = { email: 'nobody@thekra.test', password: 'wrong-password' };
    for (let i = 0; i < 5; i++) {
      await request(server).post('/v1/auth/login').send(body).expect(401);
    }
    const res = await request(server).post('/v1/auth/login').send(body).expect(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('POST /v1/quotes/:id/reports → 429 after 5 reports per minute', async () => {
    const server = app.getHttpServer();
    const url = `/v1/quotes/${randomUUID()}/reports`;
    for (let i = 0; i < 5; i++) {
      const res = await request(server).post(url).send({ reason: 'TEXT' });
      expect(res.status).not.toBe(429);
    }
    await request(server).post(url).send({ reason: 'TEXT' }).expect(429);
  });

  it('public routes share the global 120/min limit', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 120; i++) {
      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
    }
    await request(server).get('/health').expect(429);
  });
});
