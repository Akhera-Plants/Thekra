/**
 * Reading order of a topic's texts and «الميزان» (owner, 2026-11-01).
 *
 * The «النوافل وقيام الليل» page opened with al-Falaq 113:4: a CHAPTER_AYAH link (a verse the importer found inside a
 * hadith of a book chapter) with relevanceScore 90, above the chapter's own texts. A CHAPTER_AYAH verse now comes after
 * every other text of the list, whatever its score, and opens the page («الميزان») only when the topic has nothing
 * else. It stays listed (it is accepted) and counted, in the «الآيات» tab too.
 */

import { INestApplication } from '@nestjs/common';
import { GradeSource, HadithGrade, LinkBasis, LinkReviewStatus, QuoteType, SourceType } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

// Dev-seed texts (prisma/seed.ts).
const VERSE_62_9 = '00000000-0000-4000-8000-000000000006';
const VERSE_98_5 = '00000000-0000-4000-8000-000000000007';
const VERSE_2_261 = '00000000-0000-4000-8000-000000000008';
const MUSLIM_SAHIH = '00000000-0000-4000-8000-000000000012';
// Test-only: a sahih hadith outside the Sahihayn (the «other» band).
const OTHER_SAHIH = '00000000-0000-4000-8000-0000000000e1';
const OTHER_SOURCE = '10000000-0000-4000-8000-0000000000e1';

const AYAH_NOTE = 'أورده المنذري في باب: الترغيب في قيام الليل — صحيح الترغيب والترهيب';
const CHAPTER_NOTE = 'من باب: الترغيب في قيام الليل — صحيح الترغيب والترهيب';

interface ListItem {
  link: { band?: string; relevanceScore: number | null };
  quote: { id: string; type: string };
}

