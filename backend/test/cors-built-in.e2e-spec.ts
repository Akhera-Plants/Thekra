/**
 * The live site once lost every client-side request because the API project had
 * no CORS_ORIGINS and fell back to localhost only. The site's own origins are
 * built in now, so they pass whatever CORS_ORIGINS holds.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

const env = vi.hoisted(() => {
  const previous = process.env['CORS_ORIGINS'];
  // The value production effectively had: the code default, localhost only.
  process.env['CORS_ORIGINS'] = 'http://localhost:3000';
  return { previous };
});

import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('CORS built-in site origins (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp(app);
    if (env.previous === undefined) delete process.env['CORS_ORIGINS'];
    else process.env['CORS_ORIGINS'] = env.previous;
  });

  it.each([
    'https://thekra-web.vercel.app',
    'https://thekra-web-git-master-almekdadmohammadgmailcoms-projects.vercel.app',
    'http://localhost:3000',
  ])('allows %s on a preflight and on a GET', async (origin) => {
    const preflight = await request(app.getHttpServer())
      .options('/v1/sins/ghibah/quotes')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET');
    expect(preflight.headers['access-control-allow-origin']).toBe(origin);

    const get = await request(app.getHttpServer()).get('/v1/sins').set('Origin', origin);
    expect(get.headers['access-control-allow-origin']).toBe(origin);
  });

  it('still refuses an unlisted origin', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
