# Cursor task — apply the reviewer's taxonomy (v2) and fill every topic with its texts

Paste everything below the line into Cursor (Agent mode). Do the phases IN ORDER. Each phase ends with:
backend + frontend `tsc --noEmit`, lint, unit and e2e tests green, the importer's idempotency re-run, a commit,
and `git push`. If anything in the repo contradicts this file, STOP and report — do not improvise.

---

You are applying a taxonomy that the project reviewer wrote by hand and the owner reviewed. You do NOT design
topics, rename them, invent mappings or decide sides. Your job is mechanical and verifiable.

## Read first (in this order)
1. `backend/prisma/taxonomy/taxonomy.yaml` — the single source of truth: 165 topics in 12 domains + deferred akhlaq
   labels. Its header comment defines every field. Read it fully.
2. `docs/taxonomy/taxonomy-review.md` — the same tree, human-readable, with the expected anchored counts.
3. `docs/taxonomy/sections/*.tsv`, `docs/taxonomy/structure-report.md` — the book structure you imported (e0fe96b).
4. `docs/taxonomy/content-map.tsv` — the reviewer's content-based decision for each of the 384 sections that have no
   book anchor: TOPICS (305), ITEM (15, classify each text by its content) or SKIP (64, with the reason).
5. `backend/.cursorrules`, `docs/build/IMPORT_REPORT.md`.

## Context — what happened and what the reviewer changed (so you understand, not redo)
- Your earlier rule-based classification (d164ee9) split chapter titles into fragments and created 595 sins /
  837 deeds with names like «سوى ذلك )»، «ه بالسواد»، «بيع»; 267/289 of them went public, and the al-Sa'di term matching
  linked غافر 12 to «الرياء» because the tafsir contains «الكبرياء». Those were hidden in a5d9bd7 and are now replaced.
- e0fe96b imported each book's real structure (BookSection / SectionItem). The reviewer built the taxonomy on the
  scholars' own tabwib: Riyad al-Salihin chapter numbers, al-Dhahabi's kabira numbers, al-Targhib's targhib/tarhib
  titles, al-Zuhd and Minhaj titles, the 77 Shu'ab branches, and now al-Munajjid's «سلسلة أعمال القلوب».
- Reviewer changes after the owner's review (v1 → v2), all already in the YAML:
  1. New DO topic `tawhid` (التوحيد) — the opposite of `shirk` is tawhid, not ikhlas. Branch 1 moved to tawhid.
  2. `dhikr-akhira` renamed «التشويق إلى الجنة وتذكّر الآخرة» and now includes Riyad 372 «ما أعد الله للمؤمنين في الجنة».
  3. al-Zuhd «باب فخر الأرض بعضها على بعض» → `dhikr` and `salah` (its reports are about prayer and dhikr).
  4. al-Targhib «صلاة العشاء والصبح … في جماعة» → `salat-fi-jamaah`; «صوم الاثنين والخميس / الأربعاء والخميس» → `siyam`.
  5. al-Targhib «الترهيب من تخطي الرقاب يوم الجمعة» → `adha-muslimin` (and labelled under akhlaq «أدب المجالس»).
  6. al-Zuhd «باب في الخلال المذمومة» → `kadhib` and `khiyana` («كل الخلال يطبع عليها المؤمن إلا الكذب والخيانة»).
  7. New DO topic `muhasaba` (محاسبة النفس). New DO topic `tark-lillah` (أجر من ترك شيئًا لله), `listed: false`:
     not shown in the deeds list; it is the shared «reward of abstaining» pool for every AVOID topic (Phase 4).
  8. New source: «سلسلة أعمال القلوب» (al-Munajjid) — `munajjid:` anchors on ikhlas, khawf-raja, sabr (الرضا),
     shukr, muraqaba (التفكر، التقوى), tawakkul, mahabbat-allah, muhasaba, wara.
  9. Deferred akhlaq layer: `akhlaq:` block (virtue ↔ opposite ↔ balance). Store as labels now; no UI.
  10. Content pass over the 384 unanchored sections (`content-map.tsv`): the reviewer read each title and assigned
      topics by what the chapter is about. New topics for it: domain «الآداب والسنن اليومية» (adab-taam، adab-safar،
      adab-libas، adab-masjid، adab-majlis), tawqir-kibar (Riyad 44, branch 75), taat-wulat (Riyad 80, branch 49),
      tasweer (hidden, kabira 48). These links are CLASSIFIED BY THE REVIEWER, not by the book — they carry their own
      basis so they can be filtered, audited and revoked as a group.
  11. Not mapped on purpose: biographies (عامر بن عبد قيس، صلة بن أشيم، أويس، عمر بن عبد العزيز، توبة داود),
      «قتل الحيات والوزغ», and fiqh-detail etiquette chapters.
