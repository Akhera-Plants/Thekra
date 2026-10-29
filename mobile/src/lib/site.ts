/**
 * Public web site that shared links point to (PROJECT_GUIDE §1). A constant on purpose: a new
 * `EXPO_PUBLIC_*` variable would have to be added to CI, backend/.env.example and docs/deploy/VERCEL.md
 * (AGENTS.md), which this app does not need for one fixed public address.
 */
export const SITE_URL = 'https://thekra-web.vercel.app';

/** «عن ذكرى ومنهجه». */
export const SITE_ABOUT_PATH = '/about';
/**
 * The site has no privacy page yet (roadmap §8 lists one before the app is published): the link opens the about
 * page at the `#privacy` anchor, where that section belongs.
 */
export const SITE_PRIVACY_PATH = '/about#privacy';

/** A page of the site in the app's language (Arabic at `/`, English under `/en`). */
export function sitePageUrl(path: string, locale: string): string {
  return locale === 'en' ? `${SITE_URL}/en${path}` : `${SITE_URL}${path}`;
}
