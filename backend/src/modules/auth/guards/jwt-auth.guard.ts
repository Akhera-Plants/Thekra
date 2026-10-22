import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Requires a valid access token (Authorization: Bearer <token>).
 * Returns 401 UNAUTHENTICATED when missing or invalid.
 *
 * Not registered globally: opt-in per controller with @UseGuards(JwtAuthGuard).
 * (Guest-first product: endpoints 1-18 require no token.)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Valid access token required',
      });
    }
    return user;
  }
}
