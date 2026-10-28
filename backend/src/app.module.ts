import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import type { IncomingMessage } from 'node:http';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { ClassificationModule } from './modules/classification/classification.module.js';
import { GoodDeedsModule } from './modules/good-deeds/good-deeds.module.js';
import { HadithModule } from './modules/hadith/hadith.module.js';
import { ImanBranchesModule } from './modules/iman-branches/iman-branches.module.js';
import { QuranModule } from './modules/quran/quran.module.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';
import { ReviewModule } from './modules/review/review.module.js';
import { SinsModule } from './modules/sins/sins.module.js';
import { SourcesModule } from './modules/sources/sources.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { FavoritesModule } from './modules/favorites/favorites.module.js';
import { PracticeModule } from './modules/practice/practice.module.js';
import { ContentSyncModule } from './modules/content-sync/content-sync.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/**
 * P2-12: Only echo back an inbound x-request-id that is safe (alphanumeric +
 * dot/underscore/hyphen, ≤128 chars).  Anything else → generate a fresh UUID.
 * This prevents log-injection and avoids echoing arbitrary client data in every
 * log line.
 */
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Global default 120 req/min per client IP, enforced by the APP_GUARD below.
    // Stricter @Throttle() overrides sit on /auth/* and the public mistake report.
    // Under NODE_ENV=test throttling is skipped (suites log in far more often
    // than a real client) unless a spec opts in with THROTTLE_IN_TEST=true.
    // It is never skipped in development or production.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isTest = config.get<string>('NODE_ENV') === 'test';
        return {
          throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
          skipIf: () => isTest && process.env['THROTTLE_IN_TEST'] !== 'true',
        };
      },
    }),
    // Phase 5: scheduler for content-sync cron jobs.
    // Only fires when SYNC_ENABLED=true; local/CI remain unaffected.
    ScheduleModule.forRoot(),
    // Phase 5: in-memory response cache with 60-second TTL.
    // Used by SinsController (list) and QuotesController (search).
    CacheModule.register({ ttl: 60_000, isGlobal: true }),
    // P2-11: forRootAsync so all logger config comes from the validated
    // ConfigService instead of process.env.  pino-pretty is loaded ONLY in
    // development mode so the devDependency can never be reached in production.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          transport:
            config.get<string>('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.refreshToken',
          ],
          // P2-12: validate inbound request-id; generate UUID when absent/unsafe.
          genReqId: (req: IncomingMessage, res: { setHeader: (k: string, v: string) => void }) => {
            const existing = req.headers['x-request-id'];
            const id =
              typeof existing === 'string' && REQUEST_ID_RE.test(existing)
                ? existing
                : crypto.randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          // P2-13: exclude health-check probes from auto-logging so they don't
          // flood logs in production.
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url?.startsWith('/health') ?? false,
          },
        },
      }),
    }),
    PrismaModule,
    HealthModule,
    // Phase 4 modules (§1.12 import order)
    AuthModule,
    UsersModule,
    FavoritesModule,
    // Core content modules
    QuotesModule,
    ReviewModule,
    SourcesModule,
    TagsModule,
    TaxonomyModule,
    GoodDeedsModule,
    SinsModule,
    ImanBranchesModule,
    // Reminders, habit plans, the occasion calendar and the practice store sync
    PracticeModule,
    HadithModule,
    QuranModule,
    ClassificationModule,
    // Phase 5: content-sync pipeline
    ContentSyncModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
