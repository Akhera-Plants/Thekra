# Handoff: public UI port + polish (do not revert)

**Audience:** Claude (or any agent) continuing work on Thekra.  
**Purpose:** Put the following decisions and file changes in context so you **do not undo, “simplify,” or reintroduce** old patterns.  
**Branch state:** `master` is ahead of `origin/master` by these UI commits (among others). Latest polish commits end at `c3ad5e3`.

---

## Non-technical summary (what the product looks like now)

1. **Public site** was ported from the `thekra-source` prototype into the Next.js app: home, header/footer, sins / good deeds / branches indexes and readers, about, favorites chrome — while keeping existing APIs, auth, favorites, and admin logic.
2. **RTL / LTR arrows** were wrong (Arabic and English reversed). They are fixed: forward = `ArrowRight` flipped in RTL. Do not switch back to `ArrowLeft` + RTL flip.
3. **Locale switcher:** English label is **`En`**, not `English`.
4. **Green pathway card** (“باب للرجوع” / return path): overline + door icon + supporting text must stay **light** on green. Dark ink there was a CSS bug (`color: inherit` on links); do not reintroduce dark text on that card.
5. **Source strip** on the home page uses **React Bits `LogoLoop`** (vendored under `shared/react-bits/`), not a homemade marquee.
6. **“تذكرة أخرى” / shuffle** button on topic readers was **removed** on purpose. The list + filters + “show more” are enough. Do not bring shuffle / highlight-trail UI back.
7. **«تصنيف المراجعة»** was an internal curation note shown on public quote lists. **Removed** from public UI and API payloads. Do not show it to readers again.
8. **Brand tagline** is one phrase only, with Quranic vocalization in Arabic: **`لِمَن كَانَ لَهُۥ قَلْبٌ`**. Header + footer use `app.tagline`. About page no longer repeats the same phrase as its lead. Brand message uses the Quran face.
9. **Focus / borders:** Thick double rings (border + fat `ring-3` / `ring-2` on inputs and grade badges) looked wrong. Focus is now a **single quiet border** (or thin ring). Do not restore shadcn’s heavy `ring-3` focus on public controls.
10. **English typography:** User rejected Source Sans 3. English uses **Amiri** (literary, pairs with Arabic/Thmanyah feel). Reading sizes were bumped; header nav + tagline were enlarged again after feedback that they were too small.
11. **Dev login (seed):**  
    - User: `user@thekra.local` / `password123456`  
    - Admin: `admin@thekra.local` / `password123456`  
    (Requires seed to have been run.)

---

## Technical decisions (do not “fix” these without asking)

### Directional arrows
- Shared component: `frontend/src/components/shared/DirectionalArrow.tsx`
- Pattern: Lucide **`ArrowRight`** + Tailwind **`rtl:-scale-x-100`**
- Used across pathways, moments, CTAs, catalog, favorites, about, quote “view full” links
- **Wrong** pattern (reverted intentionally): `ArrowLeft` + `rtl:-scale-x-100` (reverses both locales)

### Locale switcher
- `frontend/src/components/shared/LocaleSwitcher.tsx`
- Other locale label: Arabic → `العربية`, English → **`En`**

### Pathway return ink (green card)
- Override lives in `frontend/src/app/site-public.css` under `.site-public a.pathway-return …`
- Light overline/icon/description; title uses pathway primary ink tokens
- Root cause of dark text: public CSS forcing `a { color: inherit }` — pathway-return exceptions must stay

### Source strip / LogoLoop
- `frontend/src/components/shared/react-bits/LogoLoop.tsx` (React Bits, vendored)
- Wired from `frontend/src/components/home/SourceStrip.tsx`
- `frontend/components.json` updated for the react-bits registry entry
- Respect `prefers-reduced-motion` (static list)

