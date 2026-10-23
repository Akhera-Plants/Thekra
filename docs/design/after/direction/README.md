# Direction, language-leak, typography and layout pass

Screenshots: `before/` and `after/` hold every public page at ar/en × light/dark × 1440/390
(`<page>-<locale>-<theme>-<width>.png`, plus `--N-<selector>.png` crops of the breadcrumbs,
page heading, kind tabs, `section.reading-pair` and `#paths`). `metrics-*.json` beside them
records, per shot: `dir`, horizontal overflow, breadcrumb texts, the tabs' `dir`, the chip row
`lang` and start edge, any Arabic left in the page heading on `/en`, and the reading-pair heights.
`after/featured/` holds the featured-card states (closed, hover/tap open) and a simulated long
Quran verse. English font: [english-font.md](<english-font.md>).

## Hard-coded direction audit (`src/`)

| Hit | Decision |
|---|---|
| Radix primitives (tabs, menus, popovers, select, sheet) had no `DirectionProvider` → rendered `dir="ltr"` on `/` | **Bug, fixed**: `Direction.Provider` from the locale in `lib/providers.tsx` |
| `.olive-drawing` `left:-7px`, `.pathway-flourish` `left:-20px/-28px` | **Bug, fixed**: `inset-inline-end` + `--art-mirror` |
| `.saved-count` `left:2px` | **Bug (LTR), fixed**: `inset-inline-end` |
| Topic tabs at 390px (`filled` tabs `min-w-0 flex-1`, centred) overlapped «Hadith/Sayings of the Salaf» | **Bug, fixed** in `ReminderReader`: tabs keep text width, track scrolls from its start edge |
| `SurahView` back link: whole link `rtl:-scale-x-100` (mirrored its text) + `ArrowRight` | **Bug, fixed**: `DirectionalArrow` turned around (← en, → ar), link not mirrored |
| `StudyPanel` previous/next chevrons pointed the wrong way in both locales | **Bug, fixed**: previous = `ChevronLeft rtl:-scale-x-100`, next = `ChevronRight rtl:-scale-x-100` |
| `QuoteCard` link arrow `ArrowRight rtl:-scale-x-100` | Correct; switched to `DirectionalArrow` for one pattern |
| `SourceStrip` `.source-window dir="ltr"`, `LogoLoop` `mr-`/`ml-`/`left-*` | Deliberate (LogoLoop measures an LTR track); kept, comment exists |
| `QuoteCard` `<bdi dir="ltr">` surah:ayah; `QuoteBody` English blockquote / note `dir="ltr"` | Deliberate; one-line comments added |
| `ArabicText` `dir="rtl"`; Arabic islands `lang="ar" dir="rtl"` | Deliberate |
| `.site-public:before/:after` page-edge arabesques `right/left` | Deliberate (symmetric frame both edges); comment added |
| Hover nudges `translateX(-Npx)` in the ported CSS | Overridden by the `[dir=rtl]` / `[dir=ltr]` rules below them; correct |
| `CatalogIndex`, `AlternativeDeedsBlock` `hover:translate-x-1 rtl:hover:-translate-x-1` | Correct |
| `dialog`, `alert-dialog` `start-1/2 -translate-x-1/2 rtl:translate-x-1/2`; `select` side offsets with `rtl:` | Correct |
| `dropdown-menu`, `ui/breadcrumb` `ChevronRightIcon rtl:rotate-180` | Correct (sub-menu / admin crumbs) |
| `StudyPanel` sheet side `ar → left`, `en → right` | Correct (inline-end) |
| Admin `sidebar.tsx` physical sides, `AdminSidebar side` by locale, admin Arabic inputs `dir="rtl"`, `KbdGroup dir="ltr"` | Admin; correct as is |
| Chip row (`ThemeChips`) | Inherits page direction; first chip at the right edge on `/`, left on `/en` (measured) |
| Text inputs, toasts | No physical offsets found; no `<Toaster />` is mounted on public pages |

## Data gaps (English text missing — not invented, listed for the owner)

Measured against the local API (`/v1/sins`, `/v1/good-deeds`, `/v1/branches`, `lang=en`):

- No topic has an Arabic description, reward, name, pair title or branch title without its
  English counterpart, so no English line was hidden for lack of a translation.
- Descriptions missing in **both** languages (the page shows no lead line in either):
  - 76 of 84 sins: zina, khamr, kibr, shirk, tul-amal, ghibah-raqamiya, masala, dhul-wajhayn,
    istihana-saghair, zulm-raiyya, khiyana, iftar-ramadan, rishwa, tanazzuh-bawl, ghish, intisab,
    kitman-ilm, akl-mal-yatim, sukhriya, tadhib-hayawan, sabb-lan, mutl, takdhib-qadar, uquq,
    tashhir, israf, shahadat-zur, amn-makr, malahi, qimar, alab-mulhiya, adha-muslimin, adha-jar,
    ihtikar, tabarruj, bida, qatl, dayyuth, waqt-tawasul, tashabbuh, bukhl, tark-hajj, hajr-quran,
    murahanat, tanammur, zulm, qawl-bila-amal, jidal, mann, sabb-sahaba, istirad, hijran, qadhf,
    liwat, sihr-kahana, nushuz, ishaat, tajassus, intihar, tatayyur, su-dhann, hilf-bighayr-allah,
    yamin-ghamus, sariqa, isbal-harir, baghy-fakhr, ghadr, akl-haram, nazar-muharram,
    nazar-shashat, riba, niyaha, idaat-al-waqt, man-ajr, man-zakah, zulm-zawja.
  - 69 of 77 good deeds: salamat-sadr, kafalat-yatim, tawakkul, iffa, taawun, satr-muslim, zuhd,
    amr-maruf, adab-libas, adab-taam, adab-majlis, adab-masjid, adab-safar, iman-ghayb, siyam,
    khawf-raja, sunna, afw, jumua, amana-wafa, samaha, muraqaba, husn-khuluq, shukr, salah, hajj,
    qada-hawaij, haqq-jar, tawqir-kibar, ikram-dayf, tawadu, adab-salah, adl, silah-raqamiya,
    kalam-tayyib, husn-ishra, kasb-halal, hubb-fillah, mahabbat-allah, ghadd-basar, nikah,
    rahma-khalq, iqtisad, haya, taat-wulat, sabr, zakah, nafaqa-ahl, tawhid, tahara, quran,
    islah-bayn-nas, dhikr-akhira, imatat-adha, tawba, wara, talab-ilm, ightinam-waqt, muhasaba,
    salat-ala-nabi, nashr-khayr-raqami, nasiha, nashr-ilm, salam, dua, sidq, tathabbut,
    iyadat-marid, nawafil.
  - All 77 branches have no summary in either language.
- Partly translated stored text, now trimmed to its English part on `/en`:
  - Al-Dhahabi rank references («الكبائر للذهبي، الكبيرة رقم 4 — الكبيرة الرابعة في ترك الصلاة»)
    show «Al-Kabair by al-Dhahabi, major sin no. 4»; the chapter title after «—» has no English.
  - Hadeeth Encyclopedia grade notes carry Arabic edition details («صحيح البخاري، نشر: دار طوق
    النجاة…»); `/en` shows «Hadeeth Encyclopedia ruling: Authentic» without them.
  - Athar speakers have only an Arabic name (`atharSpeakerAr`); `/en` shows it as an isolated,
    marked proper name: «— <bdi lang="ar">الحسن البصري</bdi>».
  - A quote with no English translation gets the generic page title («Quote») as its tab title
    and last crumb on `/en`, instead of its Arabic opening words.
