/**
 * «مجموعات التذكير» (redesign §4.6): desk CRUD and the public read.
 * Only published verses and sahih/hasan hadith may join a set; the public read passes the reader gate again.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminAuthHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

const Q01 = '00000000-0000-4000-8000-000000000001'; // QURAN_VERSE
const Q09 = '00000000-0000-4000-8000-000000000009'; // HADITH SAHIH
const Q14 = '00000000-0000-4000-8000-000000000014'; // HADITH HASAN
const Q16 = '00000000-0000-4000-8000-000000000016'; // HADITH DAIF
const Q17 = '00000000-0000-4000-8000-000000000017'; // SCHOLAR_QUOTE

describe('Reminder sets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: Record<string, string>;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    admin = await adminAuthHeaders(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('the desk requires an admin token', async () => {
    await request(app.getHttpServer()).get('/v1/admin/reminder-sets').expect(401);
    await request(app.getHttpServer()).post('/v1/admin/reminder-sets').send({ slug: 'x', titleAr: 'س', titleEn: 'x' }).expect(401);
  });

  it('creates a set, refuses weak or non-hadith texts, publishes it, and serves it publicly', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/v1/admin/reminder-sets')
      .set(admin)
      .send({ slug: 'ayat-al-raja', titleAr: 'آيات الرجاء', titleEn: 'Verses of hope', sortOrder: 10 })
      .expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data).toMatchObject({ slug: 'ayat-al-raja', published: false, itemCount: 0, quoteIds: [] });

    await request(server)
      .post('/v1/admin/reminder-sets')
      .set(admin)
      .send({ slug: 'ayat-al-raja', titleAr: 'مكرر', titleEn: 'Dup' })
      .expect(409);

    const refused = await request(server).put(`/v1/admin/reminder-sets/${id}/items`).set(admin).send({ quoteIds: [Q01, Q16, Q17] }).expect(422);
    expect(refused.body.error.code).toBe('REMINDER_SET_QUOTE_NOT_ALLOWED');
    expect(JSON.stringify(refused.body)).toContain(Q16);
    expect(JSON.stringify(refused.body)).toContain(Q17);

    const items = await request(server).put(`/v1/admin/reminder-sets/${id}/items`).set(admin).send({ quoteIds: [Q09, Q01, Q14] }).expect(200);
    expect(items.body.data.quoteIds).toEqual([Q09, Q01, Q14]);

    // Not published yet: hidden from the public read.
    expect((await request(server).get('/v1/reminder-sets').expect(200)).body.data).toEqual([]);
    await request(server).get('/v1/reminder-sets/ayat-al-raja').expect(404);

    await request(server).patch(`/v1/admin/reminder-sets/${id}`).set(admin).send({ published: true }).expect(200);
    const list = await request(server).get('/v1/reminder-sets?lang=ar').expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ slug: 'ayat-al-raja', titleAr: 'آيات الرجاء', itemCount: 3 });
    expect(list.body.data[0].items.map((q: { id: string }) => q.id)).toEqual([Q09, Q01, Q14]);
    expect(list.body.data[0].items[0].textAr).toBeTruthy();

    const one = await request(server).get('/v1/reminder-sets/ayat-al-raja').expect(200);
    expect(one.body.data.items).toHaveLength(3);

    // A text that loses its publication drops out of the public read.
    await prisma.quote.update({ where: { id: Q14 }, data: { grade: 'DAIF' } });
    const after = await request(server).get('/v1/reminder-sets/ayat-al-raja').expect(200);
    expect(after.body.data.items.map((q: { id: string }) => q.id)).toEqual([Q09, Q01]);
    await prisma.quote.update({ where: { id: Q14 }, data: { grade: 'HASAN' } });

    await request(server).delete(`/v1/admin/reminder-sets/${id}`).set(admin).expect(204);
    await request(server).get('/v1/reminder-sets/ayat-al-raja').expect(404);
    expect(await prisma.reminderSetItem.count()).toBe(0);
  });
});