- Owner decisions (do not ask again): Quran.com terms for al-Sa'di (resource 91) APPROVED. The 4 «ابن القيم» quotes
  are DELETED. Data is not committed to git (DB, `backend/.corpus/`, dumps). Publishing rule unchanged: a hadith is
  public only when it is in al-Bukhari / Muslim or strongly matches them.

## Phase 0 — Git remote and push (code, migrations, YAML and docs only)
- `git remote add origin git@github.com:Akhera-Plants/Thekra.git` (if `origin` exists with another URL, STOP).
- Verify nothing data-like is tracked: `git ls-files | grep -E '\.corpus/|\.sql$|\.dump$|(^|/)\.env$'` prints nothing;
  no tracked file > 5 MB (`git ls-files -z | xargs -0 du -k | sort -n | tail -5`). `backend/.corpus/` stays ignored.
- Commit the reviewer's uncommitted files (`backend/prisma/taxonomy/`, `docs/taxonomy/`, `docs/review/`) as
  «docs(taxonomy): reviewer taxonomy v2 and review files», then `git push -u origin master`.
- If the push fails (auth, branch protection), STOP and report the exact error.

## Phase 1 — Structure fixes and the new book (prerequisite)
1. Ibn al-Qayyim: delete the 4 quotes of Source «ابن القيم» with their links/favorites/flags, then the Source.
2. Riyad al-Salihin: 1,338 HADITH quotes are outside every section but share a referenceNumber with a sectioned
   quote (old Waqfeya / first-import duplicates). Merge each into the sectioned quote — move favorites, links,
   flags, HadithMatch rows; keep the Waqfeya PDF page in `rawPayload.waqfeyaPage` — then delete the duplicate.
3. al-Kabair: verses are written in braces without a «[سورة: آية]» citation, e.g. «{ولا تطع كل حلاف مهين هماز مشاء
   بنميم}» in «الكبيرة الثالثة والأربعون النمام» (corpus line ~2840 of `0748Dhahabi.Kabair.Shamela0006848-ara1`).
   Detect brace spans with quran-detector → verse keys → AYAH items in order (canonical verse quote only). Re-split
   each kabira: al-Dhahabi's prose = AUTHOR_TEXT; prophetic reports («قال رسول الله صلى الله عليه وسلم…»،
   «وفي الصحيحين…»، «وعن فلان…») = HADITH items. Kabira 43's first item is mislabelled HADITH — it is his definition.
4. Leftovers outside any section: al-Zuhd 436, Mukhtasar Minhaj 173, al-Kabair 98, Shu'ab 12, Bukhari 7, Muslim 3 —
   merge duplicates as in (2), otherwise attach to the right section or list with a reason in structure-report.md.
5. al-Zuhd «باب من ترك شيئا لله» has 0 items — find its reports in the corpus and attach them (or explain).
6. Sahih al-Targhib (OCR): turn `rawPayload.verseKeys` into AYAH items at their position (canonical verse).
7. New book «سلسلة أعمال القلوب» — al-Munajjid. Modern copyrighted work: import CITATIONS only, never his prose.
   - Source text: aljam3 book 38380 (library «مكتبة المسجد النبوي», 333 pages, file 71356). Get the TXT URL with the
     aljam3 MCP `get_book` (files[].urls.txt → Hugging Face dataset `ieasybooks-org/prophet-mosque-library`, MIT);
     download that ONE file into `backend/.corpus/`, pin the dataset commit + SHA-256. No bulk API use.
   - Structure: one BookSection per chapter, by the book's index (start page): الإخلاص 7، الخوف 36، الرجاء 68،
     الرضا 91، الصبر 122، الشكر 153، التفكر 177، التوكل 200، المحبة 233، المحاسبة 257، التقوى 285، الورع 315 (end 333).
   - Items: every Quran citation «[سورة: آية]» → AYAH item (canonical verse). Every hadith he cites → run takhrij;
     strong Bukhari/Muslim match → HADITH item pointing to THAT Sahihayn quote; otherwise skip it (do not import his
     wording). His prose: one AUTHOR_TEXT item per chapter with only `{ page range, attribution }` — no text stored.
   - Attribution on every link from this book: «ذكره الشيخ محمد صالح المنجد في سلسلة أعمال القلوب، ص N».
