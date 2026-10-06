# Thekra — Frontend Implementation Plan

> Scope: the Next.js (App Router) web client in [`frontend/`](../../frontend/).
> It is a **pure client of the API** defined in [backend-plan.md](./backend-plan.md) — no private data store, no
> duplicated ranking logic ([ARCHITECTURE §3](../ARCHITECTURE.md)).
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [mobile-plan.md](./mobile-plan.md) ·
> [devops-plan.md](./devops-plan.md) · [roadmap.md](./roadmap.md)

**The constraint that shapes this whole document:** the real UI design, colour palette, branding and fonts
arrive **later**. Everything below is organised so that swapping in the final design system is a **token/config
change, not a rebuild**. Every section that touches this is marked 🎨 and §4.4 lists the exact file set that
changes on design day.

---

## 0. Ground truth about the scaffolded frontend (verified, do not re-derive)

| Fact | Consequence |
| --- | --- |
| `next@16.3.8`, `react@19.2.8` | App Router with **async dynamic APIs**: `params` and `searchParams` are Promises — `const { slug } = await params`. The generated [`layout.tsx`](../../frontend/src/app/layout.tsx) already uses the typed-routes helper `LayoutProps<"/">`; keep using `LayoutProps` / `PageProps` instead of hand-written prop types. |
| **Tailwind CSS v4** (`tailwindcss@^4` + `@tailwindcss/postcss`), configured through [`postcss.config.mjs`](../../frontend/postcss.config.mjs) | **There is no `tailwind.config.ts` and one should not be created.** v4 is CSS-first: design tokens live in [`globals.css`](../../frontend/src/app/globals.css) inside `@theme inline { … }`. The brief's "tailwind.config tokens" maps onto the `@theme inline` block here. |
| [`globals.css`](../../frontend/src/app/globals.css) currently holds only `--background`/`--foreground` and a `prefers-color-scheme` block | This is the generator default and will be **replaced** by the shadcn token block (§4). The `prefers-color-scheme` media query is dropped in favour of a `.dark` class so `next-themes` can switch it. |
| `tsconfig.json` has `paths: { "@/*": ["./src/*"] }` | shadcn aliases (`@/components/ui`, `@/lib/utils`) resolve with no config change. |
| Installed: `@tanstack/react-query@^5`, `axios@^1.20`, `zustand@^5` | The data layer needs **no new dependency** (§6). |
| Lint is ESLint 9 flat config ([`eslint.config.mjs`](../../frontend/eslint.config.mjs)) via `eslint-config-next` | Different from the backend (oxlint). Keep them separate. |
| [`.env.example`](../../frontend/.env.example) sets `NEXT_PUBLIC_API_URL="http://localhost:3000"` | Collides with `next dev`'s own port 3000. The API moves to `3001`; this file is updated in the same commit ([backend-plan §0](./backend-plan.md#0-ground-rules-taken-from-the-existing-repo-do-not-re-derive)). |
| [`frontend/AGENTS.md`](../../frontend/AGENTS.md) is auto-written by `next dev` and says to read `node_modules/next/dist/docs/` before writing code | Treat it as a standing instruction for whoever implements this: **verify Next 16 API details against the bundled docs**, since this Next version post-dates most training data. Do not delete that block. |
| `src/features/*` and `src/lib` contain only `README.md` | Feature slices are filled in place; folder names (`sin-reminder`, `good-deed-motivation`, `quran-hadith-browser`, `favorites`) must not be renamed. |

---

## 1. Architecture in one picture

```
src/
├── app/                              ROUTING ONLY — thin Server Components
│   ├── [locale]/                     added in the i18n step (§5)
│   │   ├── layout.tsx                <html lang dir>, fonts, providers
│   │   ├── page.tsx                  Home — the two entry points
│   │   ├── sins/page.tsx             · sins/[slug]/page.tsx
│   │   ├── good-deeds/page.tsx       · good-deeds/[slug]/page.tsx
│   │   ├── quotes/[id]/page.tsx
│   │   ├── browse/page.tsx
│   │   ├── favorites/page.tsx
│   │   ├── login/page.tsx            · register/page.tsx
│   │   ├── kinship/page.tsx          · kinship/[relativeId]/ · kinship/calendar/   (Phase 4b, proposed)
│   │   ├── branches/page.tsx         · branches/[number]/   (Phase 3b, proposed — slice features/iman-branches)
│   │   └── settings/page.tsx
│   ├── api/auth/[...]/route.ts        httpOnly refresh-cookie handlers (§6.5)
│   └── globals.css                   🎨 design tokens (the swap point)
├── components/
│   ├── ui/                           shadcn primitives — GENERATED, do not hand-edit
│   └── shared/                       app-wide composites (AppShell, LocaleSwitcher, ThemeToggle…)
├── features/                         ONE SLICE PER PRODUCT FLOW (existing folders)
│   ├── sin-reminder/{components,hooks,types}
│   ├── good-deed-motivation/{components,hooks,types}
│   ├── quran-hadith-browser/{components,hooks,types}
│   ├── favorites/{components,hooks,stores}
│   └── kinship/{components,hooks}    NEW slice, Phase 4b, proposed — silat-rahim-plan.md §9
├── lib/                              api client, query setup, types, utils (§6)
├── i18n/                             next-intl routing + request config (§5)
└── messages/                         ar.json, en.json
```

**Rule:** a file under `app/` may contain routing, metadata, data prefetch and layout composition — nothing
else. All UI lives in `features/*` or `components/*`. This is what makes the design swap cheap: the route tree
never has to be touched again.

---

## 2. Route map

`[locale]` ∈ `{ ar, en }`, `ar` default (§5). Auth column: `guest` = no login needed.

