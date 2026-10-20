# Cursor task — hadith explanations (HadeethEnc + long sharh), tafsir & sharh study panel, deploy prep

Run AFTER docs/taxonomy/CURSOR_FIX_LINKS_PRAYER.md is done. Paste everything below the line into Cursor. Phases in
order; after each: backend + frontend tsc, lint, unit, e2e, importer re-run (second run writes 0), commit, push.

---

FIRST read docs/handoff/ui-port-session-context.md. The public UI described there is final: extend, never revert
(no shuffle, no public «تصنيف المراجعة», DirectionalArrow, Amiri for English, quiet focus, kit Button/SegmentTabs).
Skills to use: ~/.agents/skills/interface-design, shadcn, vercel-composition-patterns, emil-design-eng,
web-design-guidelines, impeccable (critique + polish on screenshots).

## Phase 1 — HadeethEnc (موسوعة الأحاديث النبوية) import
Source: official API https://hadeethenc.com/api/v1 (free access; the owner accepts it like QuranEnc).
- Roots: GET /categories/roots/?language=ar (7 roots, ~4.2k hadith). List: GET /hadeeths/list/?language=ar&category_id=
  {id}&page=&per_page=. One: GET /hadeeths/one/?language={ar|en}&id= → title, hadeeth, attribution, grade, explanation,
  hints (benefits), words_meanings, reference, categories.
- Cache every response in backend/.corpus/hadeethenc/ (gitignored); polite rate (≤5 req/s); idempotent by HadeethEnc id.
- Store per hadith (ar + en): the explanation as Explanation kind SHARH (source «موسوعة الأحاديث النبوية — HadeethEnc»),
  hints as kind FAWAID, words_meanings as kind GHARIB, the reference text, and the grade.
- Match each HadeethEnc hadith to our quotes with the existing takhrij matcher (normalised matn, 0.75): link the
  explanations to every matched quote (all its copies: Sahihayn copy + book copies). Report matched / unmatched.
- OWNER DECISION — grade: HadeethEnc's grade becomes an accepted publishing source. New GradeSource HADEETHENC:
  grade صحيح / حسن (ar) or Authentic / Good (en) → SAHIH / HASAN; anything weaker is not publishable. Never overwrite
  SAHIHAYN / AUTO_SAHIHAYN; it may upgrade AUTHORITY_LEGACY rows and SUNAN_TAHQIQ keeps priority over it. Citation
  line: «حكم موسوعة الأحاديث النبوية: صحيح — <its reference line>». Update grade-policy.ts and its tests.
- Unmatched HadeethEnc hadith: import as Quotes (type HADITH, textSource DIGITAL, source HadeethEnc, publishable by
  its grade) with their HadeethEnc categories in rawPayload; NOT linked to any topic (the reviewer classifies later).
  Export docs/taxonomy/hadeethenc-unlinked.tsv (id, title, categories, grade) for the reviewer.

## Phase 2 — long sharh for the Sahihayn (only if numbering maps reliably)
- Fath al-Bari (Ibn Hajar) for al-Bukhari, Sharh al-Nawawi on Muslim — find them in OpenITI (licence accepted),
  pin commit + SHA-256. Parse into passages keyed by the hadith number in OUR standard numbering (Bukhari Fath
  numbering, Muslim Abd al-Baqi). Verify with anchors: Bukhari 1, 6094, 3261; Muslim 8, 82, 2564 — the passage must
  explain that hadith. If the numbering cannot be mapped reliably, STOP this phase and report; do not guess.
- Store as Explanation kind SHARH_LONG with source name; shown only on the hadith's own page, never inline in lists.

## Phase 3 — the study panel (tafsir for verses, sharh for hadith)
Reference the owner liked: the «سورة» Quran app — a sheet over the reading page with a segmented tab bar on top
(e.g. علوم السورة / الصفحة / الآية / الكلمة), an underline sub-tab row under it (أسماء السورة / نزول السورة / مقاصد …),
Quranic words inside the text set in the Quran font and coloured, and a bottom toolbar (expand, share, previous,
next, close). Build the same idea for Thekra with the kit SegmentTabs (segment variant for the main bar, underline for
the sub-row) and the kit Button:
- Trigger: a quiet «التفسير» (verse) / «الشرح» (hadith) button on each QuoteCard (extend QuoteCard; keep its layout).
- Container: desktop = side panel (Sheet from the end side, ~480px), mobile = bottom sheet (90vh, drag to close).
- Verse tabs: «المعنى» (المختصر — default, short), «السعدي», «التحرير والتنوير». Hadith tabs: «الشرح» (HadeethEnc),
  «الفوائد», «معاني الكلمات», and «فتح الباري» / «شرح النووي» when Phase 2 data exists. Hide empty tabs. en: only tabs
  that have English text (Al-Mukhtasar; HadeethEnc en).
- Reading: paragraphs split; measure ≤ 68ch; Quranic spans ({…} and ﴿…﴾ in al-Sa'di / al-Mukhtasar / Ibn Ashur) rendered
  in the Quran font with the accent colour; long texts (Ibn Ashur) show the first ~1,200 characters + «اقرأ المزيد»
  (no 126k-character wall); lazy-load each tab.
- Toolbar: expand to full page (route /quran/[surah]/[ayah] or /hadith/[id] showing all tabs), share (copy link with
  tab), previous / next item in the current list, close. Keyboard: Esc closes, ←/→ (mirrored in RTL) switch item.
- Remove the old inline collapsed tafsir accordions under verses (they are replaced by the panel).
- Screenshots (1440 + 390, dark + light, ar + en) of the panel open on a verse and on a hadith → docs/design/after/study/.

## Phase 4 — deployment prep (no deploy; the owner clicks)
Target: two Vercel projects from this monorepo + Neon Postgres (free).
- frontend: Root Directory `frontend`; build with pnpm workspace; env NEXT_PUBLIC_API_URL.
- backend: Root Directory `backend`; check Vercel's current NestJS support in its docs (vercel.com/docs) and add what it
  needs (entry file / vercel.json); `prisma migrate deploy` during build; env DATABASE_URL (Neon pooled),
  DIRECT_URL (Neon direct, for migrations), JWT secrets, CORS origin = the frontend URL. If NestJS on Vercel is not
  viable, document Render free as the API host instead.
- scripts/db-push-to-neon.sh: pg_dump local → pg_restore into Neon (reads URLs from env, never hard-coded).
- docs/deploy/VERCEL.md: exact owner steps (create Neon via Vercel Marketplace, import repo twice with the two root
  directories, env vars table, first migration, data restore, custom domain), plus the Hobby-plan non-commercial note.
- Verify locally: `pnpm --filter frontend build` and the backend production build succeed.

## Report — docs/build/STUDY_PANEL_REPORT.md
HadeethEnc counts (fetched, matched, imported, grades by value), grade-policy changes, Phase 2 result or the reason it
stopped, panel screenshots, deploy files list, and the real output of every check.
