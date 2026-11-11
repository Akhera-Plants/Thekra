/**
 * E2E spec for the reader (round 6, C-13 / C-01n): GET /v1/quotes/:id/reader (three tafsirs inline in the owner's
 * order, sharh for hadith, «وجه التذكير» of the link), the link PATCH fields, and the owner's link-concerns list.
 */

import { INestApplication } from '@nestjs/common';
import { ExplanationKind, SourceType } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { READER_TAFSIRS } from '../src/modules/quotes/quote-reader.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminAuthHeaders, closeTestApp, createTestApp, userAuthHeaders } from './helpers/test-app.js';

/** Seed (prisma/seed.ts): Q01 = al-Hujurat 49:12 (linked to ghibah), Q10 = a sahih hadith. */
const Q01 = '00000000-0000-4000-8000-000000000001';
const Q10 = '00000000-0000-4000-8000-000000000010';
const OTHER_TAFSIR = '10000000-0000-4000-8000-000000000024';

describe('Quote reader (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: Record<string, string>;
  let linkId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    admin = await adminAuthHeaders(app);
    for (const { sourceId, key } of [...READER_TAFSIRS, { sourceId: OTHER_TAFSIR, key: 'other' }]) {
      await prisma.source.upsert({
        where: { id: sourceId },
        create: { id: sourceId, name: key, nameAr: key, type: SourceType.BOOK },
        update: {},
      });
    }
    // Inserted in reverse order on purpose: the reader orders by the owner's list, not by the rows.
    await prisma.explanation.createMany({
      data: [
        { kind: ExplanationKind.TAFSIR, ayahKey: '49:11-13', sourceId: READER_TAFSIRS[2].sourceId, text: 'ابن عاشور', languageCode: 'ar' },
        { kind: ExplanationKind.TAFSIR, ayahKey: '49:12', sourceId: READER_TAFSIRS[1].sourceId, text: 'السعدي', languageCode: 'ar' },
        { kind: ExplanationKind.TAFSIR, ayahKey: '49:12', sourceId: READER_TAFSIRS[0].sourceId, text: 'المختصر', languageCode: 'ar' },
        { kind: ExplanationKind.TAFSIR, ayahKey: '49:12', sourceId: READER_TAFSIRS[0].sourceId, text: 'Mukhtasar', languageCode: 'en' },
        { kind: ExplanationKind.TAFSIR, ayahKey: '49:12', sourceId: OTHER_TAFSIR, text: 'other', languageCode: 'en' },
        { kind: ExplanationKind.TAFSIR, ayahKey: '49:14', sourceId: READER_TAFSIRS[1].sourceId, text: 'آية أخرى', languageCode: 'ar' },
        { kind: ExplanationKind.SHARH, quoteId: Q10, sourceId: READER_TAFSIRS[1].sourceId, text: 'شرح', languageCode: 'ar' },
      ],
    });
    const link = await prisma.sinQuote.findFirstOrThrow({ where: { quoteId: Q01, reviewStatus: 'ACCEPTED' } });
    linkId = link.id;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('a verse: المختصر، السعدي، ابن عاشور inline, in that order, only passages covering the ayah; cacheable', async () => {
    const res = await http().get(`/v1/quotes/${Q01}/reader`).expect(200);
    expect(res.headers['cache-control']).toContain('s-maxage=120');
    expect(res.body.data).toMatchObject({ quoteId: Q01, type: 'QURAN_VERSE', reminderAngle: null, explanations: [] });
    expect(res.body.data.tafsirs.map((t: { key: string; entries: Array<{ text: string }> }) => [t.key, t.entries.map((e) => e.text)])).toEqual([
      ['mukhtasar', ['المختصر']],
      ['sadi', ['السعدي']],
      ['ibn-ashur', ['ابن عاشور']],
    ]);
    const en = await http().get(`/v1/quotes/${Q01}/reader?lang=en`).expect(200);
    expect(en.body.data.tafsirs.map((t: { key: string; languageCode: string }) => [t.key, t.languageCode])).toEqual([
      ['mukhtasar', 'en'],
      ['sadi', 'ar'],
      ['ibn-ashur', 'ar'],
    ]);
  });

  it('a hadith keeps its sharh; 400 for a bad linkId; 404 for an unknown text', async () => {
    const res = await http().get(`/v1/quotes/${Q10}/reader`).expect(200);
    expect(res.body.data.explanations.map((e: { kind: string; text: string }) => [e.kind, e.text])).toEqual([['SHARH', 'شرح']]);
    expect(res.body.data.tafsirs).toEqual([]);
    await http().get(`/v1/quotes/${Q10}/reader?linkId=nope`).expect(400);
    await http().get('/v1/quotes/00000000-0000-4000-8000-0000000000aa/reader').expect(404);
  });

  it('«وجه التذكير»: empty until written; shown for its own accepted link only; English only when written', async () => {
    expect((await http().get(`/v1/quotes/${Q01}/reader?linkId=${linkId}`).expect(200)).body.data.reminderAngle).toBeNull();
    const patched = await http()
      .patch(`/v1/admin/sin-quotes/${linkId}`)
      .set(admin)
      .send({ reminderAngle: '  نصّ تحريريّ للاختبار  ' })
      .expect(200);
    expect(patched.body.data).toMatchObject({ reminderAngle: 'نصّ تحريريّ للاختبار', reminderAngleEn: null });
    expect((await http().get(`/v1/quotes/${Q01}/reader?linkId=${linkId}`).expect(200)).body.data.reminderAngle).toEqual({
      text: 'نصّ تحريريّ للاختبار',
      languageCode: 'ar',
    });
    expect((await http().get(`/v1/quotes/${Q01}/reader?lang=en&linkId=${linkId}`).expect(200)).body.data.reminderAngle).toBeNull();
    // The same link id with another text answers nothing.
    expect((await http().get(`/v1/quotes/${Q10}/reader?linkId=${linkId}`).expect(200)).body.data.reminderAngle).toBeNull();
    await http().patch(`/v1/admin/sin-quotes/${linkId}`).set(admin).send({ reminderAngle: null }).expect(200);
    expect((await http().get(`/v1/quotes/${Q01}/reader?linkId=${linkId}`).expect(200)).body.data.reminderAngle).toBeNull();
  });

  it('«no real link»: flagged links are listed for the owner (admin only) and stay public until he decides', async () => {
    const user = await userAuthHeaders(app);
    await http().get('/v1/admin/link-concerns').set(user).expect(403);
    expect((await http().get('/v1/admin/link-concerns').set(admin).expect(200)).body).toEqual({
      data: [],
      meta: { counts: { sin: 0, 'good-deed': 0, branch: 0 }, limitPerKind: 100, offset: 0, total: 0, topics: [] },
    });
    await http().patch(`/v1/admin/sin-quotes/${linkId}`).set(admin).send({ concern: 'SOMETHING' }).expect(400);
    await http().patch(`/v1/admin/sin-quotes/${linkId}`).set(admin).send({ concern: 'NO_REAL_LINK', concernNote: 'الآية في الظن لا في الغيبة؟' }).expect(200);

    const list = await http().get('/v1/admin/link-concerns').set(admin).expect(200);
    expect(list.body.meta.counts).toEqual({ sin: 1, 'good-deed': 0, branch: 0 });
    expect(list.body.data).toEqual([
      expect.objectContaining({
        kind: 'sin',
        linkId,
        concern: 'NO_REAL_LINK',
        concernNote: 'الآية في الظن لا في الغيبة؟',
        reviewStatus: 'ACCEPTED',
        topic: expect.objectContaining({ slug: expect.any(String) }),
        quote: expect.objectContaining({ id: Q01, type: 'QURAN_VERSE' }),
      }),
    ]);
    expect(list.body.data[0].concernAt).toEqual(expect.any(String));
    expect((await http().get('/v1/admin/link-concerns?kind=good-deed').set(admin).expect(200)).body.data).toEqual([]);
    await http().get('/v1/admin/link-concerns?kind=people').set(admin).expect(400);

    await http().get(`/v1/quotes/${Q01}`).expect(200);
    await http().patch(`/v1/admin/sin-quotes/${linkId}`).set(admin).send({ concern: null }).expect(200);
    const row = await prisma.sinQuote.findUniqueOrThrow({ where: { id: linkId } });
    expect(row).toMatchObject({ concern: null, concernAt: null });
    expect((await http().get('/v1/admin/link-concerns').set(admin).expect(200)).body.data).toEqual([]);
  });

  it('link concerns: paging with offset, a topic filter, the pending / hidden decision, and the topic list', async () => {
    const links = await prisma.sinQuote.findMany({ orderBy: { id: 'asc' }, take: 5, select: { id: true, sinId: true } });
    expect(links.length).toBe(5);
    for (const [i, l] of links.entries()) {
      await http().patch(`/v1/admin/sin-quotes/${l.id}`).set(admin).send({ concern: 'NO_REAL_LINK', concernNote: `n${i}` }).expect(200);
    }
    const url = '/v1/admin/link-concerns?kind=sin';
    const first = (await http().get(`${url}&limit=2`).set(admin).expect(200)).body;
    const second = (await http().get(`${url}&limit=2&offset=2`).set(admin).expect(200)).body;
    const third = (await http().get(`${url}&limit=2&offset=4`).set(admin).expect(200)).body;
    expect([first, second, third].map((b) => b.data.length)).toEqual([2, 2, 1]);
    const ids = [...first.data, ...second.data, ...third.data].map((r: { linkId: string }) => r.linkId);
    expect(new Set(ids).size).toBe(5);
    expect(first.meta).toMatchObject({ total: 5, offset: 0, counts: { sin: 5 } });
    expect((await http().get('/v1/admin/link-concerns?kind=branch').set(admin).expect(200)).body.meta.counts).toEqual({ sin: 5, 'good-deed': 0, branch: 0 });
    expect(second.meta.offset).toBe(2);
    expect(first.meta.topics.reduce((n: number, t: { count: number }) => n + t.count, 0)).toBe(5);

    // Topic filter (needs a kind).
    const topicId = first.meta.topics[0].id as string;
    const one = (await http().get(`${url}&topicId=${topicId}`).set(admin).expect(200)).body;
    expect(one.data.every((r: { topic: { id: string } }) => r.topic.id === topicId)).toBe(true);
    expect(one.meta.total).toBe(first.meta.topics[0].count);
    await http().get(`/v1/admin/link-concerns?topicId=${topicId}`).set(admin).expect(400);
    await http().get(`${url}&topicId=nope`).set(admin).expect(400);
    await http().get(`${url}&offset=-1`).set(admin).expect(400);
    await http().get(`${url}&decision=maybe`).set(admin).expect(400);

    // «اخفِ الربط»: rejected link keeps its concern and moves to the hidden list; «أبقِ الربط» clears it.
    const [hide, keep] = [links[0]!.id, links[1]!.id];
    await http().patch(`/v1/admin/sin-quotes/${hide}`).set(admin).send({ reviewStatus: 'REJECTED' }).expect(200);
    await http().patch(`/v1/admin/sin-quotes/${keep}`).set(admin).send({ reviewStatus: 'ACCEPTED', concern: null }).expect(200);
    const pending = (await http().get(`${url}&decision=pending`).set(admin).expect(200)).body;
    const hidden = (await http().get(`${url}&decision=hidden`).set(admin).expect(200)).body;
    expect(pending.meta.counts.sin).toBe(3);
    expect(hidden.data.map((r: { linkId: string }) => r.linkId)).toEqual([hide]);
    expect(hidden.meta.counts.sin).toBe(1);
    expect(pending.data.map((r: { linkId: string }) => r.linkId)).not.toContain(hide);
    expect(pending.data.map((r: { linkId: string }) => r.linkId)).not.toContain(keep);
  });

  it('GET /v1/admin/quotes/ledger: graded and unlinked counts per source in one call (admin only)', async () => {
    await http().get('/v1/admin/quotes/ledger').expect(401);
    const user = await userAuthHeaders(app);
    await http().get('/v1/admin/quotes/ledger').set(user).expect(403);
    const res = await http().get('/v1/admin/quotes/ledger').set(admin).expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const row of res.body.data) expect(row).toEqual({ sourceId: expect.any(String), graded: expect.any(Number), unlinked: expect.any(Number) });
    // Same numbers the per-source list requests give.
    const row = res.body.data[0] as { sourceId: string; graded: number; unlinked: number };
    const graded = await http().get(`/v1/admin/quotes?sourceId=${row.sourceId}&grades=SAHIH&grades=HASAN&grades=DAIF&limit=1`).set(admin).expect(200);
    const unlinked = await http().get(`/v1/admin/quotes?sourceId=${row.sourceId}&unlinkedOnly=true&limit=1`).set(admin).expect(200);
    expect(graded.body.meta.total).toBe(row.graded);
    expect(unlinked.body.meta.total).toBe(row.unlinked);
  });
});