describe('Reading order and «الميزان» (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const server = () => app.getHttpServer();
  const ids = (body: { data: { items: ListItem[] } }) => body.data.items.map((item) => item.quote.id);

  async function deed(slug: string, links: Array<{ quoteId: string; basis: LinkBasis; relevanceScore: number }>) {
    const row = await prisma.goodDeed.create({ data: { slug, name: slug, nameAr: `عمل ${slug}` } });
    await prisma.goodDeedQuote.createMany({
      data: links.map((link) => ({
        goodDeedId: row.id,
        ...link,
        reviewStatus: LinkReviewStatus.ACCEPTED,
        note: link.basis === LinkBasis.CHAPTER_AYAH ? AYAH_NOTE : CHAPTER_NOTE,
      })),
    });
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();

    await prisma.source.create({
      data: { id: OTHER_SOURCE, name: 'Test Sunan', nameAr: 'سنن الاختبار', type: SourceType.HADITH_COLLECTION },
    });
    await prisma.quote.create({
      data: {
        id: OTHER_SAHIH,
        type: QuoteType.HADITH,
        textAr: 'حديث صحيح من خارج الصحيحين لاختبار ترتيب القراءة',
        sourceId: OTHER_SOURCE,
        grade: HadithGrade.SAHIH,
        gradeSource: GradeSource.MANUAL,
        hadithReference: 'TEST-READING-ORDER',
      },
    });

    // The «النوافل» case: the incidental verse has the higher score.
    await deed('test-nawafil', [
      { quoteId: VERSE_62_9, basis: LinkBasis.CHAPTER_AYAH, relevanceScore: 90 },
      { quoteId: OTHER_SAHIH, basis: LinkBasis.CHAPTER, relevanceScore: 50 },
    ]);
    // Every band, two CHAPTER_AYAH verses.
    await deed('test-reading-bands', [
      { quoteId: VERSE_62_9, basis: LinkBasis.CHAPTER_AYAH, relevanceScore: 95 },
      { quoteId: VERSE_98_5, basis: LinkBasis.CHAPTER_AYAH, relevanceScore: 90 },
      { quoteId: VERSE_2_261, basis: LinkBasis.REVIEWER_SECTION, relevanceScore: 40 },
      { quoteId: MUSLIM_SAHIH, basis: LinkBasis.TAKHRIJ, relevanceScore: 80 },
      { quoteId: OTHER_SAHIH, basis: LinkBasis.CHAPTER, relevanceScore: 50 },
    ]);
    // Nothing but a CHAPTER_AYAH verse.
    await deed('test-only-ayah', [{ quoteId: VERSE_62_9, basis: LinkBasis.CHAPTER_AYAH, relevanceScore: 90 }]);

    const sin = await prisma.sin.create({ data: { slug: 'test-reading-sin', name: 'Test sin', nameAr: 'معصية الاختبار' } });
    await prisma.sinQuote.createMany({
      data: [
        { sinId: sin.id, quoteId: VERSE_62_9, basis: LinkBasis.CHAPTER_AYAH, relevanceScore: 95, note: AYAH_NOTE, reviewStatus: LinkReviewStatus.ACCEPTED },
        { sinId: sin.id, quoteId: OTHER_SAHIH, basis: LinkBasis.CHAPTER, relevanceScore: 50, note: CHAPTER_NOTE, reviewStatus: LinkReviewStatus.ACCEPTED },
      ],
    });

    const branch = await prisma.imanBranch.create({ data: { number: 2, titleAr: 'شعبة ترتيب القراءة' } });
    await prisma.imanBranchQuote.createMany({
      data: [
        { imanBranchId: branch.id, quoteId: VERSE_62_9, basis: LinkBasis.CHAPTER_AYAH, relevanceScore: 95, note: AYAH_NOTE, reviewStatus: LinkReviewStatus.ACCEPTED },
        { imanBranchId: branch.id, quoteId: OTHER_SAHIH, basis: LinkBasis.CHAPTER, relevanceScore: 50, reviewStatus: LinkReviewStatus.ACCEPTED },
        { imanBranchId: branch.id, quoteId: MUSLIM_SAHIH, basis: LinkBasis.TAKHRIJ, relevanceScore: 50, reviewStatus: LinkReviewStatus.ACCEPTED },
      ],
    });
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('a CHAPTER_AYAH verse with a higher score still comes after a CHAPTER text, and does not open the page', async () => {
    const [detail, list] = await Promise.all([
      request(server()).get('/v1/good-deeds/test-nawafil').expect(200),
      request(server()).get('/v1/good-deeds/test-nawafil/quotes').expect(200),
    ]);
    expect(ids(list.body)).toEqual([OTHER_SAHIH, VERSE_62_9]);
    expect(detail.body.data.mizan).toMatchObject({ source: 'top', items: [{ id: OTHER_SAHIH }] });
  });

  it('keeps the verse listed and counted, in the «الآيات» tab too', async () => {
    const [verses, all] = await Promise.all([
      request(server()).get('/v1/good-deeds/test-nawafil/quotes?kind=verse').expect(200),
      request(server()).get('/v1/good-deeds/test-nawafil/quotes').expect(200),
    ]);
    expect(ids(verses.body)).toEqual([VERSE_62_9]);
    expect(all.body.meta.countsByKind).toMatchObject({ all: 2, verse: 1, hadith: 1 });
    expect(all.body.meta.total).toBe(2);
  });

  it('reads verses, Sahihayn, other texts, then CHAPTER_AYAH verses; bands only go up; «الميزان» is the first text', async () => {
    const [detail, list] = await Promise.all([
      request(server()).get('/v1/good-deeds/test-reading-bands').expect(200),
      request(server()).get('/v1/good-deeds/test-reading-bands/quotes').expect(200),
    ]);
    const items = list.body.data.items as ListItem[];
    expect(items.map((item) => item.quote.id)).toEqual([VERSE_2_261, MUSLIM_SAHIH, OTHER_SAHIH, VERSE_62_9, VERSE_98_5]);
    expect(items.map((item) => item.link.band)).toEqual(['ayah', 'sahihayn', 'other', 'other', 'other']);
    expect(list.body.meta.ordering).toBe('ayah,sahihayn,hadith,chapter-ayah');
    expect(detail.body.data.mizan.items.map((quote: { id: string }) => quote.id)).toEqual([items[0]!.quote.id]);
  });

  it('pages in the same order', async () => {
    const pages = await Promise.all([1, 2, 3].map((page) =>
      request(server()).get(`/v1/good-deeds/test-reading-bands/quotes?limit=2&page=${page}`).expect(200)));
    expect(pages.map((res) => ids(res.body))).toEqual([
      [VERSE_2_261, MUSLIM_SAHIH],
      [OTHER_SAHIH, VERSE_62_9],
      [VERSE_98_5],
    ]);
    expect(pages[2]!.body.meta.total).toBe(5);
  });

  it('opens with a CHAPTER_AYAH verse only when the topic has nothing else', async () => {
    const res = await request(server()).get('/v1/good-deeds/test-only-ayah').expect(200);
    expect(res.body.data.mizan).toMatchObject({ source: 'top', items: [{ id: VERSE_62_9 }] });
  });

  it('applies the same order to a sin page and its «الميزان»', async () => {
    const [detail, list] = await Promise.all([
      request(server()).get('/v1/sins/test-reading-sin').expect(200),
      request(server()).get('/v1/sins/test-reading-sin/quotes').expect(200),
    ]);
    expect(ids(list.body)).toEqual([OTHER_SAHIH, VERSE_62_9]);
    expect(detail.body.data.mizan).toMatchObject({ source: 'top', items: [{ id: OTHER_SAHIH }] });
  });

  it('applies the same order to a branch page and its «الميزان»', async () => {
    const [detail, list] = await Promise.all([
      request(server()).get('/v1/branches/2').expect(200),
      request(server()).get('/v1/branches/2/quotes').expect(200),
    ]);
    expect(ids(list.body)).toEqual([MUSLIM_SAHIH, OTHER_SAHIH, VERSE_62_9]);
    expect(list.body.meta).toMatchObject({
      total: 3,
      ordering: 'ayah,sahihayn,hadith,chapter-ayah',
      countsByType: { QURAN_VERSE: 1, HADITH: 2 },
    });
    expect(detail.body.data.mizan).toMatchObject({ source: 'top', items: [{ id: MUSLIM_SAHIH }] });
    const page2 = await request(server()).get('/v1/branches/2/quotes?limit=2&page=2').expect(200);
    expect(ids(page2.body)).toEqual([VERSE_62_9]);
  });
});
