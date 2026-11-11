/**
 * The website's permanent redirects (owner round 5, docs/plan/2026-11-07-owner-round-5.md §1 Web table), built from
 * practice-core `WEB_REDIRECTS` so the old paths follow the shared navigation map. `next.config.ts` serves them: a
 * config redirect is answered before the filesystem and the proxy, so an old link or a push notification never renders
 * the old page first.
 *
 * Pure, no imports: next.config.ts loads this file before the app is compiled.
 */

/** One rule as next.config `redirects()` takes it. */
export interface RedirectRule {
  source: string;
  destination: string;
  permanent: true;
}

/** The locales that carry a path prefix (Arabic is the default and has none; next-intl `localePrefix: 'as-needed'`). */
export const PREFIXED_LOCALES = ['en'] as const;

/**
 * Every old path → its new place, for the bare (Arabic) path and each prefixed locale. A sub-path of an old path
 * (`/names/al-rahman`) follows it too, unless a current page lives under the old path: `/practice/habits` redirects but
 * `/practice/habits/<id>` is the habit page.
 */
export function webRedirectRules(
  redirects: readonly { from: string; to: string }[],
  currentRoutes: readonly (string | null)[],
): RedirectRule[] {
  const routes = currentRoutes.filter((route): route is string => typeof route === 'string');
  const rules: RedirectRule[] = [];
  for (const { from, to } of redirects) {
    const hasPageUnder = routes.some((route) => route.startsWith(`${from}/`));
    for (const prefix of ['', ...PREFIXED_LOCALES.map((locale) => `/${locale}`)]) {
      const destination = to === '/' ? prefix || '/' : `${prefix}${to}`;
      rules.push({ source: `${prefix}${from}`, destination, permanent: true });
      if (!hasPageUnder) rules.push({ source: `${prefix}${from}/:rest+`, destination, permanent: true });
    }
  }
  return rules;
}
