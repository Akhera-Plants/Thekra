/**
 * E2E spec for the home «في لحظات مثل هذه» list (round 6, C-09): GET /v1/home-moments (public, CDN-cached; the
 * YAML seed while the table is empty) and the admin desk /v1/admin/home-moments.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminAuthHeaders, closeTestApp, createTestApp, userAuthHeaders } from './helpers/test-app.js';

describe('Home moments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: Record<string, string>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    admin = await adminAuthHeaders(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('empty table → the YAML seed, only topics that exist here, cacheable', async () => {
    const res = await http().get('/v1/home-moments').expect(200);
    expect(res.headers['cache-control']).toContain('s-maxage=300');
    expect(res.body.meta).toEqual({ locale: 'ar', source: 'seed' });
    // The test fixtures have the sins ghadab and ghibah but not the deeds salah / kalam-tayyib.
    expect(res.body.data.map((m: { key: string }) => m.key)).toEqual(['anger', 'backbiting']);
    expect(res.body.data[0]).toEqual({
      key: 'anger',
      label: 'تعينك على التخفّف من الغضب',
      situation: 'قبل أن تردّ وأنت غاضب',
      icon: 'pause',
      topic: { type: 'sin', slug: 'ghadab', title: expect.any(String), path: '/sins/ghadab' },
    });
    const en = await http().get('/v1/home-moments?lang=en').expect(200);
    expect(en.body.data[0]).toMatchObject({ label: 'Help to let go of anger', situation: 'Before you reply in anger' });
    await http().get('/v1/home-moments?lang=fr').expect(400);
  });

  it('the desk is admin-only', async () => {
    await http().get('/v1/admin/home-moments').expect(401);
    const user = await userAuthHeaders(app);
    await http().get('/v1/admin/home-moments').set(user).expect(403);
  });

  it('desk rows replace the seed: create, validate, unpublish, delete', async () => {
    const created = await http()
      .post('/v1/admin/home-moments')
      .set(admin)
      .send({ key: 'envy', topicType: 'SIN', topicSlug: 'ghibah', labelAr: ' تعينك على سلامة الصدر ', labelEn: 'Help', icon: 'heart', sortOrder: 5 })
      .expect(201);
    const id: string = created.body.data.id;
    expect(created.headers['location']).toBe(`/v1/admin/home-moments/${id}`);
    expect(created.body.data).toMatchObject({ labelAr: 'تعينك على سلامة الصدر', published: true, situationAr: null });

    let list = await http().get('/v1/home-moments').expect(200);
    expect(list.body.meta.source).toBe('database');
    expect(list.body.data.map((m: { key: string }) => m.key)).toEqual(['envy']);

    await http()
      .post('/v1/admin/home-moments')
      .set(admin)
      .send({ key: 'extra', topicType: 'SIN', topicSlug: 'ghibah', labelAr: 'x', labelEn: 'x', icon: 'heart', colour: 'red' })
      .expect(400);
    await http()
      .post('/v1/admin/home-moments')
      .set(admin)
      .send({ key: 'envy', topicType: 'SIN', topicSlug: 'ghibah', labelAr: 'x', labelEn: 'x', icon: 'heart' })
      .expect(409);
    await http()
      .post('/v1/admin/home-moments')
      .set(admin)
      .send({ key: 'nope', topicType: 'GOOD_DEED', topicSlug: 'no-such-deed', labelAr: 'x', labelEn: 'x', icon: 'heart' })
      .expect(422);
    await http()
      .post('/v1/admin/home-moments')
      .set(admin)
      .send({ key: 'bidi', topicType: 'SIN', topicSlug: 'ghibah', labelAr: 'ab‮c', labelEn: 'x', icon: 'heart' })
      .expect(400);

    await http().patch(`/v1/admin/home-moments/${id}`).set(admin).send({ published: false }).expect(200);
    list = await http().get('/v1/home-moments').expect(200);
    expect(list.body).toEqual({ data: [], meta: { locale: 'ar', source: 'database' } });

    await http().patch(`/v1/admin/home-moments/${id}`).set(admin).send({ key: 'renamed' }).expect(400);
    await http().patch(`/v1/admin/home-moments/${id}`).set(admin).send({ topicSlug: 'missing' }).expect(422);
    await http().delete(`/v1/admin/home-moments/${id}`).set(admin).expect(204);
    await http().delete(`/v1/admin/home-moments/${id}`).set(admin).expect(404);
    expect((await http().get('/v1/home-moments').expect(200)).body.meta.source).toBe('seed');
    expect(await prisma.homeMoment.count()).toBe(0);
  });
});
