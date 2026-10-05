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

Tabs: Home · Browse · Favorites · Settings  
Core: `sins/[slug]`, `good-deeds/[slug]`, `quotes/[id]`, `feelings/[tagSlug]`  
Auth: `(auth)/login`, `(auth)/register`

## Tests

```bash
pnpm --filter mobile test
pnpm --filter mobile exec tsc --noEmit
```

EAS / store submission → see `docs/build/BLOCKERS.md` (B-007).
