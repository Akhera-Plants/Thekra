import 'reflect-metadata';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA, GUARDS_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from '../../app.module.js';
import { OptionalJwtAuthGuard } from '../../modules/auth/guards/optional-jwt-auth.guard.js';
import { PUBLIC_CACHE_METADATA } from './public-cache.js';

type Ctor = new (...args: never[]) => object;

interface Route {
  id: string;
  controller: Ctor;
  handler: (...args: never[]) => unknown;
  guards: unknown[];
  cached: boolean;
}

/** Every controller reachable from AppModule (imports walked, dynamic modules unwrapped). */
function controllersOf(root: unknown): Ctor[] {
  const seen = new Set<unknown>();
  const found = new Set<Ctor>();
  const visit = (mod: unknown) => {
    const real = (mod as { module?: unknown })?.module ?? mod;
    const dynamic = mod as { controllers?: Ctor[]; imports?: unknown[] };
    if (!real || seen.has(real)) return;
    seen.add(real);
    for (const controller of (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, real as object) ?? []) as Ctor[]) found.add(controller);
    for (const controller of dynamic.controllers ?? []) found.add(controller);
    for (const imported of [...((Reflect.getMetadata(MODULE_METADATA.IMPORTS, real as object) ?? []) as unknown[]), ...(dynamic.imports ?? [])]) visit(imported);
  };
  visit(root);
  return [...found];
}

function routesOf(controller: Ctor): Route[] {
  const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
  const classGuards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
  const routes: Route[] = [];
  for (const name of Object.getOwnPropertyNames(controller.prototype)) {
    const handler = (controller.prototype as Record<string, unknown>)[name];
    if (typeof handler !== 'function' || name === 'constructor') continue;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) continue;
    const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
    const guards = [...classGuards, ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[])];
    routes.push({
      id: `${RequestMethod[method]} /${[base, path].filter((part) => part && part !== '/').join('/')}`,
      controller,
      handler: handler as Route['handler'],
      guards,
      cached: Reflect.getMetadata(PUBLIC_CACHE_METADATA, handler) !== undefined,
    });
  }
  return routes;
}

const routes = controllersOf(AppModule).flatMap(routesOf);

/** The whole list of CDN-cacheable routes. A new route is NOT in it, so it defaults to no cache. */
const CACHEABLE = [
  'GET /sins',
  'GET /sins/:slug',
  'GET /sins/:slug/quotes',
  'GET /sins/:slug/good-deeds',
  'GET /good-deeds',
  'GET /good-deeds/:slug',
  'GET /good-deeds/:slug/quotes',
  'GET /branches',
  'GET /branches/:number',
  'GET /branches/:number/quotes',
  'GET /sources',
  'GET /sources/:id',
  'GET /topic-themes',
  'GET /quotes',
  'GET /quotes/today',
  'GET /quotes/:id',
  'GET /quotes/:id/explanations',
  'GET /quran/surahs',
  'GET /quran/surahs/:surahNumber/ayahs',
  'GET /quran/ayahs/:surahNumber/:ayahNumber',
  'GET /hadith',
  'GET /hadith/collections',
  'GET /practice/catalog',
  'GET /practice/evidence',
  'GET /calendar/occasions',
  'GET /calendar/occasions.ics',
].sort();

const PRIVATE_PREFIXES = ['auth', 'admin', 'favorites', 'reports', 'review', 'health', 'users', 'me'];

describe('public cache route metadata', () => {
  it('finds the controllers (guards the walk itself)', () => {
    expect(routes.length).toBeGreaterThan(60);
    expect(routes.map((route) => route.id)).toEqual(
      expect.arrayContaining(['GET /sins/:slug/quotes', 'POST /auth/login', 'GET /favorites', 'GET /me/practice', 'POST /me/practice/sync', 'PUT /me/sin-vault']),
    );
  });

  it('caches exactly the allow-listed public routes', () => {
    expect(routes.filter((route) => route.cached).map((route) => route.id).sort()).toEqual(CACHEABLE);
  });

  it('never caches anything but a GET', () => {
    expect(routes.filter((route) => route.cached && !route.id.startsWith('GET ')).map((route) => route.id)).toEqual([]);
  });

  it('never caches an authenticated, admin, favorites, report, review or health route', () => {
    const offenders = routes
      .filter((route) => route.cached)
      .filter((route) => {
        const first = route.id.split(' ')[1]?.split('/')[1] ?? '';
        return PRIVATE_PREFIXES.includes(first) || route.id.includes('/admin') || route.id.includes('/reports');
      });
    expect(offenders.map((route) => route.id)).toEqual([]);
  });

  it('allows only the optional-auth guard on a cached route (the interceptor then answers private, no-store to a bearer)', () => {
    const offenders = routes.filter((route) => route.cached && route.guards.some((guard) => guard !== OptionalJwtAuthGuard));
    expect(offenders.map((route) => route.id)).toEqual([]);
  });

  it('gives every other route no cache decoration at all', () => {
    const others = routes.filter((route) => !CACHEABLE.includes(route.id));
    expect(others.length).toBeGreaterThan(30);
    expect(others.filter((route) => route.cached)).toEqual([]);
  });
});
