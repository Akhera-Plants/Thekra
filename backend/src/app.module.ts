import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.body.password',
          'req.body.refreshToken',
        ],
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id =
            typeof existing === 'string' && existing.length > 0
              ? existing
              : crypto.randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
      },
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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