8. Regenerate `docs/taxonomy/sections/*.tsv` (add `munajjid.tsv`) and `structure-report.md`. Idempotent.

Acceptance (paste real SQL output in the report): Ibn al-Qayyim rows = 0; Riyad orphan hadith = 0; kabira 43 has
AYAH 68:10–68:11 and the hadith «لا يدخل الجنة نمام»; orphan counts per book = 0 or explained; Munajjid: 12 sections,
AYAH and HADITH counts per chapter, 0 stored prose.

## Phase 2 — Schema (one migration, additive)
Keep `Sin` (AVOID topics) and `GoodDeed` (DO topics) as the public tables — URLs and favorites depend on them. Add:
- `TopicDomain` (key, nameAr, nameEn, order).
- On `Sin` and `GoodDeed`: `domainKey`, `origin` value `TAXONOMY`, `isContemporary`, `isHidden` (never public until
  the owner unhides), `isListed` (false = not in lists, still usable, e.g. tark-lillah), `taxonomyOrder`, and the
  opposite link in both directions (reuse `GoodDeed.oppositeSinId`; add `Sin.oppositeGoodDeedId` if missing; DO↔DO or
  AVOID↔AVOID opposites are not allowed — all YAML opposites are cross-side, verify and fail loudly otherwise).
- `TopicDerivation` (contemporary topic → classical topic, either side).
- `TopicLabel` (labelKey, labelAr, side+slug) for the deferred akhlaq block.
- On `SinQuote` / `GoodDeedQuote`: `basis` enum `CHAPTER | CHAPTER_AYAH | TAKHRIJ | AUTHOR_CITATION |
  REVIEWER_SECTION | AI_ITEM | KEYWORD_PROPOSAL | MANUAL`, plus `classifiedBy` (`BOOK` | `REVIEWER` | `AI`) so the
  DB itself says whether a link comes from the author's tabwib or from our classification and `sectionId` (nullable FK to BookSection). Keep `reviewStatus`, `note`.

## Phase 3 — Apply the taxonomy (`backend/prisma/imports/taxonomy/`, script `import:taxonomy`, `--dry-run` flag)
3.1 Topics
- Upsert every YAML topic by `slug` (AVOID → Sin, DO → GoodDeed): nameAr=`ar`, name=`en`, domain, opposite,
  contemporary, hidden, listed (default true), order = YAML position. The 16 existing curated slugs (ghibah, kadhib,
  hasad, ghadab, namimah, qat-al-rahim, riya, tark-as-salah, hifz-al-lisan, sadaqah, silat-ar-rahim, salat-fi-jamaah,
  ikhlas, kaff-al-ghadab, dhikr, birr-al-walidayn) are UPDATED in place, never recreated.
- `branches` → upsert `ImanBranchSin` / `ImanBranchGoodDeed`.
- `kabair` → topic `rank = KABIRA`, rankSource al-Kabair, `rankReference = «الكبائر للذهبي، الكبيرة رقم N — <title>»`
  (first number wins). Move the links of `kabira-N` into the topic, then delete `kabira-N`. Numbers absent from the
  YAML (35, 48, 57, 64, 67) keep their `kabira-N` row with `isHidden = true`.
- `akhlaq` → TopicLabel rows only. No UI.
- Delete every `origin = AUTO_CHAPTER` Sin/GoodDeed and every link from the old chapter rule or the al-Sa'di term
  matching (hidden in a5d9bd7). Nothing of them is reused.

