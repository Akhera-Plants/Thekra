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
- **الخصوصية:** كل شيء في `chrome.storage.local` على جهازك. الطلبات الوحيدة: الكتالوج والنصوص من `thekra.vercel.app`.
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
| `src/state.ts` | Storage envelope (`serializeStore` / `parseStore` + extension preferences) |
| `src/cache.ts` | The two API calls and their daily caches |
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
- [ ] Permission justifications: `alarms` (reminder times), `notifications` (the reminder), `storage` (plans on the
      device), host `thekra.vercel.app` (catalog and published texts). No remote code, no content scripts.
- [ ] Store texts and screenshots in Arabic and English; single purpose: "reminders for good deeds you choose".
- [ ] The API endpoints `GET /v1/practice/catalog` and `GET /v1/practice/evidence?ids=` must be live in production
      before release (otherwise reminders show no text, by design).
- [ ] Bump `version` in `package.json` for every upload.
