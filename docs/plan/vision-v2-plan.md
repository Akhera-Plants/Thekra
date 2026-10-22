# Thekra — Vision v2: Three Paths, شعب الإيمان, Explanations, Sources & Book Import

> **Scope:** the owner's updated product vision, turned into an implementable plan, plus a whole-project audit of
> what is still missing. It adds two lettered phases — **Phase 3b** (three paths, شعب الإيمان, sin rank,
> explanations, Dorar links) and **Phase 5b** (book corpus import and tafsir caching) — and amends **Phase 4b**
> (reminders for any good deed). **Documentation only.** Nothing in `backend/`, `frontend/` or `mobile/` was
> created or changed, nothing was installed, no migration was generated.
> Every model, field, enum, endpoint, module, slice, route and dependency below is a **PROPOSED addition that
> requires owner approval** before Cursor implements it ([backend/.cursorrules](../../backend/.cursorrules) →
> "Schema Changes Are Exceptional", "Module Boundaries", "Dependencies"; [frontend/.cursorrules](../../frontend/.cursorrules)
> → fixed slice list).
> **No Islamic content is supplied by this plan.** Sin ranks, شعب numbering, grades, references and شرح
> attributions are always "owner/scholar to verify".
> Repo state checked at HEAD `47f3d48` with a dirty working tree (see [§14](#14-whole-project-gap-audit), row G7).
> Cross-doc: [TECHNICAL_PLAN.md](../TECHNICAL_PLAN.md) · [roadmap.md](./roadmap.md) ·
> [backend-plan.md](./backend-plan.md) · [frontend-plan.md](./frontend-plan.md) ·
> [content-pipeline-plan.md](./content-pipeline-plan.md) · [silat-rahim-plan.md](./silat-rahim-plan.md) ·
> [mobile-plan.md](./mobile-plan.md) · [devops-plan.md](./devops-plan.md)

---

## 0. Ground rules and repo facts

| Rule / fact | Source | Consequence here |
| --- | --- | --- |
| **Guest-first** | [TECHNICAL_PLAN B1](../TECHNICAL_PLAN.md#b-auth--access) | The third path (شعب الإيمان), sin ranks, explanations and "read more" links are all public. Only reminders (Phase 4b) need an account. |
| **Cache, don't proxy** | [TECHNICAL_PLAN §I.4](../TECHNICAL_PLAN.md#i-standing-assumptions), [ARCHITECTURE §2](../ARCHITECTURE.md#2-dynamic-content-strategy) | Tafsir is cached by a sync run, never fetched per request. The Dorar hadith API is a **curation aid run by a human**, never called by a request handler. |
| **Ingestion ≠ classification** | [TECHNICAL_PLAN D7](../TECHNICAL_PLAN.md#d-content-pipeline), [content-pipeline §4.3](./content-pipeline-plan.md#43-where-automation-is-allowed-and-where-it-is-not) | Book importers and the tafsir sync write content only. **No importer writes `SinQuote`, `GoodDeedQuote`, `ImanBranchQuote` or `QuoteTag`.** A human links. |
| **Grade policy everywhere** | [backend-plan §4.3](./backend-plan.md#43-grade-policy-moduleshadithgrade-policyts), [TECHNICAL_PLAN D8/D9](../TECHNICAL_PLAN.md#d-content-pipeline) | Branch quotes (#86) and explanation lookups (#87) go through `GradePolicy` like #3/#7/#9. Imported narrations default to `UNGRADED`, so they stay hidden until a curator grades them. |
| **Arabic is the source of truth** | [TECHNICAL_PLAN E7](../TECHNICAL_PLAN.md#e-frontend) | `textAr` and Arabic explanations are always shown. A translated explanation is shown in addition, never instead. |
| **Schema is final; additions are exceptional** | [backend/.cursorrules](../../backend/.cursorrules) | §6 is a proposal. Each feature ships as its own migration and its own commit. |
| **Module list is exactly backend-plan §1** | [backend-plan §1](./backend-plan.md#1-module-map) | One new module is proposed (`modules/iman-branches/`). Explanations and external links live in existing modules (§8). |
| **No breaking `/v1` change** | [roadmap cross-cutting](./roadmap.md#cross-cutting-every-phase) | Everything is additive. `Sin.severity` is kept (§6.2). Phase 7's mobile client mirrors the contract, so `mobile/src/lib/types/api.ts` is updated together with `frontend/src/lib/types/api.ts`. |
| **Repo fact: most of the roadmap is already built** | `git log` (`78edc19` Phase 3, `49af73e`/`6c3d027` Phase 4, `a1f037b` Phase 5, `cd68e7b` Phase 6, `d6705ee` Phase 7, `e452fe4` Phase 8 CI) | Phases 3b and 5b extend shipped code: the admin curation UI (`features/curation`), the content-sync executor and `SyncLog` console, and the Expo app all exist. Phase 4b is **not** built (blocked on approvals). |

---

## 1. The owner's vision

Paraphrased from the owner's own words (Arabic). The core idea is unchanged: the right reminder at the moment of
need. The vision now has **three main paths** plus **periodic reminders**.

| # | Path (working name) | What the user gets | Today |
| --- | --- | --- | --- |
| 1 | «أشعر برغبة في معصية» | A list of sins to avoid. Each sin shows its **rank — كبيرة or صغيرة** — and the gathered verses and hadith that urge avoiding it. | Exists (`/sins`, `/sins/[slug]`, endpoints #1–#4) **minus the rank**. `Sin.severity Int?` (1–10) is an editorial weight, not a scholarly rank. |
| 2 | «أريد عمل حسنة» | Specific acts of worship and good deeds, with the texts that show the reward and urge doing them. | Exists (`GoodDeed` + `reward`/`rewardAr` + `GoodDeedQuote`, `/good-deeds/[slug]`, #5–#7). |
| 3 | **شعب الإيمان** (new) | Faith as a practical, everyday picture, based on al-Bayhaqi's «الجامع لشعب الإيمان» together with one of its explanations (شرح). Each شعبة has its meaning, its texts, and the practical deeds and sins it relates to. | Does not exist (no model, endpoint or route). |

| Also in scope | Detail | Today |
| --- | --- | --- |
| **Periodic reminders** | صلة الرحم per named relative («صلة رحم خالتي فلانة، عمتي فلانة») **and** الصدقة and other acts of worship the owner will add. So a reminder can target **any** `GoodDeed`, not only "forgotten deeds". | Planned as Phase 4b ([silat-rahim-plan.md](./silat-rahim-plan.md)), not built. S3 is resolved here: [§10](#10-reminders-for-any-good-deed--phase-4b-amendment). |
| **Explanations** | تفسير for verses, شرح for hadith, and the شرح of each شعبة. | Nothing in the schema or any plan stores an explanation (verified: no match for tafsir/sharh/explanation in `docs/`, `backend/`, `frontend/`). Designed in §3, §6–§9. |
| **"Read more" on الدرر السنية** | Link each sin, deed and شعبة to its page in «موسوعة الأخلاق والسلوك». | Not present (no Dorar mention anywhere in the repo). Designed in §3.1, §6. |

| Explicitly out of scope now | Why |
| --- | --- |
| Living the context of revelation/hadith (أسباب النزول، سياق الحديث) | Needs a qualified scholarly team. Recorded as a future phase idea in [§19](#19-future-phase-idea--context-of-revelation-and-community-contributions). |
| Community contributions | A possible later way to build the above. It conflicts with the standing assumption "no user-generated public content" ([TECHNICAL_PLAN §I.10](../TECHNICAL_PLAN.md#i-standing-assumptions)) and with "one curator" (§I.9). Not designed. |

---

## 2. Path names — proposals for the owner

The current labels are the owner's working names, already shipped in `frontend/messages/ar.json`
(`home.sinEntryLabel` = «أشعر برغبة في معصية», `home.deedEntryLabel` = «أريد عمل حسنة»). The owner picks one per
path (decision [V1](#15-owner-decisions)). Changing a label is an i18n-only change (`ar.json`/`en.json`, both keys,
CI parity check `pnpm check:i18n`).

| Path | Option | English label | Why this wording |
| --- | --- | --- | --- |
| 1 — sin | «أعِنّي على ترك معصية» | Help me resist a sin | Asks for help instead of confessing a desire; no shame on the button. |
| 1 — sin | «ذكِّرني قبل أن أزِلّ» | Remind me before I slip | Matches the app's name (تذكرة) and the moment of need. |
| 1 — sin | «أجد في نفسي ميلًا إلى معصية» | I feel drawn to a sin | Closest to the owner's wording, softer than «رغبة». |
| 1 — sin | «اجتنِب المعاصي» | Avoid sins | Short, neutral catalogue label; works as a heading too. |
| 2 — good deed | «دُلّني على خير» | Show me something good to do | Echoes the Prophetic phrasing of guiding to good; inviting. |
| 2 — good deed | «أريد أن أعمل صالحًا» | I want to do a good deed | Owner's meaning, more classical wording. |
| 2 — good deed | «رغِّبني في طاعة» | Encourage me to an act of worship | Says exactly what the screen does (ترغيب). |
| 2 — good deed | «أبواب الخير» | Doors of goodness | Short catalogue heading. |
| 3 — شعب الإيمان | «شُعَب الإيمان» | Branches of faith | The work's own term; recognisable. |
| 3 — شعب الإيمان | «الإيمان في حياتي» | Faith in my daily life | States the purpose: practical, everyday. |
| 3 — شعب الإيمان | «الإيمان عملًا» | Faith in action | Short; stresses practice. |
| 3 — شعب الإيمان | «كيف أعيش إيماني؟» | How do I live my faith? | A question the user would actually ask. |

Recommendation (not a decision): keep the path-1 and path-2 tone non-shaming and parallel — e.g. «أعِنّي على
ترك معصية» / «دُلّني على خير» / «شُعَب الإيمان». The owner decides.

---

## 3. Content sources: Dorar, Quran.com tafsir, hadith sharh

### 3.1 Dorar (al-Durar al-Saniyya) — correcting the akhlaq API assumption

**Correction.** The owner believes "we'll use the Dorar akhlaq API". **There is no API for the ethics
encyclopedia.** What exists:

| Item | Verified fact | Evidence |
| --- | --- | --- |
| Dorar's public API | `https://dorar.net/dorar_api.json?skey=…` (JSON, or JSONP with `&callback=?`). The documentation page describes it as a service that lets site owners **display hadith-encyclopedia search results** on their own sites. The documented example reads results from `data.ahadith`. Nothing else is offered. | [dorar.net/article/389](https://dorar.net/article/389) (fetched; title «خدمة واجهة الموسوعة الحديثية API») |
| «موسوعة الأخلاق والسلوك» | A browsable encyclopedia at `https://dorar.net/alakhlaq`, split into «مُقَدِّماتٌ في الأخلاقِ والسُّلوكِ», «الأخلاق المحمودة» and «الأخلاق المذمومة». Every entry is a numbered page, e.g. `/alakhlaq/286` («معنى الأمانةِ لُغةً واصطِلاحًا»). The page links to "المراجع المعتمدة" and "منهج العمل في الموسوعة". **No API.** The only API link on the site points back to article 389 (the hadith API). | [dorar.net/alakhlaq](https://dorar.net/alakhlaq) (fetched) |
| Rights | The site states «جميع الحقوق محفوظة» (per the owner-supplied verification; the fetched page was truncated before the footer, so this plan did not re-read it). Content may not be copied without permission. | — |
| Server-side access | A plain `curl` to `dorar.net` returned **HTTP 403** during this check while a browser-like fetch returned 200. **Verify that `dorar_api.json` answers a server-side client** before building the CLI in §3.2; if it does not, the fallback is manual lookup on the website. | this check |

**Strategy (three uses, no scraping):**

| # | Use | How | Permission needed |
| --- | --- | --- | --- |
| D-a | **Hadith API as a curation aid** | A human looks up a narration's rulings while grading or linking it. Built as a **CLI helper** (`backend/prisma/imports/tools/dorar-hadith-lookup.ts`, run by `pnpm --filter backend dorar:lookup "<words>"`) that fetches the JSON server-side, strips the HTML fragment to plain text and prints it. It never writes the database and never runs in a request handler or in CI. The curator then records a grade **with the grader and reference** (e.g. the scholar and book cited in the ruling). Dorar's text is never stored as a `Quote`. | No (documented public service used as intended). Owner confirms the use ([V18](#15-owner-decisions)). |
| D-b | **Deep link "اقرأ المزيد في الدرر السنية"** | Each `Sin` / `GoodDeed` / `ImanBranch` can carry links to its Dorar page(s) — e.g. a sin → its entry under «الأخلاق المذمومة», a deed → «الأخلاق المحمودة». Stored as `ExternalReference` rows (§6), curated by hand, `https` only, host allow-listed (`dorar.net`). Rendered as an outbound link with the provider named; no content is shown from Dorar. | **No** — linking needs no permission. |
| D-c | **Importing akhlaq content** (text, definitions, gathered texts) | Not planned. Requires **written permission from Dorar**. | **Yes — owner action** ([V5](#15-owner-decisions)). Request via [dorar.net/feedback](https://dorar.net/feedback): scope (which sections), attribution and link-back, no modification of text, non-commercial use, how updates are handled. Until a written grant exists, only D-a and D-b are built. |

**Rejected:** calling the JSONP API from the Phase 6 admin UI in the browser. JSONP executes script served by a
third party inside the admin page, where the admin's access token lives in memory
([frontend-plan §6.5](./frontend-plan.md#65-authsession-on-the-client-phase-4)). A server-side CLI that reads JSON
and prints text has none of that risk.

### 3.2 Quran tafsir — cached from Quran.com (verified)

The Quran.com API (the existing primary Quran provider, [content-pipeline §2.1](./content-pipeline-plan.md#21-qurancom-api--primary-quran-provider))
**does offer tafsir**, in the same way as translations. Verified during this check (no token was needed today;
[TECHNICAL_PLAN D4](../TECHNICAL_PLAN.md#d-content-pipeline) still applies — auth may become required):

| Request | Result |
| --- | --- |
| `GET https://api.quran.com/api/v4/resources/tafsirs` | Catalogue. Arabic resources returned: `16` التفسير الميسر, `91` السعدي, `14` ابن كثير, `15` الطبري, `90` القرطبي, `94` البغوي, `93` الوسيط (طنطاوي). Also non-Arabic ones (e.g. `169` Ibn Kathir abridged, English). |
| `GET /api/v4/tafsirs/16/by_ayah/49:12` | `{ tafsir: { resource_id, text, verses: { "49:12": … } } }` |
| `GET /api/v4/tafsirs/16/by_chapter/103?per_page=50` | `{ tafsirs: [{ id, resource_id, verse_key, language_id, text, slug }], pagination }` — the batch shape a sync run needs. |

Plan: a new tafsir capability in `content-sync` (Phase 5b, §8) caches chosen resources into `Explanation` rows
(`kind = TAFSIR`, `origin = API_CACHED`, keyed by `ayahKey`), idempotent on `(apiProvider, externalId)` =
`('quran.com-tafsir', '<resourceId>:<verse_key>')`. Which resources, and their redistribution terms, are owner
decisions ([V13](#15-owner-decisions)). Tafsir text may contain HTML: store sanitised plain text (keep `rawPayload`
verbatim, never serialised).

### 3.3 Hadith sharh and branch sharh — curated, cited

No provider supplies hadith commentary in a licensable form that this plan verified. Hadith شرح and branch
شرح are **curated `LOCAL` `Explanation` rows**, each attributed to a `Source` (the commentary work and edition)
plus a `reference` (volume/page). The curator types or pastes from a clean digital edition (§4) — never OCR —
and the owner verifies. Which شرح to use is an owner/scholar decision ([V2](#15-owner-decisions), [V15](#15-owner-decisions)).

Candidates for شعب الإيمان (owner to verify; none is chosen by this plan):

| Candidate | Status | Digital text found |
| --- | --- | --- |
| al-Bayhaqi's own chapter text in «الجامع لشعب الإيمان» | The base work | §4.2 |
| al-Ḥalīmī, «المنهاج في شعب الإيمان» — the root work al-Bayhaqi built on | **owner to verify** | OpenITI `0403AbuCabdAllahHalimi.MinhajFiShucabIman` (version `Sham19Y0018567-ara1`); [Shamela 18567](https://shamela.ws/book/18567) (ت حلمي محمد فودة، دار الفكر، ط1 ١٣٩٩هـ، ٣ أجزاء) |
| al-Qazwīnī, «مختصر شعب الإيمان» — a known abridgment | **owner to verify** | OpenITI `0699IbnCabdRahmanQazwiniShafici.MukhtasarShucabIman` (versions `JK000027-ara1`, `Shamela0006850-ara1`); [Shamela 6850](https://shamela.ws/book/6850) (ت عبد القادر الأرناؤوط، دار ابن كثير، ط2 ١٤٠٥) |
| A modern شرح | owner/scholar choice; likely copyrighted → needs permission | — |

---

## 4. The owner's book folder and digital-text availability

### 4.1 What the PDFs are (owner-supplied analysis, pypdf)

Folder: `/Users/moedad/Documents/work/Personal Projects/Books for Thekra` (9 PDFs, 258 MB). Not opened or changed
by this task.

| File | Pages | Text layer |
| --- | --- | --- |
| الأدب المفرد (البخاري) | 584 | none — scanned images |
| الجامع لشعب الإيمان للبيهقي ط الرشد | 7,825 | none — scanned images |
| الزهد والرقائق | 1,248 | none — scanned images |
| صحيح الترغيب والترهيب (الألباني) | 2,352 | none — scanned images |
| مختصر منهاج القاصدين | 488 | none — scanned images |
| الداء والدواء (ت. العتيبي) | 600 | none — scanned images |
| ما لا يسع المسلم جهله | 338 | text layer exists, but legacy font encoding → extracted text is not Arabic Unicode |
| بهجة المجالس | 1 | only the cover page, not the book |
| رياض الصالحين ط دار المنهاج | ? | AES-256 encrypted publisher edition |

**Conclusion: seeding directly from these PDFs is not viable.**

- It would need Arabic OCR. OCR errors in Quran and hadith text (dropped or wrong tashkeel, confused letters such
  as ب/ت/ث or ي/ى) are **unacceptable** for this product — content integrity is its one non-negotiable guarantee
  ([roadmap cross-cutting](./roadmap.md#cross-cutting-every-phase)). **No OCR text is ever imported.**
- The scans are **modern editions** (tahqiq, typesetting, footnotes) with their own rights, even though the
  classical texts themselves are public domain. One is encrypted; one is only a cover.
- **Recommended path:** keep the PDFs as the owner's **reference and verification copies** (page citations,
  spot-checking an import), and import **the same works from clean digital Unicode texts** (§4.2), choosing the
  version whose edition matches the owner's PDF where one exists.

### 4.2 Per-work digital-text availability (checked with web requests; no bulk downloads)

OpenITI paths are `OpenITI/<25-year repo>/data/<author>/<book>/` on GitHub; the version suffix names its origin
(`ShamelaNNNNNNN` = al-Maktaba al-Shamela book id, `JK…`/`ShamAY…`/`Sham19Y…` = other OpenITI source collections).
[usul.ai](https://usul.ai) serves OpenITI versions (`source: openiti`) and Shamela/turath versions (`source: turath`)
in its page data.

| # | Work (owner's PDF) | OpenITI (verified path → versions) | Shamela (verified page → edition) | Matches owner's edition? | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | الأدب المفرد — al-Bukhārī (d. 256) | [`0275AH/…/0256Bukhari.AdabMufrad`](https://github.com/OpenITI/0275AH/tree/master/data/0256Bukhari/0256Bukhari.AdabMufrad) → `JK000011-ara1`, `Shamela0009647-ara1`, `Shamela0012991-ara1`, `Shia001922-ara1` | [12991](https://shamela.ws/book/12991): ت محمد فؤاد عبد الباقي، المطبعة السلفية، ط2 ١٣٧٩هـ · [9647](https://shamela.ws/book/9647): «بأحكام الألباني» ت الزهيري، مكتبة المعارف ١٤١٩هـ | **unknown** (the PDF's edition is not identified) | `9647` carries al-Albānī's rulings (a modern work) — prefer `12991` for the text and cite grades separately (§5.6). usul.ai: `/t/adab-mufrad`. |
| 2 | الجامع لشعب الإيمان — al-Bayhaqī (d. 458), **ط الرشد** | [`0475AH/…/0458Bayhaqi.ShucabIman`](https://github.com/OpenITI/0475AH/tree/master/data/0458Bayhaqi/0458Bayhaqi.ShucabIman) → `JK000021-ara1.completed`, `ShamAY0033962-ara1`, `Shamela0010660-ara1` | [10660](https://shamela.ws/book/10660): «ط الرشد» — مكتبة الرشد بالرياض مع الدار السلفية ببومباي، ط1 ١٤٢٣هـ/٢٠٠٣م | **Yes, likely** — `Shamela0010660` is the same publisher/edition as the owner's PDF, so narration numbers and page references should line up (owner to spot-check) | ~11k narrations (owner's estimate): the importer must stream (§5.9). usul.ai `/t/shucab-iman` lists the OpenITI versions plus a turath version of a different edition (دار الكتب العلمية). |
| 3 | الزهد والرقائق | [`0200AH/…/0181IbnMubarak.Zuhd`](https://github.com/OpenITI/0200AH/tree/master/data/0181IbnMubarak/0181IbnMubarak.Zuhd) → `JK000055-ara1`, `JK006954-ara1`, `Shamela0013028-ara1` | [13028](https://shamela.ws/book/13028): «الزهد والرقائق - ابن المبارك - ت الأعظمي» | **unknown** — the title matches Ibn al-Mubārak's (d. 181) work in al-Aʿẓamī's edition; **owner to verify the PDF's author and edition** (other works share this title) | usul.ai `/t/zuhd` (OpenITI + turath versions, investigator حبيب الرحمن الأعظمي). |
| 4 | صحيح الترغيب والترهيب — al-Albānī (d. 1420) | **Not in OpenITI** — the author folder `1425AH/…/1420MuhammadNasirDinAlbani` has only `SahihAdabMufrad`, `DacifAdabMufrad`, `SahihWaDacifSunanTirmidhi`. The **base work**, al-Mundhirī's «الترغيب والترهيب» (d. 656), is in [`0675AH/…/0656IbnCabdQawiMundhiri.TarghibWaTarhib`](https://github.com/OpenITI/0675AH/tree/master/data/0656IbnCabdQawiMundhiri/0656IbnCabdQawiMundhiri.TarghibWaTarhib) → `JK000080-ara1`, `Sham19Y0013223-ara2`, `Shamela0006847-ara1` | [171](https://shamela.ws/book/171): صحيح الترغيب والترهيب، مكتبة المعارف، ط1 ١٤٢١هـ/٢٠٠٠م، ٣ أجزاء (also served by usul.ai `/t/sahih-al-targhib-wal-tarhib` from turath) · [6847](https://shamela.ws/book/6847): المنذري، ت إبراهيم شمس الدين، دار الكتب العلمية ١٤١٧ | Shamela 171 is the Maktabat al-Maʿārif edition; whether it matches the PDF is **unknown** | **Modern copyrighted work.** Use it to **cite grades** (book + number), never to copy al-Albānī's commentary or footnotes (§5.6). |
| 5 | مختصر منهاج القاصدين — Najm al-Dīn Ibn Qudāma al-Maqdisī (d. 689) | [`0700AH/…/0689AhmadIbnCabdRahmanIbnQudama.MukhtasarMinhajQasidin`](https://github.com/OpenITI/0700AH/tree/master/data/0689AhmadIbnCabdRahmanIbnQudama) → `Shamela0098087-ara1` | [98087](https://shamela.ws/book/98087): مكتبة دار البيان، دمشق ١٣٩٨هـ/١٩٧٨م، ٤٠٨ ص | **unknown** | Prose work → curated excerpts, not a bulk import (§5.3). usul.ai `/t/mukhtasar-minhaj-qasidin`. |
| 6 | الداء والدواء — Ibn Qayyim al-Jawziyya (d. 751), ت. العتيبي | [`0775AH/…/0751IbnQayyimJawziyya.DaWaDawa`](https://github.com/OpenITI/0775AH/tree/master/data/0751IbnQayyimJawziyya) → `JK000062-ara1`, `ShamAY0034414-ara1`, `ShamAY0038516-ara1`, `Shamela0000158-ara1`, `Shamela0098093-ara1` | [158](https://shamela.ws/book/158): دار المعرفة، المغرب ١٤١٨هـ · [98093](https://shamela.ws/book/98093): دار عطاءات العلم/ابن حزم، ط4 ١٤٤٠هـ | **No match found** for "ت. العتيبي" among these versions — **owner to verify** | Prose → curated excerpts (§5.3). usul.ai `/t/al-da-wa-l-dawa`. |
| 7 | ما لا يسع المسلم جهله | **Not found** | **Unknown** — Shamela's search is JavaScript-only and could not be queried; a web search shows several different modern books with this title (e.g. one credited to عبد الله المصلح وصلاح الصاوي, another on [islamhouse.com/ar/books/2842433](https://islamhouse.com/ar/books/2842433/) credited to a committee) | **Owner to identify the author/edition** | Modern → copyrighted unless the publisher grants reuse. islamhouse lead **unverified**. |
| 8 | بهجة المجالس وأنس المجالس — Ibn ʿAbd al-Barr (d. 463) | [`0475AH/…/0463IbnCabdBarr.BahjatMajalis`](https://github.com/OpenITI/0475AH/tree/master/data/0463IbnCabdBarr/0463IbnCabdBarr.BahjatMajalis) → `Shamela0000558-ara1` | [558](https://shamela.ws/book/558) | n/a — the owner's PDF is only the cover | Prose/adab → curated excerpts (§5.3). usul.ai `/t/bahjat-majalis`. |
| 9 | رياض الصالحين — al-Nawawī (d. 676), ط دار المنهاج | [`0700AH/…/0676Nawawi.RiyadSalihin`](https://github.com/OpenITI/0700AH/tree/master/data/0676Nawawi) → `JK000073-ara2`, `ShamAY0038643-ara3`, `Shamela0000512-ara4` (49 KB — likely partial), `Shamela0002348-ara5`, `Shamela0012014-ara1.mARkdown`, `Shia002208-ara2` | [12014](https://shamela.ws/book/12014): ت شعيب الأرنؤوط، مؤسسة الرسالة، ط3 ١٤١٩هـ · [2348](https://shamela.ws/book/2348): ت الفحل | **No** — no Dār al-Minhāj version found; hadith numbering can differ between editions — **owner to choose the edition** and accept its numbering | Al-Nawawī's takhrīj notes («متفق عليه»، «رواه مسلم») are kept in `rawPayload`, not auto-mapped to a grade (§5.6). |

Also checked, for the sin-rank source decision ([V3](#15-owner-decisions)): al-Dhahabī's «الكبائر» exists as
OpenITI `0750AH/…/0748Dhahabi.Kabair` (a candidate only — **owner to verify** and choose).

### 4.3 Licences and terms

| Corpus / item | What was verified | Consequence |
| --- | --- | --- |
| **OpenITI** release `2023.1.8` (Zenodo record [10007820](https://zenodo.org/records/10007820)) | Zenodo metadata licence id **`cc-by-nc-sa-4.0`** (CC BY-NC-SA 4.0). A newer release exists; re-check its licence before use. The GitHub repos (`OpenITI/0475AH` etc.) declare **no licence** in their metadata. | **Attribution** required (OpenITI + version URI); **non-commercial** only — if Thekra ever charges, sells or runs ads, this blocks use; **share-alike** applies to the derived dataset. Owner accepts or rejects ([V8](#15-owner-decisions)). Many OpenITI versions are themselves derived from Shamela, whose underlying editions have their own rights. |
| **al-Maktaba al-Shamela** (shamela.ws) | No terms-of-use page was found (`/about`, `/page/about` → 404). | **Unknown.** Treat Shamela as a way to *identify* an edition, not as a licence. |
| **usul.ai** | No terms page found (`/terms`, `/about` → 404). It republishes OpenITI and Shamela/turath texts. | **Unknown.** Do not import from usul.ai; use it only to locate versions. |
| **Quran.com tafsir resources** | Endpoints verified (§3.2); redistribution terms per resource **not verified**. | Owner verifies per resource before caching ([V13](#15-owner-decisions)). |
| **al-Albānī's grades** (صحيح الترغيب، أحكام الأدب المفرد) | Modern copyrighted works. | **Cite the grade** (e.g. "حسن — الألباني، صحيح الترغيب، رقم N") as a fact with its reference; **do not copy commentary or footnotes**. |
| **Dorar** | §3.1. | Link only; import only with written permission. |

---

## 5. Book import pipeline (Phase 5b)

Design only — no code. It reuses the content-pipeline ideas ([content-pipeline §1](./content-pipeline-plan.md#1-principles-inherited-not-re-decided))
but runs **outside the Nest module tree**, like `prisma/seed.ts`.

### 5.1 Principles

1. **Clean Unicode input only.** Input is a pinned digital text (an OpenITI version file at a recorded git commit
   SHA, plus its SHA-256). PDFs and OCR output are rejected by construction: the importer accepts only the
   expected text format and fails if the Arabic-letter ratio of the parsed records falls below a threshold
   (a guard against mis-encoded text such as the «ما لا يسع المسلم جهله» PDF's text layer).
2. **Import is breadth; curation is quality.** An importer writes `Source`, `Quote` and `SyncLog` only.
3. **Idempotent and re-runnable.** Same input → same rows; re-running changes nothing.
4. **Provenance survives.** Work, edition, corpus version URI, commit SHA, chapter and number travel with each row.
5. **Nothing imported is visible as a reminder** until a human links it; imported narrations are `UNGRADED`
   until a human grades them, so even public browse (#8) hides them by default.

### 5.2 Location, runner, safety

| Concern | Decision |
| --- | --- |
| Location | `backend/prisma/imports/<work>/` (one folder per work), shared pieces in `backend/prisma/imports/lib/`, the Dorar CLI in `backend/prisma/imports/tools/`. Outside `src/modules/*`, so no new Nest module ([backend/.cursorrules](../../backend/.cursorrules) module list unchanged). |
| Files per work | `work.ts` (fixed `Source` UUID + metadata, `apiProvider` namespace, input format), `parse.ts` (**pure**: text → records, no I/O), `parse.spec.ts` (Vitest — picked up by the existing `include: ['**/*.spec.ts']`), `fixtures/` (small **synthetic** samples with placeholder text in the real markup — no real religious text is invented or committed for tests). |
| Runner | `node --env-file=.env --experimental-strip-types prisma/imports/run.ts <work> --file <path> --corpus-commit <sha> [--dry-run] [--limit N]`, exposed as a `backend/package.json` script `import:book` (a config change → owner approval). Same runner style as the seed ([backend/prisma.config.ts](../../backend/prisma.config.ts)). |
| Prisma client | Like `prisma/seed.ts`, scripts under `prisma/` create their own `PrismaClient`. [backend/.cursorrules](../../backend/.cursorrules) forbids `new PrismaClient()` "in a script helper" — the seed is already an exception; the owner adds `prisma/imports/**` to that exception when approving. |
| Gates | `tsc --noEmit -p tsconfig.json` already covers `prisma/**` (no `include` in `tsconfig.json`). `oxlint` runs only on `src/ test/` — add `prisma/imports/` to the `lint` script (owner-approved config change) so importers are linted. |
| Safety | Refuses `NODE_ENV=production` unless `IMPORT_ALLOW_PRODUCTION=true` (mirrors `SEED_ALLOW_PRODUCTION`). `--dry-run` parses and prints counts plus N random records with their page/number, for the owner to compare against the PDF. Input corpus files are **not committed** to the repo (licence: §4.3); the runner reads a local path. |

### 5.3 Mapping each work onto existing models

| Model | Mapping |
| --- | --- |
| `Source` | **One row per work + edition**, fixed UUID in `work.ts`, upserted on `id`. `type = HADITH_COLLECTION` for narration works (الأدب المفرد، شعب الإيمان، الزهد، الترغيب، رياض الصالحين) and `BOOK` for prose works. `name`/`nameAr` include the edition (e.g. «الجامع لشعب الإيمان — ط الرشد ١٤٢٣»), `author`/`authorAr`, `language = 'ar'`, `isExternalApi = false` (so `POST /admin/content-sync/runs` rejects it with `422 SOURCE_NOT_EXTERNAL`), `apiProvider = 'book:<work>'`. |
| `Quote` — narration works | One row per numbered narration: `type = HADITH`, `origin = LOCAL` (see §5.4), `textAr` = the narration **verbatim as in the edition** (isnad included; extracting the matn is a curation act → a forked `LOCAL` quote), `hadithReference` = book + number in that edition (e.g. `"Shuab al-Iman (Rushd) 345"` — exact format follows the existing seed style, [V19](#15-owner-decisions)), `grade` per §5.6, `narrator` left `NULL` (automatic extraction is error-prone; a curator fills it), `apiProvider = 'book:<work>'`, `externalId = '<edition>:<number>'`, `rawPayload` = `{ corpusUri, corpusCommit, volume, page, chapterNumber, chapterTitle, takhrij? }`. |
| `Quote` — prose works (مختصر منهاج القاصدين، الداء والدواء، بهجة المجالس) | **No bulk import.** `BOOK_EXCERPT` rows have no grade, so public browse (#8) would show thousands of unreviewed paragraphs. Instead the curator creates `LOCAL` `BOOK_EXCERPT` quotes through the existing admin form (#28) with `bookTitle` and `pageOrChapter` copied from the digital edition, and the owner verifies against the PDF. |
| `Translation` | None. |
| `SyncLog` | One row per import run, against the work's `Source` (§5.5). |
| `Tag`, `QuoteTag`, link tables | **Never written by an importer.** |

### 5.4 Idempotency keys — consistency check with content-pipeline §2.5

**Finding.** Reusing `@@unique([apiProvider, externalId])` with a namespaced provider (`book:shuab-bayhaqi`) is
mechanically sound, but **"`origin = LOCAL` + non-null keys" contradicts two things as written**:

1. [content-pipeline §2.5](./content-pipeline-plan.md#25-externalid-semantics--the-idempotency-key) says: "For
   `origin = LOCAL` rows, both `apiProvider` and `externalId` stay `NULL`", and "the compound-unique upsert path is
   valid only when both values are non-null, i.e. only in the sync module". The *reason* for that rule — a
   sentinel like `'local'` would cap local quotes at one per `externalId` — does **not** apply here, because every
   imported row carries a real, distinct natural key. Only the wording needs amending.
2. The "provider text is read-only" guard (`FIELD_OWNED_BY_PROVIDER`, `backend/src/modules/quotes/quotes.service.ts`
   around line 573) checks `origin === API_CACHED` only. An imported `LOCAL` row would therefore be editable,
   and the next re-import would silently overwrite a curator's edit of `textAr`.

**Options:**

| | A — `LOCAL` + namespaced keys (**recommended**) | B — `API_CACHED` + namespaced keys |
| --- | --- | --- |
| Doc change | Amend §2.5: "Hand-written `LOCAL` rows keep `NULL` keys; `LOCAL` rows created by a book importer carry `book:`-namespaced keys; the upsert path is valid in `content-sync` and in `prisma/imports`." | None — matches §2.5 as written. |
| Code change | Extend the guard to rows whose `apiProvider` starts with `book:` for the fields **the importer writes** (`textAr`, `hadithReference`, `sourceId`, and `grade` only for graded collections). `narrator` and `grade` of ungraded works stay **editable**, because grading is the curator's job. | None — but `grade` is provider-owned for `API_CACHED`, so a curator **cannot grade** an imported narration without forking it → 11k potential duplicates. |
| Public contract | `QuoteDto.external` stays `null` (it is only set for `API_CACHED`), so clients see an ordinary curated-library quote with full `source` attribution. | `external = { apiProvider: 'book:…' }` — misleading "from an API" provenance. |
| Re-import rule | The importer's upsert `update` clause sets only importer-owned fields; it never touches `grade` (ungraded works) or `narrator`. | Same, but grading is still blocked. |

Recommendation: **A**, as an owner decision ([V9](#15-owner-decisions)). Either way the key is
`apiProvider = 'book:<work>'`, `externalId = '<edition>:<number>'` (e.g. `book:shuab-bayhaqi` / `rushd:345`),
unique per work+edition, and **never** a corpus line number (which changes between corpus releases).

### 5.5 Run bookkeeping — `SyncLog` reused

Each run creates `SyncLog { sourceId: <work Source>, status: RUNNING }`, updates `recordsImported` per batch, and
finishes `SUCCESS`/`FAILED` with the one-line summary convention of
[content-pipeline §3.4](./content-pipeline-plan.md#34-synclog-bookkeeping) in `errorMessage`
(`created=… updated=… skipped=… failed=…; corpus=<versionUri>@<sha>`). Runs therefore appear in the existing
admin sync console (`/admin/sync`), and `Source.lastSyncedAt` is set at the end. No schema change.

### 5.6 Grades

| Work type | Grade on import |
| --- | --- |
| Ungraded works (شعب الإيمان، الأدب المفرد، الزهد، رياض الصالحين، الترغيب للمنذري) | `UNGRADED`. Hidden by the default grade policy ([TECHNICAL_PLAN D9](../TECHNICAL_PLAN.md#d-content-pipeline)) until a curator grades it **with a cited grader and reference** (the Dorar CLI in §3.1 helps). al-Nawawī's takhrīj notes and any edition footnote rulings stay in `rawPayload` — they are not auto-mapped (e.g. «متفق عليه» would map to `SAHIH` in `normalizeGrade`, but that judgment belongs to the curator). |
| A graded collection whose grades are licensed for use | Map each entry's grade string through the existing `normalizeGrade` (`backend/src/modules/content-sync/mappers/grade.mapper.ts`; weakest-wins, unmapped → `UNGRADED` and logged), and put the grader in `hadithReference`/`rawPayload`. |
| صحيح الترغيب والترهيب (al-Albānī) | Default: **do not bulk-import** the modern work. Import al-Mundhirī's classical text (`UNGRADED`), and let the curator record al-Albānī's grade per narration **as a citation** («الألباني، صحيح الترغيب والترهيب، رقم N») while linking. Bulk-importing the modern work requires the publisher's permission ([V14](#15-owner-decisions)). |

`MAWDU` rows may be imported (they are part of the book) but are never served and never linkable — enforced by
the existing policy.

### 5.7 Chapter structure → curation aid (not tags, not links)

The chapter a narration sits in (for شعب الإيمان: the شعبة it is gathered under) is recorded in
`rawPayload.chapterNumber`/`chapterTitle`. It is **not** written as a `Tag` (structural tags would flood the public
`GET /tags` vocabulary and `QuoteDto.tags`, and `QuoteTag` is classification-owned) and **not** written as an
`ImanBranchQuote` link (that is an editorial act, D7). Instead, the admin quote list (`GET /admin/quotes`) gains an
additive admin-only filter `chapter=<n>` (with `sourceId`) that reads `rawPayload` server-side; `rawPayload` is
still never serialised. The branch-linking workspace (§9.4) pre-fills "source = شعب الإيمان, chapter = N" when the
curator opens branch N, so the author's own structure speeds curation without automating it.

### 5.8 The human curation step

For each branch, sin or deed: open the workspace → filter imported narrations (source, chapter, text search) →
read → grade with a citation (Dorar CLI, or the graded work) → optionally fork a matn-only `LOCAL` quote → link
with `relevanceScore` and `note` through the existing link endpoints (#48–#57) or the new branch-link endpoints
(#91–#95) → spot-check against the owner's PDF page. **No step is automatic.**

### 5.9 Volume

شعب الإيمان alone is about 11k narrations (the OpenITI `Shamela0010660` file is ~9 MB). The importer reads the file
as a **stream** (line by line), parses records incrementally, and upserts in batches of ~500 inside one
transaction per batch, updating `SyncLog.recordsImported` after each batch. A crash leaves a `RUNNING` row
(reconciled like content-sync's stale runs) and is fixed by re-running: idempotency makes resume logic
unnecessary. `--limit N` supports a pilot.

### 5.10 Tafsir caching (also Phase 5b)

Built in `content-sync`, not in `prisma/imports`, because Quran.com is an external API: a new
`ExplanationProvider` (sibling of `ContentProvider`, whose `mapToQuote` cannot produce an `Explanation`) and a
`QuranComTafsirProvider` that pages `GET /tafsirs/{id}/by_chapter/{n}`. One `Source` per tafsir resource
(`type = BOOK`, `isExternalApi = true`, `apiProvider = 'quran.com-tafsir'`, `apiBaseUrl =
https://api.quran.com/api/v4/tafsirs/<id>` — the resource id travels in the existing column, no schema change).
Manual trigger through #58; no cron until the owner wants one. Fixture tests only.

---

## 6. Proposed schema additions

> **PROPOSED — Phases 3b/5b. Requires explicit owner approval.** Additive only: no column is dropped, renamed or
> repurposed. Applies on top of the current schema ([backend/prisma/schema.prisma](../../backend/prisma/schema.prisma))
> and is independent of the Phase 4b additions ([silat-rahim §4](./silat-rahim-plan.md#4-data-model--proposed-schema-additions)).
> Ships as four migrations, each its own commit (§6.4).

```prisma
// PROPOSED — Vision v2 (Phase 3b; Explanation is also written by Phase 5b). Additive only.
// Requires owner approval (backend/.cursorrules "Schema Changes Are Exceptional").

enum SinRank {
  KABIRA  // كبيرة
  SAGHIRA // صغيرة
}

enum ExplanationKind {
  TAFSIR       // تفسير — attached by ayahKey, to every QURAN_VERSE quote with that surah:ayah
  SHARH        // شرح حديث (or of another quote) — attached by quoteId
  BRANCH_SHARH // شرح شعبة — attached by imanBranchId
}

/// One شعبة of faith, in the order of the chosen edition of al-Bayhaqi's work (owner-verified).
model ImanBranch {
  id              String               @id @default(uuid())
  number          Int                  @unique /// position in the chosen edition — owner/scholar to verify
  titleAr         String
  title           String?
  summaryAr       String?              /// short practical meaning, owner/scholar-authored; quoted شرح goes to Explanation
  summary         String?
  sourceId        String?              /// the edition the numbering comes from
  source          Source?              @relation("ImanBranchSource", fields: [sourceId], references: [id])
  sourceReference String?              /// e.g. volume/page of the chapter in that edition
  quotes          ImanBranchQuote[]
  goodDeeds       ImanBranchGoodDeed[]
  sins            ImanBranchSin[]
  explanations    Explanation[]
  externalRefs    ExternalReference[]
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
}

/// Curator link: a quote that teaches/urges this branch. Same semantics and shape as SinQuote/GoodDeedQuote.
model ImanBranchQuote {
  id             String     @id @default(uuid())
  imanBranchId   String
  imanBranch     ImanBranch @relation(fields: [imanBranchId], references: [id], onDelete: Cascade)
  quoteId        String
  quote          Quote      @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  relevanceScore Int?       @default(0)
  note           String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@unique([imanBranchId, quoteId])
  @@index([quoteId])
  @@index([imanBranchId, relevanceScore(sort: Desc, nulls: Last)])
}

/// The practical side: deeds that live out this branch.
model ImanBranchGoodDeed {
  id           String     @id @default(uuid())
  imanBranchId String
  imanBranch   ImanBranch @relation(fields: [imanBranchId], references: [id], onDelete: Cascade)
  goodDeedId   String
  goodDeed     GoodDeed   @relation(fields: [goodDeedId], references: [id], onDelete: Cascade)
  sortOrder    Int        @default(0)
  note         String?
  createdAt    DateTime   @default(now())

  @@unique([imanBranchId, goodDeedId])
  @@index([goodDeedId])
}

/// The practical side: sins that break or weaken this branch.
model ImanBranchSin {
  id           String     @id @default(uuid())
  imanBranchId String
  imanBranch   ImanBranch @relation(fields: [imanBranchId], references: [id], onDelete: Cascade)
  sinId        String
  sin          Sin        @relation(fields: [sinId], references: [id], onDelete: Cascade)
  sortOrder    Int        @default(0)
  note         String?
  createdAt    DateTime   @default(now())

  @@unique([imanBranchId, sinId])
  @@index([sinId])
}

/// تفسير / شرح text with mandatory attribution. Exactly one target: quoteId | ayahKey | imanBranchId (SQL CHECK, §6.3).
model Explanation {
  id           String          @id @default(uuid())
  kind         ExplanationKind
  quoteId      String?
  quote        Quote?          @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  ayahKey      String?         /// "49:12" — TAFSIR only
  imanBranchId String?
  imanBranch   ImanBranch?     @relation(fields: [imanBranchId], references: [id], onDelete: Cascade)
  languageCode String          @default("ar")
  text         String
  sourceId     String          /// the commentary work + edition (or the tafsir resource)
  source       Source          @relation("ExplanationSource", fields: [sourceId], references: [id])
  reference    String?         /// volume/page/chapter in that source
  origin       QuoteOrigin     @default(LOCAL)
  apiProvider  String?         /// e.g. 'quran.com-tafsir' — API_CACHED rows only
  externalId   String?         /// e.g. '16:49:12' (resourceId:verse_key)
  rawPayload   Json?           /// never serialised
  sortOrder    Int             @default(0)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([apiProvider, externalId])
  @@index([quoteId])
  @@index([ayahKey, languageCode])
  @@index([imanBranchId])
}

/// Outbound "read more" link (e.g. Dorar «موسوعة الأخلاق والسلوك»). Exactly one target (SQL CHECK, §6.3).
model ExternalReference {
  id           String      @id @default(uuid())
  provider     String      /// e.g. 'dorar.alakhlaq' — must be on the configured allow-list
  url          String      /// https only; host on the allow-list (dorar.net)
  labelAr      String?
  label        String?
  sinId        String?
  sin          Sin?        @relation(fields: [sinId], references: [id], onDelete: Cascade)
  goodDeedId   String?
  goodDeed     GoodDeed?   @relation(fields: [goodDeedId], references: [id], onDelete: Cascade)
  imanBranchId String?
  imanBranch   ImanBranch? @relation(fields: [imanBranchId], references: [id], onDelete: Cascade)
  sortOrder    Int         @default(0)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([sinId])
  @@index([goodDeedId])
  @@index([imanBranchId])
}

// Changes to EXISTING models (additive):
model Sin {
  // …existing fields — `severity Int?` stays (§6.2)…
  rank          SinRank?            /// null = not yet classified by the owner
  rankSourceId  String?             /// the book/scholar the classification follows
  rankSource    Source?             @relation("SinRankSource", fields: [rankSourceId], references: [id])
  rankReference String?             /// volume/page/number in that source
  imanBranches  ImanBranchSin[]     // relation field only
  externalRefs  ExternalReference[] // relation field only

  @@index([rank])
}

model GoodDeed {
  // …existing fields (+ Phase 4b's deedReminders when approved)…
  imanBranches ImanBranchGoodDeed[] // relation field only
  externalRefs ExternalReference[]  // relation field only
}

model Quote {
  // …existing fields…
  imanBranchLinks ImanBranchQuote[] // relation field only
  explanations    Explanation[]     // relation field only
}

model Source {
  // …existing fields…
  explanations Explanation[] @relation("ExplanationSource") // relation field only
  imanBranches ImanBranch[]  @relation("ImanBranchSource")  // relation field only
  rankedSins   Sin[]         @relation("SinRankSource")     // relation field only
}
```

### 6.1 Why each field exists

| Model.field | Why | Why not more |
| --- | --- | --- |
| `Sin.rank` (`SinRank?`) | The owner's path 1 shows كبيرة/صغيرة. Nullable: a sin stays unranked until the owner verifies it, and the UI shows nothing rather than a guess. | Only two values — finer scholarly gradations are content, not schema. |
| `Sin.rankSourceId` + `rankReference` | A rank is a scholarly claim; like a grade, it must cite who said it (e.g. a book on الكبائر — [V3](#15-owner-decisions)). Reuses `Source` for attribution. | No per-scholar disagreement table; if sources differ, the owner picks one and the note says so. |
| `ImanBranch.number` (`@unique`) | Order and identity of a شعبة in the chosen edition; used in URLs (`/branches/12`). | No `slug`: the number is the natural key once the edition is fixed ([V20](#15-owner-decisions) if the owner prefers slugs). |
| `ImanBranch.titleAr`/`title` | Display. Arabic required. | — |
| `ImanBranch.summaryAr`/`summary` | One or two owner/scholar-written lines ("what this means in daily life"). | Quoted commentary does **not** go here — it goes to `Explanation` with attribution. |
| `ImanBranch.sourceId` + `sourceReference` | Where the numbering and the chapter come from. | — |
| `ImanBranchQuote` | The texts of each شعبة, ranked exactly like `SinQuote`/`GoodDeedQuote` so the same query path, grade policy and admin linking code serve it (ARCHITECTURE §1 keeps separate join tables per intent). | — |
| `ImanBranchGoodDeed` / `ImanBranchSin` | The "practical picture": which concrete deeds express the branch and which sins break it — links into paths 1 and 2. `sortOrder` gives the curator control without a score. | No `relevanceScore` (these are small curated lists). |
| `Explanation.kind` + exactly one target | One table for تفسير/شرح/شرح شعبة — same attribution, rendering and admin flow. `ayahKey` (not `quoteId`) for tafsir, because the same ayah exists as several `Quote` rows (seed `LOCAL`, `quran.com`, `alquran.cloud` — [TECHNICAL_PLAN D5](../TECHNICAL_PLAN.md#d-content-pipeline)); keying by `"49:12"` serves all of them. | No polymorphic `targetType/targetId` string pair — real FKs keep cascade and integrity. |
| `Explanation.sourceId` (required) + `reference` | No explanation without attribution — the same rule as "no quote without a `Source`". | — |
| `Explanation.languageCode` + `text` | Arabic first; an English tafsir resource (e.g. Quran.com `169`) can be added without schema change. | No translation table for explanations; a translated explanation is its own row with its own source. |
| `Explanation.origin`/`apiProvider`/`externalId`/`rawPayload` | Cached tafsir is idempotent on the same compound key pattern as `Quote`. `LOCAL` rows keep both keys `NULL`. | — |
| `Explanation.sortOrder` | Order several explanations of one target (e.g. الميسر before القرطبي). | — |
| `ExternalReference` (generic) | Dorar links for three entity types, with room for a second provider later without a new column per provider; allow-list validation in one place. | Alternative: a nullable `dorarUrl` column on `Sin`/`GoodDeed`/`ImanBranch` — simpler, but three columns now and more later ([V6](#15-owner-decisions)). |

### 6.2 `Sin.rank` vs the existing `Sin.severity`

`severity Int?` (1–10) is **kept**. It is part of the shipped contract and code: `SinDto.severity`, the
`severityMin`/`severityMax` filters and `sort=severity` on #1 (`backend/src/modules/sins/dto/sins-query.dto.ts`),
the admin form (`frontend/src/features/curation/components/SinCrudView.tsx`), the public header
(`frontend/src/features/sin-reminder/components/SinHeader.tsx` renders "severity/10"), the mobile types, the seed
and e2e tests. Removing or repurposing it would break `/v1` ([roadmap cross-cutting](./roadmap.md#cross-cutting-every-phase)).

Meaning from now on: **`rank` is the scholarly classification shown to users; `severity` is an internal
editorial weight** (ordering only). Recommendation ([V4](#15-owner-decisions)): once ranks exist, the public
`SinHeader` shows the rank badge and stops showing "الخطورة x/10", while the API field stays. Never derive one
from the other.

### 6.3 Constraints Prisma cannot express (raw SQL in the same migration)

Precedent: `20261005000001_add_arabic_normalize_fn` and `20261005180000_add_arabic_trgm_gin_index` already carry
raw SQL. Column names are camelCase (the schema uses no `@map`).

```sql
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_one_target"
  CHECK (num_nonnulls("quoteId", "ayahKey", "imanBranchId") = 1);
ALTER TABLE "Explanation" ADD CONSTRAINT "Explanation_kind_matches_target"
  CHECK ((("kind" = 'TAFSIR') = ("ayahKey" IS NOT NULL))
     AND (("kind" = 'BRANCH_SHARH') = ("imanBranchId" IS NOT NULL)));
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_one_target"
  CHECK (num_nonnulls("sinId", "goodDeedId", "imanBranchId") = 1);
ALTER TABLE "Sin" ADD CONSTRAINT "Sin_rank_source_needs_rank"
  CHECK ("rankSourceId" IS NULL OR "rank" IS NOT NULL);
```

The DTOs enforce the same rules first (`400`), so the CHECK is a backstop. The CI drift check
(`prisma migrate diff --exit-code`) ignores CHECK constraints, as it does for the existing raw-SQL migrations.

### 6.4 Migrations (each its own commit, after approval)

| Order | Name | Contents |
| --- | --- | --- |
| 1 | `add_sin_rank` | `SinRank`, `Sin.rank`/`rankSourceId`/`rankReference`, index, the `Sin` CHECK |
| 2 | `add_iman_branches` | `ImanBranch`, `ImanBranchQuote`, `ImanBranchGoodDeed`, `ImanBranchSin` |
| 3 | `add_explanations` | `ExplanationKind`, `Explanation`, its CHECKs |
| 4 | `add_external_references` | `ExternalReference`, its CHECK |

---

## 7. REST API

All paths relative to `/v1`, the standard envelope and error shape, offset pagination
([backend-plan §2](./backend-plan.md#2-global-api-conventions)). Numbers continue the index after Phase 4b's #62–#83.

### 7.0 Endpoint index (proposed)

| # | Method | Path | Auth | Module |
| --- | --- | --- | --- | --- |
| 84 | GET | `/branches` | public | `iman-branches` |
| 85 | GET | `/branches/:number` | public | `iman-branches` |
| 86 | **GET** | **`/branches/:number/quotes`** | optional | `iman-branches` |
| 87 | GET | `/quotes/:id/explanations` | public | `quotes` |
| 88–90 | POST/PATCH/DELETE | `/admin/branches[/:id]` | admin | `iman-branches` |
| 91–95 | POST · GET · PATCH · DELETE · POST bulk | `/admin/branch-quotes[/:id]`, `/admin/branch-quotes/bulk` | admin | `classification` |
| 96 | PUT | `/admin/branches/:id/practices` | admin | `iman-branches` |
| 97 | GET | `/admin/explanations` | admin | `quotes` |
| 98–100 | POST/PATCH/DELETE | `/admin/explanations[/:id]` | admin | `quotes` |
| 101–103 | POST/PATCH/DELETE | `/admin/external-refs[/:id]` | admin | `sources` |

**Additive changes to existing endpoints** (no field removed or repurposed):

| Endpoint | Change |
| --- | --- |
| #1 `GET /sins` | New query `rank?` (`KABIRA\|SAGHIRA`); `SinDto` gains `rank` (nullable). |
| #2 `GET /sins/:slug` | Gains `rank`, `rankSource: { id, name, nameAr } \| null`, `rankReference`, `externalRefs: ExternalRefDto[]`, `relatedBranches: [{ number, titleAr, title }]`. |
| #3 `GET /sins/:slug/quotes` | `data.sin` gains `rank`. |
| #6 `GET /good-deeds/:slug` | Gains `externalRefs`, `relatedBranches`. |
| #8 admin variant `GET /admin/quotes` | New admin-only filter `chapter` (with `sourceId`), reading `rawPayload` server-side (§5.7). |
| #36–#38 admin sins | `CreateSinDto`/`UpdateSinDto` gain `rank?`, `rankSourceId?`, `rankReference?` (class rule: `rankSourceId` requires `rank`). |
| #58 `POST /admin/content-sync/runs` | Accepts a tafsir `Source` (Phase 5b). |
| #72 `POST /kinship/deed-reminders` (Phase 4b) | `422 DEED_NOT_ELIGIBLE` removed — any `GoodDeed` ([§10](#10-reminders-for-any-good-deed--phase-4b-amendment)). |

### 7.1 Shapes

```jsonc
// ImanBranchDto (#84 items)
{ "id": "…", "number": 12, "titleAr": "…", "title": "…", "summaryAr": "…", "summary": null,
  "quoteCount": 7,                               // renderable links under the default grade policy
  "source": { "id": "…", "name": "…", "nameAr": "…" }, "sourceReference": "…" }

// #85 → { data: ImanBranchDetailDto }
{ "…ImanBranchDto fields…",
  "explanations": [ ExplanationDto ],            // kind = BRANCH_SHARH, Arabic first
  "goodDeeds": [ { "slug": "sadaqah", "name": "…", "nameAr": "الصدقة" } ],
  "sins":      [ { "slug": "…", "name": "…", "nameAr": "…", "rank": "KABIRA" } ],
  "externalRefs": [ ExternalRefDto ],
  "prev": { "number": 11, "titleAr": "…" }, "next": { "number": 13, "titleAr": "…" } }

// #86 — structurally identical to #3/#7 so the frontend reuses one renderer
{ "data": { "branch": { "number": 12, "titleAr": "…", "title": "…", "summaryAr": "…" },
            "items": [ { "link": { "id": "…", "relevanceScore": 90, "note": "…" }, "quote": { /* QuoteDto */ } } ] },
  "meta": { "page": 1, "limit": 10, "total": 7, "totalPages": 1, "hasNext": false, "locale": "ar",
            "ordering": "relevanceScore:desc,grade:asc,createdAt:desc",
            "countsByType": { "QURAN_VERSE": 3, "HADITH": 4, "SCHOLAR_QUOTE": 0, "BOOK_EXCERPT": 0 },
            "appliedGrades": ["SAHIH", "HASAN"] } }

// ExplanationDto (#87 items, embedded in #85)
{ "id": "…", "kind": "TAFSIR", "languageCode": "ar", "text": "…",
  "source": { "id": "…", "name": "…", "nameAr": "التفسير الميسر", "type": "BOOK", "author": null, "authorAr": null },
  "reference": null, "origin": "API_CACHED" }      // rawPayload / apiProvider / externalId never serialised

// ExternalRefDto
{ "id": "…", "provider": "dorar.alakhlaq", "url": "https://dorar.net/alakhlaq/…", "labelAr": "…", "label": "…" }
```

### 7.2 Endpoint rules

| # | Rules |
| --- | --- |
| 84 | Query `page`, `limit`, `lang`, `q?` (Arabic-normalised search over `titleAr`/`title`, reusing the existing normaliser), `sort?` = `number\|quoteCount` (default `number`). `200`, `400`. |
| 85 | `:number` via `ParseIntPipe` (1 ≤ n). `404 RESOURCE_NOT_FOUND` when unknown. `explanations` sorted by `sortOrder`, Arabic rows always included, `lang` rows added. `200`, `400`, `404`. |
| 86 | `BranchQuotesQueryDto extends SinQuotesQueryDto` (same `limit` 1–50, `type`, `grades`, `includeWeak`, `minScore`, `shuffle`, `seed`). **Grade policy exactly as #3**: `OR: [{ type: { not: HADITH } }, { grade: { in: allowed } }]`, `MAWDU` never, `grades=MAWDU` → `422 GRADE_NOT_PERMITTED`. Same ordering and `id` tie-break, same shuffle (variety) implementation, `isFavorite` with a token (`OptionalJwtAuthGuard`). `200`, `400`, `404`, `422`. |
| 87 | Resolves the quote and applies the **same rule as #9** (D-4 in the phase-2 follow-up: `MAWDU` → `404`; `DAIF`/`UNGRADED` served with their grade). For `QURAN_VERSE` returns `TAFSIR` rows by `"<surahNumber>:<ayahNumber>"` plus any `SHARH` rows by `quoteId`; for other types returns `SHARH` rows. Arabic always, plus `lang`. `{ data: ExplanationDto[] }`. `200`, `404`. |
| 88–90 | `CreateImanBranchDto`: `number` (int ≥ 1, unique → `409`), `titleAr` (required, `@MaxLength`), `title?`, `summaryAr?`, `summary?`, `sourceId?` (unknown → `422`), `sourceReference?`. `201` + `Location`, `200`, `204`. Delete cascades links and explanations. |
| 91–95 | Mirror #48–#52 through the shared generic link implementation in `ClassificationService` (upsert on `imanBranchId_quoteId`, never bare `create`; bulk in one transaction; `relevanceScore` 0–100; `MAWDU` quote → `422 GRADE_NOT_PERMITTED`). |
| 96 | Body `{ goodDeeds: [{ goodDeedId, sortOrder?, note? }], sins: [{ sinId, sortOrder?, note? }] }` — **replaces** both sets in one transaction (same pattern as `PUT /admin/quotes/:id/tags`, #35). Unknown id → `422`. `200 { data: ImanBranchDetailDto }`. |
| 97–100 | Filter by `quoteId` / `ayahKey` / `imanBranchId` / `kind` / `sourceId`. Create validates exactly one target matching `kind` (`400`), `ayahKey` format `^\d{1,3}:\d{1,3}$`, `sourceId` exists (`422`), `text` required. **`API_CACHED` rows are read-only** for `text`/`sourceId`/target (`422 FIELD_OWNED_BY_PROVIDER`), as for quotes. |
| 101–103 | `url` must be `https:` and its host on `EXTERNAL_REF_ALLOWED_HOSTS` (default `dorar.net`) → otherwise `422 EXTERNAL_HOST_NOT_ALLOWED`; exactly one target (`400`). |

---

## 8. Backend module placement

| Piece | Module | Status |
| --- | --- | --- |
| `ImanBranch`, `ImanBranchGoodDeed`, `ImanBranchSin`; endpoints #84–#86, #88–#90, #96 | **`modules/iman-branches/`** — **NEW, proposed, owner approval + `.cursorrules` module-list update required** | Owns (writes) `ImanBranch`, `ImanBranchGoodDeed`, `ImanBranchSin`. Reads `ImanBranchQuote`, `Quote` (only through `QuotesService.toQuoteDto`/`buildQuoteInclude`/`linkOrderBy`), `GoodDeed`, `Sin`, `Explanation`, `ExternalReference`. Depends on `quotes`, `hadith` (`GradePolicy`), `sources`. Exports `ImanBranchesService` (`findAll`, `findByNumber`, `findQuotesForBranch`, `findRelatedForSin`, `findRelatedForGoodDeed`). Controllers `ImanBranchesController`, `ImanBranchesAdminController`. Registered after `TagsModule`/`SourcesModule`, before `ClassificationModule`. |
| `ImanBranchQuote` writes (#91–#95) | `classification` | Third side of the existing generic link path; `classification → iman-branches` (validate existence), like `classification → sins`. |
| `relatedBranches` on #2/#6 | `sins`, `good-deeds` | `sins → iman-branches`, `good-deeds → iman-branches`; `iman-branches` imports neither (it reads `Sin`/`GoodDeed` rows through Prisma includes). No `forwardRef`. |
| `Sin.rank*` (#1–#3, #36–#38) | `sins` | — |
| `Explanation` (#87, #97–#100) | **`quotes`** (no new module) — it owns `Quote` and `Translation`, and an explanation is attached text like a translation. A second controller file `explanations.admin.controller.ts` inside `quotes` (small extension of the per-module file convention — flag it). | Alternative: a new `explanations` module ([V11](#15-owner-decisions)). |
| `ExternalReference` (#101–#103 + embedding) | **`sources`** (provenance) — `external-refs.admin.controller.ts`; `SourcesService.findExternalRefs(target)` used by `sins`, `good-deeds`, `iman-branches`. | — |
| Tafsir caching | `content-sync` — `ExplanationProvider` interface, `QuranComTafsirProvider`, executor branch writing `Explanation` (`API_CACHED`) | **Needs a `.cursorrules` change:** product-safety rule 4 lists exactly what `content-sync` may write (`Quote`, `Translation`, `SyncLog`, `Source.lastSyncedAt`); add `Explanation (origin = API_CACHED)`. |
| Book importers, Dorar CLI | `backend/prisma/imports/**` (not a module) | §5.2 — `.cursorrules` exception for `PrismaClient` in `prisma/imports/**`. |
| `DeedReminder` for any deed | `kinship` (Phase 4b, proposed) | Module name unchanged; only the eligibility check is dropped (§10). |

---

## 9. Frontend

### 9.1 Routes

| Route | Owning slice | Auth | Renders | API |
| --- | --- | --- | --- | --- |
| `/` *(change)* | `components/shared` + slices | guest | A **third entry card** «شعب الإيمان» (final label [V1](#15-owner-decisions)) beside the two pickers, linking to `/branches`. Grid becomes 1 column on mobile, 3 on `md+` (logical utilities). | — |
| `/branches` *(new)* | `iman-branches` | guest | Numbered list of شعب with search; each row shows number, `titleAr`, short `summaryAr`, quote count. Server-rendered list (stable, SEO). | #84 |
| `/branches/[number]` *(new)* | `iman-branches` | guest | Header (number, title, `summaryAr`), **"الشرح" accordion** (branch explanations, collapsed by default, source attribution under each), ranked texts (shared `QuoteCard`, type chips from `countsByType`, "another reminder" shuffle), **practical side**: "أعمال تحقق هذه الشعبة" → `/good-deeds/[slug]`, "معاصٍ تنقضها" → `/sins/[slug]` with rank badges, prev/next شعبة, "اقرأ المزيد في الدرر السنية" links. `generateMetadata` from `titleAr`. | #85, #86 |
| `/sins`, `/sins/[slug]` *(change)* | `sin-reminder` | guest | **Rank badge** (كبيرة/صغيرة, only when set) in `SinList` rows and `SinHeader`; optional rank filter chip on `/sins`; "read more" links; "related branches" chips. | #1, #2 |
| `/good-deeds/[slug]` *(change)* | `good-deed-motivation` (+ `kinship` for the reminder toggle) | guest (toggle: user) | "read more" links, related branches; Phase 4b's **«ذكّرني بهذا العمل»** toggle for any deed (§10). | #6, #72 |
| `/quotes/[id]` *(change)* | `quran-hadith-browser` | guest | **"التفسير / الشرح" accordion** under the quote, collapsed by default; fetched on first expand. | #87 |
| `/admin/branches`, `/admin/explanations` *(new)*, `/admin/sins`, `/admin/linking` *(change)* | `curation` | admin | Branch CRUD + practices editor; explanation editor (target picker, kind, source, reference); external-refs editor on sin/deed/branch forms; sin form gains rank + rank source; linking workspace gains "branch" as a target type and the source/chapter pre-filter (§5.7). | #88–#103, #36–#38 |

### 9.2 Slices and components

| Where | What |
| --- | --- |
| `features/iman-branches/` — **NEW slice, proposed, owner approval + `frontend/.cursorrules` slice-list update** | `hooks/` `useBranches`, `useBranch`, `useBranchQuotes` · `components/` `BranchList`, `BranchHeader`, `BranchPractices`, `BranchExplanations` (uses the shared accordion), `BranchNav`, `BranchEntryCard` (home card). |
| `components/shared/quote/ExplanationAccordion` *(new, presentational)* | Takes `ExplanationDto[]` + loading/error flags; renders shadcn `accordion` (already installed: `frontend/src/components/ui/accordion.tsx`), Arabic text via `ArabicText`, attribution line (`source.nameAr`, `reference`). No data fetching — shared components stay presentational ([design-system.mdc §5.2](../../frontend/.cursor/rules/design-system.mdc)). |
| `components/shared/ExternalReferenceLinks` *(new, presentational)* | Outbound links with `rel="noopener noreferrer"`, provider name visible, `lucide-react` external-link icon `aria-hidden`, text label always present. |
| `components/shared/SinRankBadge` *(new, presentational)* | `Badge` variant per rank via semantic tokens only (no literal colours; a `--rank-*` token pair would be a Phase 8 token addition — until then `secondary`/`outline` variants). Never colour-only: the word كبيرة/صغيرة is the label. |
| `quran-hadith-browser` | `useQuoteExplanations(id)` (enabled on first expand) feeding `ExplanationAccordion` in `QuoteDetail`. |
| `sin-reminder`, `good-deed-motivation` | Render `SinRankBadge`, `ExternalReferenceLinks`, related-branch chips. |
| `curation` | `BranchCrudView`, `BranchPracticesEditor`, `ExplanationEditor`, `ExternalRefsEditor`; `LinkingWorkspace` extended with the branch target. |
| `src/lib` | `types/api.ts` (`ImanBranchDto`, `ImanBranchDetailDto`, `ExplanationDto`, `ExternalRefDto`, `SinRank`; `SinDto.rank`…), `types/enums.ts`, `api/branches.ts`, `api/explanations.ts`, admin API files, `query-keys.ts`. **Mirror the contract in `mobile/src/lib/types/api.ts`.** |
| i18n | New keys in both `messages/ar.json` and `en.json` (`home.branchEntryLabel`, `branches.*`, `explanations.*`, `sinRank.KABIRA`/`SAGHIRA`, `externalRefs.readMoreDorar`); `pnpm check:i18n` must pass. |

### 9.3 UX, accessibility, performance

- Moment-of-need screens (`/sins/[slug]`, `/good-deeds/[slug]`) stay short: explanations appear on the quote
  detail and the branch page, never inline in the reminder list.
- Accordions are collapsed by default and fetch on expand (long tafsir texts must not hurt LCP/INP —
  [design-system.mdc §4](../../frontend/.cursor/rules/design-system.mdc)); headings and `aria-expanded` from the
  shadcn primitive; RTL via logical properties; `<bdi>` around references and numbers.
- Every new region has loading, empty and error states; every route is checked in `ar` (RTL) and `en` (LTR).
- Mobile (Expo, already built): a branches screen and the home card mirror the web in a follow-up step
  ([V17](#15-owner-decisions)); the API contract is the same.

---

## 10. Reminders for any good deed — Phase 4b amendment

**Owner direction:** periodic reminders are for صلة الرحم per named relative **and** for الصدقة and other acts of
worship the owner will add. Therefore:

| Item | Before ([silat-rahim-plan](./silat-rahim-plan.md)) | After (this plan) |
| --- | --- | --- |
| Open decision **S3** | Default: forgotten deeds only, `422 DEED_NOT_ELIGIBLE` | **Resolved: any `GoodDeed`** can be put on a reminder (subject to owner confirmation, [V12](#15-owner-decisions)). |
| #72 `POST /kinship/deed-reminders` | Eligibility = membership of the `forgotten-deeds` tag | Any existing deed slug; codes `201`, `400`, `401`, `404`, `409 DEED_REMINDER_EXISTS`, `422 DEED_REMINDER_LIMIT_REACHED`. |
| Schema | `DeedReminder` (`@@unique([userId, goodDeedId])`) | **Unchanged** — it already references any `GoodDeed`. |
| UI | "Add to my reminders" on a forgotten deed's page | «ذكّرني بهذا العمل» on **every** `/good-deeds/[slug]` for signed-in users (guests see the `SignInPrompt` on click; reading never requires an account). The route composes `features/kinship` (allowed: `app → features`). |
| Forgotten deeds | Spotlight + filter via the `forgotten-deeds` tag | Unchanged — still the guest "deed of the week" and catalogue filter; no longer a gate for reminders. |
| New acts of worship (الصدقة exists in the seed as slug `sadaqah`) | — | Added by the owner as `GoodDeed` rows through admin #39 with owner-verified quotes; no schema or code change. |
| Privacy | Kinship data rules ([TECHNICAL_PLAN §I.11](../TECHNICAL_PLAN.md#i-standing-assumptions)) | Deed reminders describe a user's worship habits: same handling — never logged, in export/delete, calendar titles per [silat-rahim §7.4](./silat-rahim-plan.md#74-titles-generic-by-default-names-on-opt-in). **Sins can never be put on a reminder** (privacy of intent, §I.7). |

The silat-rahim plan is amended in place with a pointer to this section.

---

## 11. Phase placement

Existing phases are **not renumbered**; new phases are lettered like "4b".

| Phase | Name | Depends on | Why here |
| --- | --- | --- | --- |
| **3b** | Three paths & شعب الإيمان (+ sin rank, explanations, Dorar links) | 2, 3 (shipped); uses the Phase 6 admin UI (shipped) for curation | It extends the guest-first core loop with a third intent and needs no account — so it belongs logically after Phase 3. Repo fact: phases 4–8 are already built (except 4b), so 3b is **built now**, on top of shipped code. |
| **4b** *(amended)* | Silat ar-Rahim & reminders for any good deed | 4 | Unchanged placement; S3 resolved (§10). Independent of 3b/5b. |
| **5b** | Book corpus import & tafsir caching | 5 (executor, `SyncLog`, `normalizeGrade`, providers); 3b's schema (branch linking of imported شعب الإيمان narrations; `Explanation` for tafsir) | It is content ingestion — the sibling of Phase 5. Starts with a small pilot work, then شعب الإيمان. |

Recommended execution order once approvals exist: **3b → 5b pilot → 5b شعب الإيمان + tafsir**, with 4b in
parallel whenever the owner approves it. 3b's curation can start with the existing seed and hand-entered quotes;
5b makes it scale.

---

## 12. Testing

Style of [backend-plan §11](./backend-plan.md#11-testing-strategy-vitest-already-configured): Vitest unit specs
beside services, one e2e spec per controller against a real Postgres (`backend/.env.test`), fixtures only — **no
test touches Quran.com, Dorar or a corpus download.** Copy the cases below into `it(...)` names.

### 12.1 Unit (must-have)

| Module / file | Cases |
| --- | --- |
| `iman-branches` service | `findQuotesForBranch`: a Quran verse survives `grades=SAHIH`; `MAWDU` never returned; `UNGRADED` hidden by default and shown with `grades=UNGRADED`; ordering = score desc nulls last → grade → createdAt → id; shuffle reproducible with the same seed; `quoteCount` counts only renderable links; unknown number → `404`. |
| `classification` (branch side) | upsert on `imanBranchId_quoteId` (re-post updates score, no `P2002`); bulk is one transaction; `MAWDU` quote → `422`. |
| `iman-branches` practices | `PUT` replaces both sets atomically; unknown id → `422`. |
| `quotes` explanations | #87 on a `MAWDU` quote → `404`; verse returns tafsir by `ayahKey` for both a `LOCAL` and an `API_CACHED` row of the same ayah; Arabic always included; `rawPayload` absent; `API_CACHED` explanation edit → `422 FIELD_OWNED_BY_PROVIDER`; create with two targets → `400`. |
| `sources` external refs | non-https or non-allow-listed host → `422 EXTERNAL_HOST_NOT_ALLOWED`; exactly one target. |
| `sins` | `rank` filter; `rankSourceId` without `rank` → `400`; `severity` behaviour unchanged (existing tests stay green). |
| `content-sync` tafsir | mapper is pure (fixture → `Explanation` input); idempotent upsert on `('quran.com-tafsir', '<id>:<verse_key>')`; HTML stripped; a malformed record is `failed` without aborting; **never writes a link table**. |
| `prisma/imports/<work>/parse.spec.ts` | synthetic fixture → expected records (number, chapter, page); duplicate numbers rejected; Arabic-ratio guard rejects mis-encoded input; key format `'<edition>:<number>'`. |
| importer upsert (helper spec) | second run → zero creates; `update` never touches `grade` (ungraded works) or `narrator`; never writes `SinQuote`/`GoodDeedQuote`/`ImanBranchQuote`/`QuoteTag`. |
| `quotes` guard (if V9 = A) | edit of `textAr` on a `book:` row → `422`; edit of `grade`/`narrator` on an ungraded-work row → `200`. |

### 12.2 E2E

| Spec | Asserts |
| --- | --- |
| `test/iman-branches.e2e-spec.ts` | #84 envelope + pagination; #85 `404`/`400`; #86 envelope identical in shape to #3, `grades=MAWDU` → `422`, verse survives `grades=SAHIH`, `rawPayload` absent; admin #88–#90 and #96 require `ADMIN` (`401` no token, `403` USER). |
| `test/admin-classification.e2e-spec.ts` *(extend)* | #91–#95 like #48–#52. |
| `test/explanations.e2e-spec.ts` | #87 and #97–#100 incl. CHECK backstop (direct invalid insert fails). |
| `test/external-refs.e2e-spec.ts` | #101–#103 allow-list; embedding in #2/#6/#85. |
| `test/sins.e2e-spec.ts` *(extend)* | `rank` in DTOs and filter; existing severity tests unchanged. |
| `test/raw-payload.e2e-spec.ts` *(extend)* | add #84–#87 to the public sweep. |
| Frontend | Vitest for hooks/components that have logic (accordion lazy fetch, rank badge label); Playwright flows only once A-3 tooling is approved (see [§14](#14-whole-project-gap-audit) G6): home → branches → branch → linked deed; quote detail → expand tafsir; `ar`/`en`. |

---

## 13. Done when

**Phase 3b** — with owner-approved migrations applied and the owner's own verified content entered:
the home page shows three entry points in `ar` and `en`; `/branches` lists the owner-entered شعب in edition order;
`/branches/[n]` shows its summary, a collapsed «الشرح» accordion with attributed text, ranked texts under the same
grade policy as sins (a `MAWDU` row never appears; `DAIF`/`UNGRADED` only on opt-in), its linked deeds and sins,
and a Dorar "read more" link; a ranked sin shows كبيرة/صغيرة on `/sins` and `/sins/[slug]` while unranked sins show
nothing; a quote detail shows its تفسير/شرح on expand; an admin can create a branch, link quotes with a score,
set practices, add an explanation and a Dorar link — all in the browser; every new endpoint has unit + e2e tests;
backend `lint`/`tsc`/`test`/`test:e2e`/`prisma validate`, frontend `lint`/`tsc`/`build`/`test` and
`pnpm check:i18n` are green; `rawPayload` appears in no response.

**Phase 5b** — a pilot work and then شعب الإيمان import from a pinned clean digital version: a dry run prints
counts and samples the owner checks against the PDF; a real run yields one `SUCCESS` `SyncLog` with the summary;
**a second run creates zero rows**; imported narrations are `UNGRADED` and invisible on public endpoints by
default; no link or tag row was written by the importer; the admin can filter by source + chapter, grade with a
citation and link; a tafsir run caches the chosen resource idempotently and `/quotes/[id]` shows it; no test hit
the network.

**Phase 4b (amended)** — as [silat-rahim §13](./silat-rahim-plan.md#13-done-when), plus: a signed-in user puts
«الصدقة» on a weekly reminder from `/good-deeds/sadaqah` and it appears in the due list and the feed.

---

## 14. Whole-project gap audit

State column: **VERIFIED** = checked in the repo during this task (file, commit or command named);
**FROM-DOCS** = only stated in project documents. Owner column: who must act.

| # | Item | Source (doc/section) | Current state (evidence) | What is missing | Owner | Phase | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | P0-4 seed content corrections (D-5) | [phase-2 review §3 P0-4](../reviews/phase-2-backend-review.md#p0-4-seed-content-wrong-attributions-and-wrong-hadith-grades); [follow-up](../reviews/phase-2-backend-review-followup.md#p0-4-seed-rows--owner-ticks-before-applying) | All six rows unticked in the follow-up and in `docs/build/PENDING_WORK_PROMPT.md` A-1; skipped by `D-BUILD-001` in `docs/build/DECISIONS.md`. The two lists word Q17/Q18 differently ("re-attribute (or replace)"/"replace…" vs "re-attribute"/"remove it"). | Owner verifies and ticks **one** list; then Cursor applies only ticked rows. | owner → Cursor | 2 leftover | VERIFIED |
| G2 | Other P0/P1 review findings | phase-2 review §3 | Fixed: P0-1 `292e889`, P0-2 `3485c49`, P0-3 `8355517`, P1-1 `40ce918`, P1-2 `d6d6d84`, P1-3/P1-6 `662e6a4`, P1-4 `94583ae`, P1-5 `dd2a397`, P1-7 `4562a47`, P1-8 `321a693`, P1-9 `60ed115`+`c66a670`, P1-10 `52b01a4`. | — | — | 2 | VERIFIED |
| G3 | Review step "e2e infrastructure first" | phase-2 review §7 / P1-9 | `backend/.env.test` exists (git-ignored by `backend/.gitignore`), `backend/.env.test.example` tracked; `test/global-setup-e2e.ts`, `test/helpers/`, `test/fixtures/`; per-controller specs: sins, good-deeds, quotes, quran, hadith, tags, sources, admin-content, admin-classification, auth, favorites, health, errors, raw-payload, app. | Specs for every new endpoint in this plan (§12.2). | Cursor | 3b/5b | VERIFIED |
| G4 | P2-1 / P2-4 status | follow-up "Still open" items 2–3 | Done in `dd04f28` ("extract link filters and ValidQuoteShape"; `backend/src/modules/quotes/dto/valid-quote-shape.decorator.ts` exists), but the follow-up still lists them as open. | Update the follow-up doc's status (docs-only). | Cursor | 2 | VERIFIED |
| G5 | P3 polish | phase-2 review §3 P3 | "Cheap P3" ticked in `docs/build/PROGRESS.md` (`dd04f28`); remaining P3 items not itemised anywhere. | List what is left or close P3 explicitly. | Cursor | 2 | FROM-DOCS |
| G6 | Frontend §10 steps 5–11 and tests | [frontend-plan §10](./frontend-plan.md#10-build-order-for-cursor) | **Built** (the brief's "only `/` and `/en` exist" is outdated): `78edc19`; routes under `frontend/src/app/[locale]/` include `sins`, `good-deeds`, `quotes/[id]`, `browse`, `browse/quran/[surahNumber]`, `feelings/[tagSlug]`, `favorites`, `login`, `register`, `settings`, `admin/**`. Frontend tests: one smoke file (`frontend/src/__tests__/smoke.test.ts`); no Playwright, `msw` or axe in `frontend/package.json`. | Playwright + axe + `msw` (owner approval A-3 in `PENDING_WORK_PROMPT.md`); roadmap phase 3/4/8 "done when" items that need them. | owner → Cursor | 3, 4, 8 | VERIFIED |
| G7 | Dirty working tree | — | `git status`: 26 modified + 2 untracked files under `frontend/src` (auth route handlers, api-client, curation views, `lib/api/fetch-auth-me.ts`, `lib/api/map-auth-user.ts`); 5 modified plan docs (Phase 4b pointer edits in `TECHNICAL_PLAN.md`, `backend-plan.md`, `frontend-plan.md`, `mobile-plan.md`, `roadmap.md`); untracked `docs/build/PENDING_WORK_PROMPT.md`; plus this task's doc edits. | Review, gate and commit (PENDING step 1). Not touched by this task except the docs listed in its report. | owner / Cursor | — | VERIFIED |
| G8 | `docs/reviews/`, `docs/AUTONOMOUS_BUILD_PROMPT.md` uncommitted? | brief | **Committed** in `c3a466c` ("add autonomous build prompt, reviews…"); `git ls-files docs` lists them. | — | — | — | VERIFIED |
| G9 | Tracking-doc drift | `docs/build/*` | `BLOCKERS.md` lists only B-01/B-02; `FINAL_REPORT.md` still refers to B-001…B-008; `PROGRESS.md` line 46 ticks Phase 4b `[x]` although it is blocked. | Rebuild BLOCKERS as one list (PENDING step 2), untick 4b, add 3b/5b items. | Cursor | — | VERIFIED |
| G10 | Stale status text | README, ARCHITECTURE, TECHNICAL_PLAN §H | `README.md` "Status: Phase 1 — structure only"; `docs/ARCHITECTURE.md` "this phase delivers … the data model only"; TECHNICAL_PLAN H2 "not a git repository yet", H8 "no dependency … installed yet". | Refresh status lines (docs-only; not done here — outside this task's file list). | Cursor | — | VERIFIED |
| G11 | `.cursorrules` out of date | [backend/.cursorrules](../../backend/.cursorrules), [frontend/.cursorrules](../../frontend/.cursorrules) | Backend module list lacks `kinship` (4b) and `iman-branches` (3b); product-safety rule 4 does not allow `Explanation`; no exception for `prisma/imports/**` `PrismaClient`; pre-approved schema list is Phase 4 only. Frontend fixed slice list = `sin-reminder`, `good-deed-motivation`, `quran-hadith-browser`, `favorites`, but `frontend/src/features/` already has `auth`, `curation`, `settings`; lacks `kinship`, `iman-branches`. | Owner edits both files when approving (this task must not). | owner | 3b, 4b, 5b | VERIFIED |
| G12 | Phase 4b build | [silat-rahim-plan](./silat-rahim-plan.md) | Not built: no `kinship` migration in `backend/prisma/migrations/`, no `backend/src/modules/kinship/`, no `frontend/src/features/kinship/`; blocked by `D-BUILD-002`. | Owner approvals (PENDING A-2), then silat-rahim §12. | owner → Cursor | 4b | VERIFIED |
| G13 | Silat-rahim open decisions S1–S12 | [silat-rahim §14](./silat-rahim-plan.md#14-open-decisions) | All unticked in `PENDING_WORK_PROMPT.md` A-2. **S3 resolved by this plan** (§10) pending confirmation. | Owner ticks S1, S2, S4–S12; confirms S3. | owner | 4b | VERIFIED |
| G14 | Schema approvals pending | TECHNICAL_PLAN §C | `schema.prisma` has none of: Phase 4b (C8–C11) or vision v2 (C13–C16) additions. | Owner approval per migration. | owner | 3b, 4b | VERIFIED |
| G15 | DevOps | [devops-plan](./devops-plan.md) | `.github/workflows/ci.yml` and `mobile-release.yml` exist, `backend/Dockerfile` exists (`a0dab98`); **no git remote** (`git remote -v` empty), so CI has never run on GitHub; staging (Vercel/Railway) not set up (`FINAL_REPORT.md` B-004/B-005). | Remote + push; staging projects; env vars incl. new `EXTERNAL_REF_ALLOWED_HOSTS`. | owner | — | VERIFIED (remote/CI files) · FROM-DOCS (staging) |
| G16 | Live provider keys, `SYNC_ENABLED` in staging | roadmap Phase 5 | Providers fixture-tested (`a1f037b`); live run blocked (B-006). Quran.com tafsir endpoints answered without a token during this check. | Keys + staging run; tafsir resource choice (V13). | owner | 5, 5b | FROM-DOCS (keys) · VERIFIED (tafsir endpoints) |
| G17 | Brand palette and final fonts | roadmap Phase 8 | Neutral tokens kept (`D-BUILD-003`); `PROGRESS.md` items unchecked. A rank badge token (`--rank-*`) would join that token set. | Design handoff. | owner | 8 | FROM-DOCS |
| G18 | EAS / store credentials | `docs/build/BLOCKERS.md` B-01/B-02 | Repo prep done (`02c2360`, `1bde55b`). | Owner accounts. | owner | 7 | FROM-DOCS |
| G19 | `GET /v1/admin/stats` (phase 6 "likely addition") | [roadmap Phase 6](./roadmap.md#phase-6--admin--curation-ui) | No such route in any controller. The dashboard works without it. | Decide whether it is needed (coverage counts would now include branches). | owner | 6 | VERIFIED |
| G20 | Explanations (تفسير/شرح/شرح الشعبة) | owner vision | Nothing in schema or plans. | §3.2–§3.3, §6–§9. | owner → Cursor | 3b, 5b | VERIFIED |
| G21 | Sin rank (كبيرة/صغيرة) | owner vision | Only `Sin.severity Int?` exists. | §6, owner classification with sources (V3). | owner/scholar → Cursor | 3b | VERIFIED |
| G22 | شعب الإيمان path | owner vision | No model, endpoint, route or slice. | §6–§9; choice of شرح (V2). | owner/scholar → Cursor | 3b | VERIFIED |
| G23 | Dorar "akhlaq API" assumption | owner belief | No Dorar mention anywhere in the repo (nothing to correct in existing plans). The API covers only hadith search (§3.1). | Permission request for content (V5); deep links (D-b); CLI (D-a). | owner → Cursor | 3b, 5b | VERIFIED |
| G24 | Book sources | owner's book folder | PDFs not importable (§4.1); no `backend/prisma/imports/` exists. Clean texts located for 7 of 9 works (§4.2). | Edition choices (V7), licence acceptance (V8), importer (§5). | owner → Cursor | 5b | VERIFIED |
| G25 | Path names | owner vision | Current labels in `frontend/messages/ar.json` (`home.sinEntryLabel`, `home.deedEntryLabel`); frontend-plan §2 row `/`. | Owner picks (V1); i18n change. | owner → Cursor | 3b | VERIFIED |
| G26 | Reminders for any deed (الصدقة…) | owner vision | silat-rahim S3 default was "forgotten deeds only". | Amended (§10); owner confirms (V12). | owner | 4b | VERIFIED |
| G27 | Mobile parity for 3b | [mobile-plan](./mobile-plan.md) | Expo app exists (`mobile/app/`, `d6705ee`) with the two core flows; no branches screen; `mobile/src/lib/types/api.ts` mirrors the contract. | Branches screen, rank badge, explanations (V17). | owner → Cursor | 3b follow-up | VERIFIED |
| G28 | Lint coverage for `prisma/` scripts | backend `package.json` | `lint` = `oxlint --type-aware src/ test/` → `prisma/seed.ts` (and future importers) are not linted; `tsc` covers them. | Add `prisma/imports/` to lint (owner-approved). | owner → Cursor | 5b | VERIFIED |
| G29 | Community contributions / أسباب النزول | owner vision | Conflicts with TECHNICAL_PLAN §I.9–§I.10. | Future phase only (§19). | owner | future | FROM-DOCS |

---

## 15. Owner decisions

Each has a default so work can proceed once confirmed. "Blocks" = what cannot start without it.

| # | Decision | Options | Default / recommendation | Blocks |
| --- | --- | --- | --- | --- |
| V1 | **Path names** (3 paths) | §2 table | Keep current two until chosen; third = «شُعَب الإيمان» | Final i18n strings |
| V2 | **Which شرح / summary for شعب الإيمان** | al-Bayhaqi's own text; al-Ḥalīmī's «المنهاج في شعب الإيمان» (root work — verify); al-Qazwīnī's «مختصر شعب الإيمان» (abridgment — verify); a modern شرح (permission) | **No default — owner/scholar decides** | Branch summaries and `BRANCH_SHARH` content |
| V3 | **Sin-rank source** | e.g. al-Dhahabī's «الكبائر» (OpenITI `0748Dhahabi.Kabair` — verify) or another work/scholar | No default; every rank cites its source | Entering ranks (schema can ship first) |
| V4 | `severity` after ranks exist | keep public / hide from public header | Keep in API; hide "x/10" from the public header | `SinHeader` change |
| V5 | **Request Dorar's written permission** for akhlaq content | request / don't | Request (owner action); build only links + CLI until granted | Any Dorar content import |
| V6 | External link structure | generic `ExternalReference` / nullable `dorarUrl` columns | Generic | Migration 4 |
| V7 | **Which works/editions first** | §4.2 | Pilot: «الأدب المفرد» (ت عبد الباقي, `Shamela0012991`), then «شعب الإيمان» (`Shamela0010660` = ط الرشد) | Phase 5b start |
| V8 | **Licences**: accept OpenITI CC BY-NC-SA 4.0 (attribution, non-commercial, share-alike); Shamela/usul terms unknown | accept / seek other sources | Accept OpenITI with attribution if Thekra stays non-commercial; do not rely on Shamela/usul as a licence | Phase 5b import |
| V9 | Origin + keys for imported rows | A: `LOCAL` + `book:` keys + extended guard · B: `API_CACHED` | **A** (§5.4) | Importer + guard |
| V10 | **Schema approvals** | migrations 1–4 (§6.4) | Approve per migration | Each 3b feature |
| V11 | Module placement | `iman-branches` new module; explanations in `quotes` (or a new `explanations` module) | New `iman-branches`; explanations in `quotes`; refs in `sources` | 3b backend |
| V12 | **S3 resolution** | any `GoodDeed` / forgotten only | **Any `GoodDeed`** (§10) | 4b deed reminders |
| V13 | Tafsir resources to cache + their terms | e.g. `16` الميسر, `91` السعدي … | One short Arabic tafsir first, after terms are checked | Tafsir sync |
| V14 | al-Albānī's grades | cite per narration / seek permission for bulk | Cite per narration during curation | صحيح الترغيب use |
| V15 | Hadith شرح works | owner/scholar choice | No default | `SHARH` content |
| V16 | Narration text: full isnad or matn | full verbatim / curator-forked matn | Import verbatim; matn via fork | Display of imported narrations |
| V17 | Mobile parity timing | with 3b / later | Right after web 3b | Mobile release |
| V18 | Dorar hadith API usage | CLI only / none | CLI only, manual | CLI tool |
| V19 | `hadithReference` format for imported works | English like the seed / Arabic | Same style as the seed | Importer |
| V20 | Branch URL key | `:number` / slug | `:number` | Routes |
| V21 | `.cursorrules` updates | as listed in G11 | Owner edits when approving | Every 3b/5b step (Cursor will stop and ask otherwise) |

---

## 16. For Claude Code — review checklist

### 16.1 Reviewing this plan

- [ ] Every new model/field/enum/endpoint/module/slice/route/dependency is marked **PROPOSED** and appears in the
      owner-decision table; none is presented as approved.
- [ ] No Islamic content was invented: no sin rank, شعبة number/title, grade, hadith reference or شرح
      attribution appears as fact. Candidate works are flagged "owner to verify".
- [ ] Facts about Dorar, Quran.com tafsir, OpenITI paths, Shamela ids and licences match the cited URLs.
- [ ] Endpoint numbers continue after #83 without collision; additive changes break no existing response field.
- [ ] Links/anchors in this file and the edited docs resolve.

### 16.2 Reviewing the implementation (run these, don't assume)

- [ ] **Grade policy on new reads:** `grep -n "GradePolicy\|whereClause" backend/src/modules/iman-branches` shows
      the shared policy; e2e asserts `GET /v1/branches/:n/quotes?grades=MAWDU` → `422`, a verse survives
      `grades=SAHIH`, and `GET /v1/quotes/<mawdu-id>/explanations` → `404`.
- [ ] **One quote projection:** no new code builds a `QuoteDto` by hand
      (`grep -rn "textAr:" backend/src/modules/iman-branches` should find only DTO types, not mappers).
- [ ] **No OCR / PDF input:** `grep -rniE "tesseract|ocr|pdf" backend/prisma/imports` is empty; the runner requires
      `--corpus-commit` and logs the input SHA-256.
- [ ] **Idempotent imports:** run the importer twice on the fixture/pilot; the second `SyncLog` summary reports
      `created=0`; row counts unchanged.
- [ ] **No automatic linking:** `grep -rnE "sinQuote|goodDeedQuote|imanBranchQuote|quoteTag" backend/prisma/imports backend/src/modules/content-sync`
      finds no writes (`upsert|create|createMany`).
- [ ] **Re-import preserves curation:** the importer's `update` clause excludes `grade` (ungraded works) and
      `narrator`; a test proves it.
- [ ] **Provider/import text read-only:** `PATCH /v1/admin/quotes/:id` on a `book:` row's `textAr` → `422`;
      same for `API_CACHED` explanations.
- [ ] **`rawPayload` never serialised:** `test/raw-payload.e2e-spec.ts` covers #84–#87.
- [ ] **Cache, don't proxy:** `grep -rn "dorar.net\|api.quran.com" backend/src` appears only in `content-sync`
      providers/config; never in a controller or a public service.
- [ ] **External links:** allow-list enforced server-side; rendered with `rel="noopener noreferrer"`.
- [ ] **Privacy:** deed reminders accept only `GoodDeed`s; nothing about a sin selection is stored or logged;
      reminder data is in export/delete; no deed-reminder content in logs.
- [ ] **Contract mirror:** `frontend/src/lib/types/api.ts` and `mobile/src/lib/types/api.ts` both carry the new DTOs.
- [ ] **Design system:** no literal colours (`design-tokens` CI job), RTL logical utilities (`rtl-lint` job),
      `pnpm check:i18n` green, accordions collapsed by default and lazy.
- [ ] **Migrations:** one per feature, each its own commit; CHECK constraints present in SQL; drift check green.
- [ ] **Scope:** `git diff --stat` per commit maps to one build-order step.

---

## 17. For Cursor — build order

**Stop-and-ask rules (from both `.cursorrules`):** do not start a step whose approval (V-row) is missing; do not
create a module or slice not on the `.cursorrules` lists — if the owner has not updated them yet, **stop and
ask**; do not add a dependency (none is needed by this plan); never invent religious content (seed only
structure: e.g. no real شعب titles — the owner enters them through the admin UI); a schema change is always its
own migration and commit.

**Gates after every step** (from the repo root; all must be green before committing):

```bash
pnpm --filter backend exec prisma validate
pnpm --filter backend lint
pnpm --filter backend exec tsc --noEmit -p tsconfig.json
pnpm --filter backend test
pnpm --filter backend test:e2e
pnpm --filter frontend lint
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend build
pnpm --filter frontend test
pnpm check:i18n
pnpm --filter mobile exec tsc --noEmit   # only when mobile types change
```

| Step | Work | Verify (in addition to the gates) |
| --- | --- | --- |
| 0 | **Preconditions.** Clean tree (G7 resolved by the owner/PENDING step 1). Owner has approved V10 (migrations), V11 (modules), V21 (`.cursorrules` updated). Read this plan, `backend-plan.md` §2–§5, `frontend-plan.md` §2–§6. | `git status --short` empty; `grep -n "iman-branches" backend/.cursorrules frontend/.cursorrules` finds the new entries — otherwise **stop and ask**. |
| 1 | Migration `add_sin_rank` + raw-SQL CHECK. | `pnpm --filter backend exec prisma migrate dev --name add_sin_rank`; `prisma migrate diff` drift check clean. |
| 2 | `sins`: `rank` in DTOs/entities, `rank` filter on #1, admin fields #36–#38, unit + e2e. | `curl 'localhost:3001/v1/sins?rank=KABIRA'` → `200` envelope. |
| 3 | Migration `add_iman_branches`. | as step 1. |
| 4 | `modules/iman-branches`: service + public controller #84–#86 (reusing `QuotesService` builders, `GradePolicy`, shuffle), admin #88–#90, #96; unit + `test/iman-branches.e2e-spec.ts`. | e2e `grades=MAWDU` → `422`; verse survives `grades=SAHIH`. |
| 5 | `classification`: branch side of the generic link path (#91–#95) + e2e. | re-POST same pair updates score. |
| 6 | `relatedBranches` on #2/#6 (`sins`/`good-deeds → iman-branches`). | no `forwardRef`; e2e shape. |
| 7 | Migration `add_explanations` + CHECKs; `quotes`: #87 + admin #97–#100 + unit/e2e. | `MAWDU` quote → `404`; tafsir by `ayahKey` for two rows of one ayah. |
| 8 | Migration `add_external_references` + CHECK; `sources`: #101–#103, embedding in #2/#6/#85; `EXTERNAL_REF_ALLOWED_HOSTS` in `backend/.env.example` + devops-plan §5.1. | non-allow-listed host → `422`. |
| 9 | Frontend `src/lib`: types, enums, api files, query keys; mirror in `mobile/src/lib/types/api.ts`. | `tsc` both. |
| 10 | Shared presentational components: `ExplanationAccordion`, `ExternalReferenceLinks`, `SinRankBadge`. | no literal colours; `design-tokens`/`rtl-lint` jobs. |
| 11 | `features/iman-branches` + `/branches`, `/branches/[number]` (+ `loading`/`error`); home third card. | both locales by hand; `pnpm --filter frontend build` lists the new routes. |
| 12 | `sin-reminder`/`good-deed-motivation`/`quran-hadith-browser` changes (rank badge, links, related branches, quote-detail accordion). | — |
| 13 | `curation`: branch CRUD + practices, explanation editor, external-refs editor, sin rank fields, linking workspace branch target + source/chapter pre-filter (needs the #8 admin `chapter` filter — add it here with an e2e). | full admin flow in the browser. |
| 14 | **Phase 3b done-when** (§13) — record command output in `docs/build/PROGRESS.md`. | — |
| 15 | *(5b, after V7–V9, V14, V16, V19)* `backend/prisma/imports/lib` (stream reader, batch upsert, `SyncLog` helper, Arabic-ratio guard) + runner + `import:book` script + lint coverage of `prisma/imports/`; the `book:` guard extension in `quotes` (if V9 = A) with tests. | unit specs; guard e2e. |
| 16 | Pilot work importer (`parse.ts` + synthetic fixtures + spec); `--dry-run` sample for the owner; real run twice. | second run `created=0`; owner sign-off on samples. |
| 17 | شعب الإيمان importer (streaming, ~11k). | same as 16; branch workspace pre-filter works. |
| 18 | Tafsir: `ExplanationProvider`, `QuranComTafsirProvider` (fixtures only), executor branch; `.cursorrules` rule 4 already updated by the owner (V21). | fixture tests; manual run in staging only. |
| 19 | Dorar CLI `dorar:lookup` (HTML → text, no DB writes; parser unit-tested on a saved fixture; no network in tests). | prints results for a sample query when run by hand. |
| 20 | **Phase 5b done-when** (§13). | — |
| 21 | *(4b, when approved)* follow [silat-rahim §12](./silat-rahim-plan.md#12-build-order-for-cursor) with S3 = any deed (§10). | silat-rahim §13 + the الصدقة check. |
| 22 | Mobile parity (V17). | mobile gates. |

Commit per step, Conventional Commits, e.g. `feat(iman-branches): add GET /v1/branches/:number/quotes`.

---

## 18. Ready-to-paste Cursor prompt

```
Implement docs/plan/vision-v2-plan.md (Phase 3b, then Phase 5b) in the Thekra monorepo.

Read first: docs/plan/vision-v2-plan.md (all), docs/plan/backend-plan.md §1–§5 and §11, docs/plan/frontend-plan.md
§2–§6, docs/plan/content-pipeline-plan.md §1–§4, backend/.cursorrules, frontend/.cursorrules,
frontend/.cursor/rules/design-system.mdc, frontend/AGENTS.md (Next.js 16: verify APIs in node_modules/next/dist/docs/).

Rules:
- Follow §17 "For Cursor — build order" step by step. Start at step 0. Do only steps whose owner decisions (§15)
  are recorded as approved in docs/build/DECISIONS.md or in the owner's message; otherwise log the step in
  docs/build/BLOCKERS.md and stop at that step.
- If backend/.cursorrules or frontend/.cursorrules do not yet list `iman-branches` (and the other updates in §14 G11),
  STOP and ask me — do not create the module or slice.
- Every schema change is its own `prisma migrate dev --name <name>` and its own commit (§6.4), including the raw-SQL
  CHECK constraints in §6.3.
- Never invent religious content: no شعب titles/numbers, sin ranks, grades, references or شرح text. Seed and test
  fixtures use clearly synthetic placeholder text. I enter real content through the admin UI.
- Never import from PDFs or OCR. Importers read pinned clean Unicode text files only (§5).
- No importer or sync writes SinQuote, GoodDeedQuote, ImanBranchQuote or QuoteTag. Ever.
- Grade policy on every new read path; rawPayload never serialised; textAr always returned; guest-first.
- No new dependency. Mirror every contract change in frontend/src/lib/types/api.ts and mobile/src/lib/types/api.ts.
- Run all gates in §17 after every step; never weaken a test or lint rule; commit each green step
  (Conventional Commits). Record each phase's "done when" (§13) output in docs/build/PROGRESS.md.

Report at the end: steps done/blocked with commit hashes, gate output, and open owner decisions.
```

---

## 19. Future phase idea — context of revelation and community contributions

**Not designed, not scheduled.** Recorded so it is not lost.

- **Idea:** let users "live" the context of a verse or hadith (أسباب النزول، سياق الحديث). It needs a qualified
  scholarly team; the owner may later open it to **community contributions**.
- **Conflicts to resolve first:** TECHNICAL_PLAN [§I.10](../TECHNICAL_PLAN.md#i-standing-assumptions) ("no
  user-generated *public* content") and §I.9 ("one curator; no multi-curator review workflow, approval queue or
  audit trail"). Community contributions would need: contributor accounts and roles beyond `USER`/`ADMIN`, a
  submission → scholarly review → publish workflow, moderation and abuse handling, an audit trail, attribution of
  contributors, a licence for contributed text, and privacy review. Each is a new decision for the owner.
- **Data note:** if it ever happens, `Explanation` (with a new `kind` and a review status) is the natural home —
  which is one more reason explanations are modelled now with mandatory attribution.
