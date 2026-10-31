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

Tabs: Home (الرئيسية) · Today's wird (ورد اليوم, centre) · My record (سجلّي) · Settings  
Today's wird: `(tabs)/habits` (ورد اليوم): the title, one date line (Gregorian; Hijri too with «إظهار التاريخ الهجري»),
the streak chip (gold flame, practice-core `currentStreak`) and «أضف»; «اليوم» from practice-core `dayAgenda` (done rows
sink to the bottom; habits not asked today behind one collapsed row; «يومي ثقيل» chip); «أعمال دورية» (next three, «الكل»)
(pieces in `src/components/practice/hub/`, pure helpers in `src/lib/practice/wird.ts` and `hub.ts`; the
periodic-act rules and the today grouping live in `@thekra/practice-core` `wird.ts`, shared with the website, hooks in
`src/lib/practice/use-habits-hub.ts`)  
My record: `(tabs)/record` (سجلّي): the streak and «أطول مداومة», the one month calendar (a tapped day opens its list),
then «عاداتي», «أعمال دورية», «تخفَّف», «رفقة», «المحفوظات»  
Seasons of good: `practice/calendar` (مواسم الخير, a door on the home screen): occasions month and the ICS feed  
Garden: `garden` (بستاني): no entry point since the redesign (§1; screen and data kept): one plant per habit plan (+ صلة الرحم), grown by days tended, never
shrinking, resting on «يومي ثقيل»; never a plant for the sin program (`src/lib/practice/garden.ts`, drawings in
`src/components/garden/`)  
Saved: `favorites` (المحفوظات, pushed from سجلّي)  
Browse: `browse` (استكشف النصوص), a pushed screen opened from Home  
Core: `sins/[slug]`, `good-deeds/[slug]`, `quotes/[id]`, `feelings/[tagSlug]`  
Practice (`app/practice/`): `habits` (عاداتي: plans, يومي ثقيل, Ramadan, reminders), `add` (أعِنّي على طاعة), `plan/[id]`,
`periodic` (أعمال دورية: relatives and non-daily habits), `duties` (فروضي وأدواري), `kinship` (صلة الرحم; `?add=1` opens
the form), `sin-program` (تخفَّف), `calendar` (occasions month grid and feed)  
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
- Sin program («تخفَّف»): in clear only on the device; never in a sync body or a notification (title always
  «تذكرة من ذكرى»). Optional encrypted vault (`GET/PUT/DELETE /v1/me/sin-vault`): sealed on the device with a key
  derived from the user's «رمز الخصوصية» (PBKDF2-SHA256 210,000, AES-256-GCM); the key stays in memory, or in
  expo-secure-store when «تذكّر على هذا الجهاز» is on. The wipe button deletes local data, the key and the vault.
  `src/lib/crypto/install.ts` installs expo-crypto's `getRandomValues` on `globalThis.crypto` (Hermes has none).
- Evidence for the sin programs is requested for **all** catalog programs at once, so the request reveals no choice.
- Local notifications (`expo-notifications`, no push): permission asked when a reminder switch is turned on, or
  when the first habit is added (habit reminders are on by default; a stored choice is kept, a denial turns them off);
  a rolling 14-day window (max 60 pending, iOS limit) re-planned on every change and every foreground.
- Metro: `metro.config.js` maps `./x.js` → `./x.ts` only inside `packages/practice-core` (Jest: `jest.resolver.js`;
  Jest also transforms the ESM-only `@noble/*` packages).

## Phase 6: screen and devices (redesign §4.6)

- **Home-screen widgets (Android)** with `react-native-android-widget` 0.22.1 (its Expo config plugin in `app.config.ts`
  writes the three providers, their XML and the manifest receivers at `expo prebuild`; nothing works in Expo Go):
  «المداومة» (2×2: streak + «بقي n»), «ورد اليوم» (4×2: today's habits with done marks, habits only) and «نص اليوم»
  (4×2: one text a day from the source chosen in الإعدادات ← نص اليوم: a reminder set, the saved texts, «تذكيراتي», or
  «مواسم الخير»). `index.ts` (the app entry) registers the widget task; `src/widget/` holds the pure snapshot
  (`snapshot.ts`, tested), the widgets and the update call. The app saves a snapshot and calls `requestWidgetUpdate` on
  foreground and after every change; the task only reads it. Tapping a widget opens «ورد اليوم» (`thekra://habits`):
  ticking from the widget is not offered, so only the app ever writes the practice store. A snapshot from an earlier day
  shows no stale done marks; the daily text still turns over (the candidates are saved).
- **iOS widget: next step, not built.** It needs a WidgetKit extension target (Swift/SwiftUI), an App Group shared with
  the app for the snapshot, and a config plugin that adds the target at prebuild (e.g. Apple targets via a vetted
  first-party-documented plugin), then the same snapshot written to the App Group instead of AsyncStorage.
- **«تذكيراتي»**: the user's own lines (≤ 120 characters, at most 20), on this device only (prefs).
- **Prayer-time anchors**: «متى؟» offers «بعد الفجر»… first, then «وقت أختاره». «أوقات الصلاة» (city, country code,
  method by country, manual minutes) fetches 30 days from AlAdhan (`calendarByCity`) into the prefs on foreground when
  fewer than 7 days are left; offline or without a city the anchors use default times. Local reminders resolve anchors
  per day (practice-core `notificationPlan` with `prayerTimesOn`).

## Tests

```bash
pnpm --filter mobile test
pnpm --filter mobile exec tsc --noEmit
```

EAS / store submission → see `docs/build/BLOCKERS.md` (B-007).