### Reader: no shuffle
- `ReminderReader` is tabs + paginated list + show more only
- Removed: `onAnother`, highlight trail, prev/next highlight chrome, `Shuffle` button, `.reader-turn` animation
- Callers: `SinReader`, `GoodDeedReader`, branches detail — no shuffle fetches
- Frontend API types: no `shuffle` / `seed` on quote query types (backend variety shuffle API may still exist; public UI must not call it)
- i18n keys removed: `anotherReminder`, `anotherMotivation`, `closeHighlight`, related prev/next/of for that flow

### «تصنيف المراجعة»
- Backend no longer attaches `reviewLabel` in sins/good-deeds quote mappers
- Frontend `ReminderReader` / pages do not render it
- Type `reviewLabel` removed from public link DTO usage

### Tagline / i18n
- `app.tagline` (ar): `لِمَن كَانَ لَهُۥ قَلْبٌ`
- `app.tagline` (en): `For whoever has a heart`
- Removed duplicate `home.tagline`
- About `lead` rewritten so it does **not** repeat the tagline
- `.brand-message` uses `font-family: var(--font-quran), var(--font-amiri), serif` and readable size (~16px desktop)

### Focus rings
- Quieter on: `components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `button.tsx`, kit `button/variants.ts`, `GradeBadge` (no `ring-2`)
- Prefer `focus-visible:border-primary` + `ring-0` / thin ring — not `ring-3` + matching border (double frame)

### English font (current — Amiri, not Source Sans)
- **Do not reintroduce Source Sans 3** unless the owner asks
- `--font-sans` / `--font-heading` → `var(--font-amiri)` in `globals.css`
- `html[lang=en] .site-public` → Amiri, base ~18px
- `layout.tsx`: English body class `font-amiri` (Arabic stays `font-arabic-ui` / public plex where intended)
- Quote English body: `font-amiri`, ~17–19px (hero larger), `max-w-[68ch]`, `leading-[1.75]`, LTR `text-start`

### Header sizing (latest)
- `.main-nav` ~16px; `.brand-message` ~16px
- Auth guest links: real gap + ~15px / height 40px (not cramped `md:h-8` only)

### Architecture constraints still in force
- `shared` must not import `features` for data fetching (favorites count stays in `SavedNavLink` under features)
- Lucide icons for UI; site chrome may use shared site-icons where already wired
- Admin keeps its own shell; public routes use `.site-public` via `SiteChrome`
- Design tokens: Viridian / Shell; theme via `next-themes` + `.dark`

---

## Commits in this UI wave (newest first)

| Commit   | Summary |
|----------|---------|
| `c3ad5e3` | Enlarge header nav + brand tagline; auth button gap/size |
| `10c6e1f` | English → Amiri; bump reading/meta sizes |
| `11fc3b4` | Quiet focus; vocalized tagline; drop reviewLabel; (Source Sans briefly — superseded) |
| `e1f7a6b` | Remove reader shuffle control |
| `79d65fa` | RTL arrows, pathway ink, LogoLoop, En label |
| `f35660e` | Repair public port CSS, icons, catalog search |
| `766bfa2` | Port public chrome, home, path pages from thekra-source |
| `d587541` | Viridian/Shell tokens + public fonts/assets |
| `b3fb05c` | Shared Button, SegmentTabs, quote cards |
| `af35b4e` | Admin review desk shell and kit |

---

## Files touched in the polish slice (protect these)

Treat edits below as intentional. Diff against them carefully; prefer extending, not reverting.

### Core chrome / CSS / fonts
- `frontend/src/app/site-public.css`
- `frontend/src/app/globals.css`
- `frontend/src/app/[locale]/layout.tsx`
- `frontend/src/lib/fonts.ts`
- `frontend/src/components/shared/SiteHeader.tsx`
- `frontend/src/components/shared/SiteFooter.tsx`
- `frontend/src/components/shared/SiteChrome.tsx`
- `frontend/src/components/shared/AppShell.tsx`
- `frontend/src/components/shared/ThemeToggle.tsx`
- `frontend/src/components/shared/LocaleSwitcher.tsx`
- `frontend/src/components/shared/AuthNavItems.tsx`
- `frontend/src/components/shared/Breadcrumbs.tsx`
- `frontend/src/components/shared/DirectionalArrow.tsx`
- `frontend/src/components/shared/site-icons.tsx`

### Home
- `frontend/src/components/home/Pathways.tsx`
- `frontend/src/components/home/Moments.tsx`
- `frontend/src/components/home/FeaturedReminder.tsx`
- `frontend/src/components/home/FeaturedDeed.tsx`
- `frontend/src/components/home/Reflection.tsx`
- `frontend/src/components/home/SourceStrip.tsx`
- `frontend/src/components/home/OrnamentalDivider.tsx`
- `frontend/src/app/[locale]/page.tsx`
- `frontend/src/components/shared/react-bits/LogoLoop.tsx`
- `frontend/components.json`

### Readers / quotes / catalog
- `frontend/src/components/shared/editorial/ReminderReader.tsx`
- `frontend/src/components/shared/editorial/TopicCatalog.tsx`
- `frontend/src/features/sin-reminder/components/SinReader.tsx`
- `frontend/src/features/good-deed-motivation/components/GoodDeedReader.tsx`
- `frontend/src/features/sin-reminder/stores/session-intent.store.ts`
- `frontend/src/components/shared/quote/QuoteCard.tsx`
- `frontend/src/components/shared/quote/QuoteBody.tsx`
- `frontend/src/components/shared/quote/GradeBadge.tsx`
- `frontend/src/app/[locale]/sins/[slug]/page.tsx`
- `frontend/src/app/[locale]/good-deeds/[slug]/page.tsx`
- `frontend/src/app/[locale]/branches/[number]/page.tsx`
- `frontend/src/app/[locale]/about/page.tsx`

### Kit / UI primitives
- `frontend/src/components/shared/kit/button/variants.ts`
- `frontend/src/components/shared/kit/button/types.ts`
- `frontend/src/components/shared/kit/segment-tabs/*`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/app/[locale]/dev/kit/KitSpecimen.tsx`

### i18n
- `frontend/messages/ar.json`
- `frontend/messages/en.json`

### Favorites
- `frontend/src/features/favorites/components/SavedNavLink.tsx`
- `frontend/src/features/favorites/components/FavoritesList.tsx`

### Backend (reviewLabel removal only in this polish)
- `backend/src/modules/sins/sins.service.ts`
- `backend/src/modules/good-deeds/good-deeds.service.ts`
- `frontend/src/lib/types/api.ts`

### Types / API surface
- Do not re-add public `reviewLabel` display
- Do not re-wire frontend reader `shuffle: true` calls

---

## Explicit “do not reintroduce” checklist

- [ ] Shuffle / «تذكرة أخرى» on topic readers  
- [ ] Public «تصنيف المراجعة» under quotes  
- [ ] `ArrowLeft` + RTL scale for forward navigation  
- [ ] Locale label `English` (use `En`)  
- [ ] Dark ink on green pathway-return overline/icon  
- [ ] Source Sans 3 as English UI font  
- [ ] Heavy `focus-visible:ring-3` double frames on inputs/badges  
- [ ] Duplicate unvocalized «لمن كان له قلب» as home + about lead + tagline  

---

## How to continue safely

1. Read this file before changing public UI, readers, header, or English typography.  
2. Prefer new work in admin / taxonomy / content unless the owner asks to change public chrome.  
3. If a design conflict appears, ask the owner — do not silently revert the commits above.  
4. Screenshots under `docs/design/after/` are reference only; many are untracked — do not delete product code to “match” an old screenshot without checking this handoff.

---

*Generated for handoff after the Cursor session that ported and polished the public site (RTL, LogoLoop, shuffle removal, tagline, focus, Amiri EN, header sizing).*
