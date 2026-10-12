# The Sakina (سكينة) Design Language

> Status: **decided and partially applied.** This document records the design direction the owner chose —
> names, rationale and every token value — and tracks where it has and hasn't been applied yet. It is the
> companion to [`frontend-plan.md` §3–§4](./frontend-plan.md#3-shadcnui-setup-plan-) (the shadcn-on-Tailwind-v4
> swap mechanism this design fills in) and [`design-system.mdc`](../../frontend/.cursor/rules/design-system.mdc)
> (the structural rules this design must obey). **Source of truth for every numeric value: the `:root`/`.dark`
> block between the 🎨 SWAP POINT markers in
> [`frontend/src/app/globals.css`](../../frontend/src/app/globals.css#L82-L205).** This document explains and
> summarizes those values; if the two ever disagree, `globals.css` is correct and this document is stale.

## 1. Name and rationale

**سكينة (Sakina)** — tranquility, stillness, the calm that settles a heart. It is the exact feeling the product
exists to offer in the moment it's needed most: someone feeling pulled toward a sin, or moved to do something
good, opens the app in that moment, not browsing idly. The visual language has to earn that feeling, not fight
it.

Two choices this rejects on purpose:

- **The bright-green-and-gold cliché.** Most Islamic reminder/azkar apps default to saturated emerald green plus
  gold accents. It reads as a category signifier ("this is an Islamic app") rather than a considered choice, and
  high-saturation green/gold next to long-form reading text is visually loud — closer to a devotional-kitsch
  aesthetic than a calm one.
- **Dense geometric ornament as a filled surface.** Islamic geometric pattern is often used today as wallpaper —
  tiled across a whole background. Historically that is not the pattern's dominant role: in manuscript and
  architectural tradition, geometric ornament most often **forms a border or frame around a textual or
  figurative field, or recedes into a supporting role around the real subject** — it does not compete with what
  it surrounds. Sakina keeps that historical relationship: one thin outlined motif, in the corner, never a
  background fill.

What Sakina does instead:

- **Warm-neutral base ("parchment"), not stark white/black.** Reading apps that use pure white backgrounds for
  long sessions cause more eye strain than an off-white, warm paper tone — the same reasoning print typography
  has used for centuries for long-form Arabic manuscript pages, and the same reasoning behind "night mode" warm
  tones in reading apps generally. A warm charcoal (not blue-black) dark mode for the same reason: blue-shifted
  darks read as "device UI," warm darks read as "a dim room, not a screen."
- **Teal as the default action colour.** Cool, desaturated blue-green hues are consistently used in healthcare,
  wellness and meditation contexts specifically because they measure as the calmest hue family in colour-affect
  research — lower arousal than red/orange/yellow, less sterile than pure blue, less "productivity-app-green"
  than saturated emerald. Since the single dominant emotional register of this product is calm reassurance, teal
  is the default, not an accent reserved for one screen.
- **Amber for hope, indigo for contemplation — distinct from calm.** The two other path-intents are
  deliberately NOT teal: "I want to do a good deed" is a warmer, more rewarding feeling (honey amber — warmth,
  reward, light) and شعب الإيمان (branches of faith) is a slower, reflective register (a deep night-sky indigo —
  depth, quiet thought). One hue family per emotional register, used consistently everywhere that register shows
  up (card accents, badges, eventually icons/illustration).
- **Terracotta, never alarm-red, for destructive/negative states.** Red reads as an alarm; this product's most
  "negative" surface (a delete confirmation, a validation error) still should not spike anxiety the way a true
  red does. A muted, earthy terracotta keeps the *signal* (this needs attention) without the *siren*.

## 2. Token table

All values are OKLCH. "Swatch name" is a human-readable label for design conversation only — the only thing
components ever reference is the CSS variable / Tailwind utility.

### 2.1 Base — "Parchment"

| Token | Swatch name | Light | Dark |
| --- | --- | --- | --- |
| `--background` | Parchment | `oklch(0.975 0.012 75)` | — |
| `--background` (dark) | Warm Charcoal | — | `oklch(0.19 0.012 50)` |
| `--foreground` | Ink | `oklch(0.24 0.025 50)` | `oklch(0.94 0.012 75)` |
| `--card` | Parchment (card) | `oklch(0.99 0.008 75)` | `oklch(0.22 0.014 50)` |
| `--card-foreground` | Ink | `oklch(0.24 0.025 50)` | `oklch(0.94 0.012 75)` |
| `--popover` / `--popover-foreground` | *(extended, see §2.5)* | = card / card-foreground | = card / card-foreground |
| `--muted` | Parchment Shade | `oklch(0.94 0.015 75)` | `oklch(0.26 0.014 50)` |
| `--muted-foreground` | Soft Ink | `oklch(0.48 0.02 55)` | `oklch(0.68 0.015 70)` |
| `--border` / `--input` | Parchment Line | `oklch(0.88 0.015 70)` | `oklch(0.32 0.016 50)` |

### 2.2 Primary action — "Deep Teal"

| Token | Swatch name | Light | Dark |
| --- | --- | --- | --- |
| `--primary` | Deep Teal | `oklch(0.40 0.07 185)` | `oklch(0.62 0.09 185)` |
| `--primary-foreground` | Parchment-on-Teal | `oklch(0.98 0.01 75)` | `oklch(0.15 0.01 50)` |
| `--ring` | Deep Teal (focus) | `oklch(0.55 0.08 185)` | `oklch(0.62 0.09 185)` |
| `--secondary` | Parchment Tint | `oklch(0.93 0.02 75)` | `oklch(0.28 0.015 50)` |
| `--secondary-foreground` | Ink (secondary) | `oklch(0.30 0.03 50)` | `oklch(0.90 0.015 75)` |
| `--accent` | Parchment Tint, +emphasis | `oklch(0.90 0.025 75)` | `oklch(0.31 0.02 50)` |
| `--accent-foreground` | Ink (accent) | `oklch(0.28 0.035 50)` | `oklch(0.92 0.018 75)` |
| `--destructive` | Muted Terracotta | `oklch(0.50 0.11 35)` | `oklch(0.58 0.12 35)` |
| `--destructive-foreground` | Parchment-on-Terracotta | `oklch(0.98 0.01 75)` | `oklch(0.15 0.01 50)` |

`secondary`/`accent` exact values are an **interpolation**, not an owner-dictated number: the brief specified
"warm neutral variants of the base… accent one step up in emphasis" without giving `accent`'s literal numbers.
`accent` is built as `secondary` shifted one step toward the ink end (slightly less light / slightly more
chroma), inside the same warm hue family (`H≈75` light tint / `H≈50` dark tint) — never a new hue.

### 2.3 Path-intent accents (new, additive)

The three flows the product routes a person into. Each is a hue family on its own, reused everywhere that path
shows up (card top-accent, corner motif colour, eventually icons), each with a `-foreground` pair for text/icons
placed on a filled surface of that colour.

| Token | Swatch name | Light | Light fg | Dark | Dark fg |
| --- | --- | --- | --- | --- | --- |
| `--intent-sin` | Deep Teal — Sin Path | `oklch(0.40 0.07 185)` | `oklch(0.98 0.01 75)` | `oklch(0.62 0.09 185)` | `oklch(0.15 0.01 50)` |
| `--intent-good-deed` | Honey Amber — Good Deed Path | `oklch(0.64 0.13 55)` | `oklch(0.22 0.03 50)` | `oklch(0.72 0.14 55)` | `oklch(0.18 0.02 50)` |
| `--intent-iman-branch` | Night Indigo — Iman Branch Path | `oklch(0.30 0.05 265)` | `oklch(0.96 0.01 75)` | `oklch(0.55 0.08 265)` | `oklch(0.14 0.02 50)` |

`--intent-sin` is deliberately identical to `--primary`: the "sin" path is the calm/trust/safe register, the
product's dominant one, so it shares the default action colour rather than getting its own.

### 2.4 Grade (authenticity) tokens

Reused hue families — a grade badge and a path accent read as one coherent colour system, not two unrelated
palettes glued together.

| Token | Swatch name | Light | Light fg | Dark | Dark fg |
| --- | --- | --- | --- | --- | --- |
| `--grade-sahih` | = Deep Teal (trust) | `var(--intent-sin)` | `var(--intent-sin-foreground)` | same | same |
| `--grade-hasan` | = Honey Amber (acceptable) | `var(--intent-good-deed)` | `var(--intent-good-deed-foreground)` | same | same |
| `--grade-daif` | Muted Terracotta-gray | `oklch(0.62 0.02 60)` | `var(--foreground)` | `oklch(0.55 0.015 60)` | `oklch(0.98 0.01 75)`* |
| `--grade-mawdu` | = Muted Terracotta (destructive) | `var(--destructive)` | `var(--destructive-foreground)` | same | same |

\* `--grade-daif-foreground` (dark) is a literal, not `var(--foreground)`: see §4 — reusing the dark-mode base
foreground measured under AA on this specific chip, a lighter literal was needed.

`--grade-daif` is deliberately its own muted, low-chroma warm gray-tan — de-emphasized on purpose, since da'if
is shown only on request, never by default, and should never look alarming. `--grade-mawdu` is admin-only; the
public API never returns it (unchanged policy, see `backend/prisma/schema.prisma`'s `HadithGrade` enum and the
existing grade-visibility rule) — it still gets a real token for the admin/curation screens.

### 2.5 Two necessary, non-inventive extensions

Two tokens the brief didn't enumerate had to be touched anyway, because leaving them as the old neutral
placeholder would visibly break the new theme rather than just "not yet have it":

- **`--popover` / `--popover-foreground`** now equal `--card` / `--card-foreground`. `Sheet`, `Dialog`,
  `Command`, `Select`, `Tooltip` and `DropdownMenu` all render on `bg-popover` — including the sin/good-deed
  picker `Sheet`, the single highest-stakes interaction in the app (`frontend-plan.md` §7.1). Leaving it as the
  old stark white/near-black would put a visibly mismatched box over the new warm page on the very first
  interaction. No new hue was introduced — this reuses the already-specified `card` numbers.
- **`--chart-*` / `--sidebar-*`** were left untouched (still the generic neutral placeholder). Grepping the
  codebase found no chart and no sidebar-nav-pattern component in use anywhere — touching them would be
  inventing values for something nothing renders.

## 3. Motion principles

Extends `design-system.mdc` §3; does not weaken its `prefers-reduced-motion` mandate.

- **`StaggerReveal`** (`frontend/src/components/shared/StaggerReveal.tsx`): wraps a static list of children.
  Each one fades in (`opacity 0→1`) and rises (`translateY 8px→0`) over 200ms `ease-out`
  (`--animate-reveal-up` in `globals.css`), staggered 50ms per item, **capped at 6** — item 7+ all share item
  6's delay, so a long list never produces a multi-second cascading reveal. Entirely inert under
  `prefers-reduced-motion: reduce`: the animation utility is gated behind `motion-safe:` only, so reduced-motion
  users render at final state immediately with no JS branching.
- **Card press/hover** (`QuoteCard`): `transition-[opacity,transform,box-shadow] duration-150 ease-out`,
  `hover:scale-[1.01] hover:shadow-md`, `active:scale-[0.98]`. `motion-reduce:` disables both scale steps
  (`motion-reduce:hover:scale-100 motion-reduce:active:scale-100`) but **keeps** the shadow/opacity transition,
  since a shadow lift alone is not disorienting the way a scale pop is.
- **Home-entry "breathing"** (`--animate-breathe` in `globals.css`): `scale(1) → scale(1.015) → scale(1)` over
  5s `ease-in-out`, infinite, a pure CSS `@keyframes` (not JS, so it costs nothing on the main thread), applied
  only via `motion-safe:animate-breathe`. Reserved **exclusively** for the home page's top-level path-entry
  cards (currently: the sin-picker trigger, the good-deed-picker trigger, the branches entry button) — never on
  `QuoteCard`, never on a list item, so the "come, open me" invitation stays unique to the three doors into the
  app and never becomes ambient background noise.

## 4. Accessibility — contrast report (WCAG AA)

Computed from the OKLCH values via the CSS Color 4 OKLab→linear-sRGB matrices and the WCAG relative-luminance
formula (not estimated). AA requires **≥4.5:1** for normal text, **≥3:1** for large text (≥18px/14px bold) and
non-text UI components (focus rings, icon-only affordances).

| Pair | Light | Dark | Verdict |
| --- | --- | --- | --- |
| `foreground` / `background` | 15.38:1 | 15.50:1 | ✅ |
| `foreground` / `card` | 16.06:1 | 14.55:1 | ✅ |
| `muted-foreground` / `background` | 6.11:1 | 6.41:1 | ✅ |
| `muted-foreground` / `muted` | 5.51:1 | 5.40:1 | ✅ (design-system.mdc's own caution point, re-checked) |
| `primary-foreground` / `primary` | 8.38:1 | 5.65:1 | ✅ |
| `secondary-foreground` / `secondary` | 11.17:1 | 10.86:1 | ✅ |
| `accent-foreground` / `accent` | 10.91:1 | 10.43:1 | ✅ |
| `destructive-foreground` / `destructive` | 5.95:1 | **4.36:1** | ⚠️ see note below |
| `intent-sin-foreground` / `intent-sin` | 8.38:1 | 5.65:1 | ✅ |
| `intent-good-deed-foreground` / `intent-good-deed` | 4.97:1 | 7.30:1 | ✅ (light passes, narrowly) |
| `intent-iman-branch-foreground` / `intent-iman-branch` | 12.18:1 | 4.08:1 | ⚠️ dark see note |
| `grade-sahih-foreground` / `grade-sahih` (filled seal) | 8.38:1 | 5.65:1 | ✅ |
| `grade-hasan-foreground` / `grade-hasan` (filled seal) | 4.97:1 | 7.30:1 | ✅ |
| `grade-daif-foreground` / `grade-daif` (filled seal) | 4.52:1 | 4.59:1 | ✅ (both tuned to clear 4.5:1) |
| `grade-mawdu-foreground` / `grade-mawdu` (= destructive) | 5.95:1 | 4.36:1 | ⚠️ same note as destructive |
| `ring` / `background` (focus visibility, 3:1 UI threshold) | 4.33:1 | 5.31:1 | ✅ |
| `border` / `background` (decorative divider, not text) | 1.34:1 | 1.45:1 | — not applicable; see note |

**Notes:**

1. **Dark-mode destructive/mawdu text at 4.36:1** is below the 4.5:1 small-text threshold but clears 3:1
   (large text / icon / UI-component threshold). This is an inherited property of the exact `destructive` hue
   and lightness the brief specifies for dark mode (`oklch(0.58 0.12 35)`) — not something introduced by an
   implementation choice, and the brief is explicit that hues/lightness are not to be altered. Practical
   mitigation for later work: avoid `text-xs` destructive *text* in dark mode where the string is long or the
   only cue (icon + text together already reduces reliance on exact ratio); `grade-mawdu` is admin-only and
   never reaches the public surfaces this task touches.
2. **Dark-mode `intent-iman-branch-foreground` at 4.08:1** has the same shape of shortfall, for the same
   reason (owner-specified hue). It is not yet consumed by any component in this task (no شعب الإيمان entry
   card is live yet — see §5) — flagged here so the Cursor session that does wire it sizes that text
   `text-sm`+ rather than `text-xs`, or raises it to the maintainers before shipping small body text in it.
3. **`border`/`background` at ~1.3–1.5:1** is a decorative divider only (`border-border` around cards/inputs),
   not a text-conveying element — the same low separation existed in the original neutral placeholder
   (`oklch(0.922 0 0)` on `oklch(1 0 0)` ≈ 1.25:1) so this is not a new regression, and WCAG's non-text-contrast
   rule (1.4.11) exempts purely decorative, "no information conveyed" boundaries.
4. **`grade-daif-foreground` (dark) is a literal `oklch(0.98 0.01 75)`**, not `var(--foreground)`: the
   dark-mode base foreground (`oklch(0.94 0.012 75)`) measured only 4.08:1 against the `grade-daif` dark chip
   (`oklch(0.55 0.015 60)`, a background whose *linear* relative luminance is much darker than its OKLCH
   lightness number suggests — 0.166, not ~0.3). A slightly lighter, same-family literal clears 4.5:1 without
   inventing a new hue.
5. **The 8-point-star corner motif (`opacity-[0.08]`/`dark:opacity-[0.12]`)** is purely decorative, `aria-hidden`,
   and conveys no information on its own (the path accent is also carried by the top border and, where present,
   badge colour+text) — WCAG's contrast requirements do not apply to decoration that carries no information.

## 5. Card & badge redesign spec

### 5.1 `QuoteCard`

- New optional prop `intent?: 'sin' | 'good-deed' | 'iman-branch'`. Maps to a `border-t-[3px] border-t-intent-*`
  top accent via a `cva` variant. **Keyed by which path the card is being viewed in, not `quote.type`** — the
  same verse can appear with a teal top accent on a sin-reminder screen and no accent at all on `/browse`.
  Omitted → no accent, plain `border-border` on all sides (existing neutral-browse look, unchanged).
- New corner motif: a generic two-overlapping-squares 8-point star **outline** (`stroke` only, `stroke-width:1`,
  20×20, two `<rect>`s offset 45°) in the card's top-start padding gutter, `currentColor`-driven by the same
  intent token (`text-intent-*`, or `text-border` when no intent), `opacity-[0.08]`/`dark:opacity-[0.12]`,
  `aria-hidden`, `pointer-events-none`, stacked behind the header content (`-z-10`) and clipped to the card's
  rounded corners (`overflow-hidden` on the card). It is a generic Islamic geometric motif, not the rub-el-hizb
  or any calligraphic/sacred glyph. Gated behind the new `reduceDecoration` preference (`preferences.store.ts`,
  default `false`) — when true, it does not render at all.
- Hover/press motion per §3 above, added to the card's existing `cva` base.
- `QuoteCardSkeleton` gained a matching optional `intent` prop that applies the same `border-t-[3px]` thickness
  (colour doesn't matter on a skeleton) so loading and loaded geometry stay pixel-identical.

### 5.2 `GradeBadge`

Redesigned from a rectangular tinted pill to a small circular **seal**: `rounded-full`, `ring-2` (thicker than a
normal badge's hairline border), `h-7 min-w-7` (28px tall, grows horizontally for longer grade words rather than
truncating them — truncating an authenticity word would violate the "grade is never implied, always spelled
out" rule), **filled** background (`bg-grade-*`) with the matching `-foreground` text colour (not the old
10%-tint pattern — see §4 note on why this had to become a filled/foreground pairing, not a tint, to clear AA
for `grade-hasan`). SAHIH/HASAN get a tiny `Check` glyph (`lucide-react`, `aria-hidden`) before the word;
DAIF/MAWDU never do, keeping with "never alarming, never over-asserted" for the lower grades. `aria-label`
unchanged — still the full translated grade phrase; the word is always visible text, colour is never the only
signal.

## 6. Rollout build order (for a later Cursor session)

This task applied the design system's foundation and its first high-impact slice only (globals.css, the motion
primitives, `QuoteCard`/`QuoteCardSkeleton`/`GradeBadge`, the home page). Everything below is **not done yet**
and is listed in the order a later session should do it, each step independently shippable behind the existing
lint/`tsc`/build gates:

1. **`/sins/[slug]`** — `features/sin-reminder/components/ReminderList.tsx:111` passes `<QuoteCard>` with no
   `intent`. Add `intent="sin"`. Also pass the same `intent="sin"` to its `QuoteCardSkeleton` at line 72, and
   wrap the initial page of cards in `StaggerReveal` the way the home page now does.
2. **`/good-deeds/[slug]`** — `features/good-deed-motivation/components/MotivationList.tsx:123` (skeleton at
   line 74): add `intent="good-deed"` to both, plus `StaggerReveal` on first mount.
3. **`/browse`** (and `/feelings/[tagSlug]`, same list component) —
   `features/quran-hadith-browser/components/InfiniteQuoteList.tsx:61` (skeleton line 36): **no intent** — this
   is the neutral/mixed browsing context the brief explicitly calls out, so leave `intent` unset (plain border).
   `StaggerReveal` is still worth adding for the first page only (an `useInfiniteQuery`'s later pages should not
   re-stagger on every "load more").
4. **`/browse/quran/[surahNumber]`** — `features/quran-hadith-browser/components/SurahView.tsx:72` (skeleton
   line 51): same as `/browse`, no intent, optional `StaggerReveal` on first mount.
5. **`/quotes/[id]`** — `features/quran-hadith-browser/components/QuoteDetail.tsx:37` renders `GradeBadge`
   directly (not through `QuoteCard`); no action needed for the badge (already picks up the new seal from this
   task). If this screen later needs a path accent (e.g. arriving from a sin's "view full" link), thread an
   `intent` search param/prop through — not required by the current route contract.
6. **`/favorites`** — `features/favorites/components/FavoritesList.tsx:50` (skeleton line 27): favorites span
   all paths, so default to **no intent** (neutral) unless the favorite record itself carries which path it was
   saved from (it doesn't currently — a schema question for the owner, not a frontend one).
7. **`/branches/[number]`** — `app/[locale]/branches/[number]/page.tsx:105` already renders `<QuoteCard>` with
   no `intent`: add `intent="iman-branch"`. This is the first real consumer of that token outside this task.
8. **Home page, third entry card** — already live (`/branches`, wired by another in-progress change as of this
   task's dispatch) and already wrapped in `StaggerReveal` + `motion-safe:animate-breathe` by this task. No
   further action — noting it here only so the "is iman-branch live yet" question in point 8 of the task brief
   has a recorded answer: **yes, as of this task.**
9. **Admin / review-studio screens** (`features/curation/components/{LinkingWorkspace,QuoteDetailAdminView,
   QuoteListView}.tsx`) — all three call `GradeBadge` directly and already render the new seal automatically;
   no change required for the badge. If/when these screens get their own visual pass, they are explicitly
   **not** path-intent surfaces (admin tooling, not a reader path) — they should stay on the neutral
   `secondary`/`accent`/`muted` tokens, never `intent-*`.
10. **Settings** (`/settings`) — add a toggle for `reduceDecoration` (`preferences.store.ts`) alongside the
    existing `showTranslation`/`includeWeakHadith`/`arabicNumerals`/`fontScale` controls, once that screen is
    built out (route exists; current content was not part of this task's inspection).

Each step: run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` from `frontend/`, verify in both `ar` (RTL)
and `en` (LTR), and verify light + dark — per the existing Pre-Push Checklist in `.cursorrules`.
