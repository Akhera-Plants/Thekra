# ذكرى · المراجعة — interface system (admin desk)

Scope: `frontend/src/app/[locale]/admin/**` and `frontend/src/features/curation/**`.
The public site keeps its own chrome and its Sakina rules (`frontend/.cursor/rules/design-system.mdc`);
this file records only what the admin desk decided on top of them.

## Direction

- **Who:** the owner/reviewer, usually at night, checking that each published verse/hadith is
  correct, graded by the agreed rule (al-Bukhari/Muslim, or Shu'ayb al-Arna'ut for the Sunan),
  and filed under the right sin or good deed. Accuracy over speed.
- **Order of work:** triage flags → approve/reject proposed links → find a text and see why it
  is or isn't public → run/inspect content sync. The sidebar and the home page follow this order.
- **Feel:** «مكتب التحقيق», a scholar's review desk at night. Dense, calm, ink on dark paper.
  Same night palette and Thmanyah type as the site. Not a SaaS template.
- **Signature: «مسار النص».** A provenance ledger for one text:
  المصدر → الباب → التخريج → الحكم → النشر. It shows as small labelled nodes on a hairline.
  The step that stops publication is inked red and marked «هنا يتوقف».
  It is used in the quotes row expansion, the quote detail page and the flag folio
  (`kit/ProvenanceTrail.tsx`, steps built by `lib/trail.ts`).
- **Rejected defaults:**
  - Identical KPI cards → one focal band of three counts, then the «حالة المكتبة» ledger.
  - English status pills → Arabic state words with a dot (`StatusBadge`).
  - Delete beside edit on every row → a ⋯ menu: edit first, delete last, separated, confirmed.
  - Long card lists → dense tables with a facet rail.

## Tokens (no new colours)

The desk uses the site tokens in `src/app/globals.css`. The only change maps the
previously-unthemed `--sidebar-*` tokens onto the same paper (`--background`, `--muted`, `--border`…),
so the rail is the canvas with a hairline edge.

| Role | Token | Used for |
| --- | --- | --- |
| Paper (desk) | `background` | canvas, sidebar, sticky table header |
| Opened folio | `card` | expanded row, ledger panels |
| Overlay | `popover` | menus, ⌘K, dialogs |
| Ink | `foreground` | values, matn |
| Pencil | `muted-foreground` | labels, isnad, metadata |
| Seal (the one accent) | `primary` (teal) | published, accepted, primary action, focus |
| Red correction ink | `destructive` | HIGH severity, hidden, failing trail step, delete |
| Lamp | `intent-good-deed` (amber) | MEDIUM severity, pending/unreviewed, warn step |

Colour only carries state. Everything else is neutral.

## Depth & surfaces

- Borders only, as hairlines (`border-border`, rows `border-border/70`). No shadows except the
  primitives' overlays.
- The row status colour is a 2px start-edge border on the first cell (`DataTable` `rowTone`).
  It is not a filled row.

## Typography

- **UI:** Thmanyah Sans (`font-arabic-ui`, the body default in `ar`). The `en` locale uses Geist.
- **Matn:** Thmanyah Serif Text (`font-arabic-text`), `text-base` in table cells and `text-lg/xl`
  with `leading-loose` in folios. The isnad is set in `muted-foreground`, the matn in `foreground`.
  Verses use `font-quran`.
- **Titles and focal numbers:** Thmanyah Serif Display (h1 is automatic in `ar`; `StatNumber`
  uses `font-arabic-display`).
- **Scale (~1.2):** 12 label · 14 body/table · 16 matn cell · 18 section h2 · 24 page h1 ·
  48 focal number.
- **Hierarchy levers:** weight + colour before size. Labels are 12/500/muted, values 14/400–500/ink.
- **Numbers:** always `tabular-nums`, formatted through `formatCount` → `src/lib/format/digits.ts`.
  That helper currently returns Western digits in both locales, which is the owner's sitewide decision.

