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
    expect(res.body.data.version).toBeDefined();
  });

  it('GET /health/ready is green when Postgres answers SELECT 1', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body.data).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });
});
