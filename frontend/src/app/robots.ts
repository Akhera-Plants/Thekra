import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/** /robots.txt: public reading pages are indexed; accounts, admin and tooling are not. */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ['admin', 'login', 'register', 'settings', 'favorites', 'dev', 'offline', 'practice/leave-sin'];
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...privatePaths.map((path) => `/${path}`), ...privatePaths.map((path) => `/en/${path}`), '/api/'],
    },
    sitemap: new URL('/sitemap.xml', env.SITE_ORIGIN).toString(),
  };
}
