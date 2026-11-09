import { CanActivate, ExecutionContext, Injectable, mixin, PayloadTooLargeException, Type } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Refuses a request whose JSON body is larger than `limit` bytes (413 PAYLOAD_TOO_LARGE), for small public write
 * routes that should never carry more than a few hundred bytes. The global parser limit (JSON_BODY_LIMIT) still
 * bounds what is parsed; this answers early and plainly. A body sent without Content-Length is measured.
 */
export function MaxBodyBytes(limit: number): Type<CanActivate> {
  @Injectable()
  class MaxBodyBytesGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest<Request>();
      const declared = Number(req.headers['content-length']);
      const size = Number.isFinite(declared) && declared >= 0
        ? declared
        : Buffer.byteLength(req.body === undefined ? '' : JSON.stringify(req.body), 'utf8');
      if (size > limit) {
        throw new PayloadTooLargeException({ code: 'PAYLOAD_TOO_LARGE', message: `The request body must be at most ${limit} bytes` });
      }
      return true;
    }
  }
  return mixin(MaxBodyBytesGuard);
}
