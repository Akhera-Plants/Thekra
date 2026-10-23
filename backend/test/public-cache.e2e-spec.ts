/**
 * E2E: Cache-Control on public read routes, and its absence everywhere else.
 * Route-by-route coverage of the decorator lives in src/common/http/public-cache.routes.spec.ts.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

const env = vi.hoisted(() => {
  const previous = process.env['CORS_ORIGINS'];
  process.env['CORS_ORIGINS'] = 'https://thekra-web.vercel.app,http://localhost:3000';
  return { previous };
});

import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

const SHARED = 'public, s-maxage=300, stale-while-revalidate=3600';

describe('Public cache headers (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    await truncateAll(created.prisma);
    await seedTestFixtures();
  });

  afterAll(async () => {
    await closeTestApp(app);
    if (env.previous === undefined) delete process.env['CORS_ORIGINS'];
    else process.env['CORS_ORIGINS'] = env.previous;
  });

  it('a public topic page carries the shared-cache header, and HEAD does too', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=1').expect(200);
    expect(res.headers['cache-control']).toBe(SHARED);
    const head = await request(app.getHttpServer()).head('/v1/sins/ghibah/quotes?limit=1').expect(200);
    expect(head.headers['cache-control']).toBe(SHARED);
  });

  it('keeps Vary: Origin from CORS next to Vary: Authorization', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?limit=1')
      .set('Origin', 'https://thekra-web.vercel.app')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://thekra-web.vercel.app');
    const vary = String(res.headers['vary']).split(',').map((part) => part.trim().toLowerCase());
    expect(vary).toEqual(expect.arrayContaining(['origin', 'authorization']));
    expect(res.headers['cache-control']).toBe(SHARED);
  });

  it('a request that carries a token is private, never shared-cacheable', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/sins/ghibah/quotes?limit=1')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('an error response is not given the header', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/no-such-sin/quotes').expect(404);
    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('other public routes: catalogue, themes, one text, explanations', async () => {
    const list = await request(app.getHttpServer()).get('/v1/sins?limit=1').expect(200);
    expect(list.headers['cache-control']).toBe(SHARED);
    const themes = await request(app.getHttpServer()).get('/v1/topic-themes').expect(200);
    expect(themes.headers['cache-control']).toBe(SHARED);
    const id = (list.body.data.length ? (await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=1')).body.data.items[0].quote.id : null) as string;
    const one = await request(app.getHttpServer()).get(`/v1/quotes/${id}`).expect(200);
    expect(one.headers['cache-control']).toBe('public, s-maxage=120, stale-while-revalidate=600');
    const explanations = await request(app.getHttpServer()).get(`/v1/quotes/${id}/explanations`).expect(200);
    expect(explanations.headers['cache-control']).toBe('public, s-maxage=120, stale-while-revalidate=600');
  });

  it('no Cache-Control on auth, favorites, health or the report route', async () => {
    const calls = [
      () => request(app.getHttpServer()).post('/v1/auth/login').send({}),
      () => request(app.getHttpServer()).get('/v1/favorites'),
      () => request(app.getHttpServer()).get('/v1/users/me'),
      () => request(app.getHttpServer()).get('/health'),
      () => request(app.getHttpServer()).post('/v1/quotes/00000000-0000-4000-8000-000000000001/reports').send({}),
      () => request(app.getHttpServer()).get('/v1/admin/sins'),
    ];
    for (const call of calls) {
      const res = await call();
      expect(res.headers['cache-control'], `status ${res.status}`).toBeUndefined();
    }
  });
});
