# Thekra extension · إضافة ذكرى

Manifest V3 browser extension (Chrome, Edge, Firefox): gentle reminders for the good deeds you choose, built on
`@thekra/practice-core` (plans, rules, Hijri dates, storage). Spec: [roadmap §5](../docs/plan/2026-10-features-roadmap.md).
Good deeds only: the sin-leaving program is not in the extension.

## بالعربية (مختصر)

- **ما تفعله:** تختار طاعة أو أكثر من الكتالوج، وتبدأ بقدر صغير، وتحدد عدد التذكيرات في اليوم (1 إلى 6) وأوقاتها، وأيام
  العمل في الأسبوع، والأيام التي لا تريد فيها تذكيرًا، وتعديل التاريخ الهجري (−2 إلى +2)، واللغة.
- **التذكير:** إشعار فيه اسم الطاعة، والمطلوب اليوم (لا يُضاعَف ما فات)، ونص قصير منشور من موقع ذكرى مع مرجعه. الأثر
  يحمل دائمًا «أثر، وليس حديثًا». إن لم يوجد نص محفوظ والجهاز بلا إنترنت فلا يظهر أي نص. زرّان في Chrome: «تمّ» و«لاحقًا»
  (30 دقيقة). الضغط على الإشعار يفتح صفحة الطاعة في الموقع.
- **اليوم:** المطلوب، وتسجيل أي قدر (التعويض في اليوم نفسه)، ودرجة المداومة في آخر 4 أسابيع (ممتازة، طيبة، أو «خطوة صغيرة
  تكفي»، بلا كلمة فشل وبلا عدّاد أيام)، واقتراح الزيادة خطوة واحدة فقط حين يسمح بها المحرك، و«يومي ثقيل»، وموسم رمضان.
- **الحساب (اختياري):** دخول بالبريد وكلمة المرور، ثم مزامنة العادات وسجلّها فقط مع الموقع والتطبيق: عند الدخول،
  وعند فتح النافذة، وبعد كل تعديل (بعد 3 ثوانٍ)، وكل 15 دقيقة. الخروج يُبقي بياناتك على الجهاز.
- **الخصوصية:** كل شيء في `chrome.storage.local` على جهازك. الطلبات كلها إلى `thekra.vercel.app` فقط: الكتالوج والنصوص،
  والمزامنة إن سجّلت الدخول. لا يُرسل برنامج ترك المعصية أبدًا (وليس في الإضافة أصلًا).
- **البناء:** `pnpm --filter thekra-extension build` ثم حمّل `dist/chrome` أو `dist/firefox` (الخطوات بالإنجليزية أدناه).

## Build

```sh
pnpm --filter thekra-extension typecheck   # tsc --noEmit
pnpm --filter thekra-extension test        # vitest (Node, no DOM)
pnpm --filter thekra-extension build       # dist/chrome, dist/firefox, and a .zip of each when `zip` exists
```

`scripts/build.mjs`:

1. **Catalog.** `scripts/gen-catalog.mjs` reads `backend/prisma/taxonomy/deed-schedules.yaml` with
   `scripts/mini-yaml.mjs`, a strict reader for that file's subset (block maps and lists, flow `{}`/`[]`, quoted and
   plain scalars; anything else throws). No YAML dependency. Its output was checked identical to js-yaml 4.3.2 on the
   current file. It writes `src/generated/catalog.json` (git-ignored; habits only). Outside the monorepo set
   `THEKRA_SCHEDULES_YAML=/path/to/deed-schedules.yaml`, or the script falls back to `GET /v1/practice/catalog`.
   At runtime the extension prefers the API catalog (cached, refreshed at most daily) and falls back to the bundled one.
2. **Bundles.** esbuild, ESM, unminified (readable for store review), `chrome114` / `firefox121`. `@thekra/practice-core`
   and the catalog are inlined, so the extension needs nothing from the monorepo at runtime.
3. **Icons.** 16/32/48/128 px from `assets/icon.svg` (a copy of `frontend/src/app/icon.svg`): `rsvg-convert` if present,
   else Playwright's Chromium (`playwright` resolvable, `$PLAYWRIGHT_MODULE`, or `npm root -g`), else the committed
   PNGs in `assets/icons/`. ImageMagick is not used (without librsvg it cannot read SVG). The committed PNGs were
   rendered with Playwright Chromium (`node scripts/icons.mjs`).

## Account sync (optional)

Sync contract: [docs/plan/2026-10-practice-sync-contract.md](../docs/plan/2026-10-practice-sync-contract.md) §3, §5.