3.2 Section → topic matching (exactly this algorithm — it reproduces the reviewer's dry run)
- `norm(s)`: remove U+064B–U+0652, U+0670, U+0640; أ/إ/آ→ا; ة→ه; ى→ي; Persian ی→ي and ک→ك (the OCR Targhib titles
  contain them, e.g. «یا کافر»); collapse spaces.
- Riyad: BAB maps when its printed `number` is in the topic's `riyad`; a string entry matches by
  `norm(entry) ⊂ norm(titleAr)` (used for «تحريم الغدر», whose printed number is a typo).
- al-Kabair: kabira ordinal (الأولى … السبعون) parsed from the KABIRA title; its فصل sub-sections inherit it.
- Targhib / Zuhd / Minhaj / Munajjid: `norm(phrase) ⊂ norm(titleAr)`; for Minhaj test `titleAr + parentPath`.
  Targhib side check: DO topics need «ترغيب» in the title, AVOID topics need «ترهيب», unless `sideCheck: false`.
  A section may match several topics on both sides (mixed «الترغيب في … والترهيب من …» titles) — link to all.
- Shu'ab: branch ↔ topic via `branches` only (do not copy Shu'ab narrations into Sin/GoodDeed links).
- Expected (your result must match within ±2%, else STOP and report the diff): Targhib 338/512 sections,
  Zuhd 59/85, Minhaj 113/140; 384 sections unmapped (Riyad+Targhib+Zuhd+Minhaj). Anchored item counts before
  Kabair/Sahihayn/Munajjid: الغيبة 51، الكذب 18، الخيانة 5، المحافظة على الصلاة 125، صلاة الجماعة 168، الصيام 108،
  الذكر 964، التشويق إلى الجنة 215، أذى الناس 22.

