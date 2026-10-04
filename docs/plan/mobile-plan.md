# Thekra — Mobile Implementation Plan

> Scope: the React Native + Expo app reserved at [`mobile/`](../../mobile/).
> **This is a LATER phase (phase 7 in the [roadmap](./roadmap.md)). Nothing in this document should be
> scaffolded now** — `mobile/` must keep containing only its [README.md](../../mobile/README.md) until phase 7
> actually starts, and it is deliberately still absent from
> [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml).
> This document expands that README into a concrete technical plan so phase 7 starts from decisions instead of
> a blank folder.
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [backend-plan.md](./backend-plan.md) ·
> [frontend-plan.md](./frontend-plan.md) · [devops-plan.md](./devops-plan.md)

---

## 1. Why mobile is phase 7, not earlier

The product's moment of need — *"I am tempted right now"* — is overwhelmingly a phone moment, so mobile is the
eventual primary surface. It is still sequenced late on purpose:

- The API contract must be **stable** first. A client that ships to an app store cannot be redeployed like a web
  page; shipping it before the response shapes settle guarantees a `/v2`.
- The web app is the cheapest place to learn what the two core screens should actually look like.
- The design system (phase 8 input) arrives after phase 3, and the mobile app should consume the *final* tokens,
  not the neutral placeholder set.
- The curation library has to be worth reading before distribution matters.

Entry condition for phase 7: phases 2–4 shipped, `/v1` unchanged for a full phase, and a real content library in
place.

---

## 2. Stack

