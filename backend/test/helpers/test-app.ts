/**
 * Shared helper for e2e tests: creates and tears down a NestJS test application
 * wired to the thekra_test Postgres database (DATABASE_URL set by setup-e2e.ts).
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/config/configure-app.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/**
 * D-1: Returns headers required to authenticate admin requests in e2e tests.
 *
 * When ADMIN_API_KEY is set in the test environment (.env.test sets it to
 * `test-admin-key`), every request to /admin/* must include this header.
 * Passing these headers to supertest's `.set()` satisfies the AdminApiKeyGuard.
 *
 * Usage:
 *   request(app.getHttpServer())
 *     .post('/v1/admin/sins')
 *     .set(adminHeaders())
 *     .send({ ... })
 */
export function adminHeaders(): Record<string, string> {
  const key = process.env['ADMIN_API_KEY'];
  return key ? { 'x-admin-key': key } : {};
}

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
