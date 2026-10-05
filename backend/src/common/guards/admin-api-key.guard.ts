import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * D-1: Stop-gap admin guard until Phase 4 `RolesGuard` lands.
 *
 * Behaviour:
 *   - ADMIN_API_KEY is set  → require header `x-admin-key` to match; mismatch → 403.
 *   - ADMIN_API_KEY unset AND NODE_ENV === 'production' → always 403 (refuse unguarded prod traffic).
 *   - ADMIN_API_KEY unset AND not production → allow (local dev convenience).
 *
 * Apply with `@UseGuards(AdminApiKeyGuard)` on every admin controller class.
 * Remove in Phase 4 when `RolesGuard` is added.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = this.config.get<string>('ADMIN_API_KEY');

    if (!apiKey) {
      const nodeEnv = this.config.get<string>('NODE_ENV');
      if (nodeEnv === 'production') {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Admin access requires authentication in production. Set ADMIN_API_KEY.',
        });
      }
      // Local dev: allow without a key
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-admin-key'];

    if (header !== apiKey) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Invalid or missing x-admin-key header',
      });
    }

    return true;
  }
}
