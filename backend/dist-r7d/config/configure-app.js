import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const helmet = require('helmet');
import compression from 'compression';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor.js';
import { validationExceptionFactory } from '../common/validation/validation-exception.factory.js';
import { corsOriginRules } from './cors-origins.js';
export const JSON_BODY_LIMIT = '300kb';
export function parseTrustProxy(raw) {
    const value = raw?.trim();
    if (!value)
        return undefined;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    if (/^\d+$/.test(value))
        return Number(value);
    return value;
}
export function configureApp(app) {
    const config = app.get(ConfigService);
    const trustProxy = parseTrustProxy(config.get('TRUST_PROXY'));
    if (trustProxy !== undefined) {
        const instance = app.getHttpAdapter().getInstance();
        instance.set?.('trust proxy', trustProxy);
    }
    app.use(helmet({
        contentSecurityPolicy: config.get('NODE_ENV') === 'production'
            ? undefined
            : false,
    }));
    app.use(compression());
    app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
    app.useBodyParser('text', { type: 'text/plain', limit: '16kb' });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: validationExceptionFactory,
    }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.enableCors({
        origin: corsOriginRules(config.get('CORS_ORIGINS')),
        credentials: true,
    });
    app.enableShutdownHooks();
}
//# sourceMappingURL=configure-app.js.map