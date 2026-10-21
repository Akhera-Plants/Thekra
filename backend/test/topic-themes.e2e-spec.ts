/**
 * E2E: topic themes (prisma/taxonomy/topic-themes.yaml).
 *
 * ghibah ↔ hifz-al-lisan is a taxonomy pair, so one page shows the themes of
 * both. The import writes themeKeys; here the test tags a few seeded links
 * directly so the reader rules, merging, kind filter and counts can be checked.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

interface Item {
  link: { id: string };
  quote: { id: string; type: string; isAthar?: boolean };
}

describe('Topic themes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sinTagged: Item[] = [];
  let deedTagged: Item[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
    const deed = await prisma.goodDeed.findUniqueOrThrow({ where: { slug: 'hifz-al-lisan' } });
    // The taxonomy import sets both directions of a pair; the dev seed only sets the deed's.
    await prisma.sin.update({ where: { slug: 'ghibah' }, data: { oppositeGoodDeedId: deed.id } });

    const sinPage = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=50').expect(200);
    sinTagged = (sinPage.body.data.items as Item[]).slice(0, 2);
    for (const item of sinTagged) {
      await prisma.sinQuote.update({ where: { id: item.link.id }, data: { themeKeys: ['ghibah-tahrim'] } });
    }
    const deedPage = await request(app.getHttpServer()).get('/v1/good-deeds/hifz-al-lisan/quotes?limit=50').expect(200);
    deedTagged = (deedPage.body.data.items as Item[]).slice(0, 1);
    for (const item of deedTagged) {
      await prisma.goodDeedQuote.update({ where: { id: item.link.id }, data: { themeKeys: ['lisan-samt'] } });
    }
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('seeds enough texts for the checks', () => {
    expect(sinTagged).toHaveLength(2);
    expect(deedTagged).toHaveLength(1);
  });

  it('GET /v1/sins/ghibah/quotes lists the page themes (sin first, then the paired deed) with counts', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=50').expect(200);
    const themes = res.body.meta.themes as { key: string; ar: string; en: string; count: number }[];
    expect(res.body.meta.theme).toBeNull();
    const keys = themes.map((theme) => theme.key);
    expect(keys.indexOf('ghibah-tahrim')).toBeLessThan(keys.indexOf('lisan-samt'));
    expect(themes.find((theme) => theme.key === 'ghibah-tahrim')).toMatchObject({ ar: 'تحريم الغيبة', count: 2 });
    expect(themes.find((theme) => theme.key === 'lisan-samt')?.count).toBe(1);
    expect(themes.find((theme) => theme.key === 'ghibah-mubah')?.count).toBe(0);
    // The untouched reader payload stays as before.
    expect(res.body.meta.countsByKind).toBeDefined();
    expect(res.body.data.companion).toBeDefined();
  });

  it('?theme= filters the page to the tagged texts and reports the theme', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=50&theme=ghibah-tahrim').expect(200);
    const ids = (res.body.data.items as Item[]).map((item) => item.quote.id).sort();
    expect(ids).toEqual(sinTagged.map((item) => item.quote.id).sort());
    expect(res.body.meta.theme).toBe('ghibah-tahrim');
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.companion.items).toEqual([]);
    expect(res.body.meta.countsByKind.all).toBe(2);
    // meta.themes is the whole page, not the filtered list.
    expect(res.body.meta.themes.find((theme: { key: string }) => theme.key === 'lisan-samt').count).toBe(1);
  });

  it('a paired deed theme opens on the sin page from the deed side', async () => {
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=50&theme=lisan-samt').expect(200);
    expect((res.body.data.items as Item[]).map((item) => item.quote.id)).toEqual(deedTagged.map((item) => item.quote.id));
    expect(res.body.meta.theme).toBe('lisan-samt');
  });

  it('theme combines with kind; countsByKind stays the theme count across tabs', async () => {
    const kind = sinTagged[0]?.quote.type === 'QURAN_VERSE' ? 'verse' : 'hadith';
    const res = await request(app.getHttpServer())
      .get(`/v1/sins/ghibah/quotes?limit=50&theme=ghibah-tahrim&kind=${kind}`)
      .expect(200);
    const expected = sinTagged.filter((item) => (kind === 'verse' ? item.quote.type === 'QURAN_VERSE' : item.quote.type === 'HADITH' && !item.quote.isAthar));
    expect(res.body.meta.total).toBe(expected.length);
    expect(res.body.meta.countsByKind.all).toBe(2);
  });

  it('GET /v1/good-deeds/hifz-al-lisan/quotes?theme= reaches the paired sin texts', async () => {
    const res = await request(app.getHttpServer()).get('/v1/good-deeds/hifz-al-lisan/quotes?limit=50&theme=ghibah-tahrim').expect(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.meta.themes[0].key).toBe('lisan-samt');
  });

  it('a key that is not a theme of the page is ignored', async () => {
    const base = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=50').expect(200);
    const res = await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?limit=50&theme=tark-jumua').expect(200);
    expect(res.body.meta.theme).toBeNull();
    expect(res.body.meta.total).toBe(base.body.meta.total);
  });

  it('a malformed theme key is a validation error', async () => {
    await request(app.getHttpServer()).get('/v1/sins/ghibah/quotes?theme=%3Cscript%3E').expect(400);
  });

  it('GET /v1/topic-themes returns the search index with both pages of a pair', async () => {
    const res = await request(app.getHttpServer()).get('/v1/topic-themes').expect(200);
    const entry = (res.body.data as { key: string; terms: string[] }[]).find((row) => row.key === 'ghibah-tahrim');
    expect(entry).toMatchObject({
      ar: 'تحريم الغيبة',
      topic: { slug: 'ghibah', side: 'AVOID' },
      pages: { sins: 'ghibah', goodDeeds: 'hifz-al-lisan' },
    });
    expect(entry?.terms.length).toBeGreaterThan(0);
    // Topics that are not in the database (most of the taxonomy in the test seed) are left out.
    expect((res.body.data as { topic: { slug: string } }[]).every((row) => row.topic.slug.length > 0)).toBe(true);
  });
});
