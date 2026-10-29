# Thekra Mobile (Expo)

React Native app consuming the same `/v1` API as the web frontend.

## Stack

- Expo SDK 57 + **expo-router** (file-based navigation)
- TanStack Query + AsyncStorage persister, axios, Zustand (auth/session)
- i18next (`ar` default, `en`), RTL via `I18nManager`
- Design system in `src/theme` (the website's palette and fonts, light and dark) and `src/ui` (the component kit). No colour or icon outside them

## Run

From repo root:

```bash
pnpm install
EXPO_PUBLIC_API_URL=http://localhost:3001 pnpm --filter mobile start
```

Use a device/simulator with the API reachable (localhost works on iOS simulator; Android emulator may need `10.0.2.2:3001`).

## Screens

Tabs: Home · My garden (بستاني) · My habits (عاداتي, centre) · Favorites · Settings  
Garden: `(tabs)/garden` (بستاني): one plant per habit plan (+ صلة الرحم), grown by days tended, never shrinking, resting
on «يومي ثقيل»; never a plant for the sin program (`src/lib/practice/garden.ts`, drawings in `src/components/garden/`)  
Browse: `browse` (استكشف النصوص), a pushed screen opened from Home  
Core: `sins/[slug]`, `good-deeds/[slug]`, `quotes/[id]`, `feelings/[tagSlug]`  
Hub: `(tabs)/habits` (عاداتي): today across every track (practice-core `dayAgenda`), week strip, «أضف» sheet, the three
tracks, «وين وصلت هذا الشهر» month grid (pieces in `src/components/practice/hub/`, hooks in `src/lib/practice/use-habits-hub.ts`)  
Practice (`app/practice/`): `habits` (طاعاتي: plans, يومي ثقيل, Ramadan, reminders), `add` (أعِنّي على طاعة), `plan/[id]`,
`duties` (فروضي وأدواري), `kinship` (صلة الرحم; `?add=1` opens the form), `sin-program` (ترك المعصية), `calendar` (month grid)  
Auth: `(auth)/login`, `(auth)/register`

## Practice features (roadmap docs/plan/2026-10-features-roadmap.md §2–§4, §6, §8; sync contract docs/plan/2026-10-practice-sync-contract.md)

- Engine: `@thekra/practice-core` (workspace package, TypeScript source). Nothing is re-implemented in the app;
  every edit goes through its store helpers (`updatePlan`, `upsertRelative`, `undoContact`, `updateSettings`…).
- Storage: practice-core `Store` v2 in AsyncStorage `thekra.practice.v1` (`parseStore` upgrades v1; the first
  app version's habit-key ids get UUIDs once, see `migrateLegacy`); app-only prefs (reminder switches/times, roles,
  «تذكّر على هذا الجهاز») in `thekra.practice.prefs.v1`.
- Sync (signed in): `POST /v1/me/practice/sync` with `buildSyncRequest` in batches until nothing is pending, else
  `GET /v1/me/practice?since=`; merged with `applyServerChanges`. Runs on sign-in, foreground, 3 s after an edit
  and every 15 minutes while active. Status in Settings.
- Sin program («ترك المعصية»): in clear only on the device; never in a sync body or a notification (title always
  «تذكرة من ذكرى»). Optional encrypted vault (`GET/PUT/DELETE /v1/me/sin-vault`): sealed on the device with a key
  derived from the user's «رمز الخصوصية» (PBKDF2-SHA256 210,000, AES-256-GCM); the key stays in memory, or in
  expo-secure-store when «تذكّر على هذا الجهاز» is on. The wipe button deletes local data, the key and the vault.
  `src/lib/crypto/install.ts` installs expo-crypto's `getRandomValues` on `globalThis.crypto` (Hermes has none).
- Evidence for the sin programs is requested for **all** catalog programs at once, so the request reveals no choice.
- Local notifications (`expo-notifications`, no push): permission asked when a reminder switch is turned on;
  a rolling 14-day window (max 60 pending, iOS limit) re-planned on every change and every foreground.
- Metro: `metro.config.js` maps `./x.js` → `./x.ts` only inside `packages/practice-core` (Jest: `jest.resolver.js`;
  Jest also transforms the ESM-only `@noble/*` packages).

## Tests

```bash
pnpm --filter mobile test
pnpm --filter mobile exec tsc --noEmit
```

EAS / store submission → see `docs/build/BLOCKERS.md` (B-007).