## Spacing & density

- 4px base.
- Page padding is `px-6 pt-6`. The top bar is `h-12`. Sections on the home page sit `gap-12` apart;
  blocks inside a page sit `gap-6` apart.
- **Table:** header `h-9`, rows `h-10` (`px-3 py-1.5`), the expand column `w-9`, the actions column `w-10`.
- **Folio** (expanded row): `pt-3 pb-5`, indented `ps-12` under the chevron. Blocks inside it are `gap-6`.
- **Facet rail:** `w-60`. Options are `h-8 px-2` with the count at the end edge. Groups are `gap-5` apart.
- **Trail node:** `px-2.5 py-1.5 rounded-md`, label 12px, value 14px, nodes joined by a `w-3` hairline.

## Public Button kit

Product actions on the site use `frontend/src/components/shared/kit/button`
(nexa-shaped variant × tone × size). Contract + Claude check page:
`.interface-design/button.md` and live specimen at `/dev/kit`.

## Components (`frontend/src/features/curation/components/kit/`)

| Component | Contract |
| --- | --- |
| `DataTable` | Typed columns; loading skeleton rows (geometry-matched), empty and error states built in. Row expansion, controlled active row, and `keyboard` (j/k move, Enter open, Esc close; ignored while typing or in a menu or dialog). `rowTone` sets the start-edge colour. `TablePager` sets the quiet footer. |
| `FilterRail` | Single-select facets with live counts (`count` is undefined when there is no count). «الكل» resets. `hideEmpty` for long facets. Count loading and error states. |
| `StatusBadge` | cva `tone` (danger / caution / positive / quiet / neutral) × `size`. A dot plus a word, never a pill. One tone map per enum (`SEVERITY_TONE`, `GRADE_TONE`…). |
| `ProvenanceTrail` | `steps[]` with state ok / warn / fail / na / pending. Loading skeleton. The first fail carries «هنا يتوقف». Presentational only. |
| `StatNumber` | A focal count. The danger tone lights up only when the value is above 0. Optional `href` to the filtered queue. Loading and error states. |
| `PageHeader` | The page's single h1, a description, a tabular `meta`, and actions at the end edge. |
| `RowActions` | A ⋯ menu: primary items, then one destructive item behind an `AlertDialog`. |

Labels for every enum live in one file: `frontend/src/lib/format/admin-labels.ts`
(ar/en, `satisfies Record<Enum, …>`). Source and topic names come from `sourceName` and `topicName`.

## Motion

- `.desk-press`: `scale(0.97)` on `:active`, 140ms `cubic-bezier(0.23,1,0.32,1)`.
- `.desk-folio`: row expansion, 180ms opacity + `translateY(-4px)`.
- The chevron rotates in 150ms.
- ⌘K has no extra animation (it is used many times a night).
- Under `prefers-reduced-motion`, transforms are dropped and the folio uses a 120ms fade.

## Shell

- `[locale]/layout.tsx` → `AppShell` → `SiteChrome` (a client component). For the `admin` segment
  (`useSelectedLayoutSegment`), the public header and footer are not rendered.
  `admin/layout.tsx` renders `AdminGuard` → `AdminShell`.
- `AdminShell` is a Radix `Direction.Provider` (RTL for every primitive) wrapping a shadcn
  `SidebarProvider`.
  - The sidebar is on the start side (right in `ar`, `side` follows the locale).
  - The top bar (`h-12`) holds the crumbs, ⌘K and the theme toggle.
- **Sidebar groups:**
  - المراجعة: ما ينتظرك الآن، البلاغات with the open-HIGH count in red, الربط المقترح.
  - المحتوى: النصوص، المعاصي، الطاعات، المصادر، الوسوم.
  - النظام: المزامنة.
- **Sidebar footer:** back to the site, the user menu, and `app.intentionReminder` verbatim.
