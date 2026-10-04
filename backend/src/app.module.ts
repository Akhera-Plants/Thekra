import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { ClassificationModule } from './modules/classification/classification.module.js';
import { GoodDeedsModule } from './modules/good-deeds/good-deeds.module.js';
import { HadithModule } from './modules/hadith/hadith.module.js';
import { QuranModule } from './modules/quran/quran.module.js';
import { QuotesModule } from './modules/quotes/quotes.module.js';
import { SinsModule } from './modules/sins/sins.module.js';
import { SourcesModule } from './modules/sources/sources.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
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
    HadithModule,
    QuranModule,
    QuotesModule,
    SourcesModule,
    TagsModule,
    GoodDeedsModule,
    SinsModule,
    ClassificationModule,
  ],
})
export class AppModule {}
