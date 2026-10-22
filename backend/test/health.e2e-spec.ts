import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /health returns liveness without a DB check', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
    // P2-13: version must come from package.json, not npm_package_version
    expect(res.body.data.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('GET /health/ready is green when Postgres answers SELECT 1', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body.data).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  // P2-12: request-id echo-back
  it('echoes a valid x-request-id header', async () => {
    const validId = 'test-request-id-123';
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', validId)
      .expect(200);
    expect(res.headers['x-request-id']).toBe(validId);
  });

  it('replaces an unsafe x-request-id with a UUID', async () => {
    const unsafeId = '<script>alert(1)</script>';
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', unsafeId)
      .expect(200);
    // Must NOT echo back the unsafe value
    expect(res.headers['x-request-id']).not.toBe(unsafeId);
    // Must be a valid UUID
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('replaces an x-request-id that is too long (>128 chars) with a UUID', async () => {
    const longId = 'a'.repeat(129);
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', longId)
      .expect(200);
    expect(res.headers['x-request-id']).not.toBe(longId);
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
