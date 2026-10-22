import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT guard: a valid token enriches the response (e.g. isFavorite),
 * but a missing or invalid token degrades gracefully to anonymous (no 401).
 *
 * Used on endpoints 3, 7, 8, 9 per §7.2:
 *   "a malformed/expired token must degrade to anonymous, not 401"
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleRequest<T>(_err: any, user: T): T {
    // Swallow all auth errors — return undefined (anonymous) instead of throwing.
    return user;
  }
}