3.3 Links from a mapped section (every item, author's order)
- HADITH item → basis CHAPTER, sectionId, ACCEPTED, note «من باب: <title> — <book>». Mixed sections: ACCEPTED on all
  matched topics, note adds «(باب مشترك)».
- AYAH item → canonical verse quote, basis CHAPTER_AYAH, ACCEPTED, note «أورده <author> في باب: <title> — <book>»
  (النووي، الذهبي، المنذري، ابن المبارك، ابن قدامة). These author-chosen verses REPLACE the al-Sa'di keyword links.
- Munajjid items → basis AUTHOR_CITATION, ACCEPTED, note «ذكره الشيخ محمد صالح المنجد في سلسلة أعمال القلوب، ص N».
- AUTHOR_TEXT items stay non-public.
- relevanceScore: AYAH 90, public hadith 80, other hadith 50; equal scores keep section order.

3.4 Takhrij propagation
- For every link from 3.3 whose quote has a STRONG HadithMatch to a Bukhari/Muslim reference, link that Sahihayn
  quote to the same topic: basis TAKHRIJ, ACCEPTED, note «رواه البخاري (رقم) — ورد في باب: <title> من <book>».
  One link per (topic, quote). Readers see the clean Sahihayn matn first; the original book is the second citation.

3.5 Keyword proposals (al-Adab al-Mufrad, Bukhari and Muslim tarajim — no hand anchors yet)
- Match `kw` (same norm, containment; side from title verbs: تحريم / النهي / الترهيب / ذم / كراهية → AVOID; فضل /
  الترغيب / استحباب / الحث / الأمر بـ → DO; no verb → either). Links basis KEYWORD_PROPOSAL, NOT_REVIEWED (not public).
- `docs/taxonomy/proposals/<book>.tsv`: sectionId, title, proposed slug(s), side, item count. Do not ACCEPT any.

3.6 Reviewer content map (`docs/taxonomy/content-map.tsv`, by sectionId — do not re-decide)
- TOPICS rows: link every item of the section (author's order, same item rules as 3.3) to each listed slug:
  basis REVIEWER_SECTION, classifiedBy REVIEWER, ACCEPTED, note «تصنيف المراجع حسب موضوع الباب: <title> — <book>».
  Run takhrij propagation (3.4) on them too (the Sahihayn copy gets basis TAKHRIJ, classifiedBy REVIEWER).
- SKIP rows: nothing is linked. Keep the reason in the report.
- ITEM rows (15 sections with truncated or vague titles): read each HADITH/AYAH item's text and decide its topic(s)
  the way the reviewer did for «باب فخر الأرض» (the reports there are about the earth praising prayer and dhikr →
  salah + dhikr). Use ONLY existing slugs from the YAML. Write `docs/taxonomy/item-decisions.tsv` (quoteId, section,
  first 120 chars, slugs, one-line reason, confidence high|low). High → link basis AI_ITEM, classifiedBy AI,
  ACCEPTED, note «تصنيف آلي حسب محتوى النص». Low or no clear topic → do NOT link; list it in the report for the owner.
- Public pages label any text whose link has classifiedBy ≠ BOOK with a small muted note «تصنيف المراجعة» (no
  English). Admin: filter links by classifiedBy and revoke a whole group.

3.7 Second run of `import:taxonomy`: 0 created / 0 updated / 0 deleted. Paste both summaries.

## Phase 4 — Public behaviour (balance: hope AND warning — owner requirement)
- A topic is public when `isHidden = false` AND it has ≥ 1 public text (direct, or via TopicDerivation for
  contemporary topics). Lists show only `isListed = true`. Hidden: jihad, firar-zahf, kaffarat, kabira-N leftovers.
- AVOID topic page has two labelled parts, both always present when data exists:
  «ما جاء في التحذير منها» (its own texts) and «أجر من تركها لله» (texts of its `opposite` DO topic + the
  `tark-lillah` pool). Reader mode alternates: warning, reward, warning, reward …
- DO topic page: «فضلها وثوابها» first (its own texts), then «ما جاء في التحذير من تركها» (its `opposite` AVOID texts).
- Within a part: CHAPTER_AYAH first, then Sahihayn hadith (TAKHRIJ or direct), then other public hadith; every text
  shows «من باب: … — <book>» or the Munajjid attribution.
- Contemporary pages: their own texts (none yet) + derived topics' texts grouped under each derived topic's name,
  with «موضوع معاصر: نصوصه مستمدة من الأبواب التالية». «كبيرة» badge with reference stays. Iman branches listed.

## Phase 5 — UI for the tree (keep «ليل», Thmanyah, Arabic-only, no Latin in the ar locale)
- `/sins`, `/good-deeds`: grouped by domain in YAML order; rows show name, «كبيرة» if ranked, number of public texts;
  contemporary rows carry «معاصر». Search on top.
- Home «ما الذي يثقل قلبك؟» = the 8 listed AVOID topics with the most public texts.
- Screenshots (real 1440×900 and true 390 via iframe) of `/sins`, `/sins/ghibah`, `/good-deeds`,
  `/good-deeds/silat-ar-rahim`, `/sins/waqt-tawasul` → `docs/design/after/`.

## Phase 6 — Report `docs/taxonomy/apply-report.md`, then commit and push
- Phase 1 acceptance outputs. Section-match totals vs 3.2 expectations.
- Per topic (by domain): side, links by basis (CHAPTER / CHAPTER_AYAH / TAKHRIJ / AUTHOR_CITATION / REVIEWER_SECTION /
  AI_ITEM / KEYWORD_PROPOSAL) and by classifiedBy,
  public texts, rank. Then every public topic with < 3 public texts.
- 20 random ACCEPTED links, 20 random REVIEWER_SECTION links, every AI_ITEM decision, the low-confidence ITEM texts,
  and 20 random KEYWORD_PROPOSAL rows (topic, basis, note, first 80 chars).
- Real output of tsc, lint, unit, e2e and both importer runs.

## Backlog — write to `docs/build/BACKLOG.md`, do not implement
- Slim the DB after classification: keep only ayat and Sahihayn hadith linked to a topic or branch or referenced by
  takhrij; drop the rest (re-importable from the pinned corpora).
- Akhlaq view («الأخلاق والتزكية»): virtue ↔ opposite ↔ balance, using the TopicLabel rows; owner will supply a
  reference (e.g. «خلق المسلم» للغزالي).
