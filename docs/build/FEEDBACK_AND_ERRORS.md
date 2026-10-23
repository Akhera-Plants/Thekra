# Loading feedback, errors and speed (public site)

Screenshots: `docs/design/after/loading/`.

## Loader and feedback

- `BrandLoader` (`components/shared/feedback/BrandLoader.tsx`): the favicon leaf, inline SVG, CSS-only. `size="inline"` for chips/lists/buttons, `size="page"` (green tile + leaf, breathing) for routes. `role="status"`, `aria-busy`, label from `feedback.loading*`. With `prefers-reduced-motion` the mark is still and the label text is shown. Logical properties only (mirrors in RTL). Styles: `app/feedback.css`.
- `loading.tsx` for every public segment (`RouteSkeleton`, variants catalog / reader / detail / list / plain) plus `[locale]/loading.tsx` and `admin/loading.tsx`.
- `NavigationProgress` (in `[locale]/layout.tsx`): top bar, starts on any in-app link press or back/forward, ends when the route changed **and** the `data-route-loading` skeleton is gone. App Router has no router events, so the start is the click. The pressed link gets `data-nav-pending`; `LinkPending` (`useLinkStatus`) sits inside catalogue cards.
- Topic readers (`useTopicReader`, `BranchReader`): `keepPreviousData` + `signal` (latest click cancels the previous request), list `aria-busy`/dimmed by ReminderReader, pill `ReaderStatus` pinned to the viewport (no layout shift), failure → error with retry, never an endless skeleton. `?theme=` is applied on the client so the topic pages can be cached.

## Error model

- `ApiError.kind`: `network | timeout | http | validation | parse` (`lib/types/api.ts`). Browsers hide CORS blocks as status-0 network errors; the console hint says so.
- Normalised in `lib/api-client.ts` (axios in the browser, native `fetch` on the server). `lib/errors.ts`: `failureKey`, `isRetryable`, `reportFailure` (one `console.error` per failure object).
- Query/mutation caches log failures once (`lib/query-client.ts`). Retry: one extra try for network/timeout, two for 5xx, none for 4xx.
- Shown through `ErrorState`: `QueryErrorState` (client), `ServerErrorState` (server catch + `router.refresh`), `RouteError` (`error.tsx`, uses `retry`). Messages: `feedback.error.*` (ar/en). No raw text, URL or status reaches the visitor.
- `app/[locale]/error.tsx`, `not-found.tsx`, `app/global-error.tsx` (own document, language from the URL).
- Server pages: only an API 404 becomes `notFound()`; anything else is logged and rethrown (`rethrowUnlessNotFound`) so `error.tsx` offers a retry and a failure is never cached as an empty page. Optional extras (theme labels, about sources, home blocks) degrade; home throws only if all three blocks fail.

## Caching rules

- Server reads use native `fetch` with `next: { revalidate, tags }` (axios bypasses the data cache). Default 300 s; catalogue lists (`/sins`, `/good-deeds`, `/branches`, `/sources`, `/topic-themes`) 3600 s. Tags `api`, `api:<resource>`.
- Pages: `export const revalidate = 300` (about 3600); `force-dynamic` removed from home, sins, good-deeds, branches and their details, about, browse, feelings. `generateStaticParams` prerenders the 30 topics with most texts per catalogue; the rest render on first visit then cache. Still dynamic: favorites, `/api/auth/*`.
- Do not read `searchParams`/cookies in a public page: it makes the route dynamic again.
- The build needs the API: build-phase fetches wait 30 s and retry 3 times; a dead API fails the build rather than shipping empty pages.
- `vercel.json` `"regions": ["fra1"]`: the Vercel docs list `regions` in `vercel.json`, Hobby = a single region, and `fra1` (Frankfurt) is in the region list, so one region is within the Hobby limit. Not deployed here; confirm on the next deployment.
- Locale switch: next-intl's locale `Link` is hard-wired to `prefetch={false}`, so `LocaleSwitcher` prefetches the other locale's route on idle/hover/focus. `/ar/x` → `/x` is a single 307 (canonical), the switcher links straight to the canonical URL, so no extra hop.
