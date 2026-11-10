import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
export interface PublicCacheOptions {
    sMaxAge: number;
    staleWhileRevalidate: number;
    maxAge?: number;
}
export declare const PUBLIC_CACHE: {
    readonly content: {
        readonly sMaxAge: 300;
        readonly staleWhileRevalidate: 3600;
    };
    readonly quote: {
        readonly sMaxAge: 120;
        readonly staleWhileRevalidate: 600;
    };
    readonly reference: {
        readonly sMaxAge: 600;
        readonly staleWhileRevalidate: 3600;
    };
    readonly daily: {
        readonly sMaxAge: 300;
        readonly staleWhileRevalidate: 60;
    };
    readonly search: {
        readonly sMaxAge: 60;
        readonly staleWhileRevalidate: 60;
        readonly maxAge: 30;
    };
};
export declare const PUBLIC_CACHE_METADATA = "thekra:public-cache";
export declare function publicCacheHeader(options: PublicCacheOptions): string;
export declare const PRIVATE_CACHE_HEADER = "private, no-store";
export declare function isPersonalRequest(headers: Request['headers']): boolean;
export declare class PublicCacheInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
export declare function PublicCache(options: PublicCacheOptions): MethodDecorator;
