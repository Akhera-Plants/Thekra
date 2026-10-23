import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { PUBLIC_CACHE, PUBLIC_CACHE_METADATA, PublicCacheInterceptor, publicCacheHeader } from './public-cache.js';

function setup(headers: Record<string, string | undefined>, options: unknown = PUBLIC_CACHE.content) {
  const set: Record<string, string> = {};
  const vary: string[] = [];
  const handler = () => undefined;
  if (options) Reflect.defineMetadata(PUBLIC_CACHE_METADATA, options, handler);
  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({ setHeader: (k: string, v: string) => (set[k] = v), vary: (v: string) => vary.push(v) }),
    }),
  } as unknown as ExecutionContext;
  return { context, set, vary };
}

describe('PublicCacheInterceptor', () => {
  const run = (context: ExecutionContext, next: CallHandler) => lastValueFrom(new PublicCacheInterceptor().intercept(context, next));

  it('sends the shared-cache header on an anonymous success', async () => {
    const { context, set, vary } = setup({});
    await run(context, { handle: () => of({ data: [] }) });
    expect(set['Cache-Control']).toBe('public, s-maxage=300, stale-while-revalidate=3600');
    expect(vary).toEqual(['Authorization']);
  });

  it('answers private, no-store when a bearer token or a cookie is present', async () => {
    for (const headers of [{ authorization: 'Bearer x' }, { cookie: 'a=b' }]) {
      const { context, set } = setup(headers);
      await run(context, { handle: () => of({ data: [] }) });
      expect(set['Cache-Control']).toBe('private, no-store');
    }
  });

  it('adds nothing to an error response', async () => {
    const { context, set } = setup({});
    await expect(run(context, { handle: () => throwError(() => new Error('boom')) })).rejects.toThrow('boom');
    expect(set['Cache-Control']).toBeUndefined();
  });

  it('does nothing on a handler without the decorator metadata', async () => {
    const { context, set, vary } = setup({}, null);
    await run(context, { handle: () => of(1) });
    expect(set).toEqual({});
    expect(vary).toEqual([]);
  });

  it('formats presets, with a browser max-age only when asked', () => {
    expect(publicCacheHeader(PUBLIC_CACHE.search)).toBe('public, max-age=30, s-maxage=60, stale-while-revalidate=60');
    expect(publicCacheHeader(PUBLIC_CACHE.quote)).toBe('public, s-maxage=120, stale-while-revalidate=600');
  });
});
