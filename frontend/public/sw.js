/*
 * Thekra service worker. Registered by ServiceWorkerRegister in production only.
 *
 * - Pages: network first. A page that loaded is kept, so it opens again offline; a page never
 *   opened falls back to /offline (or /en/offline).
 * - Build assets (/_next/static, fonts, icons, ornaments): cache first. Their names change on
 *   every build, so a cached copy is never stale.
 * - Public API reads (GET /v1/… on the API origin given at registration): network first, cached
 *   copy offline. Anything with an Authorization header, any non-GET, and private pages
 *   (admin, login, settings, favorites) are never cached.
 * Caches are capped and renamed with VERSION, so a changed worker clears the old ones.
 */
const VERSION = 'v1';
const PAGES = `thekra-pages-${VERSION}`;
const ASSETS = `thekra-assets-${VERSION}`;
const API = `thekra-api-${VERSION}`;
const LIMITS = { [PAGES]: 80, [ASSETS]: 300, [API]: 300 };
const OFFLINE = ['/offline', '/en/offline'];
const PRIVATE = /^\/(?:en\/)?(?:admin|login|register|settings|favorites|dev)(?:\/|$)/;
/** Public reads only (the API's own CDN cache presets); auth, favorites, review and admin never. */
const PUBLIC_API = /^\/v1\/(?:sins|good-deeds|branches|quotes|quran|hadith|sources|tags|topic-themes)(?:\/|$|\?)/;
const ASSET = /^\/(?:_next\/static\/|icons\/|ornaments\/|favicon|apple-icon|icon\.svg)/;

const apiOrigin = (() => {
  try {
    const value = new URL(self.location.href).searchParams.get('api');
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
})();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => Promise.all(OFFLINE.map((path) => cache.add(path).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('thekra-') && !(key in LIMITS)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const extra = keys.length - LIMITS[cacheName];
  for (let index = 0; index < extra; index += 1) await cache.delete(keys[index]);
}

function storable(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'cors')
    && !response.headers.has('set-cookie')
    && !/no-store|private/.test(response.headers.get('cache-control') || '');
}

async function networkFirst(request, cacheName, fallback) {
  try {
    const response = await fetch(request);
    if (storable(response)) {
      const copy = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, copy)).then(() => trim(cacheName));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (fallback) {
      const page = await caches.match(fallback);
      if (page) return page;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (storable(response)) {
    const copy = response.clone();
    caches.open(ASSETS).then((cache) => cache.put(request, copy)).then(() => trim(ASSETS));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('authorization')) return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (PRIVATE.test(url.pathname) || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
    if (request.mode === 'navigate') {
      const offline = url.pathname === '/en' || url.pathname.startsWith('/en/') ? '/en/offline' : '/offline';
      event.respondWith(networkFirst(request, PAGES, offline));
      return;
    }
    if (ASSET.test(url.pathname)) event.respondWith(cacheFirst(request));
    return;
  }

  if (apiOrigin && url.origin === apiOrigin && PUBLIC_API.test(url.pathname)) {
    event.respondWith(networkFirst(request, API, null));
  }
});
