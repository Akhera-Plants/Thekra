/**
 * E2E spec for auth endpoints (phase 4).
 * Tests endpoints #19–#23: register, login, refresh, me, logout.
 *
 * Decisions verified:
 * - Unknown email and wrong password produce identical 401 INVALID_CREDENTIALS
 * - Register returns 409 EMAIL_ALREADY_REGISTERED on duplicate
 * - Refresh issues a new token pair (rotating refresh)
 * - /auth/me requires a valid access token
 * - 401 vs 403 distinction: 401 on missing token, 403 on wrong role
 */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedTestFixtures, TEST_PASSWORD } from './fixtures/seed-test-fixtures.js';
import { truncateAll } from './helpers/reset-db.js';
import { closeTestApp, createTestApp } from './helpers/test-app.js';

describe('Auth endpoints (e2e)', () => {
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

  // ── §1 Register ──────────────────────────────────────────────────────────

  describe('POST /v1/auth/register', () => {
    it('201 with tokens on valid input', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'securepassword123',
          displayName: 'New User',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        user: {
          email: 'newuser@example.com',
          displayName: 'New User',
          role: 'USER',
        },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
      // passwordHash must never appear in the response
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('normalises email to lowercase', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'UPPERCASE@EXAMPLE.COM', password: 'securepassword123' })
        .expect(201);
      expect(res.body.data.user.email).toBe('uppercase@example.com');
    });

    it('409 EMAIL_ALREADY_REGISTERED on duplicate email', async () => {
      // Register once
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'duplicate@example.com', password: 'securepassword123' })
        .expect(201);

      // Register again
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'duplicate@example.com', password: 'securepassword123' })
        .expect(409);

      expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('400 VALIDATION_FAILED when password too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'short@example.com', password: 'short' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('400 VALIDATION_FAILED when email missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ password: 'securepassword123' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  // ── §2 Login ─────────────────────────────────────────────────────────────

  describe('POST /v1/auth/login', () => {
    it('200 with tokens on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-user@thekra.test', password: TEST_PASSWORD })
        .expect(200);

      expect(res.body.data).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
    });

    it('401 INVALID_CREDENTIALS on wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-user@thekra.test', password: 'wrongpasswordhere' })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('401 INVALID_CREDENTIALS on unknown email (same code as wrong password)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'wrongpasswordhere' })
        .expect(401);
      // Must be identical code — timing oracle prevention
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  // ── §3 Refresh ────────────────────────────────────────────────────────────

  describe('POST /v1/auth/refresh', () => {
    it('200 with new token pair on valid refresh token (rotating)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-user@thekra.test', password: TEST_PASSWORD })
        .expect(200);

      const { refreshToken } = loginRes.body.data;

      const refreshRes = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshRes.body.data).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
    });

    it('401 INVALID_REFRESH_TOKEN on garbage token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'garbage.token.here' })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('401 INVALID_REFRESH_TOKEN when access token used as refresh token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-user@thekra.test', password: TEST_PASSWORD })
        .expect(200);
      const { accessToken } = loginRes.body.data;

      // Access token is signed with different secret → must fail
      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: accessToken })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  // ── §4 Me ─────────────────────────────────────────────────────────────────

  describe('GET /v1/auth/me', () => {
    it('200 with user info when authenticated', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-user@thekra.test', password: TEST_PASSWORD })
        .expect(200);
      const { accessToken } = loginRes.body.data;

      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        email: 'e2e-user@thekra.test',
        role: 'USER',
        favoriteCount: expect.any(Number),
      });
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('401 UNAUTHENTICATED without token', async () => {
      const res = await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('401 UNAUTHENTICATED with garbage token', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer garbage.token')
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  // ── §5 Logout ─────────────────────────────────────────────────────────────

  describe('POST /v1/auth/logout', () => {
    it('204 when authenticated', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-user@thekra.test', password: TEST_PASSWORD })
        .expect(200);
      const { accessToken } = loginRes.body.data;

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('401 UNAUTHENTICATED without token', async () => {
      const res = await request(app.getHttpServer()).post('/v1/auth/logout').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  // ── §6 Admin role check ───────────────────────────────────────────────────

  describe('Admin role: 401 vs 403 distinction', () => {
    it('401 UNAUTHENTICATED when no token on admin route', async () => {
      const res = await request(app.getHttpServer()).post('/v1/admin/sins').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('403 FORBIDDEN when USER role hits admin route', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-user@thekra.test', password: TEST_PASSWORD })
        .expect(200);
      const { accessToken } = loginRes.body.data;

      const res = await request(app.getHttpServer())
        .post('/v1/admin/sins')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test', nameAr: 'اختبار', slug: 'test-role-check' })
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('ADMIN user can access admin routes', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'e2e-admin@thekra.test', password: TEST_PASSWORD })
        .expect(200);
      const { accessToken } = loginRes.body.data;

      // POST /admin/sins with valid body should succeed (201 or 409 on existing slug)
      const res = await request(app.getHttpServer())
        .post('/v1/admin/sins')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Auth Test Sin',
          nameAr: 'خطيئة اختبار المصادقة',
          slug: 'auth-test-sin-role',
        });
      expect([201, 409]).toContain(res.status);
    });
  });
});
