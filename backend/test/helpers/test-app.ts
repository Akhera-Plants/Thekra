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
