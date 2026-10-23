import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- helmet's
// exports map has no "types" condition, so Vercel's pnpm layout resolves
// index.d.cts as a CJS namespace with no call signature. Importing through
// createRequire bypasses TypeScript's module-resolution mismatch entirely:
// the runtime value is always the callable middleware function.
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';

const require = createRequire(import.meta.url);
const helmet = require('helmet') as (
  options?: Record<string, unknown>,
) => (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

import compression from 'compression';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor.js';
import { validationExceptionFactory } from '../common/validation/validation-exception.factory.js';
import { corsOriginRules } from './cors-origins.js';

/** TRUST_PROXY env → Express "trust proxy" value (hop count, boolean, or list). */
export function parseTrustProxy(raw: string | undefined): boolean | number | string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // The rate limiter keys on req.ip; behind a platform proxy it must come from
  // X-Forwarded-For, which Express only honours when "trust proxy" is set.
  const trustProxy = parseTrustProxy(config.get<string>('TRUST_PROXY'));
  if (trustProxy !== undefined) {
    const instance = app.getHttpAdapter().getInstance() as {
      set?: (key: string, value: unknown) => void;
    };
    instance.set?.('trust proxy', trustProxy);
  }

  // Phase 5: security headers via helmet
  app.use(
    helmet({
      // Allow inline scripts for health check pages in dev; strip in prod
      contentSecurityPolicy:
        config.get<string>('NODE_ENV') === 'production'
          ? undefined // use helmet defaults in production
          : false,   // disable CSP in development for easier debugging
    }),
  );

  // Phase 5: gzip/brotli response compression
  app.use(compression());

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  // Exact origins and single-`*` host patterns (Vercel previews); a bare `*`,
  // `null` or a malformed entry throws here, so a bad value fails the boot.
  // Rules: src/config/cors-origins.ts. Requests without Origin get no CORS headers.
  // The public site's own origins are built in (BUILT_IN_CORS_ORIGINS); CORS_ORIGINS adds to them.
  app.enableCors({
    origin: corsOriginRules(config.get<string>('CORS_ORIGINS')),
    credentials: true,
  });
  app.enableShutdownHooks();
}
