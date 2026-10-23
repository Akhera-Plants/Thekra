import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * CDN caching for public, read-only GET routes.
 *
 * Opt-in per route with `@PublicCache(PUBLIC_CACHE.content)`. There is no global
 * default: a route without the decorator sends no Cache-Control from us, so a
 * new route is uncached until someone decides otherwise. The route-metadata test
 * (public-cache.routes.spec.ts) pins the exact list.
 *
 * Only a success is cached (an error is never given the header). A request that
 * carries an Authorization header or a cookie is answered `private, no-store`
 * even on a decorated route: optional-auth routes add per-user fields
 * (`isFavorite`) for those requests, and that response must not enter a shared cache.
 * `Vary: Authorization` is added besides, and `Vary: Origin` from the CORS
 * middleware is kept (Response.vary appends).
 */
export interface PublicCacheOptions {
  /** Seconds a shared cache (the CDN) may serve the response without asking us. */
  sMaxAge: number;
  /** Seconds a shared cache may serve it stale while it refreshes in the background. */
  staleWhileRevalidate: number;
  /** Browser max-age in seconds; omitted means the browser revalidates each time. */
  maxAge?: number;
}

/** Presets. A change made in the admin area or pushed with RELEASE_DB.md shows within s-maxage (+ one stale hit). */
export const PUBLIC_CACHE = {
  /** Topic catalogues, topic quote pages, branches, theme labels, quran/hadith lookups. */
  content: { sMaxAge: 300, staleWhileRevalidate: 3600 },
  /** One text and its explanations: a flag or admin edit can hide it, so a shorter window. */
  quote: { sMaxAge: 120, staleWhileRevalidate: 600 },
  /** Source catalogue: edited rarely. */
  reference: { sMaxAge: 600, staleWhileRevalidate: 3600 },
  /** Text of the day: it changes at 00:00 UTC, so almost no stale window. */
  daily: { sMaxAge: 300, staleWhileRevalidate: 60 },
  /** Free-text search: many distinct URLs, short window. */
  search: { sMaxAge: 60, staleWhileRevalidate: 60, maxAge: 30 },
} as const satisfies Record<string, PublicCacheOptions>;

export const PUBLIC_CACHE_METADATA = 'thekra:public-cache';

export function publicCacheHeader(options: PublicCacheOptions): string {
  return [
    'public',
    ...(options.maxAge !== undefined ? [`max-age=${options.maxAge}`] : []),
    `s-maxage=${options.sMaxAge}`,
    `stale-while-revalidate=${options.staleWhileRevalidate}`,
  ].join(', ');
}

export const PRIVATE_CACHE_HEADER = 'private, no-store';

/** True when the request identifies a user, so the response may differ from the anonymous one. */
export function isPersonalRequest(headers: Request['headers']): boolean {
  return Boolean(headers['authorization'] || headers['cookie']);
}

@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = Reflect.getMetadata(PUBLIC_CACHE_METADATA, context.getHandler()) as PublicCacheOptions | undefined;
    if (!options) return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        res.vary('Authorization');
        res.setHeader('Cache-Control', isPersonalRequest(req.headers) ? PRIVATE_CACHE_HEADER : publicCacheHeader(options));
      }),
    );
  }
}

/** Marks one public GET route as CDN-cacheable. Never put it on an authenticated or admin route. */
export function PublicCache(options: PublicCacheOptions): MethodDecorator {
  return applyDecorators(SetMetadata(PUBLIC_CACHE_METADATA, options), UseInterceptors(PublicCacheInterceptor));
}