| Concern | Decision | Note |
| --- | --- | --- |
| Framework | **React Native via Expo (managed workflow)** + **TypeScript** | As already stated in [mobile/README.md](../../mobile/README.md). Managed workflow because nothing here needs custom native code. |
| Scaffold command | `pnpm create expo-app mobile --template expo-template-blank-typescript` *(run from the repo root, phase 7 only)* | Use the official template; hand-rolling the Expo config is explicitly out of bounds per the existing README. |
| Navigation | **`expo-router`** (file-based) | Mirrors the Next.js App Router mental model one-for-one, so the route map below maps onto [frontend-plan §2](./frontend-plan.md#2-route-map) with no translation layer. |
| Server state | **TanStack Query v5** | Same version and same key factory conventions as the web app — one mental model, and the persistence story in §6 builds on it. |
| HTTP | **axios** | Same client shape as the web (§5). |
| Client UI state | **Zustand** | Same tiny-store discipline as [frontend-plan §6.6](./frontend-plan.md#66-zustand--deliberately-tiny). |
| Styling | **`nativewind` v4** (Tailwind for RN) | Lets the same `--primary`/`--muted` semantic token names carry over, so phase 8's palette lands in both clients from one source of truth. Fallback if it fights Expo SDK upgrades: plain `StyleSheet` + a hand-written token module exporting the same names. |
| Components | **No shadcn/ui** (it is Radix + DOM) | Use RN primitives and, if a kit is wanted, `react-native-reusables` — the RN port that follows shadcn's API/token conventions. Component *structure* is shared conceptually, never literally. |
| i18n | **`i18next` + `react-i18next` + `expo-localization`** (+ `i18next-icu` for Arabic plurals) | `next-intl` is Next-only. ICU keeps the message catalogues format-compatible with the web's `messages/{ar,en}.json` (§5.2). |
| Storage | **`@react-native-async-storage/async-storage`** | Justified in §6. |
| Secure storage | **`expo-secure-store`** | The refresh token belongs in the Keychain/Keystore, never in AsyncStorage. |
| Fonts | `expo-font` + the same Arabic family chosen in phase 8 | Arabic script needs a real font file bundled; do not rely on platform defaults, which differ between iOS and Android. |
| Build/release | **EAS Build + EAS Submit**, OTA via `expo-updates` | [devops-plan §3.3](./devops-plan.md#33-mobile-phase-7). |
| Testing | Vitest *or* Jest + `@testing-library/react-native`; Maestro for device E2E | Follow whatever the Expo SDK version supports cleanly at the time; do not fight the template. |

---

## 3. Screen map

`expo-router` file tree, with the corresponding web route and the API calls from
[backend-plan §3](./backend-plan.md#3-rest-api-spec):

```
mobile/app/
├── _layout.tsx                    providers: QueryClient + persister, i18n, theme, RTL bootstrap
├── (tabs)/
│   ├── _layout.tsx                bottom tabs: Home · Browse · Favorites · Settings
│   ├── index.tsx                  Home
│   ├── browse.tsx                 Browse
│   ├── favorites.tsx              Favorites
│   └── settings.tsx               Settings
├── sins/index.tsx                 Sin picker (full screen, searchable)
├── sins/[slug].tsx                Reminders  ← core screen
├── good-deeds/index.tsx           Deed picker
├── good-deeds/[slug].tsx          Motivations ← core screen
├── quotes/[id].tsx                Quote detail (share target)
├── feelings/[tagSlug].tsx         Emotion entry
├── (auth)/login.tsx               Sign in
├── (auth)/register.tsx            Register
└── +not-found.tsx
```

| Screen | Web equivalent | Auth | Content | API |
| --- | --- | --- | --- | --- |
| **Home** | `/` | guest | The two entry points as large, unambiguous actions, phrased as moments (*"أشعر برغبة في معصية"* / *"أريد عمل حسنة"*), plus a "continue reading" row from the last-viewed intent and a shortcut to Favorites. | prefetch `GET /sins`, `GET /good-deeds` |
| **Sin picker** | the `SinPickerSheet` | guest | A searchable list — a **full screen** on mobile rather than the web's bottom sheet, because the keyboard consumes half a sheet and this screen must be usable one-handed, fast, under stress. Category chips; recently-used first. | `GET /sins` (#1) |
| **Reminders** (`sins/[slug]`) | `/sins/[slug]` | guest | Vertically paged/scrolled quote cards with `textAr` at reading size, grade/type badges, provenance, favorite, share, "another reminder" (`shuffle`), type filter, and the **alternatives** block linking to the opposite deed. | `GET /sins/:slug` (#2), `GET /sins/:slug/quotes` (#3) |
| **Deed picker** | the `GoodDeedPickerSheet` | guest | As above, for deeds. | `GET /good-deeds` (#5) |
| **Motivations** (`good-deeds/[slug]`) | `/good-deeds/[slug]` | guest | Reward callout first (`rewardAr`), then ranked motivation cards, then the `oppositeSin` link. | `GET /good-deeds/:slug` (#6), `GET /good-deeds/:slug/quotes` (#7) |
| **Browse** | `/browse` | guest | Quran-by-surah / Hadith-by-collection / search, with grade and tag filters. Infinite list. | `GET /quotes` (#8), `GET /quran/surahs` (#10), `GET /hadith/collections` (#14), `GET /tags` (#15) |
| **Quote detail** | `/quotes/[id]` | guest | Full text, all translations, full provenance, native share sheet (text + attribution + deep link), "also relates to". | `GET /quotes/:id` (#9) |
| **Emotion entry** | `/feelings/[tagSlug]` | guest | Enter from a feeling when the user cannot name a sin. | `GET /tags?category=EMOTION` (#15), `GET /quotes?tag=…` (#8) |
| **Favorites** | `/favorites` | user (readable offline, §6) | Saved quotes, newest first; **the one screen that must work with no network**. | `GET /favorites` (#24) |
| **Settings** | `/settings` | guest | Language toggle `ar`/`en` (+ RTL, §4), theme, translation visibility, weak-hadith opt-in, Arabic-Indic numerals, font scale, account/sign-out, "clear offline cache". | `GET /auth/me` (#22) when signed in |
| **Login / Register** | `/login`, `/register` | guest | Reachable only by choice, from Favorites or Settings. | `POST /auth/login` (#20), `POST /auth/register` (#19) |

Guest-first is identical to the web: only Favorites sync needs an account
([backend-plan §3.8](./backend-plan.md#38-auth-phase-4)). No screen is ever gated behind a sign-in wall.

### 3.1 Mobile-only affordances (justified, not gratuitous)

| Affordance | Why it belongs on mobile |
| --- | --- |
| Native share sheet | Sharing a verse or hadith with attribution is the main organic growth path. |
| Haptics on favorite/shuffle (`expo-haptics`) | Confirms the action without a visual interruption while reading. |
| Deep links + universal links (`thekra://sins/ghibah`, `https://…/sins/ghibah`) | Lets a shared link open the app on the exact screen. Configure `scheme` in `app.json` in phase 7. |
| Offline favorites | §6. |
| Keep-awake while reading (`expo-keep-awake`, opt-in) | Long Arabic passages are read slowly. |
| Notifications | **Explicitly out of scope.** The product is *on-demand by definition* ([README](../../README.md): "instead of pushing random daily content"). A reminder push would contradict the premise. Revisit only as a user-configured intention reminder, never as a content feed. |

---

## 4. RTL and Arabic on React Native

Harder than on the web, and the main source of phase-7 surprises:

- **`I18nManager.forceRTL(true)` requires an app reload to take effect.** A language toggle in Settings must
  therefore either prompt "restart to apply" or call `expo-updates`' `reloadAsync()`. Plan the UX for this from
  day one — discovering it late means rebuilding Settings.
- Use `expo-localization` to seed the initial locale from the device, then persist the user's explicit choice.
- Prefer **logical styles** (`paddingStart`, `marginEnd`, `textAlign: 'start'`) exactly as the web plan prefers
  `ps-*`/`pe-*` ([frontend-plan §5.4](./frontend-plan.md#54-tailwind-rtl-conventions-enforced-in-review)).
  With `nativewind` the same `ps-4`/`pe-4` classes apply, so the convention carries over verbatim.
- Mirror directional icons (`transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }]`).
- `writingDirection: 'rtl'` on Arabic `<Text>`; wrap LTR runs (`"Bukhari 13"`, `49:12`) in their own `<Text>`
  with `writingDirection: 'ltr'`.
- Bundle the Arabic font file via `expo-font`; verify tashkeel rendering on **both** iOS and Android, since
  shaping differs.
- Line height for Arabic bodies: ~1.9–2.1× font size, same rule as the web.
- Test every screen in both directions on both platforms before release — a `ar`/`en` × iOS/Android matrix in
  the phase 7 QA checklist.

---

## 5. Relationship to the web frontend

### 5.1 Shared contract, not shared code (phase 7)

The mobile app and the web app are **two independent clients of one API**, as stated in
[ARCHITECTURE §3](../ARCHITECTURE.md#3-repository-layout). What is shared in phase 7 is *conceptual*:

| Shared by convention | How |
| --- | --- |
| Endpoint list & response shapes | Both implement against [backend-plan §3](./backend-plan.md#3-rest-api-spec). The `{ data, meta }` envelope and the `{ error: { code … } }` shape are decoded in exactly one module per client. |
| `src/lib` structure | Mirror [frontend-plan §6.2](./frontend-plan.md#62-srclib-layout): `api-client.ts`, `api/*.ts` one file per resource, `types/api.ts`, `query-keys.ts`. Same filenames, same function names (`getSinQuotes`, `useSinQuotes`) so a developer moving between clients needs no re-orientation. |
| Query keys & cache policy | Same `queryKeys` factory shape; same `refetchOnWindowFocus: false` reasoning (never reshuffle a screen someone is reading). |
| Enum values | `QuoteType`, `QuoteOrigin`, `HadithGrade`, `TagCategory` re-declared as `const` objects — **never** importing `@prisma/client` into a client app. |
| Design tokens | Same semantic token *names* (`--primary`, `--muted-foreground`, `--grade-sahih`, `--intent-sin`), so phase 8's palette is one values table applied twice. |

Deliberately **not** shared: components (DOM vs native), navigation, styling implementation, i18n library.

### 5.2 `packages/shared-types` — a future option, not built now

Once both clients exist and the contract has stopped moving, the duplicated `types/api.ts` is the obvious thing
to lift:

```
packages/shared-types/          ← FUTURE, do not create now
├── package.json                name: "@thekra/shared-types", private, types-only (no runtime code)
└── src/{enums.ts,dto.ts,api.ts}
```

Then add `"packages/*"` to [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) alongside `mobile`.

Why **not** now: a shared package is only worth its cost when there are two real consumers *and* a settled
contract. Extracting it during phase 3 would add a build step, a workspace dependency and a versioning question
to a surface still changing weekly. The cost of waiting is one duplicated types file — cheap and visible.

A stronger long-term variant: generate the types from the backend. Add `@nestjs/swagger` to produce an OpenAPI
document from the existing DTOs, then `openapi-typescript` to emit `@thekra/shared-types` in CI. That makes a
contract drift a **failing build** instead of a runtime bug. Listed in
[Open Decisions](../TECHNICAL_PLAN.md#open-decisions--assumptions) with a recommendation to adopt it when the
mobile app starts, not before.

Message catalogues (`messages/{ar,en}.json`) are the second extraction candidate (`packages/shared-i18n`), which
is why ICU format is specified for both clients (§2).

---

## 6. Offline strategy

**Decision: `AsyncStorage` + TanStack Query's persister (`@tanstack/query-async-storage-persister` +
`PersistQueryClientProvider`), not `expo-sqlite`.**

Justification:

1. **The data is tiny and document-shaped.** Favorites plus the last few viewed intents is tens of quotes —
   a few hundred KB of JSON. SQLite's value is querying and joining large datasets locally; there is nothing to
   join here, and the API already does the ranking.
2. **It reuses the cache that already exists.** The screens are built on TanStack Query, so persisting the query
   cache makes Favorites and the last-viewed reminders readable offline with roughly 20 lines of provider setup
   and **zero** new data-access code. `expo-sqlite` would mean a second schema, local migrations, and a
   read-through layer under every hook — duplicating state with the usual drift bugs.
3. **No local write model is needed.** Favoriting is the only mutation. Offline favorites are handled with
   TanStack Query's offline mutation support (`networkMode`, paused mutations resumed on reconnect) plus server
   idempotency: `POST /v1/favorites` returning `409 ALREADY_FAVORITED` is harmless to replay, and
   `DELETE /v1/favorites/:quoteId` is keyed by `quoteId` rather than a join-row id precisely so it is replayable
   ([backend-plan §3.9](./backend-plan.md#39-favorites-phase-4-auth-required)). That design makes a sync engine
   unnecessary.
4. **It is reversible.** Swapping the persister for `expo-sqlite/kv-store` or a full SQLite cache later changes
   one provider, because nothing else talks to storage.

Concrete plan:

| Item | Decision |
| --- | --- |
| Persisted | `queryKeys.favorites.*`, `queryKeys.sins.detail/quotes` and `goodDeeds.detail/quotes` for the last N (10) viewed intents, the sin/deed catalogues, and `quotes.detail` for favorited quotes. |
| Not persisted | `session`, search results, admin anything. |
| `maxAge` | 7 days, then evicted on rehydrate. |
| Filtering | `dehydrateOptions.shouldDehydrateQuery` allow-lists keys — never persist the whole cache blindly. |
| Budget | Soft cap ~5 MB with an LRU trim, plus "clear offline cache" in Settings. |
| Offline UX | A persistent banner "عرض محتوى محفوظ — لا يوجد اتصال"; cards show a subtle "saved copy" marker; favoriting while offline is accepted optimistically and flushed on reconnect. |
| Network detection | `expo-network` / `@react-native-community/netinfo` wired into Query's `onlineManager`. |
| Secrets | The refresh token goes in `expo-secure-store`, **never** AsyncStorage; the access token stays in memory. |

**Upgrade trigger for `expo-sqlite`:** a genuine offline-first requirement — e.g. "download a whole collection
and search it with no connection". That is a different product feature, and it is the point at which a local
query engine earns its cost. Recorded in Open Decisions.

---

## 7. Phase 7 build order (when it starts)

1. Scaffold with the official Expo TS template; add `mobile` to `pnpm-workspace.yaml`; set `scheme`, bundle ids and `app.json` basics.
2. `expo-router` + the tab layout + the file tree in §3 as empty screens.
3. `lib/` mirroring the web: `api-client.ts`, `api/*`, `types/*`, `query-keys.ts`; verify against staging.
4. `QueryClient` + persister + NetInfo wiring (§6) before any screen logic, so offline is designed in, not bolted on.
5. i18n + RTL bootstrap (§4), including the reload-on-locale-change UX. **Before building screens.**
6. Design tokens from phase 8 (`nativewind` + the shared semantic names) and a `QuoteCard` native equivalent.
7. Core loop: Sin picker → Reminders, then Deed picker → Motivations.
8. Quote detail + native share + deep links.
9. Browse, Emotion entry.
10. Auth + Favorites (+ offline favorites).
11. Settings.
12. QA matrix (`ar`/`en` × iOS/Android × online/offline), accessibility pass (TalkBack/VoiceOver with Arabic), then EAS build and store submission ([devops-plan §3.3](./devops-plan.md#33-mobile-phase-7)).
