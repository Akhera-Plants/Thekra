/**
 * E2E spec for admin CRUD endpoints — endpoints #28–#47.
 *
 * Covers smoke + acceptance tests from the review:
 *   D-1   — AdminApiKeyGuard: no header → 403; correct header → 200; public routes unaffected
 *   P1-1  — translation PUT/POST/DELETE lifecycle; ar → 400; bad code → 400; duplicate POST → 409
 *   P1-4  — null in PATCH body → 400 VALIDATION_FAILED; oppositeSinId=null clears it; note=null clears it
 *   P2-4  — ValidQuoteShape: HADITH without grade → 400 naming the field
 *
 * Pattern: create → verify → patch → verify → delete → verify 404.
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

// From dev seed
const SRC_BUKHARI = '10000000-0000-4000-8000-000000000002';
const TAG_ANGER_ID = 'c0000000-0000-4000-8000-000000000001';
const SIN_GHIBAH_ID = 'a0000000-0000-4000-8000-000000000001';
const Q01 = '00000000-0000-4000-8000-000000000001'; // QURAN_VERSE with existing translation

describe('Admin content CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ════════════════════════════════════════════════════════════════
  // §0  D-1: AdminApiKeyGuard behaviour
  // ════════════════════════════════════════════════════════════════

  describe('AdminApiKeyGuard (D-1)', () => {
    it('GET /v1/admin/quotes without x-admin-key → 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/quotes')
        // no .set(adminHeaders()) — deliberately missing
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('GET /v1/admin/quotes with wrong x-admin-key → 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/quotes')
        .set('x-admin-key', 'wrong-key')
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('GET /v1/admin/quotes with correct x-admin-key → 200', async () => {
      await request(app.getHttpServer())
        .get('/v1/admin/quotes')
        .set(adminHeaders())
        .expect(200);
    });

    it('GET /v1/sins (public route) is unaffected by the guard → 200', async () => {
      await request(app.getHttpServer())
        .get('/v1/sins')
        .expect(200);
    });

    it('GET /health (public route) is unaffected by the guard → 200', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §1  SINS  (endpoints #36–#38)
  // ════════════════════════════════════════════════════════════════

  describe('Admin Sins', () => {
    let createdSinId: string;

    it('POST /v1/admin/sins → 201 with Location header', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/sins')
        .set(adminHeaders())
        .send({
          name: 'Test Admin Sin',
          nameAr: 'خطيئة اختبار الإدارة',
          slug: 'test-admin-sin',
          category: 'test',
          severity: 3,
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        name: 'Test Admin Sin',
        slug: 'test-admin-sin',
      });
      expect(res.headers['location']).toContain('/v1/admin/sins/');
      createdSinId = res.body.data.id as string;
    });

    it('POST /v1/admin/sins with duplicate slug → 409', async () => {
      await request(app.getHttpServer())
        .post('/v1/admin/sins')
        .set(adminHeaders())
        .send({
          name: 'Test Admin Sin Duplicate',
          nameAr: 'خطيئة اختبار مكررة',
          slug: 'test-admin-sin',
          severity: 1,
        })
        .expect(409);
    });

    it('PATCH /v1/admin/sins/:id → 200 updates the sin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/sins/${createdSinId}`)
        .set(adminHeaders())
        .send({ severity: 5 })
        .expect(200);
      expect(res.body.data.severity).toBe(5);
    });

    it('PATCH /v1/admin/sins/:id with null name → 400 VALIDATION_FAILED (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/sins/${createdSinId}`)
        .set(adminHeaders())
        .send({ name: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('PATCH /v1/admin/sins/:id with null nameAr → 400 VALIDATION_FAILED (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/sins/${createdSinId}`)
        .set(adminHeaders())
        .send({ nameAr: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('DELETE /v1/admin/sins/:id with no links → 204', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/sins/${createdSinId}`)
        .set(adminHeaders())
        .expect(204);
    });

    it('DELETE /v1/admin/sins/:id?force=false on linked sin → 409 SIN_HAS_LINKS (P0-1)', async () => {
      // ghibah has many quote links — must not delete with force=false
      const res = await request(app.getHttpServer())
        .delete(`/v1/admin/sins/${SIN_GHIBAH_ID}?force=false`)
        .set(adminHeaders())
        .expect(409);
      expect(res.body.error.code).toBe('SIN_HAS_LINKS');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §2  GOOD DEEDS  (endpoints #39–#41)
  // ════════════════════════════════════════════════════════════════

  describe('Admin Good Deeds', () => {
    let createdDeedId: string;
    let oppositeSinId: string;

    beforeAll(async () => {
      // Create a sin to use as oppositeSinId
      const sinRes = await request(app.getHttpServer())
        .post('/v1/admin/sins')
        .set(adminHeaders())
        .send({
          name: 'Opposite Sin For Test',
          nameAr: 'خطيئة مقابلة للاختبار',
          slug: 'opposite-sin-for-test',
        });
      oppositeSinId = sinRes.body.data.id as string;
    });

    it('POST /v1/admin/good-deeds → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/good-deeds')
        .set(adminHeaders())
        .send({
          name: 'Test Admin Deed',
          nameAr: 'عمل صالح اختبار',
          slug: 'test-admin-deed',
          category: 'test',
          oppositeSinId,
        })
        .expect(201);

      // Set ID before assertions so later tests can use it even if an assertion below fails
      createdDeedId = res.body.data.id as string;

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        name: 'Test Admin Deed',
        // oppositeSin is returned as an object with { id, slug, name, nameAr }, not oppositeSinId string
        oppositeSin: expect.objectContaining({ id: oppositeSinId }),
      });
    });

    it('PATCH /v1/admin/good-deeds/:id with oppositeSinId=null → 200 clears it (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/good-deeds/${createdDeedId}`)
        .set(adminHeaders())
        .send({ oppositeSinId: null })
        .expect(200);
      // oppositeSin becomes null when oppositeSinId is cleared
      expect(res.body.data.oppositeSin).toBeNull();
    });

    it('PATCH /v1/admin/good-deeds/:id with null name → 400 (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/good-deeds/${createdDeedId}`)
        .set(adminHeaders())
        .send({ name: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('DELETE /v1/admin/good-deeds/:id → 204', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/good-deeds/${createdDeedId}`)
        .set(adminHeaders())
        .expect(204);
    });

    afterAll(async () => {
      // Cleanup opposite sin
      await request(app.getHttpServer())
        .delete(`/v1/admin/sins/${oppositeSinId}`)
        .set(adminHeaders())
        .catch(() => undefined);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §3  QUOTES  (endpoints #28–#31)
  // ════════════════════════════════════════════════════════════════

  describe('Admin Quotes', () => {
    let createdQuoteId: string;

    it('POST /v1/admin/quotes → 201 for a SCHOLAR_QUOTE', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/quotes')
        .set(adminHeaders())
        .send({
          type: 'SCHOLAR_QUOTE',
          textAr: 'نص اقتباس الاختبار من العالم',
          sourceId: SRC_BUKHARI,
          author: 'Test Author',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        type: 'SCHOLAR_QUOTE',
      });
      expect(res.headers['location']).toContain('/v1/admin/quotes/');
      createdQuoteId = res.body.data.id as string;
    });

    it('POST /v1/admin/quotes with HADITH and no grade → 400 VALIDATION_FAILED (P2-4 ValidQuoteShape)', async () => {
      // P2-4: @ValidQuoteShape() on CreateQuoteDto triggers class-validator →
      // ValidationPipe → validationExceptionFactory → 400 BadRequestException.
      const res = await request(app.getHttpServer())
        .post('/v1/admin/quotes')
        .set(adminHeaders())
        .send({
          type: 'HADITH',
          textAr: 'نص حديث بدون درجة',
          sourceId: SRC_BUKHARI,
          // grade intentionally omitted → cross-field validation must reject
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      // The error details should mention the missing field
      const detailMsg = JSON.stringify(res.body.error.details ?? '');
      expect(detailMsg.toLowerCase()).toMatch(/grade/i);
    });

    it('GET /v1/admin/quotes → 200 with list (no grade filter)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/admin/quotes?limit=100')
        .set(adminHeaders())
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Admin must see all quotes regardless of grade
    });

    it('PATCH /v1/admin/quotes/:id → 200 updates author', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/quotes/${createdQuoteId}`)
        .set(adminHeaders())
        .send({ author: 'Updated Author' })
        .expect(200);
      // author is nested inside the `book` sub-object in the QuoteDto shape
      expect(res.body.data.book?.author).toBe('Updated Author');
    });

    it('PATCH /v1/admin/quotes/:id with null textAr → 400 (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/quotes/${createdQuoteId}`)
        .set(adminHeaders())
        .send({ textAr: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('DELETE /v1/admin/quotes/:id → 204', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/quotes/${createdQuoteId}`)
        .set(adminHeaders())
        .expect(204);
    });

    it('DELETE /v1/admin/quotes/:id again → 404', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/quotes/${createdQuoteId}`)
        .set(adminHeaders())
        .expect(404);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §4  TRANSLATIONS  (endpoints #32–#34) — P1-1
  // ════════════════════════════════════════════════════════════════

  describe('Admin Translations (P1-1)', () => {
    it('PUT /v1/admin/quotes/:id/translations/:lang → creates translation (200)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/admin/quotes/${Q01}/translations/fr`)
        .set(adminHeaders())
        .send({ text: 'Traduction de test en français' })
        .expect(200);

      // The ResponseEnvelopeInterceptor wraps the { id, languageCode, text } object in { data: {...} }
      expect(res.body.data).toMatchObject({
        languageCode: 'fr',
        text: 'Traduction de test en français',
      });
    });

    it('PUT /v1/admin/quotes/:id/translations/:lang → updates existing translation (200)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/admin/quotes/${Q01}/translations/fr`)
        .set(adminHeaders())
        .send({ text: 'Traduction mise à jour' })
        .expect(200);

      expect(res.body.data.text).toBe('Traduction mise à jour');
    });

    it('POST /v1/admin/quotes/:id/translations → 201 + Location header', async () => {
      // Use a new language code not yet added
      const res = await request(app.getHttpServer())
        .post(`/v1/admin/quotes/${Q01}/translations`)
        .set(adminHeaders())
        .send({ languageCode: 'de', text: 'Deutsche Testübersetzung' })
        .expect(201);

      // The ResponseEnvelopeInterceptor wraps the { id, languageCode, text } object in { data: {...} }
      expect(res.body.data).toMatchObject({
        languageCode: 'de',
        text: 'Deutsche Testübersetzung',
      });
      expect(res.headers['location']).toContain('/translations/de');
    });

    it('POST /v1/admin/quotes/:id/translations same lang → 409 conflict', async () => {
      // 'de' was just created above
      await request(app.getHttpServer())
        .post(`/v1/admin/quotes/${Q01}/translations`)
        .set(adminHeaders())
        .send({ languageCode: 'de', text: 'Duplicate translation' })
        .expect(409);
    });

    it('PUT /v1/admin/quotes/:id/translations/ar → 400 (Arabic reserved for textAr) (P1-1)', async () => {
      await request(app.getHttpServer())
        .put(`/v1/admin/quotes/${Q01}/translations/ar`)
        .set(adminHeaders())
        .send({ text: 'يجب أن يُرفض هذا' })
        .expect(400);
    });

    it('PUT /v1/admin/quotes/:id/translations/EN → 400 (invalid format — must be lowercase) (P1-1)', async () => {
      await request(app.getHttpServer())
        .put(`/v1/admin/quotes/${Q01}/translations/EN`)
        .set(adminHeaders())
        .send({ text: 'Bad language code format' })
        .expect(400);
    });

    it('PUT /v1/admin/quotes/:id/translations/fr with no text → 400', async () => {
      await request(app.getHttpServer())
        .put(`/v1/admin/quotes/${Q01}/translations/fr`)
        .set(adminHeaders())
        .send({})
        .expect(400);
    });

    it('DELETE /v1/admin/quotes/:id/translations/fr → 204', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/quotes/${Q01}/translations/fr`)
        .set(adminHeaders())
        .expect(204);
    });

    it('DELETE /v1/admin/quotes/:id/translations/fr again → 404', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/quotes/${Q01}/translations/fr`)
        .set(adminHeaders())
        .expect(404);
    });

    it('PUT /v1/admin/quotes/unknown-uuid/translations/en → 404', async () => {
      await request(app.getHttpServer())
        .put('/v1/admin/quotes/00000000-0000-4000-8000-000000000099/translations/en')
        .set(adminHeaders())
        .send({ text: 'some text' })
        .expect(404);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §5  TAGS  (endpoints #45–#47)
  // ════════════════════════════════════════════════════════════════

  describe('Admin Tags', () => {
    let createdTagId: string;

    it('POST /v1/admin/tags → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/tags')
        .set(adminHeaders())
        .send({
          name: 'Test Tag',
          nameAr: 'علامة اختبار',
          slug: 'test-tag',
          category: 'THEME',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        name: 'Test Tag',
        slug: 'test-tag',
      });
      expect(res.headers['location']).toContain('/v1/admin/tags/');
      createdTagId = res.body.data.id as string;
    });

    it('POST /v1/admin/tags with null name → 400 (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/tags')
        .set(adminHeaders())
        .send({
          name: null,
          nameAr: 'علامة اختبار',
          slug: 'test-tag-null',
          category: 'THEME',
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('PATCH /v1/admin/tags/:id → 200 updates the tag', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/tags/${createdTagId}`)
        .set(adminHeaders())
        .send({ name: 'Updated Tag Name' })
        .expect(200);
      expect(res.body.data.name).toBe('Updated Tag Name');
    });

    it('PATCH /v1/admin/tags/:id with null name → 400 (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/tags/${createdTagId}`)
        .set(adminHeaders())
        .send({ name: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('DELETE /v1/admin/tags/:id → 204', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/tags/${createdTagId}`)
        .set(adminHeaders())
        .expect(204);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §6  SOURCES  (endpoints #42–#44)
  // ════════════════════════════════════════════════════════════════

  describe('Admin Sources', () => {
    let createdSourceId: string;

    it('POST /v1/admin/sources → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/sources')
        .set(adminHeaders())
        .send({
          name: 'Test Source',
          nameAr: 'مصدر اختبار',
          type: 'HADITH_COLLECTION',
          isExternalApi: false,
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        name: 'Test Source',
        isExternalApi: false,
      });
      expect(res.headers['location']).toContain('/v1/admin/sources/');
      createdSourceId = res.body.data.id as string;
    });

    it('POST /v1/admin/sources with null name → 400 (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/admin/sources')
        .set(adminHeaders())
        .send({
          name: null,
          nameAr: 'مصدر',
          type: 'HADITH_COLLECTION',
        })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('PATCH /v1/admin/sources/:id → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/sources/${createdSourceId}`)
        .set(adminHeaders())
        .send({ name: 'Updated Source Name' })
        .expect(200);
      expect(res.body.data.name).toBe('Updated Source Name');
    });

    it('PATCH /v1/admin/sources/:id with null name → 400 (P1-4)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/sources/${createdSourceId}`)
        .set(adminHeaders())
        .send({ name: null })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('DELETE /v1/admin/sources/:id → 204', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/sources/${createdSourceId}`)
        .set(adminHeaders())
        .expect(204);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §7  Tag assignment (endpoint #35)
  // ════════════════════════════════════════════════════════════════

  describe('Admin Quote Tag Assignment', () => {
    it('PUT /v1/admin/quotes/:id/tags → 200 assigns tags', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/admin/quotes/${Q01}/tags`)
        .set(adminHeaders())
        .send({ tagIds: [TAG_ANGER_ID] })
        .expect(200);
      expect(res.body.data).toBeDefined();
    });

    it('PUT /v1/admin/quotes/:id/tags with duplicate tagIds → 400 (P2-5)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/admin/quotes/${Q01}/tags`)
        .set(adminHeaders())
        .send({ tagIds: [TAG_ANGER_ID, TAG_ANGER_ID] })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §8  note=null clears it (P1-4 — SinQuote and GoodDeedQuote)
  // ════════════════════════════════════════════════════════════════

  describe('Sin/GoodDeed link note=null clears (P1-4)', () => {
    let linkId: string;

    beforeAll(async () => {
      // Get the first sin-quote link id from the admin listing
      const res = await request(app.getHttpServer())
        .get('/v1/admin/sin-quotes?limit=1&sinId=' + SIN_GHIBAH_ID)
        .set(adminHeaders())
        .expect(200);
      if (res.body.data.length > 0) {
        linkId = res.body.data[0].id as string;
      }
    });

    it('PATCH /v1/admin/sin-quotes/:id with note=null → 200 clears note (P1-4)', async () => {
      if (!linkId) return; // skip if no link found
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/sin-quotes/${linkId}`)
        .set(adminHeaders())
        .send({ note: null })
        .expect(200);
      expect(res.body.data.note).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // §9  rawPayload never in admin responses
  // ════════════════════════════════════════════════════════════════

  it('GET /v1/admin/quotes never contains rawPayload', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/quotes')
      .set(adminHeaders())
      .expect(200);
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
  });
});
