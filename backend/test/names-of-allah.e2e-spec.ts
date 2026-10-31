/**
 * «الأسماء الحسنى» (redesign §4.7): GET /v1/names-of-allah and /v1/names-of-allah/:slug.
 *
 * The list comes from names-of-allah.yaml. A name page serves its primary verse by the yaml quoteId under the reader
 * gate, and up to 10 more published verses whose normalized text contains the word (with or without «ال»), ordered by
 * surah/ayah, never the primary verse. The verse rows below are test placeholders, not Quran text.
 */

import { INestApplication } from '@nestjs/common';
import { QuoteType, TextSource } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

/** at-tawwab's primary verse id in names-of-allah.yaml. */
const PRIMARY = 'c0939c6a-7964-4ad1-b161-fd680f67c736';
const V_BARE = '00000000-0000-4000-8000-0000000000a1';
const V_WITH_AL = '00000000-0000-4000-8000-0000000000a2';
const V_PLURAL = '00000000-0000-4000-8000-0000000000a3';
const V_OCR = '00000000-0000-4000-8000-0000000000a4';

describe('Names of Allah (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    const { id: sourceId } = await prisma.source.findFirstOrThrow();
    const verse = (id: string, surahNumber: number, ayahNumber: number, textAr: string, textSource: TextSource = TextSource.DIGITAL) => ({
      id,
      type: QuoteType.QURAN_VERSE,
      textAr,
      surahNumber,
      ayahNumber,
      textSource,
      sourceId,
    });
    await prisma.quote.createMany({
      data: [
        verse(PRIMARY, 2, 37, 'نَصُّ اخْتِبَارٍ فِيهِ ٱلتَّوَّابُ'),
        // Out of surah order on purpose: the API orders by surah/ayah.
        verse(V_WITH_AL, 110, 3, 'نص اختبار فيه والتواب'),
        verse(V_BARE, 4, 16, 'نص اختبار فيه كلمة تواب وحدها'),
        verse(V_PLURAL, 2, 222, 'نص اختبار يحب التوابين'),
        verse(V_OCR, 3, 1, 'نص اختبار التواب', TextSource.OCR),
      ],
    });
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /v1/names-of-allah → the 77 names in file order, CDN-cacheable', async () => {
    const res = await request(app.getHttpServer()).get('/v1/names-of-allah').expect(200);
    expect(res.headers['cache-control']).toContain('s-maxage=');
    expect(res.body.data).toHaveLength(77);
    expect(res.body.data[0]).toEqual({ number: 1, slug: 'allah', nameAr: 'الله', ref: '59:22' });
    expect(res.body.data.find((n: { slug: string }) => n.slug === 'at-tawwab')).toMatchObject({ nameAr: 'التواب', ref: '2:37' });
  });

  it('GET /v1/names-of-allah/at-tawwab → verse, meaning, links and other published verses', async () => {
    const res = await request(app.getHttpServer()).get('/v1/names-of-allah/at-tawwab').expect(200);
    const data = res.body.data;
    expect(data).toMatchObject({
      slug: 'at-tawwab',
      nameAr: 'التواب',
      ref: '2:37',
      review: 'pending-sheikh',
      meaningAr: expect.any(String),
      meaningEn: expect.any(String),
    });
    expect(data.verse).toMatchObject({ id: PRIMARY, type: 'QURAN_VERSE' });
    expect(data.verse).not.toHaveProperty('rawPayload');
    expect(data.links).toEqual([
      { kind: 'deed', slug: 'tawba', nameAr: expect.any(String), name: expect.any(String) },
      { kind: 'action', slug: 'leave-sin', nameAr: 'تخفَّف', name: 'Lighten' },
    ]);
    // Whole word with or without «ال», by surah/ayah; not the plural, not the OCR row, not the primary verse.
    expect(data.otherVerses.map((q: { id: string }) => q.id)).toEqual([V_BARE, V_WITH_AL]);
    expect(data.prev).toMatchObject({ slug: expect.any(String) });
    expect(data.next).toMatchObject({ slug: expect.any(String) });
  });

  it('a name whose verse is not in this database still answers, with verse null', async () => {
    const res = await request(app.getHttpServer()).get('/v1/names-of-allah/al-majid?lang=en').expect(200);
    expect(res.body.data).toMatchObject({ slug: 'al-majid', verse: null, next: null });
  });

  it('GET /v1/names-of-allah/unknown → 404', async () => {
    const res = await request(app.getHttpServer()).get('/v1/names-of-allah/no-such-name').expect(404);
    expect(res.headers['cache-control'] ?? '').not.toContain('s-maxage');
  });

  it('rejects an unknown lang', async () => {
    await request(app.getHttpServer()).get('/v1/names-of-allah/allah?lang=fr').expect(400);
  });
});