- **Storage:** practice-core Store v2 in `thekra.store` (plans carry `habitKey`, `rule` and `updatedAt`; tombstones;
  `sync.lastSyncedAt` and `acked`). Every edit goes through the practice-core store helpers (`upsertPlan`,
  `updatePlan`, `deletePlan`, `updateSettings`). `thekra.prefs` holds device-only UI prefs: language, quiet days,
  onboarded. The first version (Store v1, plan id = habit key, rules in prefs) is upgraded once by the background:
  plans get UUID ids (the API requires them), `habitKey`, and their rule in `Plan.rule`.
- **Sign-in:** email + password in Settings → `POST /v1/auth/login`; tokens in `thekra.auth` (`chrome.storage.local`),
  the password is never stored. The access token is refreshed (`POST /v1/auth/refresh`) a minute before it expires
  and on a 401 (one retry); a rejected refresh token signs out. Sign-out (`POST /v1/auth/logout`, best effort) drops the
  tokens, keeps all local data and resets `store.sync` so a later sign-in sends everything again.
- **Sync** (`src/sync-runner.ts`, run only in the background, one at a time): `buildSyncRequest` → keep **plans and
  logs only** → `POST /v1/me/practice/sync` → `applyServerChanges` into the store as it is in storage at that moment
  (edits made during the request stay pending). Relatives, contacts and settings that come back are kept but never
  sent or shown. A body with a `programs` key is never sent. Large first syncs go out in rounds of 500 items.
- **When:** on sign-in, when the popup opens, 3 s after a local edit that left something to send, and on a 15-minute
  `sync` alarm while signed in. The popup shows the last result (synced at HH:MM, offline, error, session ended).
- No extra permission: the API host permission already covers `/v1/auth/*` and `/v1/me/practice/*`.

## Load unpacked

- **Chrome / Edge:** `chrome://extensions` (or `edge://extensions`) → Developer mode → Load unpacked → `dist/chrome`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`.
  Firefox has no notification buttons: log from the popup. If Firefox has not granted the API host permission
  (it can be opt-in for MV3 add-ons), the popup shows a button to allow it.

## Files

| Path | What |
| --- | --- |
| `src/background.ts` | Service worker (Firefox: background script). Alarms, notifications, buttons, cache refresh |
| `src/popup/` | Onboarding/settings and the Today view (plain DOM, logical CSS, RTL in Arabic, site palette) |
| `src/scheduler.ts` | Pure: next reminder instants from plans + rules + quiet days + Hijri offset |
| `src/quotes.ts` | Pure: which published quote a notification shows, labels, notification text |
| `src/progress.ts` | Pure: adherence band, increase, ebb, Ramadan season (all through practice-core) |
| `src/state.ts` | Storage envelope (Store v2 via `serializeStore` / `parseStore`, UI prefs, v1 upgrade) |
| `src/cache.ts` | The two public API calls and their daily caches |
| `src/auth.ts` | Sign-in, token refresh on expiry and on 401, sign-out |
| `src/sync-runner.ts` | Pure sync run (plans and logs only), status, `programs` guard |
| `src/messages.ts` | Popup → background messages (`ready`, `sync`, `signIn`, `signOut`) |
| `_locales/{ar,en}/messages.json` | All UI strings (also bundled, so the chosen language applies everywhere) |
| `scripts/` | build, catalog generator, YAML reader, icons, manifests |

## Store submission checklist

- [ ] **Chrome Web Store:** developer account (one-time registration fee), upload `dist/thekra-chrome-<version>.zip`.
      Edge Add-ons accepts the same zip (free account).
- [ ] **Firefox AMO:** free account, upload `dist/thekra-firefox-<version>.zip`. The add-on id is the placeholder
      **`thekra@akhera-plants`** (`scripts/manifest.mjs`); keep it forever once published. `data_collection_permissions`
      is set to `none`. The bundles are not minified, so no separate source upload should be needed.
- [ ] **Privacy policy URL** (required by both stores): publish [PRIVACY.md](./PRIVACY.md) on the site
      (e.g. `https://thekra-web.vercel.app/privacy/extension`) and paste the URL in both dashboards.
- [ ] Permission justifications: `alarms` (reminder times and the 15-minute sync), `notifications` (the reminder),
      `storage` (plans on the device), host `thekra.vercel.app` (catalog, published texts, optional account sync).
      No remote code, no content scripts.
- [ ] Store "data usage" forms: with sign-in the extension handles authentication information (tokens) and the
      user's habit data, sent only to the Thekra API for the user's own account; Firefox `data_collection_permissions`
      may need updating from `none` before submission (check AMO's current categories).
- [ ] Store texts and screenshots in Arabic and English; single purpose: "reminders for good deeds you choose".
- [ ] The API endpoints `GET /v1/practice/catalog` and `GET /v1/practice/evidence?ids=` must be live in production
      before release (otherwise reminders show no text, by design).
- [ ] Bump `version` in `package.json` for every upload.
