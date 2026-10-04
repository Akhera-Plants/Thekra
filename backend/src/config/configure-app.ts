import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
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
