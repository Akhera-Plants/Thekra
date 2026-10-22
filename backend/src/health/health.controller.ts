import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * P2-13: Read the application version once at module load time from the local
 * package.json.  `npm_package_version` is only injected by `npm run …` and is
 * undefined when the server is started via `node dist/main`.
 *
 * import.meta.dirname resolves to the directory of *this compiled file*, so
 * ../../package.json is always the project-root package.json regardless of
 * whether the code is run from `dist/` or `src/` (e.g. in tests via tsx).
 */
const APP_VERSION: string = (
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../../package.json'), 'utf-8'),
  ) as { version: string }
).version;

const startedAt = Date.now();

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  liveness() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      version: APP_VERSION,
    };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        checks: { database: 'up' },
      };
    } catch {
      // P2-13: 503 is intentional — k8s/Docker readiness probes check the HTTP
      // status code.  AllExceptionsFilter wraps the body in the error envelope,
      // placing { status, checks } in error.details exactly as §8 specifies.
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service not ready',
        details: { status: 'error', checks: { database: 'down' } },
      });
    }
  }
}
