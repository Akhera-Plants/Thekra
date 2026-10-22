/**
 * Shared helper for e2e tests: creates and tears down a NestJS test application
 * wired to the thekra_test Postgres database (DATABASE_URL set by setup-e2e.ts).
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/config/configure-app.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
}

/**
 * Boots a full NestJS application backed by the test Postgres database.
 * Callers must call `closeTestApp(app)` in afterAll.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma };
}

/**
 * Gracefully shuts down the NestJS application (closes DB connections, etc.).
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}

/**
 * Phase 4: Logs in as the given user and returns a Bearer token header.
 *
 * Usage:
 *   const headers = await authHeaders(app, 'e2e-admin@thekra.test', 'password123456');
 *   request(app.getHttpServer()).post('/v1/admin/sins').set(headers).send({ ... })
 */
export async function authHeaders(
  app: INestApplication,
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const token: string = res.body.data.accessToken;
  return { Authorization: `Bearer ${token}` };
}

/**
 * Phase 4: Returns admin Bearer token headers for e2e tests.
 * Admin is seeded by seedTestFixtures as 'e2e-admin@thekra.test' / TEST_PASSWORD.
 */
export async function adminAuthHeaders(app: INestApplication): Promise<Record<string, string>> {
  return authHeaders(app, 'e2e-admin@thekra.test', 'password123456');
}

/**
 * Phase 4: Returns regular user Bearer token headers for e2e tests.
 */
export async function userAuthHeaders(app: INestApplication): Promise<Record<string, string>> {
  return authHeaders(app, 'e2e-user@thekra.test', 'password123456');
}

/**
 * D-1 legacy helper (kept for reference; now returns empty object since
 * AdminApiKeyGuard is no longer on admin routes).
 * @deprecated Use adminAuthHeaders() instead.
 */
export function adminHeaders(): Record<string, string> {
  return {};
}
