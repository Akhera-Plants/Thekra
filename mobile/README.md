# Thekra Mobile (Expo)

React Native app consuming the same `/v1` API as the web frontend.

## Stack

- Expo SDK 57 + **expo-router** (file-based navigation)
- TanStack Query + AsyncStorage persister, axios, Zustand (auth/session)
- i18next (`ar` default, `en`), RTL via `I18nManager`
- Design tokens in `src/lib/tokens.ts` (Phase 8 will swap values only)

## Run

From repo root:

```bash
pnpm install
EXPO_PUBLIC_API_URL=http://localhost:3001 pnpm --filter mobile start
```

Use a device/simulator with the API reachable (localhost works on iOS simulator; Android emulator may need `10.0.2.2:3001`).

## Screens

Tabs: Home · My habits (عاداتي) · Browse · Favorites · Settings  
Core: `sins/[slug]`, `good-deeds/[slug]`, `quotes/[id]`, `feelings/[tagSlug]`  
Practice (`app/practice/`): `add` (أعِنّي على طاعة), `plan/[id]`, `duties` (فروضي وأدواري), `kinship` (صلة الرحم),
`sin-program` (ترك المعصية), `calendar`  
Auth: `(auth)/login`, `(auth)/register`

## Practice features (roadmap docs/plan/2026-10-features-roadmap.md §2–§4, §6, §8)

- Engine: `@thekra/practice-core` (workspace package, TypeScript source). Nothing is re-implemented in the app.
- Storage: practice-core `Store` in AsyncStorage `thekra.practice.v1`; app-only prefs (reminder switches/times,
  reminder rule per plan, free minutes) in `thekra.practice.prefs.v1`; sync meta in `thekra.practice.sync.v1`.
- Privacy: the sin program («ترك المعصية») is local only — never synced (`exportForSync` has no `programs`),
  never in a notification (title always «تذكرة من ذكرى»). Its evidence request asks for the evidence of **all**
  catalog programs at once, so the request does not reveal the choice.
- Local notifications (`expo-notifications`, no push): permission asked when a reminder switch is turned on;
  a rolling 14-day window (max 60 pending, iOS limit) re-planned on every change and every foreground.
- Account sync (signed in): GET/PUT `/v1/me/practice` with a version; see `src/lib/practice/sync.ts` for the
  merge rule on 409.
- Metro: `metro.config.js` maps `./x.js` → `./x.ts` only inside `packages/practice-core` (Jest: `jest.resolver.js`).

## Tests

```bash
pnpm --filter mobile test
pnpm --filter mobile exec tsc --noEmit
```

EAS / store submission → see `docs/build/BLOCKERS.md` (B-007).
