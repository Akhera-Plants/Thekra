import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /v1 → 404 with RESOURCE_NOT_FOUND envelope (scaffold route removed)', async () => {
    const res = await request(app.getHttpServer()).get('/v1').expect(404);
    expect(res.body).toMatchObject({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: expect.any(String),
      },
    });
  });

  it('GET /health is reachable without the /v1 prefix', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /sins (no /v1 prefix) → 404', async () => {
    await request(app.getHttpServer()).get('/sins').expect(404);
  });
});
