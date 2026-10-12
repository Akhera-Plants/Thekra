/**
 * Public branches of faith, grade attribution, and chapter maps.
 *
 * A narration appears on a branch only after the link is ACCEPTED, and only
 * when the grade policy allows it. DAIF and UNGRADED stay hidden by default.
 * MAWDU is never served. A chapter map stores one reviewed target and does
 * not create quote links by itself.
 */

import { INestApplication } from '@nestjs/common';
import { ExplanationKind, GradeSource, HadithGrade, LinkReviewStatus, QuoteType } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { QF_MAWDU, QF_UNGRADED, seedTestFixtures } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { adminAuthHeaders, closeTestApp, createTestApp } from './helpers/test-app.js';

const Q09 = '00000000-0000-4000-8000-000000000009';
const Q_DAIF = '00000000-0000-4000-8000-0000000000f4';

describe('Branches of faith (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let branchId: string;
  let sourceId: string;
  let sinId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await truncateAll(prisma);
    await seedTestFixtures();

    const source = await prisma.source.findFirstOrThrow();
    sourceId = source.id;
    const sin = await prisma.sin.findUniqueOrThrow({ where: { slug: 'ghibah' } });
    sinId = sin.id;

    const branch = await prisma.imanBranch.create({
      data: {
        number: 1,
        titleAr: 'شعبة الاختبار',
        summaryAr: 'خلاصة من نص البيهقي',
      },
    });
    branchId = branch.id;

    await prisma.quote.update({
      where: { id: Q09 },
      data: {
        gradeAuthority: 'الألباني',
        gradeReference: 'صحيح الترغيب 2831',
        volume: '1',
        page: '2831',
      },
    });

    await prisma.quote.create({
      data: {
        id: Q_DAIF,
        type: QuoteType.HADITH,
        textAr: 'حديث ضعيف لأغراض الاختبار فقط',
        sourceId,
        grade: HadithGrade.DAIF,
        gradeSource: GradeSource.MANUAL,
        hadithReference: 'TEST-DAIF',
      },
    });

    await prisma.imanBranchQuote.create({
      data: {
        imanBranchId: branchId,
        quoteId: Q09,
        note: 'باب تحريم الغيبة',
        reviewStatus: LinkReviewStatus.NOT_REVIEWED,
      },
    });
    await prisma.imanBranchQuote.create({
      data: {
        imanBranchId: branchId,
        quoteId: Q_DAIF,
        reviewStatus: LinkReviewStatus.ACCEPTED,
      },
    });
    await prisma.imanBranchQuote.create({
      data: {
        imanBranchId: branchId,
        quoteId: QF_UNGRADED,
        reviewStatus: LinkReviewStatus.ACCEPTED,
      },
    });

    await prisma.explanation.create({
      data: {
        kind: ExplanationKind.SHARH,
        quoteId: Q09,
        text: 'شرح ظاهر',
        sourceId,
        rawPayload: { secret: true },
      },
    });
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('GET /v1/branches → 200 with the entered branch and no invented titles', async () => {
    const res = await request(app.getHttpServer()).get('/v1/branches').expect(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        number: 1,
        titleAr: 'شعبة الاختبار',
        quoteCount: 0,
      }),
    ]);
  });

  it('GET /v1/branches/1 hides unreviewed and weak narrations', async () => {
    const res = await request(app.getHttpServer()).get('/v1/branches/1/quotes').expect(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.meta.appliedGrades).toEqual(['SAHIH', 'HASAN']);
  });

  it('GET /v1/branches/1/quotes?grades=MAWDU → 422', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/branches/1/quotes?grades=MAWDU')
      .expect(422);
    expect(res.body.error.code).toBe('GRADE_NOT_PERMITTED');
  });

  it('an accepted sahih link is public and keeps the chapter note', async () => {
    await prisma.imanBranchQuote.update({
      where: { imanBranchId_quoteId: { imanBranchId: branchId, quoteId: Q09 } },
      data: { reviewStatus: LinkReviewStatus.ACCEPTED },
    });

    const res = await request(app.getHttpServer()).get('/v1/branches/1/quotes').expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].link.note).toBe('باب تحريم الغيبة');
    expect(res.body.data.items[0].quote.id).toBe(Q09);
    expect(res.body.data.items[0].quote.citation).toMatchObject({
      gradeAuthority: 'الألباني',
      gradeReference: 'صحيح الترغيب 2831',
      volume: '1',
      page: '2831',
    });
  });

  it('includeWeak shows the accepted weak narration and still hides MAWDU', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/branches/1/quotes?includeWeak=true&limit=20')
      .expect(200);
    const ids = res.body.data.items.map((item: { quote: { id: string } }) => item.quote.id);
    expect(ids).toContain(Q09);
    expect(ids).toContain(Q_DAIF);
    expect(ids).toContain(QF_UNGRADED);
    expect(ids).not.toContain(QF_MAWDU);
  });

  it('GET /v1/branches/1 returns the summary and omits severity on related sins', async () => {
    await prisma.imanBranchSin.create({
      data: { imanBranchId: branchId, sinId },
    });
    const res = await request(app.getHttpServer()).get('/v1/branches/1').expect(200);
    expect(res.body.data.summaryAr).toBe('خلاصة من نص البيهقي');
    expect(res.body.data.sins[0]).toMatchObject({ slug: 'ghibah', rank: null });
    expect(res.body.data.sins[0]).not.toHaveProperty('severity');
  });

  it('GET /v1/branches/nope → 400 and an unknown number → 404', async () => {
    await request(app.getHttpServer()).get('/v1/branches/nope').expect(400);
    const missing = await request(app.getHttpServer()).get('/v1/branches/77').expect(404);
    expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('GET /v1/quotes/:id/explanations hides raw payload and 404s a fabricated hadith', async () => {
    const res = await request(app.getHttpServer()).get(`/v1/quotes/${Q09}/explanations`).expect(200);
    expect(res.body.data[0].text).toBe('شرح ظاهر');
    expect(JSON.stringify(res.body)).not.toContain('rawPayload');
    expect(JSON.stringify(res.body)).not.toContain('secret');

    const missing = await request(app.getHttpServer())
      .get(`/v1/quotes/${QF_MAWDU}/explanations`)
      .expect(404);
    expect(missing.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('admin chapter map stores one target and refuses two', async () => {
    const headers = await adminAuthHeaders(app);
    const bad = await request(app.getHttpServer())
      .post('/v1/admin/chapter-maps')
      .set(headers)
      .send({
        sourceId,
        chapterKey: 'bab-1',
        chapterTitleAr: 'باب تحريم الغيبة',
        targetType: 'SIN',
        sinId,
        imanBranchId: branchId,
      })
      .expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');

    const created = await request(app.getHttpServer())
      .post('/v1/admin/chapter-maps')
      .set(headers)
      .send({
        sourceId,
        chapterKey: 'bab-1',
        chapterTitleAr: 'باب تحريم الغيبة',
        targetType: 'SIN',
        sinId,
      })
      .expect(201);
    expect(created.body.data.reviewed).toBe(false);
    expect(await prisma.imanBranchQuote.count({ where: { note: 'باب تحريم الغيبة' } })).toBe(1);
  });

  it('admin cannot create a second branch with the same number', async () => {
    const headers = await adminAuthHeaders(app);
    const res = await request(app.getHttpServer())
      .post('/v1/admin/branches')
      .set(headers)
      .send({ number: 1, titleAr: 'مكرر' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});
