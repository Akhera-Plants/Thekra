/**
 * E2E spec for CORS (rules: src/config/cors-origins.ts).
 *
 * Pins CORS_ORIGINS to the production shape — an exact origin, a Vercel
 * preview pattern and localhost — so it does not depend on .env.test.
 * ConfigModule.forRoot validates the environment when AppModule is imported,
 * so the value is set in vi.hoisted, before the imports below run.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

const env = vi.hoisted(() => {
  const previous = process.env['CORS_ORIGINS'];
  process.env['CORS_ORIGINS'] =
    'https://thekra-web.vercel.app,https://thekra-web-*-almekdadmohammadgmailcoms-projects.vercel.app,http://localhost:3000';
  return { previous };
});

import { closeTestApp, createTestApp } from './helpers/test-app.js';

const EXACT = 'https://thekra-web.vercel.app';
const PREVIEW = 'https://thekra-web-git-master-almekdadmohammadgmailcoms-projects.vercel.app';
const DISALLOWED = [
  'https://evil.example',
  'https://thekra-web-x.vercel.app.evil.com',
  'http://thekra-web.vercel.app',
];

describe('CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app);
    if (env.previous === undefined) delete process.env['CORS_ORIGINS'];
    else process.env['CORS_ORIGINS'] = env.previous;
  });

  function preflight(origin: string) {
    return request(app.getHttpServer())
      .options('/v1/sins')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'content-type');
  }

  describe.each([
    ['exact origin', EXACT],
    ['preview pattern origin', PREVIEW],
  ])('allowed %s', (_label, origin) => {
    it('preflight echoes the origin with credentials', async () => {
      const res = await preflight(origin).expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['vary']).toContain('Origin');
    });

    it('GET echoes the origin with credentials', async () => {
      const res = await request(app.getHttpServer()).get('/health').set('Origin', origin).expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['vary']).toContain('Origin');
    });
  });

  describe.each(DISALLOWED.map((origin) => [origin]))('disallowed origin %s', (origin) => {
    it('preflight answers without Access-Control-Allow-Origin', async () => {
      const res = await preflight(origin).expect(204);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('GET is served without Access-Control-Allow-Origin', async () => {
      const res = await request(app.getHttpServer()).get('/health').set('Origin', origin).expect(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  it('a request without Origin (server-to-server, curl) is served without CORS headers', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
