import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * JWT payload shape stored on `request.user` by JwtStrategy / OptionalJwtAuthGuard.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Parameter decorator that extracts the typed JWT payload from `request.user`.
 * Services never read `req.user` directly — they accept `@CurrentUser()` only.
 *
 * Usage:
 *   @Get('me')
 *   @UseGuards(JwtAuthGuard)
 *   me(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    return req.user;
  },
);
