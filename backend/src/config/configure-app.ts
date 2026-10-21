import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor.js';
import { validationExceptionFactory } from '../common/validation/validation-exception.factory.js';

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
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.enableShutdownHooks();
}
