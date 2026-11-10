var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { applyDecorators, Injectable, SetMetadata, UseInterceptors, } from '@nestjs/common';
import { tap } from 'rxjs';
export const PUBLIC_CACHE = {
    content: { sMaxAge: 300, staleWhileRevalidate: 3600 },
    quote: { sMaxAge: 120, staleWhileRevalidate: 600 },
    reference: { sMaxAge: 600, staleWhileRevalidate: 3600 },
    daily: { sMaxAge: 300, staleWhileRevalidate: 60 },
    search: { sMaxAge: 60, staleWhileRevalidate: 60, maxAge: 30 },
};
export const PUBLIC_CACHE_METADATA = 'thekra:public-cache';
export function publicCacheHeader(options) {
    return [
        'public',
        ...(options.maxAge !== undefined ? [`max-age=${options.maxAge}`] : []),
        `s-maxage=${options.sMaxAge}`,
        `stale-while-revalidate=${options.staleWhileRevalidate}`,
    ].join(', ');
}
export const PRIVATE_CACHE_HEADER = 'private, no-store';
export function isPersonalRequest(headers) {
    return Boolean(headers['authorization'] || headers['cookie']);
}
let PublicCacheInterceptor = class PublicCacheInterceptor {
    intercept(context, next) {
        const options = Reflect.getMetadata(PUBLIC_CACHE_METADATA, context.getHandler());
        if (!options)
            return next.handle();
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        return next.handle().pipe(tap(() => {
            res.vary('Authorization');
            res.setHeader('Cache-Control', isPersonalRequest(req.headers) ? PRIVATE_CACHE_HEADER : publicCacheHeader(options));
        }));
    }
};
PublicCacheInterceptor = __decorate([
    Injectable()
], PublicCacheInterceptor);
export { PublicCacheInterceptor };
export function PublicCache(options) {
    return applyDecorators(SetMetadata(PUBLIC_CACHE_METADATA, options), UseInterceptors(PublicCacheInterceptor));
}
//# sourceMappingURL=public-cache.js.map