| Route | Owning slice | Auth | Renders | API calls ([backend-plan §3](./backend-plan.md#3-rest-api-spec)) |
| --- | --- | --- | --- | --- |
| `/` | `components/shared` + both core slices | guest | Two large entry actions — *"أشعر برغبة في معصية"* / *"أريد عمل حسنة"* — plus a quick search. Opens the picker Sheet/Dialog. | `GET /sins?limit=100`, `GET /good-deeds?limit=100` (prefetched for the picker) |
| `/sins` | `sin-reminder` | guest | Browsable sin catalogue: search, `category` filter, severity sort. | `GET /sins` (#1) |
| **`/sins/[slug]`** | **`sin-reminder`** | guest | **Core screen.** Sin header (`nameAr`, `severity`, `descriptionAr`), ranked reminder cards of mixed type, type-filter chips from `meta.countsByType`, "another reminder" (`shuffle`), and the **constructive alternatives** block from `data.alternatives` linking to `/good-deeds/[slug]`. | `GET /sins/:slug` (#2), **`GET /sins/:slug/quotes`** (#3) |
| `/good-deeds` | `good-deed-motivation` | guest | Deed catalogue with search + category filter. | `GET /good-deeds` (#5) |
| **`/good-deeds/[slug]`** | **`good-deed-motivation`** | guest | **Core screen.** Deed header + **reward** callout (`rewardAr`), ranked motivation cards, `oppositeSin` link. | `GET /good-deeds/:slug` (#6), **`GET /good-deeds/:slug/quotes`** (#7) |
| `/quotes/[id]` | `quran-hadith-browser` | guest | Full quote: Arabic text at reading size, full provenance (`source`, `narrator`, `grade`, `hadithReference`), all translations, tags, and "also relates to" via `relatedSins`/`relatedGoodDeeds`. Shareable/`generateMetadata` target. | `GET /quotes/:id?includeAllTranslations=true` (#9) |
| `/browse` | `quran-hadith-browser` | guest | Direct content browsing: tabs **Quran / Hadith / All**, filters by surah, collection, `grade`, tag, `type`; infinite list. | `GET /quotes` (#8), `GET /quran/surahs` (#10), `GET /hadith/collections` (#14), `GET /tags` (#15), `GET /sources` (#17) |
| `/browse/quran/[surahNumber]` | `quran-hadith-browser` | guest | Ayah list for one surah. | `GET /quran/surahs/:n/ayahs` (#11) |
| `/feelings/[tagSlug]` | `sin-reminder` | guest | The "I only know what I feel" path — enters from an `EMOTION` tag instead of a named sin. | `GET /tags?category=EMOTION` (#15), `GET /quotes?tag=…` (#8) |
| `/favorites` | `favorites` | **user** | Saved quotes, newest first. Shows a sign-in prompt (not a redirect) when anonymous. | `GET /favorites` (#24) |
| `/login`, `/register` | `components/shared/auth` | guest | Email+password forms. **Only reachable by choice** — never a gate on the core flows. | `POST /auth/login` (#20), `POST /auth/register` (#19) |
| `/settings` | `components/shared` | guest | Language toggle (`ar`/`en`), theme toggle, translation-visibility preference, weak-hadith opt-in. | — (local + `GET /auth/me` #22 when signed in) |
| `/admin/**` | *(phase 6, new slice `features/curation`)* | admin | Curation UI over endpoints #28–#57. Deliberately out of scope until the roadmap's phase 6. | admin endpoints |
| `/kinship`, `/kinship/[relativeId]`, `/kinship/calendar` | *(Phase 4b, new slice `features/kinship`, proposed)* | **user** (`SignInPrompt` when anonymous, no redirect) | Private صلة الرحم list: due/overdue list with an optimistic "contacted" action, add/edit sheet, contact history, motivating `QuoteCard`, calendar-feed subscription (copyable `webcal://` link + local QR). Also adds `ForgottenDeedSpotlight` on `/` (guest), a forgotten-deeds filter on `/good-deeds`, and export/delete in `/settings`. Full spec: [silat-rahim-plan §9](./silat-rahim-plan.md#9-frontend). | #62–#83, #5, #7 |
| `/branches`, `/branches/[number]` | *(Phase 3b, new slice `features/iman-branches`, proposed)* | guest | The third path, **شعب الإيمان**: numbered list, then one شعبة with its summary, a collapsed «الشرح» accordion, ranked texts (shared `QuoteCard`, same grade policy), linked deeds and sins, Dorar "read more". Also: a third entry card on `/`, a كبيرة/صغيرة badge on `/sins` and `/sins/[slug]`, a تفسير/شرح accordion on `/quotes/[id]`, "remind me" on every `/good-deeds/[slug]` (Phase 4b amendment), and admin screens. Full spec: [vision-v2-plan §9](./vision-v2-plan.md#9-frontend). | #84–#87, #91–#103, #1–#3, #6 |

Extra route files per segment: `loading.tsx` (Skeleton composition), `error.tsx` (client error boundary with a
retry), plus a root `not-found.tsx`. `/sins/[slug]` and `/good-deeds/[slug]` also get `generateMetadata` using
`nameAr`/`name` for shareable titles.

### 2.1 Rendering strategy per route

| Route | Strategy | Why |
| --- | --- | --- |
| `/`, `/sins`, `/good-deeds` | Server Component fetch + `revalidate: 300` | Catalogues change only when a curator edits them; cheap, fast first paint, SEO-visible. |
| `/sins/[slug]`, `/good-deeds/[slug]` | Server Component for the **intent header**, Client Component for the **quote list** | The header is stable and SEO-relevant; the list is interactive (type chips, `shuffle`, favorite hearts, pagination) and personalised by `isFavorite`. Prefetch the first page on the server and hydrate TanStack Query (§6.4) so there is no spinner on first paint. |
| `/quotes/[id]` | Server Component, `revalidate: 3600` + `generateMetadata` | Quotes are immutable in practice and are the natural share target. |
| `/browse`, `/feelings/[tagSlug]` | Client Component with `useInfiniteQuery` | Filter-heavy and stateful in the URL. |
| `/favorites`, `/settings` | Client Component, `dynamic = 'force-dynamic'` | Per-user, never cached. |

---

## 3. shadcn/ui setup plan 🎨

### 3.1 Init

```bash
# run from frontend/ (NOT the repo root — components.json must sit beside package.json)
pnpm dlx shadcn@latest init
```

Answers / resulting [`frontend/components.json`](../../frontend/) — the file is created at `frontend/components.json`:

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",                       // ← empty: Tailwind v4 has no JS config file
    "css": "src/app/globals.css",
    "baseColor": "neutral",             // 🎨 deliberately neutral until the real palette exists
    "cssVariables": true,               // 🎨 non-negotiable — this is the swap mechanism
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "utils": "@/lib/utils",
    "hooks": "@/hooks"
  }
}
```

Three answers that matter:

- **`tailwind.config: ""`** — the repo is on Tailwind v4. Pointing this at a non-existent `tailwind.config.ts`
  is the single most likely setup mistake; the CLI then writes tokens to the wrong place.
- **`cssVariables: true`** — with `false`, shadcn hard-codes utility colours like `bg-neutral-900` into every
  generated component, and the future palette swap becomes a find-and-replace across dozens of files. With
  `true`, it emits `bg-background`/`text-foreground`, resolved from CSS variables.
- **`baseColor: "neutral"`** — an intentional placeholder. Neutral greys look deliberate rather than
  half-finished while the design is pending, and they do not bias the eventual palette.

What `init` adds/changes (expected diff, so a reviewer is not surprised): `components.json`, `src/lib/utils.ts`
(the `cn()` helper), the token blocks in `src/app/globals.css`, and the dependencies
`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css` (v4's successor to
`tailwindcss-animate`), plus a `@radix-ui/react-*` package per added primitive.

### 3.2 Primitives to install up front

```bash
pnpm dlx shadcn@latest add card tabs command dialog sheet badge skeleton sonner \
  separator scroll-area button input label select popover tooltip dropdown-menu \
  alert accordion avatar toggle-group form
```

| Component | Where it is used | Why it is in the first batch |
| --- | --- | --- |
| `card` | `QuoteCard` — every reminder/motivation item | The single most-rendered component in the app; variants per `QuoteType`. |
| `tabs` | `/browse` (Quran / Hadith / All); the sin↔deed switcher on `/` | Native keyboard + `aria-selected` handling for the primary switch. |
| `command` | The "pick your sin / deed" search (⌘K-style, fuzzy over `nameAr` + `name`) | With ~50–200 catalogue entries, a searchable list beats a dropdown; it is the fastest path at the exact moment of need. |
| `dialog` + `sheet` | The picker entry flow — `Dialog` on desktop, `Sheet` (bottom) on mobile | Opens from `/` without a navigation, so the user is one tap from a reminder. Radix focus-trapping matters here (§7). |
| `badge` | Tags, `grade` (SAHIH/HASAN/DAIF), `type`, `origin` | Authenticity must be *visible*, not buried — a schema-level product requirement ([ARCHITECTURE §1](../ARCHITECTURE.md)). |
| `skeleton` | `loading.tsx` per route; quote-list placeholders | Matches the card geometry so there is no layout shift. |
| `sonner` | "Saved to favorites", "Removed", "Couldn't save — retry" | shadcn's current toast recommendation (the old `toast` component is deprecated). Non-blocking feedback for optimistic mutations. |
| `separator` | Between provenance lines and quote text | Low-noise visual division that is already RTL-aware. |
| `scroll-area` | Long sin lists inside the Sheet; long hadith text | Consistent scrollbars across platforms inside overlays. |
| `button`, `input`, `label`, `form` | Everywhere; auth + filter forms | `form` wires `react-hook-form` + `zod` — add those two deps at the auth step (phase 4), not before. |
| `select`, `popover`, `dropdown-menu`, `toggle-group` | Filters (`type`, `grade`, surah, collection), locale/theme menus | `toggle-group` is the right primitive for the type-filter chips driven by `meta.countsByType`. |
| `tooltip` | Explaining `grade` values and `origin = API_CACHED` | Short definitions without leaving the screen. |
| `alert` | "This narration is weak (ضعيف)" notices; empty states | A content-integrity affordance, not decoration. |
| `accordion` | Translations and `rawPayload`-free provenance details on `/quotes/[id]` | Keeps the Arabic text visually primary. |
| `avatar` | Signed-in header state | Trivial, avoids a second `add` round later. |

Deferred until needed: `table` (phase 6 curation UI), `calendar`/`date-picker` (sync-log filters), `chart`,
`carousel`, `pagination` (the quote list uses a "load more" button, not numbered pages).

### 3.3 Where composed components live — the rule that protects the design swap

| Layer | Path | Hand-edited? | Example |
| --- | --- | --- | --- |
| **Primitives** | `src/components/ui/*` | **No.** Generated by the CLI; re-runnable. Only exception: an unavoidable a11y fix, which must be noted in a comment. | `ui/card.tsx`, `ui/dialog.tsx` |
| **Shared composites** | `src/components/shared/*` | Yes | `AppShell`, `SiteHeader`, `LocaleSwitcher`, `ThemeToggle`, `EmptyState`, `ErrorState`, `ArabicText` |
| **Feature components** | `src/features/<slice>/components/*` | Yes | `sin-reminder/components/SinPickerSheet.tsx`, `ReminderList.tsx` |
| **Cross-feature content components** | `src/components/shared/quote/*` | Yes | `QuoteCard`, `QuoteCardSkeleton`, `GradeBadge`, `SourceAttribution`, `FavoriteButton` |

`QuoteCard` sits in `components/shared/quote/` rather than in a feature slice **on purpose**: identical quote
rendering is needed by `sin-reminder`, `good-deed-motivation`, `quran-hadith-browser` and `favorites`. It takes
`{ quote: QuoteDto; link?: { relevanceScore, note }; variant?: 'compact' | 'full' }` and switches on
`quote.type` internally — one place to change when a verse card and a hadith card should look different.

Planned feature components:

```
features/sin-reminder/components/      SinPickerSheet, SinSearchCommand, SinList, SinHeader,
                                       ReminderList, ReminderTypeFilter, AnotherReminderButton,
                                       AlternativeDeedsBlock, FeelingEntryGrid
features/good-deed-motivation/components/
                                       GoodDeedPickerSheet, GoodDeedList, GoodDeedHeader,
                                       RewardCallout, MotivationList, OppositeSinLink
features/quran-hadith-browser/components/
                                       BrowseTabs, QuoteFilters, SurahSelect, CollectionSelect,
                                       GradeFilter, InfiniteQuoteList, QuoteDetail
features/favorites/components/         FavoritesList, FavoriteButton (re-export of shared), SignInPrompt
features/kinship/components/           (Phase 4b, proposed) DueList, MarkContactedButton, RelativeFormSheet,
                                       ContactHistory, DeedReminderList, KinshipMotivation, CalendarSubscribeCard …
                                       — full list in silat-rahim-plan.md §9.2
```

Phase 4b note ([silat-rahim-plan §9.2](./silat-rahim-plan.md#92-feature-slice-featureskinship-new-slice--owner-approval-needed)):
`SignInPrompt` moves to `components/shared/auth/` because `/kinship` needs it too, and slices never import each
other. `good-deed-motivation` gains `ForgottenDeedSpotlight` and `ForgottenDeedsFilterChip`.

Phase 3b note ([vision-v2-plan §9.2](./vision-v2-plan.md#92-slices-and-components)): a **new slice
`features/iman-branches`** (proposed; needs the owner's `frontend/.cursorrules` slice-list update) with
`BranchList`, `BranchHeader`, `BranchPractices`, `BranchExplanations`, `BranchNav`, `BranchEntryCard`; new
presentational shared components `components/shared/quote/ExplanationAccordion`,
`components/shared/ExternalReferenceLinks` and `components/shared/SinRankBadge`; `curation` gains branch,
explanation and external-ref editors. Contract changes are mirrored in `mobile/src/lib/types/api.ts`.

---

## 4. Theming plan — deferring the real palette 🎨

### 4.1 Mechanism

shadcn CSS-variable theming on Tailwind v4: semantic variables are declared once in
[`src/app/globals.css`](../../frontend/src/app/globals.css) and mapped into Tailwind's theme with `@theme inline`.
Components then only ever reference **semantic** utilities (`bg-background`, `text-muted-foreground`,
`border-border`, `ring-ring`) — never a literal colour.

Target shape of `globals.css` (values are placeholders; structure is final):

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* 🎨 ---------- SWAP POINT: the real palette replaces ONLY these values ---------- */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  /* Thekra-specific semantic tokens, added by us (not shadcn defaults) */
  --grade-sahih: var(--primary);
  --grade-hasan: var(--primary);
  --grade-daif: var(--muted-foreground);
  --intent-sin: var(--foreground);          /* the "discouraging" context */
  --intent-good-deed: var(--foreground);    /* the "motivating" context */
}
.dark { /* same keys, dark values */ }
/* 🎨 ---------------------------- END SWAP POINT ---------------------------- */

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* …one mapping per variable above… */
  --color-grade-sahih: var(--grade-sahih);
  --color-intent-sin: var(--intent-sin);
  --font-sans: var(--font-ui);
  --font-arabic: var(--font-arabic);
  --radius-lg: var(--radius);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

Two deliberate additions beyond stock shadcn:

1. **`--grade-*` tokens.** Hadith grade must be colour-coded eventually. Declaring the tokens now — all aliased
   to neutral values — means `GradeBadge` is written once against `bg-grade-sahih` and the designer later gives
   those four variables real values without touching the component.
2. **`--intent-sin` / `--intent-good-deed`.** The two core flows will almost certainly be visually
   differentiated (a warning register vs an encouraging one). Reserving the tokens now keeps that from becoming
   a component rewrite.

### 4.2 Light/dark now, colours later

Add **`next-themes`** immediately, before the palette exists:

- `ThemeProvider` in the locale layout with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `disableTransitionOnChange`.
- Replace the generator's `@media (prefers-color-scheme: dark)` block with a `.dark` class block — a media query cannot be overridden by a user toggle, which is exactly what a reader-oriented app needs at night.
- `suppressHydrationWarning` on `<html>` (required by `next-themes`).
- `ThemeToggle` in `components/shared`.

Doing this now, with neutral colours, means the dark variant is already structurally correct and the designer
fills in one extra column of values. Retrofitting dark mode after the palette lands is the expensive order.

### 4.3 Typography placeholder 🎨

Two font slots, both placeholders, both consumed only via CSS variables:

| Slot | Variable | Placeholder | Used for |
| --- | --- | --- | --- |
| Arabic / content | `--font-arabic` | **`Noto Naskh Arabic`** via `next/font/google` (`subsets: ['arabic']`, `display: 'swap'`) | All `textAr`, Quran verses, hadith text, Arabic UI |
| Latin / UI | `--font-ui` | Keep the scaffolded **Geist** for now | English UI, numbers, code-ish metadata |

Guidance for the eventual choice (the designer decides, this is the brief): Quranic text is traditionally set in
**Naskh**, which is calmer and more authoritative for scripture than the geometric/Kufi families; whatever is
picked needs a genuine Arabic glyph set with tashkeel support (Noto Naskh Arabic, Amiri, KFGQPC Uthmanic are the
realistic candidates — Amiri and Uthmanic specifically for verse display). Arabic needs **larger line-height
than Latin** (`leading-loose` on verse text, ~1.9–2.1) because diacritics occupy vertical space; bake that into
an `ArabicText` / `.verse-text` utility rather than per-component classes. Never render Arabic in a Latin font
with a fallback — it produces inconsistent glyph shaping.

Also drop the generator's `body { font-family: Arial, Helvetica, sans-serif }` from `globals.css`: it silently
overrides the font variables.

### 4.4 🎨 Exactly what changes on design day

**Changes (expected):**

| File | Change |
| --- | --- |
| `src/app/globals.css` | The `:root` + `.dark` variable values between the two 🎨 markers. Possibly a few new `@theme inline` mappings for brand-specific tokens. |
| `src/app/[locale]/layout.tsx` | The two `next/font` declarations (font family swap only — the variable names `--font-arabic` / `--font-ui` stay). |
| `components.json` | `baseColor` (affects only *future* `shadcn add` output, not existing files). |
| `public/` + `app/icon.*` | Logo, favicon, OG image. |
| `messages/{ar,en}.json` | Final brand/marketing copy. |

**Must NOT change:** any file under `src/components/ui/`, any file under `src/features/`, any route file, the
API client, or the query hooks. **If a palette change forces a component edit, the component was written
wrong** (it hard-coded a colour) — that is the review rule for every PR from phase 3 onward.

Enforcement: an ESLint rule (or a CI `grep` in [devops-plan §2](./devops-plan.md#2-continuous-integration-github-actions))
banning literal Tailwind colour utilities (`bg-neutral-*`, `text-gray-*`, `#rrggbb`, `rgb(`) outside
`globals.css`.

---

## 5. i18n & RTL plan

### 5.1 Library: `next-intl`

**Decision: `next-intl`.** It is the App-Router-native option: locale-segment routing, middleware-based
negotiation, `getTranslations` in Server Components *and* `useTranslations` in Client Components from one
message catalogue, and typed message keys. `next-i18next` is Pages-Router-era; raw `react-i18next` would mean
hand-rolling routing and losing server-side translation; `next-intl` also carries ICU plural/number/date
formatting, which Arabic needs (Arabic has six plural categories — `zero`, `one`, `two`, `few`, `many`,
`other`).

### 5.2 Files

```
src/i18n/routing.ts        defineRouting({ locales: ['ar','en'], defaultLocale: 'ar', localePrefix: 'as-needed' })
src/i18n/request.ts        getRequestConfig — loads messages/<locale>.json
src/i18n/navigation.ts     typed Link / redirect / usePathname / useRouter wrappers
src/middleware.ts          createMiddleware(routing) — locale negotiation + redirect
messages/ar.json           PRIMARY catalogue (source of truth for UI copy)
messages/en.json           secondary
next.config.ts             wrapped with createNextIntlPlugin()
```

`localePrefix: 'as-needed'` keeps Arabic URLs clean (`/sins/ghibah`) and prefixes only English
(`/en/sins/ghibah`). Arabic is the default because it is the audience's and the content's language.

**This step restructures `src/app`:** the existing `app/layout.tsx` and `app/page.tsx` move under
`app/[locale]/`, with a minimal root `app/layout.tsx` retained (next-intl requires the `<html>` tag inside the
locale layout for `dir`). Do this **once, early in phase 3**, before many routes exist — doing it in phase 8
would mean moving a dozen route files.

### 5.3 `dir` handling

```tsx
// src/app/[locale]/layout.tsx  (shape)
export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;                      // Next 16: params is a Promise
  if (!hasLocale(routing.locales, locale)) notFound();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning
          className={`${arabicFont.variable} ${uiFont.variable}`}>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>{children}</QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

`dir` is set **once, on `<html>`**, from the locale. No per-component `dir` juggling and no `dir` in client
state — one source of truth.

**Mixed-direction content is the real hazard:** Arabic UI (`dir=rtl`) will contain LTR runs — `"Bukhari 13"`,
`49:12`, provider names, emails. Handle it where it occurs, not globally:
`<bdi>` or `<span dir="ltr" className="inline-block">` around references and numerals, and `font-variant-numeric`
decisions (Western vs Arabic-Indic digits) made once in `ArabicText`. Verse numbering shown as `٤٩:١٢` vs
`49:12` is a product choice — surface it in `/settings` and default to Arabic-Indic in `ar`.

### 5.4 Tailwind RTL conventions (enforced in review)

| Use | Not |
| --- | --- |
| `ps-4` / `pe-4` | `pl-4` / `pr-4` |
| `ms-auto` / `me-2` | `ml-auto` / `mr-2` |
| `text-start` / `text-end` | `text-left` / `text-right` |
| `start-0` / `end-0` | `left-0` / `right-0` |
| `border-s` / `border-e` | `border-l` / `border-r` |
| `rounded-s-lg` / `rounded-e-lg` | `rounded-l-lg` / `rounded-r-lg` |
| `rtl:-scale-x-100` on directional icons (chevrons, back arrows) | shipping a left-pointing "back" arrow in RTL |

Tailwind v4 ships these logical utilities natively — no RTL plugin is needed. Note that generated
`components/ui/*` files sometimes contain physical properties; when a primitive visibly breaks in RTL, fix it in
the generated file and leave a comment (§3.3's documented exception). `flex-row` + `order-*` are
direction-agnostic and safe. **Every PR from phase 3 on must be eyeballed in both directions** — add a
`?_dir=ltr` dev-only override or just switch the locale.

### 5.5 Content vs UI language — the critical distinction

`textAr` is **content** and is always rendered in Arabic, regardless of UI locale. Switching the UI to English
switches labels, buttons and descriptions, and attaches the `en` `Translation` under the Arabic — it never
replaces the Arabic text. The API enforces the same rule ([backend-plan §2.4](./backend-plan.md#24-locale-and-translations)).
Practically: the UI locale drives `lang`/`dir`; the `?lang=` query param drives which `Translation` is attached;
a quote card in English UI still shows `textAr` first, in `--font-arabic`, `dir="rtl"` on that element.

---

## 6. State & data-fetching plan

### 6.1 Division of responsibility

| Concern | Tool | Rule |
| --- | --- | --- |
| Server state (sins, deeds, quotes, favorites) | **TanStack Query v5** | Everything that comes from the API. No duplication into Zustand. |
| Small client-only UI state | **Zustand v5** | Only state with no server counterpart (§6.6). |
| URL-shaped state (filters, pagination, active tab) | **`useSearchParams` + router** | Shareable and back-button-correct; a filtered `/browse` view must be linkable. |
| Form state | `react-hook-form` + `zod` (added with shadcn `form`, phase 4) | Auth and admin forms only. |
| Theme | `next-themes` | Not Zustand. |
| Locale | `next-intl` + the URL segment | Not Zustand. |
| Auth session | httpOnly cookie + a `useSession` query (§6.5) | Access token never in `localStorage`. |

### 6.2 `src/lib` layout

```
src/lib/
├── api-client.ts        the single axios instance + interceptors
├── api/
│   ├── sins.ts          getSins, getSin, getSinQuotes, getSinAlternatives
│   ├── good-deeds.ts    getGoodDeeds, getGoodDeed, getGoodDeedQuotes
│   ├── quotes.ts        getQuotes, getQuote
│   ├── quran.ts         getSurahs, getSurahAyahs, getAyah
│   ├── hadith.ts        getHadith, getHadithCollections
│   ├── tags.ts          getTags, getTag
│   ├── sources.ts       getSources, getSource
│   ├── auth.ts          login, register, refresh, me, logout
│   ├── favorites.ts     getFavorites, getFavoriteQuoteIds, addFavorite, removeFavorite
│   └── kinship.ts       Phase 4b, proposed — endpoints #62–#79 (silat-rahim-plan.md §9.3)
├── types/
│   ├── api.ts           QuoteDto, SinDto, GoodDeedDto, SinQuotesResponse, PageMeta, ApiError…
│   └── enums.ts         QuoteType, QuoteOrigin, HadithGrade, TagCategory, SourceType, SyncStatus
├── query-client.ts      createQueryClient() — shared defaults
├── query-keys.ts        the whole key factory, one file
├── providers.tsx        QueryProvider (client) with a per-request QueryClient
├── env.ts               validated NEXT_PUBLIC_* access (never raw process.env in components)
└── utils.ts             cn() (created by shadcn init) + formatters
```

`src/lib/types/api.ts` is **hand-written to mirror the backend DTOs** in phase 3, with a comment pointing at
[backend-plan §3.1](./backend-plan.md#31-shared-response-shapes) as the contract. A generated
`packages/shared-types` workspace package (or OpenAPI codegen) is the right long-term answer and is listed in
Open Decisions / [mobile-plan §5](./mobile-plan.md#5-relationship-to-the-web-frontend) — **not built now**.
Enums are re-declared as `const` objects + union types rather than imported from `@prisma/client`, so the
frontend never depends on a backend package.

### 6.3 `api-client.ts`

```ts
// shape only
export const apiClient = axios.create({
  baseURL: `${env.NEXT_PUBLIC_API_URL}/v1`,   // note the /v1 prefix lives here, once
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});
```

- **Response interceptor unwraps the envelope**: returns `response.data.data` and stashes `meta`, so hooks deal
  in domain objects while list hooks can still read `meta`. Concretely: typed helpers `get<T>()` returning
  `{ data: T; meta?: PageMeta }` — the `{ data, meta }` convention from
  [backend-plan §2.2](./backend-plan.md#22-response-envelope) is decoded in exactly one place.
- **Error interceptor** normalises the `{ error: { code, message, details } }` body into a typed
  `ApiError extends Error` carrying `code`, `status`, `details`. UI switches on `error.code`, never on message text.
- **`lang` injection**: a request interceptor appends `lang` from the active locale so no call site repeats it.
- **Auth**: `Authorization: Bearer` from the in-memory access token; on `401` with `code = 'UNAUTHENTICATED'`,
  call the refresh route **once**, queue concurrent failures, retry, and on second failure clear the session and
  surface a sign-in prompt. Never retry a `403`.
- **Server vs client**: the same module is used on both sides; a `createServerApiClient()` variant forwards
  cookies/headers for RSC fetches.

### 6.4 Query conventions

```ts
// src/lib/query-keys.ts
export const queryKeys = {
  sins: {
    all: ['sins'] as const,
    list: (p: SinsQuery) => ['sins', 'list', p] as const,
    detail: (slug: string) => ['sins', 'detail', slug] as const,
    quotes: (slug: string, p: SinQuotesQuery) => ['sins', slug, 'quotes', p] as const,
  },
  goodDeeds: { /* mirror */ },
  quotes: { detail: (id: string) => ['quotes', id] as const, list: (p) => ['quotes', 'list', p] as const },
  favorites: { all: ['favorites'] as const, quoteIds: ['favorites', 'quote-ids'] as const },
  session: ['session'] as const,
} as const;
```

Defaults in `createQueryClient()`: `staleTime: 60_000` (5 min for catalogue queries), `gcTime: 300_000`,
`retry: (count, err) => count < 2 && err.status >= 500` (never retry `4xx`), `refetchOnWindowFocus: false`
(refetching a reminder screen when the user tabs back would reshuffle what they are reading — actively bad
here).

Server prefetch + hydration for the core routes: the Server Component builds a `QueryClient`, `prefetchQuery`s
the first page, and passes `dehydrate(qc)` into a `HydrationBoundary`, so `/sins/[slug]` paints the first
reminders with **no loading state** and the client takes over for interaction.

Hook layout (one hook per endpoint, inside the owning slice):

```
features/sin-reminder/hooks/useSins.ts            useQuery(queryKeys.sins.list)
features/sin-reminder/hooks/useSin.ts
features/sin-reminder/hooks/useSinQuotes.ts       ← the core hook; supports type filter + shuffle + load-more
features/sin-reminder/hooks/useEmotionTags.ts
features/good-deed-motivation/hooks/useGoodDeeds.ts
features/good-deed-motivation/hooks/useGoodDeed.ts
features/good-deed-motivation/hooks/useGoodDeedQuotes.ts
features/quran-hadith-browser/hooks/useQuoteSearch.ts   useInfiniteQuery
features/quran-hadith-browser/hooks/useQuote.ts
features/quran-hadith-browser/hooks/useSurahs.ts
features/quran-hadith-browser/hooks/useHadithCollections.ts
features/favorites/hooks/useFavorites.ts
features/favorites/hooks/useFavoriteQuoteIds.ts
features/favorites/hooks/useToggleFavorite.ts     ← optimistic mutation + sonner toast + rollback
```

Rules: a component never calls `apiClient` directly — always through a hook; a hook never contains JSX; hooks
return TanStack Query results unchanged (no bespoke `{ loading, data }` re-wrapping).

`useToggleFavorite` is the one mutation in the MVP: optimistically flip `isFavorite`, `cancelQueries` +
snapshot + rollback on error, invalidate `favorites.all` and `favorites.quoteIds` on settle, `sonner` toast on
both outcomes. When anonymous it does not call the API at all — it opens the sign-in prompt, because favoriting
is the *only* reason to have an account.

### 6.5 Auth/session on the client (phase 4)

Refresh token in an **httpOnly, `Secure`, `SameSite=Lax` cookie** written by a Next.js route handler
(`src/app/api/auth/session/route.ts`) that proxies `POST /v1/auth/login` and `POST /v1/auth/refresh`. The access
token lives in memory only (a module variable + a `session` query). Rationale: a token in `localStorage` is
readable by any XSS, and this app will render user-independent but third-party-sourced text — minimise blast
radius. Middleware does **not** gate routes: `/favorites` renders a `SignInPrompt` instead of redirecting,
keeping the guest-first promise.

### 6.6 Zustand — deliberately tiny

One store, `src/features/sin-reminder/stores/session-intent.store.ts` (plus a deed equivalent or a single shared
store):

```ts
type IntentSessionState = {
  pickerOpen: boolean;                      // the Dialog/Sheet
  pickerMode: 'sin' | 'good-deed' | null;
  lastViewedSinSlug: string | null;         // "continue where you left off"
  lastViewedGoodDeedSlug: string | null;
  varietySeed: string | null;               // stable `shuffle` seed for this session
  open(mode): void; close(): void; setSeed(s): void;
};
```

Plus `src/lib/stores/preferences.store.ts` (persisted to `localStorage` via `zustand/middleware`):
`showTranslation`, `includeWeakHadith`, `arabicNumerals`, `fontScale`. These are device preferences with no
server counterpart; persisting them is what makes the app feel personal **without an account**.

**Not in Zustand:** API data, theme, locale, filter state. If a piece of state could be answered by a query or
read from the URL, it does not belong here.

---

## 7. Accessibility plan

This is a **sensitive, emotional use case** — someone may open the app in distress or shame. A11y here is not
compliance decoration; it decides whether the app is usable at the moment it is needed.

### 7.1 The picker Dialog/Sheet (the highest-stakes interaction)

- Radix handles focus trap + restore; **do not** override `onOpenAutoFocus` except to move focus to the search
  `Input` (which is the desired target: the user should be able to type their sin immediately).
- `Command` (cmdk) owns arrow-key navigation and `aria-activedescendant`; items need accessible names that read
  well in Arabic — bind the Arabic name as the primary label, the English as a secondary description.
- `DialogTitle` + `DialogDescription` are **mandatory** (Radix warns otherwise). If the title is visually hidden
  for design reasons, use `VisuallyHidden`, never omit it.
- On close, focus returns to the trigger. When a sin is selected and the app navigates to `/sins/[slug]`, focus
  must move to the result heading (`<h1 tabIndex={-1}>` + `.focus()` on mount) — otherwise a screen-reader user
  lands on a new page with focus on a button that no longer exists.
- Escape closes without choosing, and no choice is ever persisted implicitly. **Nothing about a user's sin
  selection is sent anywhere identifying it to an account** in phase 3/4 — no analytics event naming the sin.
  State that explicitly in the privacy copy; it is a trust requirement for this product.

### 7.2 The reminder/motivation list

- `aria-live="polite"` on a status region announcing "عرض ١٠ تذكيرات" / "Showing 10 reminders" after a fetch, so
  shuffle and filter changes are announced rather than silent.
- Each card is an `<article>` with an `aria-labelledby` pointing at the quote text; `grade` and `type` badges
  carry a text alternative (`aria-label="حديث صحيح"`) rather than relying on colour.
- `FavoriteButton` is a real `<button>` with `aria-pressed` and an accessible name that includes *what* is being
  saved; the icon alone is never the label.
- "Another reminder" (`shuffle`) must not steal focus or scroll-jump; keep the heading stable and re-render the
  list beneath it.
- `prefers-reduced-motion`: disable card entrance animations and any carousel transition.

### 7.3 Baseline across the app

- Keyboard-complete: every interactive element reachable and operable; a visible focus ring from `--ring`
  (never `outline: none` without a replacement).
- Contrast: the neutral placeholder palette must already pass WCAG AA (4.5:1 body, 3:1 large). **Contrast is a
  stated acceptance criterion handed to the designer with the palette**, re-verified in phase 8.
- Arabic text: minimum 18px for verse/hadith bodies with `leading-loose`; a `fontScale` preference (§6.6) for
  larger. Never justify Arabic text with `text-align: justify` (it degrades word shaping).
- Semantic headings per page, one `<h1>`, skip-to-content link in `AppShell`.
- Images/icons decorative → `aria-hidden`; meaningful → labelled.
- Forms: every `Input` has a real `<Label htmlFor>`; errors tied by `aria-describedby`; error text is never
  colour-only.
- Tooling: `eslint-plugin-jsx-a11y` (comes with `eslint-config-next`) kept at error level; an `axe` pass per
  route in the phase 8 audit ([roadmap](./roadmap.md)).

---

## 8. Dependencies to add (nothing installed in this task)

| Phase | Package | Purpose |
| --- | --- | --- |
| 3 | `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`, `@radix-ui/react-*` | installed automatically by `shadcn init` / `add` |
| 3 | `next-themes` | light/dark scaffolding before the palette (§4.2) |
| 3 | `next-intl` | i18n + RTL routing (§5) |
| 3 | `sonner` | toasts (pulled in by `shadcn add sonner`) |
| 4 | `react-hook-form`, `zod`, `@hookform/resolvers` | auth + admin forms (pulled in by `shadcn add form`) |
| 4b | `qrcode.react` (or an equivalent local renderer) — **pending owner approval** | QR for the calendar-feed link, rendered locally and never through a remote QR service ([silat-rahim-plan §15](./silat-rahim-plan.md#15-dependencies-and-configuration)) |
| 8 | `@axe-core/react` or `axe-playwright` (dev) | accessibility audit pass |

Already present, do not re-add: `@tanstack/react-query`, `axios`, `zustand`, `tailwindcss` v4.

---

## 9. Testing (frontend)

No test runner is configured in `frontend/` yet. Recommendation, introduced in phase 3 and **not** retrofitted
later:

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit / component | **Vitest** + `@testing-library/react` + `jsdom` | `QuoteCard` per `QuoteType`; `GradeBadge`; the envelope-unwrapping interceptor; the Arabic/LTR `<bdi>` helper. Matches the backend's runner, so one mental model. |
| Hooks | Vitest + `msw` | `useSinQuotes` ordering/pagination/shuffle; `useToggleFavorite` optimistic rollback. `msw` fixtures are copied from the response examples in [backend-plan §3](./backend-plan.md#3-rest-api-spec) — they double as the contract check. |
| E2E | **Playwright** (phase 4+) | The two core flows end-to-end, in **both** `ar` (RTL) and `en` (LTR); guest → favorite → sign-in prompt. |

Minimum bar for phase 3: `pnpm --filter frontend build` and `tsc --noEmit` clean, plus component tests for
`QuoteCard` and the core hooks. Full E2E is a phase 4 deliverable.

---

## 10. Build order for Cursor

1. `src/lib/env.ts`, `api-client.ts`, `types/api.ts`, `types/enums.ts`, `query-keys.ts`, `query-client.ts`, `providers.tsx` — verified against a running backend with a single `getSins()` call.
2. `shadcn init` + the §3.2 `add` batch; replace `globals.css` with the token structure in §4.1; remove the `Arial` body override.
3. `next-themes` + `ThemeToggle`.
4. `next-intl`: move `app/*` → `app/[locale]/*`, add `i18n/`, `middleware.ts`, `messages/{ar,en}.json`, wrap `next.config.ts`. **Do this before building routes.**
5. `components/shared`: `AppShell`, `SiteHeader`, `LocaleSwitcher`, `ThemeToggle`, `EmptyState`, `ErrorState`, `ArabicText`.
6. `components/shared/quote`: `QuoteCard`, `QuoteCardSkeleton`, `GradeBadge`, `SourceAttribution`.
7. `sin-reminder`: hooks → `SinList`/`SinSearchCommand` → `SinPickerSheet` → `/sins`, `/sins/[slug]` with `ReminderList`, `ReminderTypeFilter`, `AlternativeDeedsBlock`.
8. `good-deed-motivation`: the mirror, reusing `QuoteCard` and the list components; `RewardCallout` is the only genuinely new piece.
9. `/` home with both entry points wired to the picker.
10. `quran-hadith-browser`: `/browse`, `/browse/quran/[surahNumber]`, `/quotes/[id]`.
11. `/feelings/[tagSlug]` (emotion entry).
12. Phase 4: auth routes, session plumbing, `favorites` slice, `FavoriteButton` activation.
13. Phase 3b (proposed, after approval): `src/lib` types/api/keys → shared `ExplanationAccordion`,
    `ExternalReferenceLinks`, `SinRankBadge` → `features/iman-branches` + `/branches`, `/branches/[number]` →
    home third card → sin/deed/quote-detail additions → `curation` editors — order in
    [vision-v2-plan §17](./vision-v2-plan.md#17-for-cursor--build-order).

Steps 1–11 are phase 3 in the [roadmap](./roadmap.md); the palette swap-in is phase 8 and, if §4.4 holds, costs
one file plus fonts.
