# Book import report — Shu'ab al-Iman, al-Adab al-Mufrad, al-Kabair

Date: 2026-10-07. Dev database only (`thekra-db-1`). Nothing was committed.

Pipeline: `backend/prisma/imports/` (`run.ts` → `main.ts` → `<work>/import.ts`, pure `<work>/parse.ts`,
shared `lib/`). Script: `pnpm --filter backend import:book <shuab|adab-mufrad|kabair> [--dry-run] [--limit N]`.

## 0. Environment note (read first)

- **Prisma could not load under the harness Node 24.** `PrismaClient` failed with
  `dlopen(... libquery_engine-darwin-arm64.dylib.node) ... code signature ... not valid for use in process:
  mapping process and mapped file (non-platform) have different Team IDs`. This is the same native-binding
  restriction as for vitest/oxlint. Parsing and dry-run output worked; the DB write did not.
- **Every DB run and the spec run used the owner's existing Node `~/.nvm/versions/node/v22.19.0`.** This is the
  Node that runs the API on :3001. It was put first on `PATH` for the `pnpm --filter backend import:book …`
  command. The toolchain was not changed. pnpm prints `Unsupported engine: wanted {"node":">=24"}` and the run
  still works: Node 22.19 has `--experimental-strip-types` and `module.registerHooks`.
- `tsc --noEmit -p tsconfig.json` ran on the harness Node 24.
- **vitest:** it fails under the harness Node with `Cannot find module './rolldown-binding.wasi.cjs'` (native
  binding). Under Node 22.19 all 59 specs pass (see §6).
- **oxlint was not run.** The `lint` script covers only `src/ test/`; adding `prisma/imports/` is an
  owner-approved change in the plan (vision v2 §5.2) that was not part of this task.
- **Why `run.ts` registers a resolve hook.** Node's type stripping does not map `.js` import specifiers to
  `.ts` files. The `.cursorrules` ESM rule (relative imports end in `.js`) is kept, so `run.ts` registers a
  small resolve hook that falls back to `.ts`, then loads `main.ts`.

## 1. Corpus (pinned, git-ignored in `backend/.corpus/`)

Every imported row stores `corpusUri`, `corpusCommit` and `sha256` in `rawPayload`. The same values are in each
SyncLog summary. The loader re-checks the SHA-256 on every run.

| Work | OpenITI file | Repo commit (last touching the file) | SHA-256 |
| --- | --- | --- | --- |
| Shu'ab al-Iman (ط الرشد ١٤٢٣) | `OpenITI/0475AH/data/0458Bayhaqi/0458Bayhaqi.ShucabIman/0458Bayhaqi.ShucabIman.Shamela0010660-ara1` | `bb5632fa192ccdc3c0de8cd640faac9ac0415ed1` | `5a341285c1c80829b31f8f7c7a383b5e41ede103a5075544261d76b1e2755654` |
| al-Adab al-Mufrad (ت عبد الباقي) | `OpenITI/0275AH/data/0256Bukhari/0256Bukhari.AdabMufrad/0256Bukhari.AdabMufrad.Shamela0012991-ara1` | `47dfd28db9e158c7101c7df1162d4dc99bb70303` | `f0e9b0abb516b935a0185886a0c435fc87f3f8110753212517d9b9f87d553514` |
| Sahih al-Adab al-Mufrad (al-Albani) | `OpenITI/1425AH/data/1420MuhammadNasirDinAlbani/1420MuhammadNasirDinAlbani.SahihAdabMufrad/1420MuhammadNasirDinAlbani.SahihAdabMufrad.Shamela0001341-ara1` | `de4dd4fced3776f61738ceca2d9c89c4ae5f49af` | `ef658e6685c26b950fa306a3bf1c210a62dbffb7309e10d56242a5ed5abf6aae` |
| Da'if al-Adab al-Mufrad (al-Albani) | `OpenITI/1425AH/data/1420MuhammadNasirDinAlbani/1420MuhammadNasirDinAlbani.DacifAdabMufrad/1420MuhammadNasirDinAlbani.DacifAdabMufrad.Shamela0001346-ara1` | `de4dd4fced3776f61738ceca2d9c89c4ae5f49af` | `2c9c8eb7af72bf3d526fd42f7ac45d28f5cd09aebcd3f8ea43806bb4e457832c` |
| al-Kabair | `OpenITI/0750AH/data/0748Dhahabi/0748Dhahabi.Kabair/0748Dhahabi.Kabair.Shamela0006848-ara1` | `9168f4a124537948de88cba6adfacf560bc35d35` | `4cccf7f3de5da10fcc52f78422f5a03dfc6ea4fd29ac15da72935be169783b1a` |

The Arabic-letter guard (`lib/guard.ts`, floor 0.90) measured 1.0000 on all three works.

## 2. Final counts

```
select count(*) from "ImanBranch";                                        → 77
select count(*) from "Quote" where "apiProvider"='book:shuab-iman';       → 10725
select count(*) from "Quote" where "apiProvider"='book:adab-al-mufrad';   → 1342
  group by grade: SAHIH 745 | HASAN 158 | DAIF 205 | UNGRADED 234
select count(*) from "ImanBranchQuote" where "reviewStatus"='ACCEPTED';   → 10639
select count(*) from "ChapterEntityMap";                                  → 20
"Sin": 74 rows (9 existing + 65 new kabira-N); 69 with rank = KABIRA
```

The full `select slug,"nameAr",rank,"rankReference" from "Sin" order by slug` output is in §5.4.

## 3. Work 1 — «الجامع لشعب الإيمان» (Bayhaqi, ط الرشد)

### 3.1 Narrations

- **Count.** 10,725 numbered narrations parsed and imported as `Quote`. Fields: `type HADITH`, `origin LOCAL`,
  `grade UNGRADED`, `gradeAuthority null`, `narrator null`. `apiProvider = 'book:shuab-iman'`,
  `externalId = 'rushd:<n>'`, and `hadithReference = 'Shuab al-Iman (Rushd) <n>'`, following the seed's
  `"Muslim 2589"` style.
- **Text and location.** `textAr` is verbatim, isnad included; only markup, milestones and page tokens are
  removed. Every narration has `volume` (owner's constant). Every narration has `page` except 9869 and 9870:
  ج13 opens before the corpus marks a page there.
- **Branch links.** 10,639 narrations are linked to their branch with `reviewStatus ACCEPTED`,
  `relevanceScore 50` and `note «من الشعبة N في الكتاب»`. The other 86 narrations come before branch 1 (the
  introduction and «باب ذكر الحديث الذي ورد في شعب الإيمان») and have no link.
- **Re-runs never touch existing links.** The link upsert's `update` is `{}`, so a curator's score, note or
  rejection survives a re-import.

**Corpus defects handled, with every case listed:**

- **Heading-number typos repaired (11).** A number is repaired only when it is out of order, the expected
  number has no heading anywhere, it differs by one digit or ±1, and the next heading continues the sequence.
  The original number is kept in `rawPayload.corpusHeadingNumber`.
  223→423, 224→424, 1283→1284, 1219→1319, 3999→3899, 5961→3961, 6486→6487, 6491→6493, 7236→7237, 8063→8061,
  8976→8977.
- **Repeated numbers kept as written (4).** The second occurrence gets `externalId rushd:N-2`.
  - 5555 and 6605 are the edition's own «(أ)/(ب)» pairs.
  - 3550 and 9735 are ambiguous: probably typos for the missing 3549 and 9736/9737, but not provable.
    **Owner: check these in the PDF.**
- **Numbers with no heading in the corpus (35).** Their text most likely sits at the end of the previous
  narration; it was not split, because that would be guessing. **Owner: compare with the PDF.**
  79, 363, 372, 762, 763, 942, 1335, 1371, 1489, 1762, 1936, 2031, 2065, 2067, 2121, 2477, 3541, 3549, 3784,
  4180, 4421, 5431, 5482, 5552, 5743, 6013, 6014, 6114, 7099, 7840, 8466, 8475, 8649, 9737, 10046.
- **Conversion artifacts restored (6).** In 6 places the Shamela conversion turned a word in mid-sentence into
  a `###` heading, e.g. «…وتقيم» / `### | الصلاة،` / «وتؤتي الزكاة…». The fragment is kept in the narration
  text, so the narration is not cut in half.

### 3.2 Branches: 77 of 77 located

- **74 by their ordinal line.** Title = the words after «(وهو) باب (في)» up to the first boundary: commentary
  («قال», a quotation mark, an aya brace, «وهو/وهي» clause, «فأما/فإذا/إما»), verbatim.
- **27–29 have no ordinal in this corpus.** Each is a bare «وهو باب في …» line. They are the only such headings
  between 26 and 30, so they are numbered by position. **Owner: verify in the PDF.**
- **Fields.** `sourceReference` = «جV صP — <heading text up to the end of the title>». `title`, `summaryAr` and
  `summary` are left null. Branch 31 («الكفارات الواجبات بالجنايات») contains no numbered narration in the book,
  so it has 0 links.

**Branches for owner review:**

| # | Issue |
| --- | --- |
| 4, 77 | Long verbatim titles (>70 chars) — owner may want a shorter display title. |
| 12 | Title keeps «… وفيه فصول». |
| 18 | Source text repeats a word: «نشر العلم وألا يمنعه أهله أهله» (kept verbatim). |
| 48 | Title runs on: «القرابين والأمانة عن معناها وعرضها وجملته الهدي، والأضحية، والعقيقة». |
| 69 | «الستر على أصحاب القروف» — verbatim; possibly «القروح» in print. |
| 27, 28, 29 | Number inferred from position (ordinal line absent in corpus). |
| 10, 22, 43, 50, 66 | Heading opens a volume; the corpus has no page marker there, so `sourceReference` has «جV» without a page. |

Full branch list (number | titleAr | sourceReference | linked narrations):

```
1|الإيمان بالله عز وجل|ج1 ص189 — الأول من شعب الإيمان، وهو باب في الإيمان بالله عز وجل|35
2|الإيمان برسل الله صلوات الله عليهم عامة|ج1 ص270 — الثاني من شعب الإيمان، وهو باب في الإيمان برسل الله صلوات الله عليهم عامة|16
3|الإيمان بالملائكة|ج1 ص295 — …|27
4|الإيمان بالقرآن المنزل على نبينا محمد صلى الله عليه وسلم وسائر الكتب المنزلة على الأنبياء صلوات الله عليهم أجمعين|ج1 ص325|11
5|القدر خيره وشره من الله عز وجل|ج1 ص349|74
6|الإيمان باليوم الآخر|ج1 ص405|2
7|الإيمان بالبعث والنشور بعد الموت|ج1 ص409|1
8|حشر الناس بعد ما يبعثون من قبورهم إلى الموقف الذي بين لهم من الأرض|ج1 ص414|105
9|أن دار المؤمنين، ومآبهم الجنة ودار الكافرين ومآبهم النار|ج1 ص559|39
10|محبة الله عز وجل|ج2|316
11|الخوف من الله تعالى|ج2 ص188|250
12|الرجاء من الله تعالى وفيه فصول|ج2 ص311|153
13|التوكل بالله عز وجل والتسليم لأمره تعالى في كل شيء|ج2 ص389|189
14|حب النبي صلى الله عليه وسلم|ج2 ص500|114
15|تعظيم النبي صلى الله عليه وسلم وإجلاله وتوقيره صلى الله عليه وسلم|ج3 ص94|79
16|شح المرء بدينه|ج3 ص166|33
17|طلب العلم|ج3 ص186|66
18|نشر العلم وألا يمنعه أهله أهله|ج3 ص244|176
19|تعظيم القرآن|ج3 ص325|665
20|الطهارات|ج4 ص235|81
21|الصلاة|ج4 ص287|486
22|الزكاة التي جعلها الله تعالى جده قرينة للصلاة|ج5|268
23|الصيام|ج5 ص189|385
24|الاعتكاف|ج5 ص431|10
25|المناسك|ج5 ص437|220
26|الجهاد|ج6 ص73|73
27|المرابطة في سبيل الله عز وجل|ج6 ص136|20
28|الثبات للعدو وترك الفرار من الزحف|ج6 ص153|19
29|أداء خمس المغنم إلى الإمام أو عامله على الغانمين|ج6 ص165|8
30|العتق ووجه التقرب إلى الله عز وجل|ج6 ص177|13
31|الكفارات الواجبات بالجنايات|ج6 ص185|0
32|الإيفاء بالعقود|ج6 ص187|17
33|تعديد نعم الله عز وجل، وما يجب من شكرها|ج6 ص204|390
34|حفظ اللسان|ج6 ص434|425
35|الأمانات وما يجب من أدائها إلى أهلها|ج7 ص197|60
36|تحريم النفوس والجنايات عليها|ج7 ص235|45
37|تحريم الفروج، وما يجب من التعفف عنها|ج7 ص266|124
38|قبض اليد عن الأموال المحرمة، ويدخل فيه تحريم السرقة، وقطع الطريق|ج7 ص341|76
39|المطاعم والمشارب وما يجب التورع عنه منها|ج7 ص387|500
40|الملابس والزي والأواني وما يكره منها|ج8 ص189|391
41|تحريم الملاعب والملاهي|ج8 ص447|50
42|الاقتصاد في النفقة وتحريم أكل المال الباطل|ج8 ص487|54
43|الحث على ترك الغل والحسد|ج9|52
44|تحريم أعراض الناس وما يلزم من ترك الوقوع فيها|ج9 ص37|156
45|إخلاص العمل لله عز وجل وترك الرياء|ج9 ص134|206
46|السرور بالحسنة والاغتمام بالسيئة|ج9 ص227|29
47|معالجة كل ذنب بالتوبة|ج9 ص245|316
48|القرابين والأمانة عن معناها وعرضها وجملته الهدي، والأضحية، والعقيقة|ج9 ص432|26
49|طاعة أولي الأمر بفصولها|ج9 ص455|126
50|التمسك بما عليه الجماعة|ج10|32
51|الحكم بين الناس|ج10 ص28|16
52|الأمر بالمعروف والنهي عن المنكر|ج10 ص42|63
53|التعاون على البر والتقوى|ج10 ص82|101
54|الحياء بفصوله|ج10 ص143|137
55|بر الوالدين|ج10 ص238|118
56|صلة الأرحام|ج10 ص315|50
57|حسن الخلق ودخل في هذا كظم الغيظ، ولين الجانب، والتواضع|ج10 ص349|585
58|الإحسان إلى المماليك|ج11 ص67|38
59|حق السادة على المماليك|ج11 ص90|21
60|حقوق الأولاد والأهلين|ج11 ص103|119
61|مقاربة أهل الدين وموادتهم، وإفشاء السلام بينهم|ج11 ص179|291
62|رد السلام|ج11 ص356|70
63|عيادة المريض|ج11 ص399|70
64|الصلاة على من مات من أهل القبلة|ج11 ص442|73
65|تشميت العاطس|ج11 ص483|47
66|مباعدة الكفار والمفسدين والغلظة عليهم|ج12|154
67|إكرام الجار|ج12 ص78|57
68|إكرام الضيف|ج12 ص116|67
69|الستر على أصحاب القروف|ج12 ص153|29
70|الصبر على المصائب، وعما تنزع إليه النفس من لذة وشهوة|ج12 ص171|522
71|الزهد وقصر الأمل|ج12 ص465|552
72|الغيرة والمذاء|ج13 ص258|7
73|الإعراض عن اللغو|ج13 ص266|18
74|الجود والسخاء|ج13 ص274|138
75|رحم الصغير وتوقير الكبير|ج13 ص350|103
76|الإصلاح بين الناس إذا مرجوا وفسدت ذات بينهم|ج13 ص423|37
77|أن يحب الرجل لأخيه المسلم ما يحب لنفسه ويكره له ما يكره لنفسه ويدخل فيه إماطة الأذى عن الطريق|ج13 ص452|147
```

### 3.3 Important: branch pages stay empty in public

All Shu'ab narrations are **UNGRADED**. The public grade policy serves only SAHIH and HASAN unless weak
narrations are requested, so `/v1/branches/:n/quotes` returns 0 items by default and `quoteCount` is 0. The
items appear only with `includeWeak=true`. That rule was not changed. Branch pages will fill as narrations are
graded with a cited grader.

### 3.4 Spot check (5 random narrations — open the matching PDF page)

```
 Shuab al-Iman (Rushd) 8913  | ج11 | ص504 | أخبرنا أبو سعد الماليني , أنا أبو أحمد بن عدي , أنا عمر بن سنان المنبجي , نا إبراهيم بن سعيد الجوهري
 Shuab al-Iman (Rushd) 10576 | ج13 | ص426 | وأخبرنا علي بن أحمد بن عبدان، أنا أحمد بن عبيد، ثنا محمد بن الفرج الأزرق، ثنا السهمي يعني عبد الله ب
 Shuab al-Iman (Rushd) 6870  | ج9  | ص400 | أخبرنا أبو الفتح هلال بن محمد بن جعفر، أنا الحسين بن يحيى بن عياش، نا أبو الأشعث، نا حزم بن أبي حزم،
 Shuab al-Iman (Rushd) 389   | ج1  | ص605 | أخبرنا محمد بن عبد الله الحافظ، حدثنا أبو بكر محمد بن أحمد بن بالويه إملاء، حدثنا أبو بكر محمد بن إب
 Shuab al-Iman (Rushd) 3228  | ج5  | ص153 | أخبرنا أبو بكر بن فورك، حدثنا عبد الله بن جعفر، حدثنا يونس بن حبيب، حدثنا أبو داود، حدثنا شعبة، أخبر
```

The page is the page on which the narration's heading starts, taken from the corpus page markers. A wrong page
here would point at a page-marker defect, not a numbering one.

## 4. Work 2 — «الأدب المفرد» (ت محمد فؤاد عبد الباقي)

### 4.1 Narrations

- **Count.** 1,342 narration headings imported: numbers 1–1322, plus 21 numbers that the edition repeats (the
  second occurrence is `abdulbaqi:N-2`).
- **Missing number.** No heading for **895** in the corpus. Its text appears to sit inside 894: Albani's entry
  691/895 matches 894 at 0.86.
- **Keys and references.** `apiProvider = 'book:adab-al-mufrad'`, `externalId = 'abdulbaqi:<n>'`,
  `hadithReference = 'al-Adab al-Mufrad <n>'`, `page` from the corpus, `volume` null (single volume).
- **Corpus quirk.** Shamela inserted a «[قال الشيخ الألباني]» ruling block into each record. The block is
  excluded from `textAr`, but narration text that continues after it is kept (32 narrations; one more such
  line is a chapter title, «باب من ختم على خادمه مخافة سوء الظن», and is treated as one). The block's
  first line is stored as `rawPayload.embeddedAlbaniRuling` and is used for cross-checking only.
- **Chapters.** `rawPayload.chapterTitle` and `chapterKey = 'abdulbaqi:bab@<first narration number>'`.
  621 chapters have at least one narration.

### 4.2 Grades — how the Albani mapping was verified

- **Entry format.** Albani's files write each entry as «<albaniNo>/<originalNo> (<ruling>) text». Variants:
  «204/270م» (repeat mark), «296/1/383» (sub-numbered entry), «187/ (250/1)» and «85/ (565/ (ضعيف) 1)»
  (part k of an original number).
- **Parse results.** Sahih: 990 entries; Da'if: 214. 2 entries are unparseable because the original number is
  printed as «( ... )»: Sahih 771 and Da'if 213.
- **Every entry was checked, not a sample.** The entry's opening text (first 25 content words, normalised, stop
  words removed) must appear in the Abd al-Baqi narration carrying the written number (overlap ≥ 0.60). It must
  also score at least as well as that number's ±2 neighbours.
  - **1,170 of 1,204 confirmed.** Only confirmed entries can set a grade.
  - **17 written numbers are wrong (1.41%).** The text clearly sits at another number (≥ 0.90 there, < 0.90 at
    the written one). Mostly digit swaps: 97↔79, 58↔85, 68↔86, 367↔376, 523↔532, 544↔554, 478↔578,
    966↔669, 789↔798, 988↔889, 1023↔1032, 1057↔1075, 1234↔1243, 1036↔1306, plus 401→402, 769→770 and
    185→186 (a merged variant). Those entries were **not** applied; the narrations stay UNGRADED.
  - **17 other entries are unconfirmed** (low overlap, chapter cross-references, continuation fragments).
    These were not applied either: Sahih 71/96, 140/189, 95/1, 95/2, 199/264, 228/279, 330/428, 371/479,
    419/539, 510/654, 691/895, 769/996, 798/1010, 819/1069, 908/1185, 914/1195, 933/1224.
- **The 2% rule.** The confirmed wrong-number rate over the whole population is 1.41% (below 2%), so grades
  were applied — but only through text-confirmed entries.
  - **Caveat for the owner.** A separate seeded random draw of 20 entries (table below) had 1 wrong number,
    which is 5% within that small sample. I used the full-population check as "the sample". If you prefer the
    stricter reading, set `MAX_UNCONFIRMED_NUMBER_RATE` in
    `prisma/imports/adab-mufrad/import.ts` to 0, re-run, and all narrations import UNGRADED.
- **Independent cross-check.** I compared the applied grades with the rulings Shamela printed under each
  narration in the Abd al-Baqi file. 1,100 agree.
  - 5 differ only between SAHIH and HASAN, and the split's grade is kept: 2, 325, 326, 335, 966.
  - 2 differ on whether the narration is accepted at all, so they were left UNGRADED: 383 (split حسن الإسناد vs
    printed ضعيف) and 785 (split ضعيف vs printed صحيح).

**Random sample (seeded, 20 entries): Albani entry vs Abd al-Baqi text at that number**

| Albani entry | AM no. | overlap | result | Albani opening | Abd al-Baqi text at that number |
| --- | --- | --- | --- | --- | --- |
| صحيح 39 | 54 | 1.00 | match | عن أبي العنبس قال: دخلت على عبد الله بن عمرو … | …عن أبي العنبس قال دخلت على عبد الله بن عمرو في ا… |
| صحيح 59 | 97 | 0.00 | **mismatch** (text is at 79) | عن أبي سعيد الخدري؛ أن رسول الله صلى الله علي… | (97 is a different report: وعن عبدة عن ابن أبي خالد عن قيس عن جرير …) |
| صحيح 223 | 291 | 1.00 | match | عن أسامة بن شريك قال: كنت عند النبي صلى الله … | …عن أسامة بن شريك قال كنت عند النبي صلى الله عليه… |
| صحيح 278 | 362 | 1.00 | match | عن أبي هريرة، قال: كان رسول الله صلى الله علي… | …عن أبي هريرة قال كان رسول الله صلى الله عليه وسل… |
| صحيح 196 | 473 | 1.00 | match | عن أنس بن مالك قال: قال النبي صلى الله عليه و… | …عت أنس بن مالك قال قال النبي صلى الله عليه وسلم … |
| صحيح 406 | 521 | 1.00 | match | عن أبي أسماء قال: " من عاد أخاه، كان في خرفة … | …عن أبي أسماء قال من عاد أخاه كان في خرفة الجنة ق… |
| صحيح 468 | 599 | 1.00 | match | عن أبي سعيد قال: "كان النبي صلى الله عليه وسل… | …عن أبي سعيد الخدري مثله … |
| صحيح 545 | 704 | 1.00 | match | عن جابر بن عبد الله قال: " دعا رسول الله صلى … | …عت جابر بن عبد الله يقول دعا رسول الله صلى الله … |
| صحيح 579 | 748 | 1.00 | match | عن ثوبان، عن النبي صلى الله عليه وسلم قال: " … | …عن ثوبان عن النبي صلى الله عليه وسلم قال إن من أ… |
| صحيح 684 | 884 | 1.00 | match | قال: وفيما أرى قال: قال عمر: "أما في المعاريض… | …قال وفيما أرى قال قال عمر أما في المعاريض ما يكفي… |
| صحيح 693 | 898 | 1.00 | match | عن ابن عباس قال: " لا أرى أحدا يعمل بهذه الآي… | …عن ابن عباس قال لا أرى أحدا يعمل بهذه الآية … |
| صحيح 706 | 914 | 0.93 | match | عن حية [بن حابس] التميمي؛ أن أباه أخبره، أنه … | (isnad first; matn words match) |
| صحيح 813 | 1059 | 1.00 | match | عن علقمة قال: جاء رجل إلى عبد الله، قال: أستأ… | …عن علقمة قال جاء رجل إلى عبد الله قال أستأذن على… |
| صحيح 832 | 1086 | 0.92 | match | عن جابر قال: أتيت النبي صلى الله عليه وسلم في… | (isnad first; matn words match) |
| صحيح 945 | 1240 | 0.75 | match | عن أنس قال: " كانوا يجعون ثم يقيلون".… | …عن أنس قال كانوا يجمعون ثم يقيلون… |
| صحيح 994 | 1317 | 1.00 | match | عن أبي هريرة؛ أن رسول الله صلى الله عليه وسلم… | …عن أبي هريرة أن رسول الله صلى الله عليه وسلم قال… |
| ضعيف 85 | 565 | 1.00 | match | عن أبي سعيد قال: "لا حليم إذا ذو عثرة، ولا حك… | …عن أبي سعيد قال لا حليم إلا ذو عثرة ولا حكيم إلا… |
| ضعيف 141 | 904 | 1.00 | match | عن أسيد بن أبي أسيد، عن أمه قالت: قلت لأبي قت… | …عن أسيد بن أبي أسيد عن أمه قالت قلت لأبي قتادة م… |
| ضعيف 192 | 1214 | 1.00 | match | عن جابر قال: "إذا دخل الرجل بيته أو أوى إلى ف… | …عن جابر قال إذا دخل الرجل بيته أو أوى إلى فراشه … |
| ضعيف 202 | 1263 | 0.96 | match | عن عمر بن حمزة العمري، عن حصين بن مصعب: أن أب… | …عن عمر بن حمزة العمري عن حصين بن مصعب أن أبا هري… |

**Ruling → grade mapping (per entry, never per book)**

- **Mapping.** صحيح… → SAHIH, حسن… (including «حسن صحيح») → HASAN, ضعيف… / منكر / شاذ → DAIF, موضوع → MAWDU.
  Every Da'if-book entry is DAIF.
- **Kept UNGRADED** (reported, not guessed):
  - **Sahih-book entries with no ruling word (39).** Membership alone cannot tell صحيح from حسن. Examples:
    54/73, 136/183, 182/243, 227/296, 366/470, 575/744–581/750, 584/753, 597/767, 631/816, 661/855,
    677/877, 678/878, 688/891, 689/892, 694/899, 701/907, 711/921, 716/931, 718/933, 719/934, 727/945,
    731/949, 755/980, 768/993, 772/1004, 774/1006, 783/1021, 853/1115, 940/1232, 949/1244, 991/1313, ….
  - **Qualified rulings (6):** «صحيح دون لفظ "وأبيك"» (778), «صحيح لغيره دون سبب الحديث والإسراع» (813),
    «صحيح دون جملة الأنبياء» (814), «صحيح دون ذكر اليد» (1047), «صحيح دون جملة الإمامة» (1093),
    «حسن الإسناد إلا الزيادة فصحيحة الإسناد» (1131).
  - **Unrecognised (1):** «موقوف، رجاله ثقات، وقد صح مرفوعا» (1318).
  - **In both books → conflict (8):** narrations 66, 196, 259, 308, 750, 813, 814, 1135.
- **Mawquf/maqtu' rulings** («صحيح الإسناد موقوفا», «صحيح مقطوع» …) map to SAHIH/HASAN as Albani wrote them.
  **Owner: decide whether athar should be shown as hadith grades.**
- **What the graded rows store.** `gradeAuthority = 'الألباني'`,
  `gradeReference = 'صحيح الأدب المفرد <n>'` / `'ضعيف الأدب المفرد <n>'` (joined with «، » when two entries
  point at one narration). `rawPayload.albani[]` keeps each entry's book, number, ruling and corpus provenance.

**Final grade breakdown:** SAHIH 745 · HASAN 158 · DAIF 205 · UNGRADED 234 (MAWDU 0 — Albani's Da'if file has no
موضوع ruling).

### 4.3 ChapterEntityMap (20 rows, all `reviewed = false`)

A chapter matches when an entity's normalised name occurs in the title as whole consecutive words. Test
fixtures with slug `test-*` are excluded. No SinQuote or GoodDeedQuote rows were created.

```
abdulbaqi:bab@15   | باب عقوق الوالدين                    | SIN       | kabira-8          | عقوق الوالدين
abdulbaqi:bab@29   | باب عقوبة عقوق الوالدين              | SIN       | kabira-8          | عقوق الوالدين
abdulbaqi:bab@35   | باب بر الوالدين بعد موتهما            | GOOD_DEED | birr-al-walidayn  | بر الوالدين
abdulbaqi:bab@47   | باب وجوب صلة الرحم                    | GOOD_DEED | silat-ar-rahim    | صلة الرحم
abdulbaqi:bab@49   | باب صلة الرحم                         | GOOD_DEED | silat-ar-rahim    | صلة الرحم
abdulbaqi:bab@52   | باب فضل صلة الرحم                     | GOOD_DEED | silat-ar-rahim    | صلة الرحم
abdulbaqi:bab@56   | باب صلة الرحم تزيد في العمر           | GOOD_DEED | silat-ar-rahim    | صلة الرحم
abdulbaqi:bab@316  | باب اللعان                            | SIN       | kabira-44         | اللعان
abdulbaqi:bab@386  | باب لا يصلح الكذب                     | SIN       | kadhib            | الكذب
abdulbaqi:bab@418  | باب ما ذكر في المكر والخديعة          | SIN       | kabira-68         | المكر والخديعة
abdulbaqi:bab@483  | باب الظلم ظلمات                       | SIN       | kabira-26         | الظلم
abdulbaqi:bab@548  | باب الكبر                             | SIN       | kabira-17         | الكبر
abdulbaqi:bab@588  | باب البغي                             | SIN       | kabira-50         | البغي
abdulbaqi:bab@735  | باب الغيبة، وقول الله عز وجل {: ولا يغتب بعضكم بعضا} | SIN | ghibah | الغيبة
abdulbaqi:bab@737  | باب الغيبة للميت                      | SIN       | ghibah            | الغيبة
abdulbaqi:bab@754  | باب قول الرجل: فلان جعد، أسود، أو طويل، قصير، يريد الصفة ولا يريد الغيبة | SIN | ghibah | الغيبة
abdulbaqi:bab@893  | باب البغي                             | SIN       | kabira-50         | البغي
abdulbaqi:bab@894  | باب عقوبة البغي                       | SIN       | kabira-50         | البغي
abdulbaqi:bab@1259 | باب القمار                            | SIN       | kabira-20         | القمار
abdulbaqi:bab@1317 | باب الغضب                             | SIN       | ghadab            | الغضب
```

- **Owner: likely reject bab@754.** It matched on the word «الغيبة», but the chapter is about descriptions
  that are *not* ghibah.
- **Run order.** Kabair was imported before Adab, so these maps include the new كبيرة sins.

**Near-misses** share a word stem but are not maps. There are 203 chapters in total, most of them against the
new كبيرة names. The ones involving the original sins and deeds:

```
bab@10 «باب جزاء الوالدين» · bab@15 «باب عقوق الوالدين» · bab@29 «باب عقوبة عقوق الوالدين» · bab@31 «باب بكاء الوالدين» · bab@32 «باب دعوة الوالدين» ~ birr-al-walidayn
bab@47/49/52/56 «… صلة الرحم …» ~ qat-al-rahim
bab@63 «باب لا تنزل الرحمة على قوم فيهم قاطع رحم» · bab@64 «باب إثم قاطع الرحم» · bab@67 «باب عقوبة قاطع الرحم في الدنيا» ~ qat-al-rahim, silat-ar-rahim
bab@69 «باب فضل من يصل ذا الرحم الظالم» · bab@71 «باب صلة ذي الرحم المشرك والهدية» ~ qat-al-rahim, silat-ar-rahim
bab@195 «باب نفقة الرجل على عبده وخادمه صدقة» · bab@224 «باب إن كل معروف صدقة» ~ sadaqah
bab@1319 «باب ما يقول إذا غضب» · bab@1320 «باب يسكت إذا غضب» ~ ghadab, kaff-al-ghadab
bab@1317 «باب الغضب» ~ kaff-al-ghadab   (also mapped to ghadab above)
bab@640 «باب الصلاة على النبي …» ~ tark-as-salah, salat-fi-jamaah  (false friend)
bab@418, bab@644 ~ dhikr; bab@1020 ~ tark-as-salah  (false friends)
```

The strongest candidates for the owner to map by hand are bab@63, 64 and 67 (qat-al-rahim) and bab@1319 and
1320 (ghadab / kaff-al-ghadab).

## 5. Work 3 — «الكبائر» (attributed to al-Dhahabi)

### 5.1 Edition

- **This file (Shamela 6848).** Publisher «دار الندوة الجديدة - بيروت», one volume. Its author line reads
  «تنسب لشمس الدين … الذهبي» (*attributed*). This is the widely circulated recension with 70 numbered kaba'ir.
  It is **not** Mashhur Hasan Salman's critical edition.
- **Other OpenITI versions** (read from their `.yml` only, texts not compared):
  - `JK000429-ara1`: PRIMARY_VERSION, cleaned of paratext, 54,278 words.
  - `ShamAY0033744-ara2`: 17,662 words, likely partial or abridged.
  - This file has 53,802 words.

### 5.2 Headings

69 «الكبيرة <ordinal> …» headings were found for numbers 1–70.

- **64 is absent** from this text. 63 is «الأمن من مكر الله».
- **35 and 38 are body lines**, not `###` headings. They were still detected (short title lines).
- **31 is spelled «الحاديثة والثلاثون»** in the source and is accepted as 31.
- **A leading «في»** («الكبيرة الثالثة في السحر») is dropped from the sin name; the full heading is kept in
  `rankReference`.

### 5.3 Existing sins

| Sin | Result |
| --- | --- |
| riya «الرياء» | **KABIRA** — exact: كبيرة 37 «الرياء» |
| tark-as-salah «ترك الصلاة» | **KABIRA** — exact: كبيرة 4 «في ترك الصلاة» |
| namimah «النميمة» | **KABIRA** — explicit alias: كبيرة 43 «النمام» (the chapter is on النميمة) — **owner to confirm** |
| qat-al-rahim «قطع الرحم» | **KABIRA** — explicit alias: كبيرة 9 «هجر الأقارب» (the chapter warns «قاطع رحم») — **owner to confirm** |
| kadhib «الكذب» | **null — ambiguous**: كبيرة 14 «الكذب على الله عز وجل وعلى رسوله…» and 30 «الكذب في غالب أقواله» |
| ghibah «الغيبة», hasad «الحسد», ghadab «الغضب» | null — no كبيرة heading in this edition |
| test-sin-many-opposites | null — test fixture |

The two aliases live in `KABIRA_NAME_ALIASES` (`kabair/parse.ts`). Delete an entry to undo it. SAGHIRA was never
set. Dhahabi's evidence texts were not imported.

### 5.4 New sins (65, slug `kabira-<N>`, rank KABIRA, `rankSourceId = …0007`)

- `nameAr` is the heading's sin name, verbatim. **`name` (English) is a draft for owner review.**
- `severity`, `category` and both descriptions are null.
- On re-import, `name` (English) is never overwritten.

```
1 الشرك بالله — Associating partners with Allah        2 قتل النفس — Killing a soul               3 السحر — Sorcery
5 منع الزكاة — Withholding zakat                        6 إفطار يوم من رمضان بلا عذر — Breaking a Ramadan fast without excuse
7 ترك الحج مع القدرة عليه — Not performing Hajj despite ability   8 عقوق الوالدين — Disobeying parents
10 الزنا — Fornication   11 اللواط — Sodomy   12 الربا — Usury   13 أكل مال اليتيم وظلمه — Consuming an orphan's wealth
14 الكذب على الله عز وجل وعلى رسوله … — Lying about Allah and His Messenger   15 الفرار من الزحف — Fleeing from battle
16 غش الإمام الرعية وظلمه لهم — A ruler deceiving and wronging his subjects   17 الكبر — Arrogance
18 شهادة الزور — False testimony   19 شرب الخمر — Drinking wine   20 القمار — Gambling   21 قذف المحصنات — Slandering chaste women
22 الغلول من الغنيمة — Stealing from war spoils   23 السرقة — Theft   24 قطع الطريق — Highway robbery
25 اليمين الغموس — The false oath   26 الظلم — Oppression   27 المكاس — Unjust tax collecting
28 أكل الحرام وتناوله على أي وجه كان — Consuming the unlawful   29 أن يقتل الإنسان نفسه — Suicide
30 الكذب في غالب أقواله — Habitual lying   31 القاضي السوء — The corrupt judge   32 أخذ الرشوة على الحكم — Taking bribes for a judgment
33 تشبه النساء بالرجال وتشبه الرجال بالنساء — Men and women imitating each other
34 الديوث المستحسن على أهله والقواد … — The complacent husband and the procurer   35 المحلل والمحلل له — The muhallil and the one he acts for
36 عدم التنزه من البول … — Not guarding against urine   38 التعلم للدنيا وكتمان العلم — Seeking knowledge for worldly gain and concealing knowledge
39 الخيانة — Betraying a trust   40 المنان — Reminding others of favours done   41 التكذيب بالقدر — Denying divine decree
42 التسمع على الناس وما يسرون — Eavesdropping on people's secrets   44 اللعان — Habitual cursing
45 الغدر وعدم الوفاء بالعهد — Treachery and breaking covenants   46 تصديق الكاهن والمنجم — Believing soothsayers and astrologers
47 نشوز المرأة على زوجها — A wife's defiance of her husband   48 التصوير في الثياب … — Making images
49 اللطم والنياحة وشق الثوب … — Wailing and tearing clothes at a calamity   50 البغي — Transgression
51 الاستطالة على الضعيف والمملوك … — Abusing the weak, servants, wives and animals   52 أذى الجار — Harming one's neighbour
53 أذى المسلمين وشتمهم — Harming and reviling Muslims   54 أذية عباد الله والتطول عليهم — Harming Allah's servants and lording over them
55 إسبال الإزار … — Trailing garments out of pride   56 لبس الحرير والذهب للرجال — Men wearing silk and gold
57 إباق العبد — A slave running away   58 الذبح لغير الله عز وجل — Sacrificing to other than Allah
59 فيمن ادعى إلى غير أبيه وهو يعلم — Claiming descent from other than one's father   60 الجدل والمراء واللدد — Quarrelsome disputation
61 منع فضل الماء — Withholding surplus water   62 نقص الكيل والزراع … — Giving short measure   63 الأمن من مكر الله — Feeling secure from Allah's plan
65 تارك الجماعة فيصلي وحده من غير عذر — Leaving congregational prayer without excuse
66 الإصرار على ترك صلاة الجمعة والجماعة من غير عذر — Persistently missing Friday and congregational prayer
67 الإضرار في الوصية — Causing harm through a will   68 المكر والخديعة — Deception and trickery
69 من جس على المسلمين ودل على عورتهم — Spying on Muslims and exposing their faults   70 سب أحد من الصحابة … — Reviling the Companions
```

Notes on the new rows:
- 48, 49 and 55 have very long verbatim names. **Owner may want display names.**
- 8 «عقوق الوالدين» and 59 keep the book's wording («فيمن …»).

`select slug,"nameAr",rank,"rankReference" from "Sin" order by slug` (abridged; all 65 `kabira-*` rows follow
the pattern shown):

```
 ghadab        | الغضب        |        |
 ghibah        | الغيبة       |        |
 hasad         | الحسد        |        |
 kabira-1      | الشرك بالله  | KABIRA | الكبائر للذهبي، الكبيرة رقم 1 — الكبيرة الأولى الشرك بالله
 kabira-10     | الزنا        | KABIRA | الكبائر للذهبي، الكبيرة رقم 10 — الكبيرة العاشرة الزنا
 …             (65 kabira-N rows, N ∈ 1–70 minus 4, 9, 37, 43, 64)
 kabira-31     | القاضي السوء | KABIRA | الكبائر للذهبي، الكبيرة رقم 31 — الكبيرة الحاديثة والثلاثون القاضي السوء
 kabira-70     | سب أحد من الصحابة رضوان الله عليهم | KABIRA | الكبائر للذهبي، الكبيرة رقم 70 — الكبيرة السبعون سب أحد من الصحابة رضوان الله عليهم
 kadhib        | الكذب        |        |
 namimah       | النميمة      | KABIRA | الكبائر للذهبي، الكبيرة رقم 43 — الكبيرة الثالثة والأربعون النمام
 qat-al-rahim  | قطع الرحم    | KABIRA | الكبائر للذهبي، الكبيرة رقم 9 — الكبيرة التاسعة هجر الأقارب
 riya          | الرياء       | KABIRA | الكبائر للذهبي، الكبيرة رقم 37 — الكبيرة السابعة والثلاثون الرياء
 tark-as-salah | ترك الصلاة   | KABIRA | الكبائر للذهبي، الكبيرة رقم 4 — الكبيرة الرابعة في ترك الصلاة
 test-sin-many-opposites | خطيئة اختبار المقابلات | |
(74 rows)
```

## 6. Verification (commands run, results seen)

1. **Type-check.** `cd backend && pnpm exec tsc --noEmit -p tsconfig.json` → no output, `tsc exit=0`. It covers
   `prisma/imports/**`; the file list was checked with `--listFilesOnly`.
2. **Specs.** `pnpm exec vitest run prisma/imports`:
   - harness Node 24: fails with `Cannot find module './rolldown-binding.wasi.cjs'` (native binding);
   - Node 22.19: `Test Files 7 passed (7) · Tests 59 passed (59)`.

   Fixtures are synthetic placeholder Arabic in the real markup. The spec files are `lib/{openiti,guard,
   arabic-ordinal}.spec.ts`, `shuab/parse.spec.ts`, `adab-mufrad/parse.spec.ts`, `kabair/parse.spec.ts` and
   the updated `approved-works.spec.ts`.
3. **Dry runs** (final code):

   ```
   shuab:       parsed: 10725 narrations, 77/77 branches (unlocated: none), Arabic ratio 1.0000
                numbers: missing=35 repaired=11 repeated=3550,5555,6605,9735 pageUnknown=9869,9870
   adab-mufrad: parsed: 1342 narrations, 621 chapters, missing=895 repeated=21
                albani: sahih=990 daif=214 unparsed=2; numbers confirmed by text=1170/1204; wrong-number rate=1.41% → grades APPLIED
                grades: SAHIH=745 HASAN=158 UNGRADED=234 DAIF=205
                cross-check …: agree=1100 disagree(sahih/hasan only)=5 acceptance-disputes→UNGRADED=2; in both books→UNGRADED=8
   kabair:      parsed: 69 كبيرة headings (1–70), missing=64 duplicates=0
   ```

   Each also printed 5 random records: number, volume, page and the first 120 characters.
4. **Idempotency.** Each work was run at least twice; the second run created 0 rows and the counts are
   identical.

   ```
   shuab  run1: branchesCreated=77 quotesCreated=10725 linksCreated=10639
   shuab  run2: branchesCreated=0 branchesUpdated=77 quotesCreated=0 quotesUpdated=10725 linksCreated=0 linksExisting=10639
          (runs 3–5, after parser fixes: same as run 2 — 0 created; counts 77 / 10725 / 10639 unchanged)
   kabair run1: ranked=4 sinsCreated=65          run2: ranked=4 sinsCreated=0 sinsUpdated=65   (Sin: 74 rows, 69 KABIRA)
   adab   run1: quotesCreated=1342 chapterMapsExisting=20
   adab   run2: quotesCreated=0 quotesUpdated=1342 gradeKept=1108 chapterMapsCreated=0 chapterMapsExisting=20
          grade counts identical after both runs: SAHIH 745 · HASAN 158 · DAIF 205 · UNGRADED 234; ChapterEntityMap 20
   ```

   - **Adab rows were rebuilt twice.** I found two parser defects (text after the inserted ruling block, and
     both-book conflicts), so I deleted the 1,342 Adab quotes I had created — after confirming no favourite,
     link, translation or explanation referenced them — and re-imported. The ChapterEntityMap rows from the
     first run were kept and re-found (`chapterMapsExisting=20`).
   - **SyncLog** holds one row per run. All are SUCCESS, and each summary carries the counters, corpus version,
     commit and SHA-256. `Source.lastSyncedAt` was set.
5. **Live API** (owner's running server):

   ```
   $ curl -s localhost:3001/v1/branches | head -c 600
   {"data":[{"id":"83ad25db-…","number":1,"titleAr":"الإيمان بالله عز وجل","title":null,"summaryAr":null,"summary":null,"quoteCount":0,"source":{"id":"10000000-0000-4000-8000-000000000010","name":"Al-Jami' li-Shu'ab al-Iman (al-Rushd ed.)","nameAr":"الجامع لشعب الإيمان (ط الرشد)"},"sourceReference":"ج1 ص189 — الأول من شعب الإيمان، وهو باب في الإيمان بالله عز وجل"},{"id":"5e040de7-…","number":2,"titleAr":"الإيمان برسل الله صلوات الله ع…

   $ curl -s localhost:3001/v1/branches/1
   {"data":{"id":"83ad25db-…","number":1,"titleAr":"الإيمان بالله عز وجل","title":null,"summaryAr":null,"summary":null,"quoteCount":0,"source":{…},"sourceReference":"ج1 ص189 — الأول من شعب الإيمان، وهو باب في الإيمان بالله عز وجل","explanations":[],"goodDeeds":[],"sins":[],"prev":null,"next":{"number":2,"titleAr":"الإيمان برسل الله صلوات الله عليهم عامة","title":null}}}

   $ curl -s "localhost:3001/v1/branches/1/quotes?includeWeak=true" | head -c 600
   {"data":{"branch":{"number":1,"titleAr":"الإيمان بالله عز وجل",…},"items":[{"link":{"id":"4f3579c2-…","relevanceScore":50,"note":"من الشعبة 1 في الكتاب"},"quote":{"id":"ea3096c7-…","type":"HADITH","origin":"LOCAL","textAr":"أخبرنا أبو عبد الله الحافظ، أخبرنا أبو العباس محمد بن يعقوب، ح وأخبرنا …
     meta: total 35, appliedGrades ["SAHIH","HASAN","DAIF","UNGRADED"]
     quote.hadith = {"grade":"UNGRADED","reference":"Shuab al-Iman (Rushd) 122"}, quote.citation = {"volume":"1","page":"270",…}, external = null, no rawPayload in the body

   $ curl -s localhost:3001/v1/branches/1/quotes        (default policy)
   {"data":{…,"items":[]},"meta":{…,"total":0,…,"appliedGrades":["SAHIH","HASAN"]}}

   $ curl -s localhost:3001/v1/sins | head -c 600
   {"data":[{"id":"73f19375-…","name":"A ruler deceiving and wronging his subjects","nameAr":"غش الإمام الرعية وظلمه لهم","slug":"kabira-16","category":null,…,"rank":"KABIRA","rankReference":"الكبائر للذهبي، الكبيرة رقم 16 — الكبيرة السادسة عشرة غش الإمام الرعية وظلمه لهم","rankSource":{"id":"10000000-0000-4000-8000-000000000007","name":"Al-Kabair","nameAr":"الكبائر"},"quoteCount":0,…

   $ curl -s localhost:3001/v1/quotes/<abdulbaqi:3>
   hadith {"grade":"HASAN","reference":"al-Adab al-Mufrad 3"}, citation {"page":"15","gradeAuthority":"الألباني","gradeReference":"صحيح الأدب المفرد 3"}
   ```

6. **Tree state.**
   - **Before and after.** `git diff --stat` and the full `git diff` of Cursor's tracked files were recorded
     before and after; the diff of everything outside my paths is **byte-identical**.
   - **Untracked files.** SHA-256 of all of Cursor's untracked files: **byte-identical**.
   - **My paths.** Tracked changes are only `backend/.gitignore` (+`.corpus/`), `backend/package.json`
     (+`import:book`), `backend/prisma/imports/approved-works.ts` and `approved-works.spec.ts` (+Shu'ab
     entry). New paths: `backend/prisma/imports/{lib,shuab,adab-mufrad,kabair}/`, `run.ts`, `main.ts`, and
     this report.
   - `backend/.corpus/` is git-ignored (`git check-ignore` → `backend/.gitignore:5:.corpus/`).
   - **No schema or migration change** was made; no `prisma migrate`/`db push` was run; nothing was committed.

## 7. Idempotency and curation-safety rules implemented

- **Source.** Upserted by the fixed UUIDs in `approved-works.ts`. Shu'ab was added as `…0010` /
  `book:shuab-iman`; `seed.ts` now upserts it too.
- **Quote.** Upserted on `(apiProvider, externalId)`. Re-imports write only importer-owned fields: `textAr`,
  `hadithReference`, `volume`, `page`, `rawPayload`, `sourceId`, `type`, `origin`. `narrator` is never
  written. The grade fields are written only while the row is ungraded by anyone: grade null, or UNGRADED with
  no `gradeAuthority`.
  - **Consequence to note:** once Albani grades are stored, they also count as "set", so a later re-import
    will not change them (`gradeKept`). To re-grade after correcting the mapping, clear the importer's grade
    fields first.
- **ImanBranch.** Upserted by `number`. `titleAr` and `sourceReference` are importer-owned; `title`,
  `summaryAr` and `summary` are never written.
- **ImanBranchQuote.** Upserted on `(imanBranchId, quoteId)`; the update is empty.
- **Sin.**
  - Ranks on existing sins are written only when `rank` is null or already sourced from al-Kabair.
  - New sins are upserted by `kabira-N`; the English `name` is never overwritten.
- **ChapterEntityMap.** No unique key, so the importer finds or creates on (source, chapterKey, target).
  Rows are always `reviewed = false`.

## 8. Left for the owner

1. **Grade Shu'ab narrations** with a cited grader — until then the 77 public branch pages show no
   narrations (§3.3).
2. **Review the branch titles** listed in §3.2 (4, 12, 18, 48, 69, 77; 27–29 by position) and fill `title` and
   `summaryAr`.
3. **Check Shu'ab numbering in the PDF:** ambiguous repeats 3550 and 9735; the 35 numbers with no heading; the
   11 repaired numbers.
4. **Al-Adab al-Mufrad:**
   - confirm the full-population reading of the 2% rule (§4.2);
   - decide the 39 no-ruling, 6 qualified, 1 unrecognised, 8 both-book and 2 disputed narrations;
   - decide whether mawquf/maqtu' athar should carry SAHIH/HASAN.
5. **Kabair:** confirm the two alias ranks (namimah → 43, qat-al-rahim → 9); decide kadhib (14 vs 30); review
   the 65 draft English names; note that كبيرة 64 is absent from this edition.
6. **ChapterEntityMap:** review the 20 suggestions (likely reject bab@754) and consider the near-misses
   (bab@63/64/67, 1319/1320).
7. **Toolchain:** decide how importers should run here — Prisma's engine does not load under the harness
   Node 24 (§0) — and whether to add `prisma/imports/` to the `lint` script.

## Waqfeya import

Date: 2026-10-11. Dev database `thekra` only. Nothing was committed. Node `~/.nvm/versions/node/v22.19.0` (same constraint as §0). Commands: `pnpm --filter backend import:book <targhib|riyad|zuhd|minhaj>`.

Source: Hugging Face `ieasybooks-org/waqfeya-library` (MIT), commit `6baff87f74cd3c53a6f3495d25c55b706cb55af8`. Files live in gitignored `backend/.corpus/waqfeya/`. TXT pages are split on the literal token `PAGE_SEPARATOR` (page N of the TXT is page N of the PDF). Each `rawPayload` and each SyncLog summary stores that commit and the file SHA-256. Quran spans were detected with `ieasybooks/quran-detector` 0.0.2 (`uv`, Python 3.12, `find_missing=False`, `find_errors=True`, `min_match=3`) and replaced with Uthmani text from Quran.com (a non-OCR `QURAN_VERSE` row in the DB overrides the cache). The detector's own `end_in_text` sometimes jumps to a later ayah with the next number; those spans were clamped to the first verse (13 in Riyad, 5 in Zuhd, 5 in Targhib). No OCR Quran span is stored as-is when the detector reported it.

`Quote.textSource` is `OCR` and `textVerifiedAt` is left null. The importer never writes `textVerifiedAt`. A proof on `riyad:1:1`: `textVerifiedAt` was set to `2026-10-11T12:00:00.000Z`, the second Riyad run reported `quotesCreated=0`, and the timestamp was still there. The stamp was then cleared so the row stays hidden until a reviewer marks it.

### Edition notes

- **صحيح الترغيب والترهيب.** The index row for this PDF is 3790 pages: it is the sahih set and the da'if set together. There is no index row with title صحيح الترغيب and pages=2352. The owner's 2352-page Ma'arif edition is the three sahih files plus the cover: الجزء 01-1.txt 699 + 01-2.txt 789 + 01-3.txt 863 + الواجهة.txt 1 = **2352**. The printed catalog counts (٧٠٠ + ٧٨٨ + ٨٦٤) are the same total. Da'if files `الجزء 02-*` were not imported. The number before the dash is the book number (it runs into the 3000s); the parenthetical number resets inside the chapter. `gradeReference` is `صحيح الترغيب <N>` using the book number. Grade authority is الألباني, and only from his ruling word (صحيح / حسن / صحيح لغيره / حسن لغيره, including the abbreviations ص لغيره and ح لغيره). A margin word glued into the matn is removed; Arabic words are not guessed.
- **رياض الصالحين.** Index row 680 pages, Halabi edition, one file. Grade is SAHIH only for متفق عليه (this edition also writes متفق على صحته, folded to the same phrase), رواه البخاري, or رواه مسلم. Authority الصحيحان. `gradeReference` is `رياض الصالحين <N> — <takhrij line>`. Everything else stays UNGRADED. No margin حسن/صحيح is applied.
- **الزهد والرقائق.** 1248 pages, Dar al-Mi'raj, one file (the index says 2 volumes; the TXT is one file and only «المجلد الأول» appears). Narrations are UNGRADED. No chapter maps.
- **مختصر منهاج القاصدين.** 488 pages. Source row only. Zero quotes.
- **ما لا يسع المسلم جهله was not imported.** This commit of `index.tsv` has no row with that title, and no المصلح edition of 300 pages. The owner's 338-page PDF is a different edition from anything in this index. A nearby title, أصول الفقه الذي لا يسع الفقيه جهله (500 pages), is a different book and was left alone.

### Counts

| Work | Pages | Quotes created (first run) | Second run `quotesCreated` | Grades | Chapter maps (`reviewed=false`) | Detector spans / ayahs | Quotes with `verseKeys` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| صحيح الترغيب والترهيب | 699+789+863+cover 1 = 2352 | 2849 | 0 | SAHIH 1649, HASAN 561, UNGRADED 639 | 133 | 1185 / 810 | 436 |
| رياض الصالحين | 680 | 1873 | 0 | SAHIH 1424, UNGRADED 449 | 29 | 898 / 789 | 317 |
| الزهد والرقائق | 1248 | 1136 | 0 | UNGRADED 1136 | 0 | 680 / 551 | 237 |
| مختصر منهاج القاصدين | 488 | 0 | 0 | — | 0 | not run (no quotes) | 0 |

Targhib grade tokens in `rawPayload.gradeToken`: صحيح 1315, صحيح لغيره 334, حسن 316, حسن لغيره 245, none 639. Riyad: متفق عليه 705, رواه مسلم 505, رواه البخاري 214, none 449. Arabic-letter ratio: Targhib 0.9997, Riyad 0.9993, Zuhd 0.9996. A second run still writes a SyncLog row and `quotesUpdated` (the upsert refreshes importer-owned fields). `gradeKept` on the second run equals the rows that already had a grade. Chapter-map rows are not reset.

SHA-256, commit `6baff87f74cd3c53a6f3495d25c55b706cb55af8`:

```
riyad   bab8240a40c7aa2c8273fe7bc5ddda16f911128916e76ba801fceb3f46c7b1f2
zuhd    2c10e61473a3058b3e2aa2edc8c33eff42b4d15d533d02805450e13b1ab80631
minhaj  1a06635b5a8ae22e8cc2f1d303f106cf1b21d7a75eda9e9efc96d2ae14f3e750
targhib 01-1 7711f50b32d40f100c06e9248ab048ba9b205ac525e26ef177b17cbd3c30887d
targhib 01-2 9066e037879fafec38f78021fa937ac65354f7f220c7d89d7e3deae883842185
targhib 01-3 4c820935f3cb98baa972beae147cbb47ca2d85ad7e95015331742c6177f0cbda
targhib cover 72614d9d5eb9ae6a487991dc5c610c93507e6757f049bf510ea9528ec37a35f2
```

### Real importer output

صحيح الترغيب. The first run created the 2849 rows (`quotesCreated=2849`, chapter maps 133). A following run, after margin abbreviations glued into the matn were stripped, updated those rows in place (`quotesCreated=0`, `gradeKept=2061` on the grades already stored). The run after that is the idempotency check. Stored grades below are from that cleaned text.

```
pages: 699+789+863+cover 1 = 2352
quran-detector clamped 5 non-contiguous spans
quran-detector: spans=1185 ayahs=810
parsed: 2849 narrations, 991 chapters
Arabic ratio 0.9997 low=0
grades: SAHIH=1649 UNGRADED=639 HASAN=561
quotesCreated=0 quotesUpdated=2849 gradeKept=2210 chapterMapsCreated=0 chapterMapsExisting=133
```

رياض الصالحين:

```
pages: 680
quran-detector clamped 13 non-contiguous spans
quran-detector: spans=898 ayahs=789
parsed: 1873 narrations, 470 chapters
Arabic ratio 0.9993 low=0
grades: SAHIH=1424 UNGRADED=449
quotesCreated=1873 quotesUpdated=0 gradeKept=0 chapterMapsCreated=29 chapterMapsExisting=0
quotesCreated=0 quotesUpdated=1873 gradeKept=1424 chapterMapsCreated=0 chapterMapsExisting=29
```

الزهد والرقائق:

```
pages: 1248
quran-detector clamped 5 non-contiguous spans
quran-detector: spans=680 ayahs=551
parsed: 1136 narrations, chapters=0 (no links)
Arabic ratio 0.9996 low=0
grades: UNGRADED=1136
quotesCreated=1136 quotesUpdated=0 gradeKept=0 chapterMapsCreated=0 chapterMapsExisting=0
quotesCreated=0 quotesUpdated=1136 gradeKept=0 chapterMapsCreated=0 chapterMapsExisting=0
```

مختصر منهاج القاصدين (both runs):

```
pages: 488; quotes: 0 (prose, source record only)
quotesCreated=0 pages=488
```

The SyncLog `errorMessage` lines are the same strings with `corpus=…@6baff87f74cd3c53a6f3495d25c55b706cb55af8 sha256=…` appended. Full hashes are in the table above.

### Ten OCR samples (seeded; open the same PDF page)

صحيح الترغيب والترهيب:

```
ج2 ص549 #2258 UNGRADED | ٢٢٥٨ - (٨) وعن أبي سعيد الخدري رضي الله عنه قال : قام رسول الله على بيت فيه نَفرٌ مِنْ قريش ، فأخذ بَعَضَادَتي الباب هل في البيت إلا قرشي ؟ » . فقالوا : لا ، إل
ج3 ص171 #3045 SAHIH | ٣٠٤٥ - (٦) وعن أبي الدرداء رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : « لَنْ ينال الدرجاتِ العُلى مَنْ تَكَهَنَ ، أَوِ اسْتَقْسَم ، أو رَجَعَ مِنْ سَ
ج1 ص459 #747 UNGRADED | ٧٤٧ - (١١) وعن أبي أيوب رضي الله عنه : أن رجلاً قال للنبي : أخبرني بعمل يدخلني الجنة . قال : تعبد الله لا تشرك به شيئاً ، وتقيم الصلاة ، وتؤتي الزكاةَ ، وتَصلُ
ج3 ص331 #3408 SAHIH | ٣٤٠٨ - (۱٥) وعن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : إنَّ الرجُلَ ليكون له عند الله المنزِلَةُ ، فما يَبْلُعْهَا بِعَمَلٍ ، فَمَا يَز
ج1 ص157 #114 SAHIH | ١١٤ - (٣) ورُوي عن أبي أمامة رضي الله عنه (۱) قال : سمعت رسول الله صلى الله عليه وسلم أربعة تجري عليهم أجورهم بعد الموت : رجلٌ مات مرابطاً في سبيل الله ، ورجلٌ
ج2 ص605 #2382 SAHIH | ۲۳۸۲ - (۲۸) وعن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : إذا سَكِرَ فَاجْلِدُوهُ ، ثُمَّ إذا سَكِرَ فاجلِدوهُ ، ثُمَّ إِذا سَكِرَ فَاجْلِ
ج3 ص28 #2709 SAHIH | ۲۷۰۹ - (۱۷) وعن معاوية بن قرة عن أبيه رضي الله عنه قال : يا بني ! إذا كنت في مجلس ترجو خَيْرَهُ فَعجِلَتْ بكَ حاجَةٌ ؛ فقُلْ : السلامُ عليكُمْ ؛ فإنَّك شريكهم ف
ج3 ص36 #2729 SAHIH | ۲۷۲۹ - (٣) وعن أنس رضي الله عنه : أنَّ رجلاً اطَّلَع من بعض حُجَر النبي ، فقام إليه النبي بِمشْقَص أو بمشاقص ، فكأنّي أنْظُر إليه يَخْتِلُ الرجلَ لِيَطْعَنَهُ ر
ج1 ص336 #507 SAHIH | ٥٠٧ - (۷) وعن البراء بن عازب رضي الله عنه قال : وكان رسول الله يقول : « إِنَّ ٱللَّهَ وَمَلَـٰٓئِكَتَهُۥ يُصَلُّونَ عَلَى ٱلنَّبِىِّ ۚ يَـٰٓأَيُّهَا ٱلَّذِينَ ء
ج1 ص331 #492 UNGRADED | ٤٩٢ - (٥) وعن النعمان بن بشير رضي الله عنه قال : سمعت رسول الله الله إن الله وملائكته يُصلّون على الصف الأوَّل ، أو الصفوف الأولى (۱) ) . رواه أحمد بإسناد جيد .
```

رياض الصالحين:

```
ج1 ص370 #975 UNGRADED | ۹۷۵ - وَعَنْ أَنَسٍ الله ، قَالَ : كُنَّا إِذَا نَزَلْنَا مَنْزِلًا؛ لا نُسَبِّحُ حَتَّى نَحُلَّ الرِّحَالَ * رَوَاهُ أَبُو دَاوُدَ [٢٥٥١] بِإِسْنَادِ عَلَى شَر
ج1 ص606 #1868 SAHIH | ١٨٦٨ - وَعَنْ عَوْفِ بْنِ مَالِكِ بْنِ الطُّفَيْلِ ، أَنَّ عَائِشَةَ مَا حُدِّثَتْ أَنَّ عَبْدَ اللَّهِ بْنِ الزُّبَيْرِ لال ، قَالَ فِي بَيْعِ، أَوْ عَطَاءٍ أَ
ج1 ص261 #584 UNGRADED | ٥٨٤ - وَعَنْهُ، قَالَ: قَالَ رَسُولُ اللَّهِ صلى الله عليه وسلم: «أَكْثِرُوا ذِكْرَ هَاذِمِ اللَّذَّاتِ ؛ يَعْنِي : المَوْتَ. رَوَاهُ التَّرْمِذِيُّ [۲۳۰۸]، وَق
ج1 ص523 #1569 SAHIH | ١٥٦٩ - وَعَنْ أَبِي هُرَيْرَةَ الله ، أَنَّ رَسُولَ اللَّهِ صلى الله عليه وسلم قَالَ: «المُتَسَابَّانِ - مَا قالا - ؛ فَعَلَى البَادِي مِنْهُمَا ، حَتَّى يَعْتَ
ج1 ص421 #1312 SAHIH | ۱۳۱۲ - وَعَنْ عَائِشَةَ ، قَالَتْ: قَالَ رَسُولُ اللَّهِ صلى الله عليه وسلم: «عَشْرٌ مِنَ الفِطْرَةِ : قَصُّ الشَّارِبِ، وَإِعْفَاءُ اللَّحْيَةِ، وَالسِّوَاكُ،
ج1 ص315 #767 SAHIH | ٧٦٧ - وَعَنْ أَبِي هُرَيْرَةَ الله ، قَالَ : نَهَى رَسُولُ اللَّهِ صلى الله عليه وسلم أَنْ يُشْرَبَ مِنْ فِي السِّقاءِ أَوِ القِرْبَةِ مُتَّفَقٌ عَلَيْهِ [البُخ
ج1 ص535 #1608 SAHIH | ١٦٠٨ - وَعَنْهُ ، أَنَّهُ مَرَّ بِفِتْيَانٍ مِنْ قُرَيشٍ، قَدْ نَصَبُوا طَيْراً وَهُمْ يَرْمُونَهُ، وَقَدْ جَعَلُوا لِصَاحِبِ الطَّيْرِ كُلَّ خَاطِئَةٍ مِنْ نَب
ج1 ص459 #1369 SAHIH | ١٣٦٩ - وَعَنْ أَبِي هُرَيْرَةَ لله ، عَنِ النَّبِيِّ ، قَالَ: «إِذَا أَتَى أَحَدَكُمْ خَادِمُهُ بِطَعَامِهِ، فَإِنْ لَمْ يُجْلِسْهُ مَعَهُ ؛ فَلْيُنَاوِلْهُ لُق
ج1 ص492 #1492 UNGRADED | ١٤٩٢ - وَعَنْ أَنَسٍ له ، أَنَّ النَّبِيَّ صلى الله عليه وسلم كَانَ يَقُولُ: «اللَّهُمَّ! إِنِّي أَعُوذُ بِكَ مِنَ البَرَصِ ، وَالجُنُونِ ، والجُذَامِ، وَسَيِّن
ج1 ص275 #642 SAHIH | ٦٤٢ - وَعَنْ أَنَسٍ الله ، عَنِ النَّبِيِّ لا الله ، قَالَ: «يَسِّرُوا وَلَا تُعَدِّرُوا ، وَبَشِّرُوا وَلا تُنَفِّرُوا مُتَّفَقٌ عَلَيْهِ البُخَارِيُّ (٦٩)، وَ
```

الزهد والرقائق:

```
ج1 ص306 #302 UNGRADED | ( ۳۰۲ ( أخبرنا مالك بن مغول قال : سمعت أبا ربيعة يحدث عن الحسن قال : قال رسول الله صلى الله عليه وسلم: كلكم يحب أن يدخل الجنة ؟ قالوا : نعم يا رسول الله . قال :
ج1 ص581 #692 UNGRADED | ( ٦٩٢ ) أخبرنا سفيان عن سليمان يعنى الأعمش عن أصحابه قال : قال عبد الله بن مسعود : ( لو سخرت من كلب لخشيت أن أكون كلبا ، وإني أكره أن أرى الرجل فارغا ليس في عمل
ج1 ص159 #75 UNGRADED | ( ٧٥ ) أخبرنا عبد العزيز ابن أبى رواد عن الضحاك قال : أحد من تعلم القرآن ثم نسيه إلا بذنب يحدثه وذلك بأن الله تعالى يقول ( وَمَآ أَصَـٰبَكُم مِّن مُّصِيبَةٍ فَ
ج1 ص495 #566 UNGRADED | ( ٥٦٦ ( أخبرنا المفضل بن لاحق عن أبي بكر بن حفص قال : ) كان ابن عمر لا يحبس عن طعامه بين مكة والمدينة مجذوما ، ولا ( ٥٦٥ ) موقوف بسند حسن سفيان ( ٣٥٨ ) . عاصم ب
ج1 ص620 #758 UNGRADED | ( ٧٥٨ ) أخبرنا مسعر عن قتادة عن أنس ( أنه جمع أهله يعنى عند الختم )
ج1 ص418 #461 UNGRADED | ) ٤٦١ ( أخبرنا سفيان بن عيينة عن حصين بن عبد الرحمن عن سالم بن أبي الجعد : ( أن عمر بن كان الله الخطاب رضى عنه استعمل النعمان بن مقرن على كسكر فكتب إليه يناشده
ج1 ص320 #324 UNGRADED | ( ٣٢٤ ) أخبرنا الأوزاعى قال : حدثنا عطاء الخراساني قال : ( ما من عبد يسجد سجدة في بقعة من بقاع الأرض إلا شهدت له بها يوم القيامة وبكت عليه يوم يموت ) .
ج1 ص423 #465 UNGRADED | ( ٤٦٥ ( أخبرنا ابن لهيعة حدثنى يزيد بن أبي حبيب أن أبا حدثه أن عقبة بن عامر حدثهم أن رسول الله صلى على قتلى أحد بعد ثماني سنين كالمودّع للأحياء والأموات ، ثم طل
ج1 ص261 #229 UNGRADED | ) ٢٢٩ ( أخبرنا يحيى بن أيوب عن عمارة بن غزية عن محمد ابن عبد الله بن عمرو بن عثمان عن أمه فاطمة بنت حسين عن معمر ( ۹۱۷ ) . قتادة ( ۷۸۹ ) . أبو عبيدة بن الجراح (
ج1 ص685 #860 UNGRADED | ( ٨٦٠ ( أخبرنا إسماعيل بن أبي خالد عن زبيد أن أبا بكر قال لعمر بن الخطاب : ( إني موصيك بوصية إن حفظتها ، إن له تعالى حقا بالنهار لا يقبله بالليل ، ولله في الليل
```

Sample #507 shows a replaced verse (33:56, Uthmani). Sample #75 likewise. Sample #492 is a hadith about the front row, not that verse, so it was left as OCR.

### Chapter-map suggestions

Exact normalised-name matches were written (`reviewed = false`). Near-misses are printed and not written. A near-miss needs a distinctive shared stem (length ≥ 4, not a word such as الله / رسول / أمر); a long sin name needs two such stems. OCR repeats the same chapter title, so several rows point at one entity.

رياض الصالحين — `chapter-maps: created=29 existing=0 matches=29 near-misses=124` on the first run.

```
MATCH GOOD_DEED الإخلاص ← ۱ - بَابُ الإِخْلاصِ وَإِحْضَارِ النِّيَّةِ فِي جَمِيعِ الأَعْمَالِ وَالأقْوَالِ وَالأحْوَالِ ؛ البَارِزَةِ وَالخَفِيَّةِ
MATCH GOOD_DEED الإخلاص ← بَابُ الإخلاص
MATCH SIN الظلم ← بَابُ تَحْرِيم الظُّلْم وَالأَمْرِ بِرَدُ المَظَالم
MATCH SIN الظلم ← بَاب تَحْرِيمِ الظُّلْمِ، وَالْأَمْرِ بِرَدُ المَظَالَم
MATCH GOOD_DEED بر الوالدين ← ٤٠ - بَابُ بِرِّ الوَالِدَيْنِ، وَصِلَةِ الأَرْحَامِ
MATCH SIN الكبر ← بَابُ تَحْرِيم الكِبْرِ، وَالإِعْجَابِ
MATCH SIN الغضب ← بَابُ الغَضَبِ إِذَا انْتُهِكَتْ حُرُمَاتُ الشَّرْع ، وَالانْتِصَارِ لِدِينِ اللَّهِ - تَعَالَى -
MATCH SIN الغضب ← ۷۷ - بَابُ الغَضَبِ إِذَا انْتُهِكَتْ حُرُمَاتُ الشَّرْعِ، وَالانْتِصَارِ لِدِينِ اللَّهِ - تَعَالَى -
MATCH SIN الغضب ← بَابُ الغَضَبِ إِذَا انْتُهِكَتْ حُرُمَاتُ الشَّع ، وَالانْتِصَارِ لِدِينِ اللَّهِ - تَعَالَى -
MATCH GOOD_DEED الصدقة ← ١٦٢ - بَابُ الصَّدَقَةِ عَنِ المَيِّتِ، وَالدُّعَاءِ لَهُ
MATCH GOOD_DEED صلاة الجماعة ← ۱۹۱ - بَابُ فَضْل صَلاةِ الجَمَاعَةِ
MATCH GOOD_DEED الذكر ← ٢٤٤ - بَابُ فَضْل الذِّكْرِ وَالحَثَّ عَلَيْهِ
MATCH GOOD_DEED الذكر ← بَابُ فَضْلِ حِلَقِ الذِّكْرِ
MATCH GOOD_DEED الذكر ← ٢٤٨ - بَابُ الذِّكْرِ عِنْدَ الصَّبَاحَ وَالمَسَاءِ
MATCH GOOD_DEED الذكر ← بَابُ الذِّكْرِ عِنْدَ الصَّبَاحَ وَالمَسَاءِ
MATCH SIN الغيبة ← بَابُ تَحْرِيم الغَيْبَةِ، وَالأمْرِ بحِفْظِ اللَّسَانِ
MATCH SIN الغيبة ← بَابُ تَحْرِيم سَمَاعِ الغيبة
MATCH SIN الغيبة ← ٢٥٥ - بَابُ تَحْرِيم سَمَاع الغِيبَةِ، وَأَمْرِ مَنْ سَمِعَ غِيبَةٌ مُحَرَّمَةَ بِرَدْهَا وَالإِنْكَارِ عَلَى قَائِلِهَا ؛ فَإِنْ عَجَزَ أَوْ لَمْ يَقْبَلْ مِنْهُ فَارَقَ المَجْلِسَ - إِنْ أَمْكَنَهُ
MATCH SIN الغيبة ← بَابُ بَيَانِ مَا يُبَاحُ مِنَ الغِيبَةِ
MATCH SIN النميمة ← بَابُ تَحْرِيمِ النَّمِيمَةِ
MATCH SIN النميمة ← ٢٥٧ ـ بَابُ تَحْرِيمِ النَّمِيمَةِ - وَهِيَ نَقُلُ الكَلَامِ بَيْن النَّاسِ عَلَى جِهَةِ الإِفْسَادِ
MATCH SIN الكذب ← بَابُ تَحْرِيمِ الكَذِبِ
MATCH SIN الكذب ← ٢٦٠ ـ بَابُ تَحْرِيمِ الكَذِبِ
MATCH SIN الحسد ← ۲۷۰ - بَابُ تَحْرِيمِ الحَسَدِ - وَهُوَ تَمَنِّي زَوَالِ النِّعْمَةِ عَنْ صَاحِبِهَا ؛ سَوَاءٌ كَانَتْ نِعْمَةَ دِينٍ أَوْ دُنْيَا
MATCH SIN الربا ← بَابُ تَغْلِيظِ تَحْرِيمِ الرِّبَا
MATCH SIN الربا ← ۲۸۷ - بَابُ تَغْلِيظِ تَحْرِيمِ الرِّبَا
MATCH SIN الرياء ← ۲۸۸ - بَابُ تَحْرِيمِ الرِّيَاءِ
MATCH SIN السحر ← بَابُ التَّعْلِيطِ فِي تَحْرِيمِ السِّحْرِ بَابُ النَّهْي عَنِ المُسَافِرَةِ بِالمُصْحَفِ إِلَى بِلادِ الكُفَّارِ
MATCH SIN السحر ← ٣٦٢ - بَابُ التَّغْلِيظِ فِي تَحْرِيمِ السِّحْرِ
NEAR SIN أذى المسلمين وشتمهم ← بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ ،حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذية عباد الله والتطول عليهم ← بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ ،حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذى المسلمين وشتمهم ← ۲۷ - بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذية عباد الله والتطول عليهم ← ۲۷ - بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذى المسلمين وشتمهم ← بَابُ تَعْظِيمِ حُرُمَاتِ المُسْلِمِينَ ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذية عباد الله والتطول عليهم ← بَابُ تَعْظِيمِ حُرُمَاتِ المُسْلِمِينَ ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذى المسلمين وشتمهم ← بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذية عباد الله والتطول عليهم ← بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ، وَرَحْمَتِهِمْ
NEAR SIN أذى المسلمين وشتمهم ← بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ ، وَرَ.
NEAR SIN أذية عباد الله والتطول عليهم ← بَابُ تَعْظِيم حُرُمَاتِ المُسْلِمِينَ، وَبَيَانِ حُقُوقِهِمْ، وَالشَّفَقَةِ عَلَيْهِمْ ، وَرَ.
NEAR SIN أذى المسلمين وشتمهم ← بَابُ سَتْرِ عَوْرَاتِ المُسْلِمِينَ، وَالنَّهْي عَنْ إِشَاعَتِهَا - لِغَيْرِ ضَرُورَةِ -
NEAR SIN الذبح لغير الله عز وجل ← بَابُ سَتْرِ عَوْرَاتِ المُسْلِمِينَ، وَالنَّهْي عَنْ إِشَاعَتِهَا - لِغَيْرِ ضَرُورَةِ -
NEAR SIN أذى المسلمين وشتمهم ← ۲۸ - بَابُ سَتْرِ عَوْرَاتِ المُسْلِمِينَ، وَالنَّهْيِ عَنْ إِشَاعَتِهَا - لِغَيْرِ ضَرُورَةٍ -
NEAR SIN الذبح لغير الله عز وجل ← ۲۸ - بَابُ سَتْرِ عَوْرَاتِ المُسْلِمِينَ، وَالنَّهْيِ عَنْ إِشَاعَتِهَا - لِغَيْرِ ضَرُورَةٍ -
NEAR SIN أذى المسلمين وشتمهم ← بَابُ قَضَاءِ حَوَائِجِ المُسْلِمِينَ
NEAR SIN أذى المسلمين وشتمهم ← ۲۹ - بَابُ قَضَاءِ حَوَائِجِ المُسْلِمِينَ
NEAR SIN أذى المسلمين وشتمهم ← بَابُ فَضْل ضَعَفَةِ المُسْلِمِينَ وَالفُقَرَاءِ وَالخَامِلِينَ
NEAR SIN أكل مال اليتيم وظلمه ← ۳۳ - بَابُ مُلاطَفَةِ اليَتِيم، وَالبَنَاتِ، وَسَائِرِ الضَّعَفَةِ وَالمَسَاكِينَ، وَالتَّوَاضُعِ مَعَهُمْ
NEAR SIN أكل مال اليتيم وظلمه ← بَابُ مُلاطَفَةِ اليَتِيم ، وَالبَنَاتِ، وَسَائِرِ الضَّعَفَةِ
NEAR SIN الإضرار في الوصية ← بَابُ الوَصِيَّةِ بِالنِّسَاءِ
NEAR SIN الإضرار في الوصية ← ٣٤ - بَابُ الوَصِيَّةِ بِالنِّسَاءِ
NEAR SIN نشوز المرأة على زوجها ← بَابُ حَقُّ الزَّوْجِ عَلَى الْمَرْأَةِ
NEAR SIN نشوز المرأة على زوجها ← ٣٥ - بَابُ حَقِّ الزَّوْجِ عَلَى الْمَرْأَةِ
NEAR SIN الإضرار في الوصية ← ۳۹ - بَابُ حَقٌّ الجَارِ، وَالوَصِيَّةِ بِهِ
NEAR SIN عقوق الوالدين ← ٤٠ - بَابُ بِرِّ الوَالِدَيْنِ، وَصِلَةِ الأَرْحَامِ
NEAR SIN عقوق الوالدين ← باب تحريم العُقوقِ وقَطِيعَةِ الرَّحِم
NEAR SIN عقوق الوالدين ← باب تخريم العُقوقِ وقَطِيعَةِ الرَّحِم
NEAR SIN الشرك بالله ← بَابُ الكَرَم وَالجُودِ، وَالإنْفَاقِ فِي وُجُوهِ الخَيْرِ، ثِقَةَ بِاللَّهِ - تَعَالَى .
NEAR SIN الشرك بالله ← بَابُ الكَرَم وَالجُودِ، وَالإنْفَاقِ فِي وُجُوهِ الخَيْرِ، ثِقَةَ بِاللَّهِ - تَعَالَى
NEAR SIN الشرك بالله ← بَابُ الكَرَمِ وَالجُودِ، وَالإنْفَاقِ فِي وُجُوهِ الخَيْرِ، ثِقَةَ بِاللَّهِ - تَعَالَى -
NEAR SIN لبس الحرير والذهب للرجال ← بَابُ اسْتِحْبَابِ زِيَارَةِ القُبُورِ لِلرِّجَالِ، وَمَا يَقَوْلُهُ الزَّائِرُ
NEAR SIN لبس الحرير والذهب للرجال ← ٦٦ - بَابُ اسْتِحْبَاب زِيَارَةِ القُبُورِ لِلرِّجَالِ (۳) ،
NEAR SIN أذية عباد الله والتطول عليهم ← ۷۸ - بَابُ أَمْرِ وَلاةِ الأُمُورِ بِالرِّفْقِ بِرَعَايَاهُمْ وَنَصِيحَتِهِمْ وَالشَّفَقَةِ عَلَيْهِمْ وَالنَّهْي عَنْ عِشْهِمْ وَالتَّشْدِيدِ عَلَيْهِمْ وَإِهْمَالِ مَصَالِحِهِمْ وَالغَفْلَةِ عَنْهُمْ
NEAR SIN الغدر وعدم الوفاء بالعهد ← ٨٦ ـ بَابُ الوَفَاءِ بِالعَهْدِ، وَإِنْجَازِ الوَعْدِ -
NEAR SIN ترك الصلاة ← بَابُ الوَقَارِ وَالسَّكِينَةِ - بَابُ النَّدْبِ إِلَى إِثْيَانِ الصَّلاةِ وَالعِلْمِ
NEAR GOOD_DEED صلاة الجماعة ← بَابُ الوَقَارِ وَالسَّكِينَةِ - بَابُ النَّدْبِ إِلَى إِثْيَانِ الصَّلاةِ وَالعِلْمِ
NEAR SIN ترك الصلاة ← ۹۳ - بَابُ النَّدْبِ إِلَى إِثْيَانِ الصَّلَاةِ وَالعِلْمِ - وَنَحْوِهِمَا مِنَ العِبَادَاتِ ـ بِالسَّكِينَةِ وَالوَقَارِ
NEAR GOOD_DEED صلاة الجماعة ← ۹۳ - بَابُ النَّدْبِ إِلَى إِثْيَانِ الصَّلَاةِ وَالعِلْمِ - وَنَحْوِهِمَا مِنَ العِبَادَاتِ ـ بِالسَّكِينَةِ وَالوَقَارِ
NEAR SIN قطع الطريق ← ۹۸ - بَابُ اسْتِحْبَابِ الذَّهَابِ إِلَى العِيدِ، وَعِيَادَةِ المَرِيضِ ) ، وَالحَجِّ - وَنَحْوِهَا ـ مِنْ طَرِيقِ، وَالرُّجُوعِ مِنْ طَرِيقِ آخَرَ ؛ لِتَكْثِيرِ مَوَاضِع العِبَادَةِ
NEAR SIN اليمين الغموس ← بَابُ اسْتِحْبَابِ تَقْدِيمِ الْيَمِينِ فِي كُلِّ مَا هُوَ مِنْ بَابِ
NEAR SIN اليمين الغموس ← بَابُ اسْتِحْبَابِ تَقْدِيمِ اليَمِينِ فِي كُلِّ مَا هُوَ مِنْ بَابِ التَّكْرِيمِ
NEAR GOOD_DEED صلاة الجماعة ← ١٠٥ - بَابُ النَّهْيِ عِنِ القِرَانِ بَيْنَ تَمْرَتَيْنِ - وَنَحْوِهِمَا - إِذَا أَكَلَ فِي جَمَاعَةٍ ؛ إِلَّا بِإِذْنِ رُفْقَتِهِ
NEAR SIN لبس الحرير والذهب للرجال ← ۱۱۷ - بَابُ اسْتِحْبَابِ الثَّوْبِ الأَبْيَضِ، وَجَوَازِ الْأَحْمَرِ وَالأَخْضَرِ وَالأصْفَرِ وَالأسْوَدِ، وَجَوَازِهِ مِنْ قُطْنِ وَكَتَّانِ وَشَعْرِ وَصُوفِ وَغَيْرِهَا؛ إِلَّا الحَرِيرَ
NEAR SIN لبس الحرير والذهب للرجال ← بَابُ اسْتِحْبَابِ التَّوَسُطِ فِي اللُّبَاسِ - بَابُ تَحْرِيمِ لِبَاسِ الحَرِيرَ عَلَى الرِّجَالِ
NEAR SIN الذبح لغير الله عز وجل ← ۱۲۱ - بَابُ اسْتِحْبَابِ التَّوَسُطِ فِي اللُّبَاسِ، وَلَا يَقْتَصِرُ عَلَى مَا يُزْرِي بِهِ لِغَيْرِ حَاجَةٍ وَلَا مَقْصُودٍ شَرْعِيٌّ
NEAR SIN لبس الحرير والذهب للرجال ← ۱۲۲ - بَابُ تَحْرِيمِ لِبَاسِ الحَرِيرِ عَلَى الرِّجَالِ، وَتَحْرِيمِ جُلُوسِهِمْ عَلَيْهِ وَاسْتِنَادِهِمْ إِلَيْهِ، وَجَوَازِ لُبْسِهِ لِلنِّسَاءِ
NEAR SIN لبس الحرير والذهب للرجال ← بَابُ جَوَازِ لُبْسِ الحَرِيرِ لِمَنْ بِهِ حِكَةُ - بَابُ النَّهِي عَنِ افْتِرَاشِ جُلُودِ النَمُورِ
NEAR SIN لبس الحرير والذهب للرجال ← ۱۲۳ - بَابُ جَوَازِ لُبْسِ الحَرِيرِ لِمَنْ بِهِ حِكَةٌ
NEAR SIN أذية عباد الله والتطول عليهم ← ۱۳۸ - بَابُ تَحْرِيمِ ابْتِدَائِنَا الكَافِرَ بِالسَّلامِ، وَكَيْفِيَّةِ الرَّدِّ عَلَيْهِمْ، وَاسْتِحْبَابِ السَّلام عَلَى أَهْلِ مَجْلِسٍ فِيهِمْ مُسْلِمُونَ وَكُفَّارٌ
NEAR SIN أن يقتل الإنسان نفسه ← ١٤١ - بَابُ بَيَانِ أَنَّ السُّنَّةَ إِذَا قِيلَ لِلْمُسْتَأْذِنِ : مَنْ أَنْتَ؟ أَنْ يَقُولَ : فُلانٌ، فَيُسَمِّيَ نَفْسَهُ بِمَا يُعْرَفُ بِهِ مِنِ اسْمِ أَوْ كُنْيَةٍ، وَكَرَاهَةِ قَوْلِهِ : أَنَا، وَنَحْوُهَا
NEAR SIN الإضرار في الوصية ← بَابُ اسْتِحْبَاب وَصِيَّةِ أهْل المَريض - بَابُ جَوَانِ قَوْلِ المَريض : أنا وَجِعٌ
NEAR SIN الإضرار في الوصية ← ١٤٨ - بَابُ اسْتِحْبَابِ وَصِيَّةِ أهْلِ الْمَرِيضِ وَمَنْ يَخْدُمُهُ بِالإِحْسَانِ إِلَيْهِ وَاحْتِمَالِهِ ، وَالصَّبْرِ عَلَى مَا يَشُقُّ مِنْ أَمْرِهِ، وَكَذَا بِالوَصِيَّةِ بِمَنْ قَرُبَ سَبَبُ مَوْتِهِ بِحَدٌ أَوَ قِصَاصِ
NEAR SIN ترك الصلاة ← بَابُ الكَفِّ عَمَّا يُرَى فِي المَيِّتِ مِنْ مَكْرُوهِ - بَابُ الصَّلَاةِ عَلَى الْمَيِّتِ وَتَشْيِيعِهِ
NEAR GOOD_DEED صلاة الجماعة ← بَابُ الكَفِّ عَمَّا يُرَى فِي المَيِّتِ مِنْ مَكْرُوهِ - بَابُ الصَّلَاةِ عَلَى الْمَيِّتِ وَتَشْيِيعِهِ
NEAR SIN ترك الصلاة ← ١٥٥ - بَابُ الصَّلاةِ عَلَى المَيِّتِ وَتَشْيِيعِهِ وَحُضُورِ دَفْنِهِ، وَكَرَاهَةِ اتَّبَاعِ النِّسَاءِ الجَنَائِزَ
NEAR GOOD_DEED صلاة الجماعة ← ١٥٥ - بَابُ الصَّلاةِ عَلَى المَيِّتِ وَتَشْيِيعِهِ وَحُضُورِ دَفْنِهِ، وَكَرَاهَةِ اتَّبَاعِ النِّسَاءِ الجَنَائِزَ
NEAR SIN ترك الصلاة ← بَابُ مَا يُقْرَأُ فِي صَلَاةِ الجَنَازَةِ
NEAR GOOD_DEED صلاة الجماعة ← بَابُ مَا يُقْرَأُ فِي صَلَاةِ الجَنَازَةِ
NEAR SIN الذبح لغير الله عز وجل ← ١٧٦ - بَابُ اسْتِحْبَابِ القُدُومِ عَلَى أَهْلِهِ نَهَاراً، وَكَرَاهَتِهِ فِي اللَّيْلِ لِغَيْرِ حَاجَةٍ
NEAR SIN نشوز المرأة على زوجها ← ۱۷۹ - بَابُ تَحْرِيمِ سَفَرِ المَرْأَةِ وَحْدَهَا
NEAR SIN ترك الصلاة ← بَابُ فَضْلُ صَلاةِ الصُّبْحِ وَالعَصْرِ
NEAR GOOD_DEED صلاة الجماعة ← بَابُ فَضْلُ صَلاةِ الصُّبْحِ وَالعَصْرِ
NEAR SIN ترك الصلاة ← ۱۸۸ - بَابُ فَضْل صَلاةِ الصُّبْحِ وَالعَصْرِ
NEAR GOOD_DEED صلاة الجماعة ← ۱۸۸ - بَابُ فَضْل صَلاةِ الصُّبْحِ وَالعَصْرِ
NEAR SIN ترك الصلاة ← بَابُ فَضْلِ انْتِظَارِ الصَّلَاةِ
NEAR GOOD_DEED صلاة الجماعة ← بَابُ فَضْلِ انْتِظَارِ الصَّلَاةِ
NEAR SIN ترك الصلاة ← ۱۹۰ - بَابُ فَضْلِ انْتِظَارِ الصَّلاةِ
NEAR GOOD_DEED صلاة الجماعة ← ۱۹۰ - بَابُ فَضْلِ انْتِظَارِ الصَّلاةِ
NEAR SIN ترك الصلاة ← ۱۹۱ - بَابُ فَضْل صَلاةِ الجَمَاعَةِ
NEAR SIN الإصرار على ترك صلاة الجمعة والجماعة من غير عذر ← ۱۹۱ - بَابُ فَضْل صَلاةِ الجَمَاعَةِ
NEAR GOOD_DEED صلاة الجماعة ← بَابُ الحَثُ عَلَى حُضُورِ الجَمَاعَةِ فِي الصُّبْحِ وَالعِشَاءِ
NEAR GOOD_DEED صلاة الجماعة ← ۱۹۳ - بَابُ الحَقِّ عَلَى حُضُورِ الجَمَاعَةِ فِي الصُّبْحِ وَالعِشَاءِ
NEAR SIN ترك الصلاة ← ٢٠٥ ـ بَابُ الحَقِّ عَلَى صَلَاةِ الوِتْرِ، وَبَيَانِ أَنَّهُ سُنَّةٌ مُؤَكَّدَةٌ (١) ، وَبَيَان وَقْتِهِ
NEAR GOOD_DEED صلاة الجماعة ← ٢٠٥ ـ بَابُ الحَقِّ عَلَى صَلَاةِ الوِتْرِ، وَبَيَانِ أَنَّهُ سُنَّةٌ مُؤَكَّدَةٌ (١) ، وَبَيَان وَقْتِهِ
NEAR SIN ترك الصلاة ← بَابُ فَضْل صَلاةِ الضُّحَى
NEAR GOOD_DEED صلاة الجماعة ← بَابُ فَضْل صَلاةِ الضُّحَى
NEAR SIN ترك الصلاة ← ٢٠٦ - بَابُ فَضْل صَلاةِ الضُّحَى، وَبَيَانِ أَقَلُّهَا وَأَكْثَرِهَا وَأَوْسَطِهَا، وَالحَقِّ عَلَى المُحَافَظَةِ عَلَيْهَا
NEAR GOOD_DEED صلاة الجماعة ← ٢٠٦ - بَابُ فَضْل صَلاةِ الضُّحَى، وَبَيَانِ أَقَلُّهَا وَأَكْثَرِهَا وَأَوْسَطِهَا، وَالحَقِّ عَلَى المُحَافَظَةِ عَلَيْهَا
NEAR SIN ترك الصلاة ← بَابُ تَجْوِيزِ صَلاةِ الضُّحَى مِنِ ارْتِفَاعِ الشَّمْسِ إِلَى زَوَالِهَا - بَابُ اسْتِحْبَابِ رَكْعَتَيْنِ بَعْدَ الوُضُوءِ
NEAR GOOD_DEED صلاة الجماعة ← بَابُ تَجْوِيزِ صَلاةِ الضُّحَى مِنِ ارْتِفَاعِ الشَّمْسِ إِلَى زَوَالِهَا - بَابُ اسْتِحْبَابِ رَكْعَتَيْنِ بَعْدَ الوُضُوءِ
NEAR SIN منع الزكاة ← بَابُ تَأْكِيدِ وُجُوبِ الزَّكَاةِ
NEAR SIN منع الزكاة ← ٢١٦ - بَابُ تَأْكِيدِ وُجُوبِ الزَّكَاةِ، وَبَيَانِ فَضْلِهَا، وَمَا يَتَعَلَّقُ بِهَا
NEAR GOOD_DEED صلاة الجماعة ← بَابُ بَيَانِ جَمَاعَةٍ مِنَ الشُّهَدَاءِ فِي ثَوَابِ الْآخِرَةِ
NEAR GOOD_DEED حفظ اللسان ← بَابُ تَحْرِيم الغَيْبَةِ، وَالأمْرِ بحِفْظِ اللَّسَانِ
NEAR SIN شهادة الزور ← بَابُ الحَقِّ عَلَى التَثَبَّتِ فِيمَا يَقُولُهُ وَيَحْكِيهِ - بَابُ بَيَان غِلَظِ تَحْرِيم شَهَادَةِ الرُّورِ
NEAR SIN أن يقتل الإنسان نفسه ← بَابُ تَحْرِيم لَعْنِ إِنْسَانِ بِعَيْنِهِ، أَوْ دَابَّةٍ
NEAR SIN أن يقتل الإنسان نفسه ← ٢٦٤ ـ بَابُ تَحْرِيم لَعْنِ إِنْسَانِ بِعَيْنِهِ، أَوْ دَابَّةٍ
NEAR SIN التصوير في الثياب والحيطان والحجر والدراهم وسائر الأشياء سواء كانت من شمع أو عجين أو حديد أو نحاس أو صوف أو غير ذلك والأمر بإتلافها ← ۲۷۰ - بَابُ تَحْرِيمِ الحَسَدِ - وَهُوَ تَمَنِّي زَوَالِ النِّعْمَةِ عَنْ صَاحِبِهَا ؛ سَوَاءٌ كَانَتْ نِعْمَةَ دِينٍ أَوْ دُنْيَا
NEAR SIN التسمع على الناس وما يسرون ← ۲۷۱ - بَابُ النَّهْيِ عَنِ التَّجَسُّسِ، وَالتَّسَمُّعِ لِكَلامِ مَنْ يَكْرَهُ
NEAR SIN أذى المسلمين وشتمهم ← ۲۷۳ - بَابُ تَحْرِيمِ احْتِقَارِ الْمُسْلِمِينَ
NEAR SIN أذى المسلمين وشتمهم ← ۲۸۰ - بَابُ تَحْرِيمِ الهِجْرَانِ بَيْنَ المُسْلِمِينَ فَوْقَ ثَلَاثَةِ أَيَّامٍ؛ إِلا لِبِدْعَةٍ فِي الْمَهْجُورِ أَوْ تَظَاهُرٍ بِفِسْقٍ أَوْ نَحْوِ ذَلِكَ قَالَ اللَّهُ - تَعَالَى -: إِنَّمَا ٱلْمُؤْمِنُونَ إِخْوَةٌ فَأَصْلِحُوا۟ بَيْنَ أَخَوَيْكُمْ ۚ وَٱتَّقُوا۟ ٱللَّهَ لَعَلَّكُمْ تُرْحَمُونَ ﴾ [الحجرات : ١٠] .
NEAR SIN نشوز المرأة على زوجها ← بَابُ النَّهْي عَنْ تَعْذِيبِ العَبْدِ وَالدَّابَّةِ وَالمَرْأَةِ وَالوَلَدِ
NEAR SIN منع الزكاة ← ۲۸ - بَابُ كَرَاهَةِ عَوْدَةِ الإِنْسَانِ فِي هِبَةٍ لَمْ يُسَلِّمْهَا إِلَى المَوْهُوبِ لَهُ، وَفِي هِبَةٍ وَهَبَهَا لِوَلَدِهِ وَسَلَّمَهَا أَوْ لَمْ يُسَلِّمْهَا، وَكَرَاهَةِ شِرَائِهِ شَيْئاً تَصَدَّقَ تَصَدَّقَ عَلَيْهِ أَوْ أَخْرَجَهُ عَنْ زَكَاةِ أَوْ كَفَّارَةٍ وَنَحْوهَا،
NEAR SIN أن يقتل الإنسان نفسه ← ۲۸ - بَابُ كَرَاهَةِ عَوْدَةِ الإِنْسَانِ فِي هِبَةٍ لَمْ يُسَلِّمْهَا إِلَى المَوْهُوبِ لَهُ، وَفِي هِبَةٍ وَهَبَهَا لِوَلَدِهِ وَسَلَّمَهَا أَوْ لَمْ يُسَلِّمْهَا، وَكَرَاهَةِ شِرَائِهِ شَيْئاً تَصَدَّقَ تَصَدَّقَ عَلَيْهِ أَوْ أَخْرَجَهُ عَنْ زَكَاةِ أَوْ كَفَّارَةٍ وَنَحْوهَا،
NEAR SIN الرياء ← بَابُ مَا يَتَوَهَّمُ أَنَّهُ رِيَاءٌ وَلَيْسَ بِرِيَاءِ
NEAR SIN الرياء ← ۲۸۹ - بَابُ مَا يَتَوَهَّمُ أَنَّهُ رِيَاءٌ وَلَيْسَ بِرِيَاءِ
NEAR SIN نشوز المرأة على زوجها ← ۲۹۰ - بابُ تَحْرِيمِ النَّظَرِ إِلَى المَرْأَةِ الأَجْنَبِيَّةِ وَالْأَمْرَدِ
NEAR SIN تشبه النساء بالرجال وتشبه الرجال بالنساء ← بَابُ تَحْرِيم تَشَبُّهِ الرِّجَالِ بِالنِّسَاءِ وَالنِّسَاءِ بِالرِّجَالِ
NEAR SIN تشبه النساء بالرجال وتشبه الرجال بالنساء ← ۲۹۲ - بَابُ تَحْرِيم تَشَبُّهِ الرِّجَالِ بِالنِّسَاءِ وَالنِّسَاءِ بِالرِّجَالِ؛ في لِبَاسِ وَحَرَكَةٍ وَغَيْر ذَلِكَ
NEAR SIN نشوز المرأة على زوجها ← ٢٩٤ - بَابُ نَهْيِ الرَّجُلِ وَالمَرْأَةِ
NEAR SIN التصوير في الثياب والحيطان والحجر والدراهم وسائر الأشياء سواء كانت من شمع أو عجين أو حديد أو نحاس أو صوف أو غير ذلك والأمر بإتلافها ← ۳۰۰ - بَابُ النَّهْيِ عَنْ تَرْكِ النَّارِ فِي البَيْتِ عِنْدَ النَّوْمِ وَنَحْوِهِ؛ سَوَاءٌ كَانَتْ فِي سِرَاجِ أَوْ غَيْرِهِ
NEAR SIN غش الإمام الرعية وظلمه لهم ← بَابُ كَرَاهِيَةِ الاحْتِبَاءِ يَوْمَ الجُمُعَةِ وَالإِمَامُ يَخْطُبُ
NEAR SIN غش الإمام الرعية وظلمه لهم ← ۳۱۲ - بَابُ كَرَاهِيَةِ الاحْتِبَاءِ يَوْمَ الجُمُعَةِ وَالْإِمَامُ يَخْطُبُ، لأَنَّهُ يَجْلِبُ النَّوْمَ ، فَيُفَوِّتُ اسْتِمَاعَ الخُطْبَةِ، وَيُخَافُ انْتِقَاضُ الوُضُوءِ
NEAR SIN اليمين الغموس ← بَابُ تَغلِيظِ اليَمِينِ الكَاذِبَةِ عَمْداً
NEAR SIN اليمين الغموس ← ٣١٥ - بَابُ تَغْلِيظِ اليَمِينِ الكَاذِبَةِ عَمْداً
NEAR SIN اليمين الغموس ← ٣١٦ ـ بَابُ نَدْبِ مَنْ حَلَفَ عَلَى يَمِينِ – فَرَأَى غَيْرَهَا خَيْراً مِنْهَا - أَنْ يَفْعَلَ ذَلِكَ المَحْلُوفَ عَلَيْهِ، ثُمَّ يُكَفِّرَ عَنْ يَمِينِهِ
NEAR SIN اليمين الغموس ← ۳۱۷ - بَابُ العَفْوِ عَنْ لَغْوِ اليَمِينِ، وَأَنَّهُ لا كَفَّارَةَ فِيهِ - وَهُوَ مَا يَجْرِي عَلَى النِّسَانِ بِغَيْرِ قَصْدِ الْيَمِينِ ؛ كَقَوْلِهِ عَلَى العَادَةِ : لا وَاللَّهِ -
NEAR SIN أن يقتل الإنسان نفسه ← بَابُ النَّهْي عَنْ قَوْلِ الإِنْسَانِ : مُطِرْنَا بِنَوْءِ كَذَا - بَابُ النَّهْي عَنِ الفُحْشِ وَبَذَاءِ النِّسَانِ
NEAR SIN نشوز المرأة على زوجها ← بَابُ تَحْرِيمِ امْتِنَاعِ المَرْأَةِ مِنْ فِرَاشِ زَوْجِهَا - بَابُ تَحْرِيم صَوْمِ الْمَرْأَةِ تَطَوُّعاً وَزَوْجُهَا حَاضِرٌ
NEAR SIN نشوز المرأة على زوجها ← ٣٣٥ - بَابُ تَحْرِيمِ امْتِنَاعِ المَرْأَةِ مِنْ فِرَاشِ زَوْجِهَا إِذَا دَعَاهَا وَلَمْ يَكُنْ لَهَا عُذْرٌ شَرْعِيٌّ
NEAR SIN نشوز المرأة على زوجها ← ٣٣٦ - بَابُ تَحْرِيم صَوْمِ الْمَرْأَةِ تَطَوْعاً وَزَوْجُهَا حَاضِرٌ
NEAR SIN غش الإمام الرعية وظلمه لهم ← ۳۳۷ - بَابُ تَحْرِيم رَفْعِ المَأْمُوم رَأْسَهُ مِنَ الرُّكُوعِ أَوِ السُّجُودِ قَبْلَ الإِمَامِ
NEAR SIN ترك الصلاة ← بَابُ النَّهْي عَنِ الصَّلاةِ إِلَى القُبُورِ - بَابُ كَرَاهَةِ الشُرُوعِ فِي نَافِلَةِ بَعْدَ شُرُوعِ المُؤَذِّنِ فِي الإقامة
NEAR GOOD_DEED صلاة الجماعة ← بَابُ النَّهْي عَنِ الصَّلاةِ إِلَى القُبُورِ - بَابُ كَرَاهَةِ الشُرُوعِ فِي نَافِلَةِ بَعْدَ شُرُوعِ المُؤَذِّنِ فِي الإقامة
NEAR SIN ترك الصلاة ← ٣٤٢ - بَابُ النَّهْي عَنِ الصَّلَاةِ إِلَى القُبُورِ
NEAR GOOD_DEED صلاة الجماعة ← ٣٤٢ - بَابُ النَّهْي عَنِ الصَّلَاةِ إِلَى القُبُورِ
NEAR SIN ترك الصلاة ← ٣٤٤ - بَابُ كَرَاهَةِ شُرُوعِ المَأْمُومِ فِي نَافِلَةٍ بَعْدَ شُرُوع المُؤَذْنِ فِي إِقَامَةِ الصَّلاةِ؛ سَوَاءٌ كَانَتِ النَّافِلَةُ سُنَّةَ تِلْكَ الصَّلاةِ أَوْ غَيْرَهَا
NEAR SIN التصوير في الثياب والحيطان والحجر والدراهم وسائر الأشياء سواء كانت من شمع أو عجين أو حديد أو نحاس أو صوف أو غير ذلك والأمر بإتلافها ← ٣٤٤ - بَابُ كَرَاهَةِ شُرُوعِ المَأْمُومِ فِي نَافِلَةٍ بَعْدَ شُرُوع المُؤَذْنِ فِي إِقَامَةِ الصَّلاةِ؛ سَوَاءٌ كَانَتِ النَّافِلَةُ سُنَّةَ تِلْكَ الصَّلاةِ أَوْ غَيْرَهَا
NEAR GOOD_DEED صلاة الجماعة ← ٣٤٤ - بَابُ كَرَاهَةِ شُرُوعِ المَأْمُومِ فِي نَافِلَةٍ بَعْدَ شُرُوع المُؤَذْنِ فِي إِقَامَةِ الصَّلاةِ؛ سَوَاءٌ كَانَتِ النَّافِلَةُ سُنَّةَ تِلْكَ الصَّلاةِ أَوْ غَيْرَهَا
NEAR SIN قطع الطريق ← ٣٥١ ـ بَابُ النَّهْي عَنِ التَّغَوُّطِ فِي طَرِيقِ النَّاسِ وَظِلِّهِمْ
NEAR SIN نشوز المرأة على زوجها ← بَابُ النَّهْيِ عَنِ البَوْلِ فِي المَاءِ الرَّاكِدِ - بَابُ تَحْرِيمِ إِحْدَادِ المَرْأَةِ عَلَى مَيْتٍ فَوْقَ ثَلَاثَةِ أَيَّامٍ
NEAR SIN نشوز المرأة على زوجها ← ٣٥٤ - بَابُ تَحْرِيمِ إِحْدَادِ المَرْأَةِ عَلَى مَيْتٍ فَوْقَ ثَلَاثَةِ أَيَّامٍ، إِلا عَلَى زَوْجِهَا: أَرْبَعَةَ أَشْهُرٍ وَعَشَرَةَ أَيَّامٍ ۱۷۸۳ - عَنْ زَيْنَبَ بِنْتِ أَبِي سَلَمَةَ نَا، قَالَتْ: دَخَلْتُ عَلَى أُمِّ
NEAR SIN الذبح لغير الله عز وجل ← ٣٥٩ - بَابُ كَرَاهَةِ رَبِّ الرَّيْحَانِ لِغَيْرِ عُذْرٍ
NEAR SIN الشرك بالله ← ٣٦٩ - بابُ مَا يَقُولُهُ وَيَفْعَلُهُ مَنِ ارْتَكَبَ مَنْهِياً عَنْهُ قَالَ اللَّهُ - تَعَالَى -: وَإِمَّا يَنزَغَنَّكَ مِنَ ٱلشَّيْطَـٰنِ نَزْغٌ فَٱسْتَعِذْ بِٱللَّهِ ۖ إِنَّهُۥ هُوَ ٱلسَّمِيعُ ٱلْعَلِيمُ
```

صحيح الترغيب والترهيب — `chapter-maps: created=133 existing=0 matches=133 near-misses=261` on the first run.

```
MATCH GOOD_DEED الإخلاص ← ١ - ( الترغيب في الإخلاص والصدق والنية الصالحة )
MATCH GOOD_DEED الإخلاص ← ١ - الترغيب في الإخلاص والصدق .
MATCH GOOD_DEED الإخلاص ← ١ - الترغيب في الإخلاص والصدق ...
MATCH GOOD_DEED الإخلاص ← ١ - كتاب الإخلاص ١ - الترغيب في الإخلاص والصدق .
MATCH GOOD_DEED الإخلاص ← ١ - كتاب الإخلاص ١ - الترغيب في الإخلاص والصدق
MATCH GOOD_DEED الإخلاص ← ١ - كتاب الإخلاص ١ - الترغيب في الإخلاص والصدق . ۱۱ و ۱۲ ـ حدیث
MATCH GOOD_DEED الإخلاص ← ١ - الترغيب في الإخلاص والصدق
MATCH SIN الرياء ← ۲ - ( الترهيب من الرياء وما يقوله من خاف شيئاً منه )
MATCH SIN الرياء ← ٢ - الترهيب من الرياء
MATCH SIN الظلم ← ۹ - ( الترغيب في المشي إلى المساجد سيما في الظلم ، وما جاء في فضلها )
MATCH GOOD_DEED صلاة الجماعة ← ١٦ - ( الترغيب في صلاة الجماعة ، وما جاء فيمن خرج يريد الجماعة فوجد الناس قد صلوا )
MATCH GOOD_DEED صلاة الجماعة ← ١٦ - الترغيب في صلاة الجماعة
MATCH SIN ترك الصلاة ← ٤٠ - ( الترهيب من ترك الصلاة تعمداً ، وإخراجها عن وقتها تهاوناً )
MATCH SIN ترك الصلاة ← ٤٠ - الترهيب من ترك الصلاة تعمداً ..
MATCH SIN ترك الصلاة ← ٤٠ - الترهيب من ترك الصلاة تعمداً .... ٥٦٩ و ٥٧٠ - حدیث
MATCH SIN ترك الصلاة ← ٤٠ - الترهيب من ترك الصلاة تعمداً ... ٥٧١ - ٥٧٣ - حديث
MATCH SIN ترك الصلاة ← ٤٠ - الترهيب من ترك الصلاة تعمداً . ٥٧٤ و ٥٧٥ - حدیث
MATCH SIN ترك الصلاة ← ٤٠ - الترهيب من ترك الصلاة تعمداً .... ٥٧٦ - ٥٧٨ - حديث
MATCH SIN منع الزكاة ← ۲ - ( الترهيب من منع الزكاة ، وما جاء في زكاة الحلي )
MATCH SIN منع الزكاة ← ٢ - الترهيب من منع الزكاة .
MATCH SIN منع الزكاة ← ٢ - الترهيب من منع الزكاة .... ٧٥٨ و ٧٥٩ - حدیث
MATCH SIN منع الزكاة ← ٢ - الترهيب من منع الزكاة
MATCH GOOD_DEED الصدقة ← ۸ - كتاب الصدقات ٣ - الترغيب في العمل على الصدقة بالتقوى
MATCH GOOD_DEED الصدقة ← ۹ - ( الترغيب في الصدقة والحث عليها ،
MATCH GOOD_DEED الصدقة ← ۹ - الترغيب في الصدقة والحث عليها
MATCH GOOD_DEED الصدقة ← ۹ - الترغيب في الصدقة والحث عليها .
MATCH GOOD_DEED الصدقة ← ١١ ـ ( الترغيب في الصدقة على الزوج والأقارب وتقديمهم على غيرهم )
MATCH GOOD_DEED الصدقة ← ۸ - كتاب الصدقات ١٦ - ترغيب المرأة في الصدقة من مال زوجها ٩٤٠ و ٩٤١ ـ حديث
MATCH SIN الفرار من الزحف ← ۱۱ - ( الترهيب من الفرار من الزحف )
MATCH SIN الفرار من الزحف ← ۱۲ - كتاب الجهاد ۱۱ - الترهيب من الفرار من الزحف
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر (١)
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١- الترغيب في الإكثار من ذكر الله تعالى ١٤٨٩ - ١٤٩٢ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١- الترغيب في الإكثار من ذكر الله تعالى . ١٤٩٣ - ١٤٩٥ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١- الترغيب في الإكثار من ذكر الله تعالى .... ١٤٩٦ - ١٤٩٨ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١- الترغيب في الإكثار من ذكر الله تعالى
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١ - الترغيب في الإكثار من ذكر الله تعالى
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ٢ - الترغيب في حضور مجالس الذكر والاجتماع . ١٥٠٢ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ٢ - الترغيب في حضور مجالس الذكر والاجتماع .. ١٥٠٣ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ۲ - الترغيب في حضور مجالس الذكر والاجتماع . ١٥٠٧ و ١٥٠٨ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ۲ - الترغيب في حضور مجالس الذكر والاجتماع .. ١٥٠٩ و ١٥١٠ - حديث
MATCH GOOD_DEED الذكر ← ١٤ ـ كتاب الذكر ٣ - الترهيب من أن يجلس مجلساً لا يذكر الله فيه . ١٥١٤ و ١٥١٥ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ٤ - الترغيب في كلمات يكفرن لغط المجلس ١٥١٨ و ١٥١٩ - حدیث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ه ـ الترغيب في قول لا إله إلا الله
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ه - الترغيب في قول لا إله إلا الله
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ه - الترغيب في قول لا إله إلا الله.
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ٦ - الترغيب في قول لا إله إلا الله وحده
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ـ الترغيب في التسبيح والتكبير
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر - الترغيب في التسبيح والتكبير
MATCH GOOD_DEED الذكر ← ١٤ ـ كتاب الذكر
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر.
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ۹ - الترغيب في قول : لا حول ولا قوة إلا بالله ١٥٨١ و ١٥٨٢ - حدیث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ۹ - الترغيب في قول : لا حول ولا قوة إلا بالله ١٥٨٣ و ١٥٨٤ - حدیث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١٠ - الترغيب في أذكار تقال بالليل
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ۱۱ - الترغيب في آيات وأذكار بعد الصلوات ... ١٥٩٣ و ١٥٩٤ - حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ۱۱ - الترغيب في آيات وأذكار بعد الصلوات .
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١١ - الترغيب في آيات وأذكار بعد الصلوات .
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١٢ - الترغيب فيما يقوله ويفعله من رأى في منامه ۱۳۹۷ - ١٥٩٩- حديث
MATCH GOOD_DEED الذكر ← ١٤ - كتاب الذكر ١٤ - الترغيب فيما يقول إذا خرج من بيته
MATCH GOOD_DEED الذكر ← 14 - كتاب الذكر ١٥ - الترغيب فيما يقوله من حصلت له وسوسة ١٦١٠ - ١٦١٣ - حديث
MATCH SIN الربا ← ۱۹ - ( الترهيب من الربا )
MATCH SIN الربا ← ۱۹ - الترهيب من الربا
MATCH SIN الربا ← ١٩ - الترهيب من الربا
MATCH SIN الظلم ← ۲۰ - كتاب القضاء وغيره ه - الترهيب من الظلم .
MATCH SIN شهادة الزور ← ٢٠ - كتاب القضاء وغيره ١٢ - الترهيب من شهادة الزور .
MATCH SIN شرب الخمر ← ۲۱ - كتاب الحدود وغيرها ٦ - الترهيب من شرب الخمر .
MATCH SIN شرب الخمر ← ۲۱ - كتاب الحدود وغيرها ٦ ـ الترهيب من شرب الخمر .
MATCH SIN شرب الخمر ← ٦ - الترهيب من شرب الخمر .
MATCH SIN شرب الخمر ← ٦ - الترهيب من شرب الخمر
MATCH SIN شرب الخمر ← ۲۱ - كتاب الحدود وغيرها ٦ - الترهيب من شرب الخمر.
MATCH SIN الزنا ← ۲۱ - كتاب الحدود وغيرها ۷ - الترهيب من الزنا
MATCH SIN الزنا ← ۲۱ - كتاب الحدود وغيرها ۷ - الترهيب من الزنا.
MATCH SIN الزنا ← ۷ - الترهيب من الزنا
MATCH SIN الزنا ← ۲۱ - كتاب الحدود وغيرها ٧ - الترهيب من الزنا .
MATCH SIN الزنا ← ۲۱ ـ كتاب الحدود وغيرها ۷ - الترهيب من الزنا .
MATCH SIN اللواط ← ۸ - الترهيب من اللواط
MATCH SIN قتل النفس ← ۲۱ - كتاب الحدود وغيرها ۹ - الترهيب من قتل النفس .
MATCH SIN قتل النفس ← ۹ - الترهيب من قتل النفس
MATCH SIN قتل النفس ← ۲۱ - كتاب الحدود وغيرها ۹ - الترهيب من قتل النفس ..
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في بر الوالدين .. ٢٤٨١ و ٢٤٨٢ - حدیث
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .... ٢٤٨٣ و ٢٤٨٤ - حدیث
MATCH GOOD_DEED بر الوالدين ← ٢٢ - كتاب البر والصلة وغيرهما 1 - الترغيب في بر الوالدين ٢٤٨٥ و ٢٤٨٦ - حدیث
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .. ٢٤٨٩ - ٢٤٩١ - حديث
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .. ٢٤٩٢ - ٢٤٩٦ - حديث
MATCH GOOD_DEED بر الوالدين ← ٢٢ - كتاب البر والصلة وغيرهما - الترغيب في بر الوالدين .
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .
MATCH GOOD_DEED بر الوالدين ← ٢٢ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين . ٢٥٠٢ - ٢٥٠٤ - حديث
MATCH GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين . ٢٥٠٥ و ٢٥٠٦ - حديث
MATCH SIN عقوق الوالدين ← ۲ - ( الترهيب من عقوق الوالدين )
MATCH SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ٢ - الترهيب من عقوق الوالدين . ٢٥٠٩ و ٢٥١٠ - حدیث
MATCH SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ۲ - الترهيب من عقوق الوالدين . ٢٥١١ - ٢٥١٣ - حدیث
MATCH SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ۲ - الترهيب من عقوق الوالدين . ٢٥١٤ و ٢٥١٥ - حدیث
MATCH SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ٢ - الترهيب من عقوق الوالدين
MATCH SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ٢ - الترهيب من عقوق الوالدين .
MATCH GOOD_DEED صلة الرحم ← ( الترغيب في صلة الرحم وإن قطعت ، والترهيب من قطعها )
MATCH GOOD_DEED صلة الرحم ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في صلة الرحم .. ٢٥٢١ و ٢٥٢٢ - حدیث
MATCH GOOD_DEED صلة الرحم ← ٢٢ - كتاب البر والصلة وغيرهما - الترغيب في صلة الرحم ٢٥۲۳ و ٢٥٢٤ - حدیث
MATCH GOOD_DEED صلة الرحم ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في صلة الرحم ٢٥٢٥ و ٢٥٢٦ - حديث
MATCH GOOD_DEED صلة الرحم ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في صلة الرحم . ۲۵۲۷ و ٢٥٢٨ - حدیث
MATCH GOOD_DEED صلة الرحم ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في صلة الرحم . ٢٥٢٩ - ٢٥٣١ - حدیث
MATCH GOOD_DEED صلة الرحم ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في صلة الرحم .. ٢٥٣٢ - ٢٥٣٤ - حديث
MATCH GOOD_DEED صلة الرحم ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في صلة الرحم ٢٥٣٨ - ٢٥٤٠ - حديث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٤٨ و ٢٥٤٩ - حدیث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٥٠ و ٢٥٥١ - حدیث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٥٢ - ٢٥٥٥ - حديث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٥٦ - ٢٥٥٨ - حديث
MATCH SIN أذى الجار ← ٢٢ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٦١ و ٢٥٦٢ .
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٦٣ - ٢٥٦٦ - حديث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٦٧ و ٢٥٦٨ - حديث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٦٩ و ٢٥٧٠ - حدیث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه ـ الترهيب من أذى الجار ٢٥٧١ - ٢٥٧٣ - حدیث
MATCH SIN أذى الجار ← ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٧٤ - ٢٥٧٦ - حديث
MATCH SIN الغضب ← ۱۰ - ( الترهيب من الغضب ، والترغيب في دفعه
MATCH SIN الغضب ← ٢٣ - كتاب الأدب وغيره ١٠ - الترهيب من الغضب
MATCH SIN الغضب ← ۲۳ - كتاب الأدب وغيره 10 - الترهيب من الغضب
MATCH SIN الغضب ← ۲۳ - كتاب الأدب وغيره ١٠ - الترهيب من الغضب
MATCH SIN النميمة ← ۱۸ - ( الترهيب من النميمة )
MATCH SIN النميمة ← ۲۳ ـ كتاب الأدب وغيره ١٨ - الترهيب من النميمة
MATCH SIN الغيبة ← ۱۹ - ( الترهيب من الغيبة والبهت وبيانهما . والترغيب في ردهما )
MATCH SIN الغيبة ← ۲۳ - كتاب الأدب وغيره ١٩ - الترهيب من الغيبة .
MATCH SIN الغيبة ← ۲۳ - كتاب الأدب وغيره 19 - الترهيب من الغيبة
MATCH SIN الغيبة ← ۲۳ - كتاب الأدب وغيره ١٩ - الترهيب من الغيبة
MATCH SIN الغيبة ← ۲۳ - كتاب الأدب وغيره ۱۹ - الترهيب من الغيبة
MATCH SIN الغيبة ← ٢٣ - كتاب الأدب وغيره ۱۹ - الترهيب من الغيبة
MATCH SIN الحسد ← ٢١ - ( الترهيب من الحسد ، وفضل سلامة الصدر )
MATCH SIN الكبر ← ٢٢ - ( الترغيب في التواضع ، والترهيب من الكبر والعجب والافتخار )
MATCH SIN الكذب ← ٢٤ - ( الترغيب في الصدق ، والترهيب من الكذب )
MATCH SIN السحر ← ۳۲ - ( الترهيب من السحر ، وإتيان الكهان والعرافين والمنجمين بالرمل والحصى أو نحو ذلك وتصديقهم )
MATCH SIN السحر ← ۲۳ - كتاب الأدب وغيره ٣٢ - الترهيب من السحر
MATCH SIN السحر ← ۲۳ - كتاب الأدب وغيره ٣٢ - الترهيب من السحر .
MATCH SIN السحر ← ٢٣ - كتاب الأدب وغيره ٣٢ - الترهيب من السحر
NEAR SIN الذبح لغير الله عز وجل ← ٦ - ( الترهيب من تعلم العلم لغير وجه الله تعالى )
NEAR SIN التعلم للدنيا وكتمان العلم ← ٦ - ( الترهيب من تعلم العلم لغير وجه الله تعالى )
NEAR SIN الذبح لغير الله عز وجل ← ٣ - كتاب العلم ٦ - الترهيب من تعلم العلم لغير وجه
NEAR SIN التعلم للدنيا وكتمان العلم ← ٣ - كتاب العلم ٦ - الترهيب من تعلم العلم لغير وجه
NEAR SIN الذبح لغير الله عز وجل ← ٦ - الترهيب من تعلم العلم لغير وجه الله
NEAR SIN التعلم للدنيا وكتمان العلم ← ٦ - الترهيب من تعلم العلم لغير وجه الله
NEAR SIN الجدل والمراء واللدد ← ١١ - الترهيب من المراء والجدال
NEAR SIN الذبح لغير الله عز وجل ← ٦ - ( الترهيب من تأخير الغُسل لغير عذر )
NEAR SIN الذبح لغير الله عز وجل ← ٤ - ( الترهيب من الخروج من المسجد بعد الأذان لغير عذر )
NEAR SIN ترك الصلاة ← ١٤ - ( الترغيب في الصلاة مطلقاً ، وفضل الركوع والسجود والخشوع )
NEAR GOOD_DEED صلاة الجماعة ← ١٤ - ( الترغيب في الصلاة مطلقاً ، وفضل الركوع والسجود والخشوع )
NEAR SIN ترك الصلاة ← ١٥ - ( الترغيب في الصلاة في أول وقتها )
NEAR GOOD_DEED صلاة الجماعة ← ١٥ - ( الترغيب في الصلاة في أول وقتها )
NEAR SIN ترك الصلاة ← ١٥ - الترغيب في الصلاة في أول وقتها
NEAR GOOD_DEED صلاة الجماعة ← ١٥ - الترغيب في الصلاة في أول وقتها
NEAR SIN ترك الصلاة ← ١٦ - ( الترغيب في صلاة الجماعة ، وما جاء فيمن خرج يريد الجماعة فوجد الناس قد صلوا )
NEAR SIN الإصرار على ترك صلاة الجمعة والجماعة من غير عذر ← ١٦ - ( الترغيب في صلاة الجماعة ، وما جاء فيمن خرج يريد الجماعة فوجد الناس قد صلوا )
NEAR SIN ترك الصلاة ← ١٦ - الترغيب في صلاة الجماعة
NEAR SIN الإصرار على ترك صلاة الجمعة والجماعة من غير عذر ← ١٦ - الترغيب في صلاة الجماعة
NEAR SIN ترك الصلاة ← ١٦ - الترغيب في الصلاة الجماعة
NEAR SIN الإصرار على ترك صلاة الجمعة والجماعة من غير عذر ← ١٦ - الترغيب في الصلاة الجماعة
NEAR GOOD_DEED صلاة الجماعة ← ١٦ - الترغيب في الصلاة الجماعة
NEAR GOOD_DEED صلاة الجماعة ← ۱۷ - ( الترغيب في كثرة الجماعة )
NEAR SIN ترك الصلاة ← ۱۸ - ( الترغيب في الصلاة في الفلاة )
NEAR GOOD_DEED صلاة الجماعة ← ۱۸ - ( الترغيب في الصلاة في الفلاة )
NEAR SIN ترك الصلاة ← ١٨ - الترغيب في الصلاة الفلاة
NEAR GOOD_DEED صلاة الجماعة ← ١٨ - الترغيب في الصلاة الفلاة
NEAR SIN ترك الصلاة ← ١٩ ـ ( الترغيب في صلاة العشاء والصبح خاصة في جماعة ،
NEAR SIN الإصرار على ترك صلاة الجمعة والجماعة من غير عذر ← ١٩ ـ ( الترغيب في صلاة العشاء والصبح خاصة في جماعة ،
NEAR GOOD_DEED صلاة الجماعة ← ١٩ ـ ( الترغيب في صلاة العشاء والصبح خاصة في جماعة ،
NEAR GOOD_DEED صلاة الجماعة ← ۱۹ - الترهيب من ترك حضور الجماعة
NEAR SIN الذبح لغير الله عز وجل ← ۲۰ - ( الترهيب من ترك حضور الجماعة لغير عذر )
NEAR GOOD_DEED صلاة الجماعة ← ۲۰ - ( الترهيب من ترك حضور الجماعة لغير عذر )
NEAR GOOD_DEED صلاة الجماعة ← ٢٠ - الترهيب من ترك حضور الجماعة
NEAR SIN ترك الصلاة ← ٢١ - ( الترغيب في صلاة النافلة في البيوت )
NEAR GOOD_DEED صلاة الجماعة ← ٢١ - ( الترغيب في صلاة النافلة في البيوت )
NEAR SIN ترك الصلاة ← ٢٢ - ( الترغيب فى انتظار الصلاة بعد الصلاة )
NEAR GOOD_DEED صلاة الجماعة ← ٢٢ - ( الترغيب فى انتظار الصلاة بعد الصلاة )
NEAR SIN ترك الصلاة ← ٢٢ - الترغيب في انتظار الصلاة بعد الصلاة
NEAR GOOD_DEED صلاة الجماعة ← ٢٢ - الترغيب في انتظار الصلاة بعد الصلاة
NEAR SIN ترك الصلاة ← ٢٢ - الترغيب في انتظار الصلاة بعد الصلاة ٤٥٣ و ٤٥٤ - حدیث
NEAR GOOD_DEED صلاة الجماعة ← ٢٢ - الترغيب في انتظار الصلاة بعد الصلاة ٤٥٣ و ٤٥٤ - حدیث
NEAR SIN ترك الصلاة ← ٢٤ - ( الترغيب في جلوس المرء في مصلاه بعد صلاة الصبح وصلاة العصر )
NEAR GOOD_DEED صلاة الجماعة ← ٢٤ - ( الترغيب في جلوس المرء في مصلاه بعد صلاة الصبح وصلاة العصر )
NEAR SIN ترك الصلاة ← ٢٥ - ( الترغيب في أذكار يقولها بعد صلاة الصبح والعصر والمغرب )
NEAR GOOD_DEED صلاة الجماعة ← ٢٥ - ( الترغيب في أذكار يقولها بعد صلاة الصبح والعصر والمغرب )
NEAR SIN غش الإمام الرعية وظلمه لهم ← ۳۲ - ( الترغيب في التأمين خلف الإمام وفي الدعاء ،
NEAR SIN غش الإمام الرعية وظلمه لهم ← ٣٢ - الترغيب في التأمين خلف الإمام . ٥١٥ و ٥١٦ - حديث
NEAR SIN غش الإمام الرعية وظلمه لهم ← ٣٣ - ( الترهيب من رفع المأموم رأسه قبل الإمام في الركوع والسجود )
NEAR SIN ترك الصلاة ← ٣٥ - ( الترهيب من رفع البصر إلى السماء في الصلاة )
NEAR GOOD_DEED صلاة الجماعة ← ٣٥ - ( الترهيب من رفع البصر إلى السماء في الصلاة )
NEAR SIN ترك الصلاة ← ٣٦ - ( الترهيب من الالتفات في الصلاة وغيره مما يذكر )
NEAR GOOD_DEED صلاة الجماعة ← ٣٦ - ( الترهيب من الالتفات في الصلاة وغيره مما يذكر )
NEAR SIN ترك الصلاة ← ٣٦ - الترهيب من الالتفات في الصلاة
NEAR GOOD_DEED صلاة الجماعة ← ٣٦ - الترهيب من الالتفات في الصلاة
NEAR SIN ترك الصلاة ← ۳۸ - ( الترهيب من وضع اليد على الخاصرة في الصلاة )
NEAR GOOD_DEED صلاة الجماعة ← ۳۸ - ( الترهيب من وضع اليد على الخاصرة في الصلاة )
NEAR GOOD_DEED صلاة الجماعة ← ٤٠ - ( الترهيب من ترك الصلاة تعمداً ، وإخراجها عن وقتها تهاوناً )
NEAR GOOD_DEED صلاة الجماعة ← ٤٠ - الترهيب من ترك الصلاة تعمداً ..
NEAR GOOD_DEED صلاة الجماعة ← ٤٠ - الترهيب من ترك الصلاة تعمداً .... ٥٦٩ و ٥٧٠ - حدیث
NEAR GOOD_DEED صلاة الجماعة ← ٤٠ - الترهيب من ترك الصلاة تعمداً ... ٥٧١ - ٥٧٣ - حديث
NEAR GOOD_DEED صلاة الجماعة ← ٤٠ - الترهيب من ترك الصلاة تعمداً . ٥٧٤ و ٥٧٥ - حدیث
NEAR GOOD_DEED صلاة الجماعة ← ٤٠ - الترهيب من ترك الصلاة تعمداً .... ٥٧٦ - ٥٧٨ - حديث
NEAR SIN ترك الصلاة ← ۳ - ( الترغيب في الصلاة قبل الظهر وبعدها )
NEAR GOOD_DEED صلاة الجماعة ← ۳ - ( الترغيب في الصلاة قبل الظهر وبعدها )
NEAR SIN ترك الصلاة ← ٦ ـ كتاب النوافل ٣ - الترغيب في الصلاة قبل الظهر وبعدها
NEAR GOOD_DEED صلاة الجماعة ← ٦ ـ كتاب النوافل ٣ - الترغيب في الصلاة قبل الظهر وبعدها
NEAR SIN ترك الصلاة ← ٤ - ( الترغيب في الصلاة قبل العصر )
NEAR GOOD_DEED صلاة الجماعة ← ٤ - ( الترغيب في الصلاة قبل العصر )
NEAR SIN ترك الصلاة ← ٦ - ( الترغيب في الصلاة بعد العشاء )
NEAR GOOD_DEED صلاة الجماعة ← ٦ - ( الترغيب في الصلاة بعد العشاء )
NEAR SIN ترك الصلاة ← ۱۲ - ( الترهيب من صلاة الإنسان وقراءته حال النعاس )
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ - ( الترهيب من صلاة الإنسان وقراءته حال النعاس )
NEAR GOOD_DEED صلاة الجماعة ← ۱۲ - ( الترهيب من صلاة الإنسان وقراءته حال النعاس )
NEAR SIN أن يقتل الإنسان نفسه ← ۱۳ - ( الترهيب من نوم الإنسان إلى الصباح ، وترك قيام شيء من الليل )
NEAR SIN أن يقتل الإنسان نفسه ← ١٥ ـ ( الترغيب في قضاء الإنسان ورده إذا فاته من الليل )
NEAR SIN ترك الصلاة ← ١٦ ـ ( الترغيب في صلاة الضحى )
NEAR GOOD_DEED صلاة الجماعة ← ١٦ ـ ( الترغيب في صلاة الضحى )
NEAR SIN ترك الصلاة ← ١٦ ـ الترغيب في صلاة الضحى
NEAR GOOD_DEED صلاة الجماعة ← ١٦ ـ الترغيب في صلاة الضحى
NEAR SIN ترك الصلاة ← ١٦ - الترغيب في صلاة الضحى
NEAR GOOD_DEED صلاة الجماعة ← ١٦ - الترغيب في صلاة الضحى
NEAR SIN ترك الصلاة ← ١٦- الترغيب في صلاة الضحى
NEAR GOOD_DEED صلاة الجماعة ← ١٦- الترغيب في صلاة الضحى
NEAR SIN ترك الصلاة ← ۱۷ - ( الترغيب في صلاة التسبيح )
NEAR GOOD_DEED صلاة الجماعة ← ۱۷ - ( الترغيب في صلاة التسبيح )
NEAR SIN ترك الصلاة ← ۱۷ - الترغيب في صلاة التسبيح
NEAR GOOD_DEED صلاة الجماعة ← ۱۷ - الترغيب في صلاة التسبيح
NEAR SIN ترك الصلاة ← ١٧ - الترغيب في صلاة التسبيح
NEAR GOOD_DEED صلاة الجماعة ← ١٧ - الترغيب في صلاة التسبيح
NEAR SIN ترك الصلاة ← ۱۸ - ( الترغيب في صلاة التوبة )
NEAR GOOD_DEED صلاة الجماعة ← ۱۸ - ( الترغيب في صلاة التوبة )
NEAR SIN ترك الصلاة ← ۱۹ - ( الترغيب فى صلاة الحاجة ودعائها )
NEAR GOOD_DEED صلاة الجماعة ← ۱۹ - ( الترغيب فى صلاة الحاجة ودعائها )
NEAR SIN ترك الصلاة ← ٢٠ - ( الترغيب في صلاة الاستخارة .... )
NEAR GOOD_DEED صلاة الجماعة ← ٢٠ - ( الترغيب في صلاة الاستخارة .... )
NEAR SIN ترك الصلاة ← ١ - ( الترغيب في صلاة الجمعة والسعي إليها ، وما جاء في فضل يومها وساعتها )
NEAR SIN الإصرار على ترك صلاة الجمعة والجماعة من غير عذر ← ١ - ( الترغيب في صلاة الجمعة والسعي إليها ، وما جاء في فضل يومها وساعتها )
NEAR GOOD_DEED صلاة الجماعة ← ١ - ( الترغيب في صلاة الجمعة والسعي إليها ، وما جاء في فضل يومها وساعتها )
NEAR SIN ترك الصلاة ← ١ - الترغيب في صلاة الجمعة.
NEAR SIN الإصرار على ترك صلاة الجمعة والجماعة من غير عذر ← ١ - الترغيب في صلاة الجمعة.
NEAR GOOD_DEED صلاة الجماعة ← ١ - الترغيب في صلاة الجمعة.
NEAR SIN الذبح لغير الله عز وجل ← ٦ - ( الترهيب من ترك الجمعة لغير عذر )
NEAR SIN الذبح لغير الله عز وجل ← ٦ - الترهيب من ترك الجمعة لغير عذر
NEAR SIN منع الزكاة ← ١ - ( الترغيب في أداء الزكاة وتأكيد وجوبها )
NEAR SIN منع الزكاة ← ۸ - كتاب الصدقات ١ - الترغيب في أداء الزكاة وتأكيد وجوبها ٧٤٠ - ٧٤٣ - حدیث
NEAR GOOD_DEED الصدقة ← ١٠ - ( الترغيب في صدقة السر )
NEAR GOOD_DEED الصدقة ← ١٠ - الترغيب في صدقة السر
NEAR SIN نشوز المرأة على زوجها ← ۸ - كتاب الصدقات ١٦ - ترغيب المرأة في الصدقة من مال زوجها ٩٤٠ و ٩٤١ ـ حديث
NEAR SIN إفطار يوم من رمضان بلا عذر ← ـ الترهيب من إفطار شيء من رمضان من غير عذر ١٠٠٥ - حديث
NEAR SIN نشوز المرأة على زوجها ← ۹ - كتاب الصوم ١٣ - ترهيب المرأة أن تصوم تطوعاً وزوجها حاضر . ١٠٥٢ - حدیث
NEAR GOOD_DEED الصدقة ← ۲۲ - ( الترغيب في صدقة الفطر ، وبيان تأكيدها (۱) )
NEAR GOOD_DEED الصدقة ← ٢١ - الترغيب في صدقة الفطر
NEAR SIN الذبح لغير الله عز وجل ← ٤ - ( الترهيب من المثلة بالحيوان ، ومن قتله لغير الأكل ،
NEAR SIN أذية عباد الله والتطول عليهم ← ٤ - الترغيب في التواضع في الحج والتبذل ولبس الدون من الثياب ؛ اقتداء بالأنبياء عليهم السلام)
NEAR SIN ترك الصلاة ← ١٤ - ( الترغيب في الصلاة في المسجد الحرام ومسجد المدينة ،
NEAR GOOD_DEED صلاة الجماعة ← ١٤ - ( الترغيب في الصلاة في المسجد الحرام ومسجد المدينة ،
NEAR SIN ترك الصلاة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد
NEAR GOOD_DEED صلاة الجماعة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد
NEAR SIN ترك الصلاة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد الحرام . ۱۱۷۹ و ۱۱۸۰۔ حدیث
NEAR GOOD_DEED صلاة الجماعة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد الحرام . ۱۱۷۹ و ۱۱۸۰۔ حدیث
NEAR SIN ترك الصلاة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد الحرام .. ۱۱۸۱ - ۱۱۸۳- حدیث
NEAR GOOD_DEED صلاة الجماعة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد الحرام .. ۱۱۸۱ - ۱۱۸۳- حدیث
NEAR SIN ترك الصلاة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد الحرام . ١١٨٤ و ١١٨٥۔ حدیث
NEAR GOOD_DEED صلاة الجماعة ← ١١ - كتاب الحج ١٤ - الترغيب في الصلاة في المسجد الحرام . ١١٨٤ و ١١٨٥۔ حدیث
NEAR SIN الرياء ← ١٢ - كتاب الجهاد -٤ - الترغيب في احتباس الخيل للجهاد لا رياءً . ١٢٤١ و ١٢٤٢- حديث
NEAR SIN الرياء ← ١٢ - كتاب الجهاد ٤ - الترغيب في احتباس الخيل للجهاد لا رياء ...
NEAR SIN الرياء ← ١٢ - كتاب الجهاد ٤ - الترغيب في احتباس الخيل للجهاد لا رياء ... ١٢٤٤ و ١٢٤٥ - حديث
NEAR SIN الرياء ← ١٢ - كتاب الجهاد ٤ - الترغيب في احتباس الخيل للجهاد لا رياء ... ١٢٤٦ - ١٢٤٩ - حديث
NEAR SIN الرياء ← ١٢ - كتاب الجهاد ٤ - الترغيب في احتباس الخيل للجهاد لا رياء . . . ١٢٥٠ - ١٢٥٣- حدیث
NEAR SIN الرياء ← ١٢- كتاب الجهاد ٤ - الترغيب في احتباس الخيل للجهاد لا رياء .
NEAR SIN شهادة الزور ← ۱۲ ـ كتاب الجهاد ۷ - الترغيب في سؤال الشهادة في سبيل الله تعالى ١٢٧٦ - ١٢٧٨ - حديث
NEAR GOOD_DEED الإخلاص ← ۱۲ ـ كتاب الجهاد ١٠ - الترغيب في إخلاص النية في
NEAR GOOD_DEED الإخلاص ← ۱۲ - كتاب الجهاد ١٠ - الترغيب في إخلاص النية في الجهاد ۱۳۳۰ و ۱۳۳۱ - حدیث
NEAR GOOD_DEED الإخلاص ← ۱۲ - كتاب الجهاد ١٠ - الترغيب في إخلاص النية في الجهاد .
NEAR GOOD_DEED الإخلاص ← ۱۲ ـ كتاب الجهاد ١٠ - الترغيب في إخلاص النية في الجهاد
NEAR SIN الغلول من الغنيمة ← ۱۳ - ( الترهيب من الغلول والتشديد فيه ، وما جاء
NEAR SIN الغلول من الغنيمة ← ١٢ - كتاب الجهاد ١٣ - الترهيب من الغلول والتشديد فيه
NEAR SIN الغلول من الغنيمة ← ۱۲ - كتاب الجهاد ١٣ - الترهيب من الغلول والتشديد فيه
NEAR SIN شهادة الزور ← ١٤ - ( الترغيب في الشهادة ، وما جاء في فضل الشهداء )
NEAR SIN شهادة الزور ← ۱۲ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ١٣٥٦ و ١٣٥٧ - حدیث
NEAR SIN شهادة الزور ← ١٢ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ١٣٥٨ و ١٣٥٩ - حدیث
NEAR SIN شهادة الزور ← ١٢ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ١٣٦٢ - ١٣٦٤ - حديث
NEAR SIN شهادة الزور ← ١٤ - الترغيب في الشهادة ، وفضل الشهداء ۱۲ - كتاب الجهاد
NEAR SIN شهادة الزور ← ١٢ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ١٣٦٨ - ۱۳۷۰ - حدیث
NEAR SIN شهادة الزور ← ۱۲ ـ كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ۱۳۷۱ - ۱۳۷۳ - حدیث
NEAR SIN شهادة الزور ← ١٢ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء
NEAR SIN شهادة الزور ← ۱۲ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وضل الشهداء ۱۳۷۰ - ۱۳۷۷ - حدیث
NEAR SIN شهادة الزور ← ۱۲ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ۱۳۷۹ - ۱۳۸۱ - حدیث
NEAR SIN شهادة الزور ← ۱۲ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء
NEAR SIN شهادة الزور ← ۱۲ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ۱۳۸۳ و ١٣٨٤ - حدیث
NEAR SIN شهادة الزور ← ۱۲ - كتاب الجهاد ١٤ - الترغيب في الشهادة ، وفضل الشهداء ١٣٨٦ و ۱۳۸۷ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ١٢ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ۱۳۸۸ و ۱۳۸۹ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ١٢ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ۱۳۹۰ - ۱۳۹۳ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ ـ كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ۱۳۹۵ و ١٣٩٦ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ١٢ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز ... ۱۳۹۷ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ۱۳۹۸ و ۱۳۹۹ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ١٤٠٠ - ١٤٠٢ - حديث
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ ـ كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز ... ١٤٠٣ - ١٤٠٥ - حديث
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ١٤٠٦ - ١٤٠٨ - حديث
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ١٤٠٩ و ١٤١٠ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ۱۲ ـ كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ١٤١١ و ١٤١٢ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ١٢ - كتاب الجهاد ١٥ - الترهيب من أن يموت الإنسان ولم يغز . ١٤١٣ و ١٤١٤ - حديث
NEAR SIN ترك الصلاة ← ۱۳ - كتاب قراءة القرآن ۱ - الترغيب في قراءة القرآن في الصلاة 1410 - ١٤١٧ - حديث
NEAR GOOD_DEED صلاة الجماعة ← ۱۳ - كتاب قراءة القرآن ۱ - الترغيب في قراءة القرآن في الصلاة 1410 - ١٤١٧ - حديث
NEAR SIN ترك الصلاة ← ۱۳ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة
NEAR GOOD_DEED صلاة الجماعة ← ۱۳ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة
NEAR SIN ترك الصلاة ← ۱۳ - كتاب قراءة القرآن -١- الترغيب في قراءة القرآن في الصلاة ١٤۲۰ و ١٤٢١ - حدیث
NEAR GOOD_DEED صلاة الجماعة ← ۱۳ - كتاب قراءة القرآن -١- الترغيب في قراءة القرآن في الصلاة ١٤۲۰ و ١٤٢١ - حدیث
NEAR SIN ترك الصلاة ← ١٣ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة ١٤٢٢ - ١٤٢٥ - حديث
NEAR GOOD_DEED صلاة الجماعة ← ١٣ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة ١٤٢٢ - ١٤٢٥ - حديث
NEAR SIN ترك الصلاة ← ١٣ - كتاب قراءة القرآن ۱ - الترغيب في قراءة القرآن في الصلاة ١٤۲۷ - ١٤٢٩ - حديث
NEAR GOOD_DEED صلاة الجماعة ← ١٣ - كتاب قراءة القرآن ۱ - الترغيب في قراءة القرآن في الصلاة ١٤۲۷ - ١٤٢٩ - حديث
NEAR SIN ترك الصلاة ← ۱۳ - كتاب قراءة القرآن ۱ - الترغيب في قراءة القرآن في الصلاة ١٤٣١ و ١٤٣٢ - حدیث
NEAR GOOD_DEED صلاة الجماعة ← ۱۳ - كتاب قراءة القرآن ۱ - الترغيب في قراءة القرآن في الصلاة ١٤٣١ و ١٤٣٢ - حدیث
NEAR SIN ترك الصلاة ← ۱۳ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة ١٤٣٣ - ١٤٣٦ - حديث
NEAR GOOD_DEED صلاة الجماعة ← ۱۳ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة ١٤٣٣ - ١٤٣٦ - حديث
NEAR SIN ترك الصلاة ← ۱۳ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة ١٤٣٧ - ١٤٤١ - حديث
NEAR GOOD_DEED صلاة الجماعة ← ۱۳ - كتاب قراءة القرآن ١ - الترغيب في قراءة القرآن في الصلاة ١٤٣٧ - ١٤٤١ - حديث
NEAR SIN الشرك بالله ← ۹ - ( الترغيب في قول : لا حول ولا قوة إلا بالله )
NEAR SIN الشرك بالله ← ١٤ - كتاب الذكر ۹ - الترغيب في قول : لا حول ولا قوة إلا بالله ١٥٨١ و ١٥٨٢ - حدیث
NEAR SIN الشرك بالله ← ١٤ - كتاب الذكر ۹ - الترغيب في قول : لا حول ولا قوة إلا بالله ١٥٨٣ و ١٥٨٤ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ١٥ - كتاب الدعاء ٦ - الترهيب من دعاء الإنسان على نفسه
NEAR SIN ترك الصلاة ← ١٥ - كتاب الدعاء - الترغيب في إكثار الصلاة على النبي
NEAR GOOD_DEED صلاة الجماعة ← ١٥ - كتاب الدعاء - الترغيب في إكثار الصلاة على النبي
NEAR SIN ترك الصلاة ← ١٥ - كتاب الدعاء ۷ - الترغيب في إكثار الصلاة على النبي
NEAR GOOD_DEED صلاة الجماعة ← ١٥ - كتاب الدعاء ۷ - الترغيب في إكثار الصلاة على النبي
NEAR SIN ترك الصلاة ← ١٥ ـ كتاب الدعاء - الترغيب في إكثار الصلاة على النبي صلى الله عليه وسلم ١٦٦٥ - ١٦٦٧- حدیث
NEAR GOOD_DEED صلاة الجماعة ← ١٥ ـ كتاب الدعاء - الترغيب في إكثار الصلاة على النبي صلى الله عليه وسلم ١٦٦٥ - ١٦٦٧- حدیث
NEAR SIN ترك الصلاة ← ١٥ - كتاب الدعاء ٧ - الترغيب في إكثار الصلاة على النبي
NEAR GOOD_DEED صلاة الجماعة ← ١٥ - كتاب الدعاء ٧ - الترغيب في إكثار الصلاة على النبي
NEAR SIN اليمين الغموس ← ۱۸ - ( الترهيب من اليمين الكاذبة الغموس )
NEAR SIN اليمين الغموس ← ١٨ - الترهيب من اليمين الكاذبة ۱۸۳۰ و ۱۸۳۱ حدیث
NEAR SIN اليمين الغموس ← ١٦ - كتاب البيوع وغيرها ۱۸ - الترهيب من اليمين الكاذبة ١٨٣٤ - ١٨٣٦- حديث
NEAR SIN اليمين الغموس ← ١٦ - كتاب البيوع وغيرها ١٨ - الترهيب من اليمين الكاذبة ۱۸۳۷ و ۱۸۳۸- حدیث
NEAR SIN اليمين الغموس ← ١٦ - كتاب البيوع وغيرها ١٨ - الترهيب من اليمين الكاذبة . ١٨٤٢ و ١٨٤٣ - حدیث
NEAR SIN إباق العبد ← ١٦ - كتاب البيوع وغيرها ٢٤ - ترهيب العبد من الإباق من سيده ۱۸۸۵ - ۱۸۸۷ - حدیث
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ ـ كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ - كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء . ۱۹۲۳ - ۱۹۲۷ - حدیث
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ - كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء. ۱۹۲۸ و ۱۹۲۹ - حدیث
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ - كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء ۱۹۳۲ و ۱۹۳۳ - حدیث
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ ـ كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء . ١٩٣٤ و ۱۹٣٥ - حدیث
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ - كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ - كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء ۱۹۳۸ - ١٩٤٠ - حديث
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ - كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء ١٩٤١ - ١٩٤٣ - حديث
NEAR SIN الغدر وعدم الوفاء بالعهد ← ۱۷ - كتاب النكاح وما يتعلق به - ترغيب الزوج في الوفاء ١٩٤٤ - ١٩٤٧ - حديث
NEAR SIN نشوز المرأة على زوجها ← ١٠ ـ ( الترهيب من إفساد المرأة على زوجها والعبد على سيده )
NEAR SIN نشوز المرأة على زوجها ← ۱۷ ـ كتاب النكاح وما يتعلق به ١١ - ترهيب المرأة أن تسأل الطلاق .
NEAR SIN نشوز المرأة على زوجها ← ۱۷ - كتاب النكاح وما يتعلق به ۱۲ - ترهيب المرأة أن تخرج . ۲۰۱۹ و ۲۰۲۰ - حدیث
NEAR SIN نشوز المرأة على زوجها ← ۱۷ ـ كتاب النكاح وما يتعلق به ۱۲ - ترهيب المرأة أن تخرج .
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ - كتاب اللباس والزينة ه - ترهيب الرجال من لبسهم الحرير . ٢٠١٦ - ٢٠٤٨ - حديث
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ ـ كتاب اللباس والزينة ه - ترهيب الرجال من لبسهم الحرير . ٢٠٤٩ - ٢٠٥١ - حدیث
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ ـ كتاب اللباس والزينة ه - ترهيب الرجال من لبسهم الحرير . ٢٠٥٢ - ٢٠٥٤ - حديث
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ - كتاب اللباس والزينة ٥ - ترهيب الرجال من لبسهم الحرير. ٢٠٥٥ و ٢٠٥٦ - حديث
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ - كتاب اللباس والزينة ه - ترهيب الرجال من لبسهم الحرير . ٢٠٥٧ - ٢٠٦٠ - حديث
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ ـ كتاب اللباس والزينة ه - ترهيب الرجال من لبسهم الحرير . ٢٠٦١ و ٢٠٦٢ - حدیث
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ - كتاب اللباس والزينة ه - ترهيب الرجال من لبسهم الحرير . ٢٠٦٣ - ٢٠٦٥ - حديث
NEAR SIN لبس الحرير والذهب للرجال ← ۱۸ ـ كتاب اللباس والزينة ٥ - ترهيب الرجال من لبسهم الحرير ٢٠٦٦ و ٢٠٦٧ - حدیث
NEAR SIN نشوز المرأة على زوجها ← ٦ - ( الترهيب من تشبه الرجل بالمرأة ، أو المرأة بالرجل في لباس أو كلام أو حركة أو نحو ذلك )
NEAR SIN لبس الحرير والذهب للرجال ← ۱۲ - ( الترغيب في الكحل بالإثمد للرجال والنساء )
NEAR SIN غش الإمام الرعية وظلمه لهم ← ۲۰ - كتاب القضاء وغيره ١١ - ترغيب الإمام في اتخاذ وزير . ٢٢٩٦ و ۲۲۹۷ - حدیث
NEAR SIN غش الإمام الرعية وظلمه لهم ← ۲۰ - كتاب القضاء وغيره ۱۱ - ترغيب الإمام في اتخاذ وزير .
NEAR SIN أن يقتل الإنسان نفسه ← ۱۰ - ( الترهيب من قتل الإنسان نفسه )
NEAR SIN أن يقتل الإنسان نفسه ← ۲۱ - كتاب الحدود وغيرها ۱۰ - الترهيب من قتل الإنسان نفسه ٢٤٥٦ و ٢٤٥٧ - حدیث
NEAR SIN أن يقتل الإنسان نفسه ← ۲۱ - كتاب الحدود وغيرها ١٠ - الترهيب من قتل الإنسان نفسه ٢٤٥٨ و ٢٤٥٩ - حدیث
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما - الترغيب في بر الوالدين .. ٢٤٨١ و ٢٤٨٢ - حدیث
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .... ٢٤٨٣ و ٢٤٨٤ - حدیث
NEAR SIN عقوق الوالدين ← ٢٢ - كتاب البر والصلة وغيرهما 1 - الترغيب في بر الوالدين ٢٤٨٥ و ٢٤٨٦ - حدیث
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .. ٢٤٨٩ - ٢٤٩١ - حديث
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .. ٢٤٩٢ - ٢٤٩٦ - حديث
NEAR SIN عقوق الوالدين ← ٢٢ - كتاب البر والصلة وغيرهما - الترغيب في بر الوالدين .
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .
NEAR SIN عقوق الوالدين ← ٢٢ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين .
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين . ٢٥٠٢ - ٢٥٠٤ - حديث
NEAR SIN عقوق الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ١ - الترغيب في بر الوالدين . ٢٥٠٥ و ٢٥٠٦ - حديث
NEAR GOOD_DEED بر الوالدين ← ۲ - ( الترهيب من عقوق الوالدين )
NEAR GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ٢ - الترهيب من عقوق الوالدين . ٢٥٠٩ و ٢٥١٠ - حدیث
NEAR GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ۲ - الترهيب من عقوق الوالدين . ٢٥١١ - ٢٥١٣ - حدیث
NEAR GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ۲ - الترهيب من عقوق الوالدين . ٢٥١٤ و ٢٥١٥ - حدیث
NEAR GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ٢ - الترهيب من عقوق الوالدين
NEAR GOOD_DEED بر الوالدين ← ۲۲ - كتاب البر والصلة وغيرهما ٢ - الترهيب من عقوق الوالدين .
NEAR SIN أكل مال اليتيم وظلمه ← ٢٢ - كتاب البر والصلة وغيرهما ٤ - الترغيب في كفالة اليتيم ورحمته ٢٥٤١ - ٢٥٤٣ - حديث
NEAR SIN أكل مال اليتيم وظلمه ← ۲۲ - كتاب البر والصلة وغيرهما ٤ - الترغيب في كفالة اليتيم ورحمته ٢٩٤٤ - ٢٥٤٦ - حديث
NEAR SIN أكل مال اليتيم وظلمه ← ٢٢ - كتاب البر والصلة وغيرهما ٤ - الترغيب في كفالة اليتيم ورحـ
NEAR SIN أن يقتل الإنسان نفسه ← ۱۱ - ( الترهيب من عَوْدِ الإنسان في هِبَتِهِ )
NEAR SIN أن يقتل الإنسان نفسه ← ۲۲ - كتاب البر والصلة وغيرهما ١١ - الترهيب من عود الإنسان في هبته ٢٦١٣ - حديث
NEAR SIN أذى المسلمين وشتمهم ← ١٢ - ( الترغيب في قضاء حوائج المسلمين وإدخال السرور عليهم ،
NEAR SIN أذية عباد الله والتطول عليهم ← ١٢ - ( الترغيب في قضاء حوائج المسلمين وإدخال السرور عليهم ،
NEAR SIN أذى المسلمين وشتمهم ← ٢٢ - كتاب البر والصلة وغيرهما ۱۲ - الترغيب في قضاء حوائج المسلمين
NEAR SIN أذى المسلمين وشتمهم ← ٢٢ - كتاب البر والصلة وغيرهما ۱۲ - الترغيب في قضاء حوائج المسلمين ٢٦٢٤ - حديث
NEAR SIN أن يقتل الإنسان نفسه ← ٩ - ( الترغيب في العزلة لمن لا يأمن على نفسه عند الاختلاط )
NEAR SIN قطع الطريق ← ۲۸ - ( الترغيب في إماطة الأذى عن الطريق ، وغير ذلك مما يذكر )
NEAR SIN أن يقتل الإنسان نفسه ← ۳۷ - ( الترهيب من أن ينام الإنسان على وجهه من غير عذر )
NEAR SIN نشوز المرأة على زوجها ← ۲۳ - كتاب الأدب وغيره ٤٣ - الترهيب من المرأة لوحدها .
NEAR SIN نشوز المرأة على زوجها ← ۲۳ - كتاب الأدب وغيره ٤٣ - الترهيب من سفر المرأة لوحدها .
NEAR SIN الإضرار في الوصية ← ٢٥ - كتاب الجنائز وما يتقدمها ۹ - الترغيب في الوصية . ٣٤٨٢ و ٣٤٨٣ - حدیث
NEAR SIN نشوز المرأة على زوجها ← ۱۸ - ( الترهيب من إحداد المرأة على غير زوجها فوق ثلاث
NEAR SIN أكل مال اليتيم وظلمه ← ۱۹ - ( الترهيب من أكل مال اليتيم بغير حق )
NEAR SIN أكل مال اليتيم وظلمه ← ٢٥ - كتاب الجنائز وما يتقدمها ۱۹ - الترهيب من أكل مال اليتيم ..
NEAR SIN تشبه النساء بالرجال وتشبه الرجال بالنساء ← ٢٠ - ( الترغيب في زيارة الرجال القبور ، والترهيب من زيارة النساء لها واتباعهن الجنائز )
```

### OCR stays off the public API

`GradePolicy.publicTextClause()` is separate from the grade filter: a row is public only when `textSource` is not OCR, or `textVerifiedAt` is set. It is applied on quote list, detail, and explanations; hadith list and collection counts; Quran list and detail; sin, good-deed, and branch link lists and the shuffle SQL; favorite list and add. Admin `GET /v1/admin/quotes?textSource=OCR&unverifiedOnly=true` lists them, and `POST /v1/admin/quotes/:id/text-verification` sets `textVerifiedAt`.

After the stamp on `riyad:1:1` was cleared, all 5,858 Waqfeya quotes have `textSource=OCR` and `textVerifiedAt` null.

Verification, Node 22.19.0:

```
pnpm exec tsc --noEmit -p tsconfig.json          # exit 0
pnpm exec prisma validate                        # schema valid
pnpm exec vitest run                             # 32 files, 340 tests passed
pnpm exec vitest run --config ./vitest.config.e2e.ts
                                                 # 16 files, 255 tests passed
```

The e2e case `public routes hide unverified OCR and keep a verified OCR quote` checks list, detail, explanations, hadith, sin quotes, favorites (422), the admin filter, and the verify endpoint. The OCR fixture ids are `…0f6` and `…0f7` so they do not collide with `Q_DAIF` (`…0f4`) in the branches e2e.

## Takhrij — al-Sahihayn

A hadith is public only when `gradeSource` is `AUTO_SAHIHAYN` or `MANUAL`, the text passes the existing OCR gate, and the quote has no open flag of severity HIGH. Stored al-Albani grades stay on the row as `AUTHORITY_LEGACY` and no longer publish. Re-importing *Sahih al-Targhib* writes the text and chapters only.

### Corpus

OpenITI/RELEASE `a7b7fe07f523fe04a9dbdb4fa0c4e86968b3d76e`. Files live in `backend/.corpus` (gitignored).

| Book | File | SHA-256 | Parsed | Cited total | Gaps inside the file numbering |
| --- | --- | --- | --- | --- | --- |
| Sahih al-Bukhari | `0256Bukhari.Sahih.Shamela0001681-ara1` | `16f95173b9ea1927b577ff85dc7e2a8351b8287e4ea9863782c4c5fc87ac8132` | 7,380 | 7,563 (Fath al-Bari / Abdul Baqi) | 183 numbers absent from the file. Number 1 occurs twice; the longer text is kept |
| Sahih Muslim | `0261Muslim.Sahih.JK000109-ara1` | `32b8b949d80d22d3db81be52d8749bc191f12510c8afe19868589bc4b08605e8` | 3,027 | 3,033 (Abdul Baqi) | Missing 937, 1065, 1173, 1367, 1683, 1824. 1,914 numbers have a second chain; the longer text is kept |

The first Bukhari load used `0256Bukhari.Sahih.JK000110-ara1.completed` (7,124 rows, sha256 `69e95684acfde24171d29dd7ba43ff2c8f9b54ade5e3ab0a73899c06671082b7`). That file's numbers are not the Fath al-Bari numbering: «إن الصدق يهدي إلى البر» was 5743 there and is 6094 in the standard count. The Shamela file above is the one now stored. Checked in the database after the reload:

| Book | Number | Start of the stored matn |
| --- | --- | --- |
| Bukhari | 1 | إنما الأعمال بالنيات |
| Bukhari | 3261 | الحمى من فيح جهنم |
| Bukhari | 6094 | إن الصدق يهدي إلى البر |
| Bukhari | 7563 | كلمتان حبيبتان إلى الرحمن |
| Muslim | 1 | لا تكذبوا علي (the muqaddima, not the hadith of Jibril) |
| Muslim | 8 | الإسلام أن تشهد أن لا إله إلا الله (the hadith of Jibril) |
| Muslim | 2564 | لا تحاسدوا ولا تناجشوا |

Muslim's continuous Abdul Baqi number sits in parentheses in the Halabi print (Aljam3 book 6237, file 16061, «صحيح مسلم (ط. الحلبي) (ت عبد الباقي)»). On the printed page the hadith of Jibril is `١ - (٨)`: the ١ is the first hadith of that chapter, and ٨ is the continuous number. Page 1986 has `٣٢ - (٢٥٦٤)` for «لا تحاسدوا ولا تناجشوا». Publishing the chapter-local ١ as if it were the unique number would collide with the muqaddima and would move 2564. The stored Muslim numbers are the parenthesis numbers. The JK file agrees (Jibril is 8, the envy hadith is 2564, the maximum is 3033).

Two Muslim lines had a hadith number glued to the next one (`# 291429132913 2913` and `# 293429352935 2935`). The parser keeps the last number that is at most 20,000, so those narrations are stored as 2913 and 2935. This corpus is a matching table (`ReferenceHadith`), not public quotes. After the edition switch, a following load created 0 rows (7,380 and 3,027 unchanged).

Footnote markers of the form `\ 1 \` are stripped before the matn is stored. None remain on `ReferenceHadith.matnText`. The isnad/matn split leaves 23 Bukhari rows and 43 Muslim rows whose matn still opens with حدثنا or أخبرنا: the companion's report has no قال, or the words after قال are themselves another chain (`قال: حدثني ناس`). The earlier JK load left 3,319 Bukhari rows and 694 Muslim rows in that state.

### Matching

For each of 17,933 hadith quotes the matn is split at the last transmission phrase before the Prophet's words, then normalised. Candidates come from a rare-word shortlist, then `pg_trgm` `similarity()` and word overlap are averaged (`trgm+overlap`). The top 5 candidates with a combined score of at least 0.30 are stored. That is 16,634 `HadithMatch` rows. A later run created 0. A public quote with `AUTO_SAHIHAYN` is shown as the matched matn (no isnad, no footnote markers), and the book it was imported from stays as a second citation.

Strong match is a combined score of at least **0.75**. The quote is then `SAHIH`, `gradeSource = AUTO_SAHIHAYN`, authority «رواه البخاري» / «رواه مسلم» / «متفق عليه», and `gradeReference` like `البخاري 6064` (both books joined with `، `). A `MANUAL` grade is never overwritten. The weak band is 0.48 up to 0.75.

### Threshold

The calibration sample below was judged against the previous JK Bukhari file, so the Bukhari numbers in that table are not the numbers now published. «إن الصدق يهدي إلى البر» is row 43 there as Bukhari 5743; the stored standard number is 6094. The sample is the best candidate per quote, taken in quote-id order: 10 at 0.95 or above, 10 from 0.85–0.95, 15 from 0.75–0.85, 15 from 0.72–0.75. All 50 were judged the same narration (an excerpt of that hadith counts as the same). Precision of score ≥ 0.75 on this sample is 35/35.

The cut is 0.75 rather than 0.72 because a pair **outside** that slice is a different narration: Shuab al-Iman «من قام ليلة القدر إيمانا واحتسابا…» scored 0.720 against Bukhari 37 «من قام رمضان إيمانا واحتسابا…». The quote ends with the chapter heading «التماس ليلة القدر من ليالي شهر رمضان», which pulled the short Ramadan narration over the line. At 0.75 that pair stays a weak flag and is not published. The 15 sample pairs below 0.75 were still the same narration, so the cut drops some true matches.

Texts below are the normalised matn, clipped.

| # | Score | Cut | Citation | Source | Our matn | Reference matn |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1.000 | at/above | Muslim 2589 | صحيح مسلم | أتدرون ما الغيبة… فقد بهته | same wording |
| 2 | 1.000 | at/above | Bukhari 5763 | صحيح البخاري | ليس الشديد بالصرعة… عند الغضب | same wording |
| 3 | 1.000 | at/above | Bukhari 5640 | صحيح البخاري | من أحب أن يبسط له في رزقه… فليصل رحمه | same wording |
| 4 | 1.000 | at/above | Bukhari 5668 | الأدب المفرد | ما زال جبريل يوصيني بالجار… سيورثه | word order differs |
| 5 | 0.958 | at/above | Muslim 2320 | شعب الإيمان | أشد حياء من العذراء في خدرها | same wording |
| 6 | 1.000 | at/above | Bukhari 3275 | شعب الإيمان | إن اليهود والنصارى لا يصبغون فخالفوهم | same wording |
| 7 | 1.000 | at/above | Bukhari 5669 | شعب الإيمان | ما زال جبريل يوصيني بالجار | same wording |
| 8 | 1.000 | at/above | Bukhari 5669 | الأدب المفرد | ما زال جبريل يوصيني بالجار | same wording |
| 9 | 1.000 | at/above | Bukhari 5989 | الأدب المفرد | نهانا أن ندعو بالموت لدعوت به | same wording |
| 10 | 1.000 | at/above | Bukhari 3364 | شعب الإيمان | بعثت من خير قرون بني آدم | same wording |
| 11 | 0.877 | at/above | Muslim 47 | صحيح البخاري | من كان يؤمن بالله… فليقل خيرا أو ليصمت | excerpt of the longer narration |
| 12 | 0.875 | at/above | Muslim 2607 | صحيح البخاري | عليكم بالصدق… يكتب عند الله صديقا | excerpt; the reference continues into الكذب |
| 13 | 0.935 | at/above | Muslim 408 | الأدب المفرد | من صلى علي واحدة صلى الله عليه عشرا | same wording |
| 14 | 0.858 | at/above | Bukhari 5948 | رياض الصالحين | والله إني لأستغفر الله… أكثر من سبعين مرة | same wording |
| 15 | 0.929 | at/above | Bukhari 5674 | الأدب المفرد | إن لي جارين فإلى أيهما أهدي… أقربهما منك بابا | same isnad and matn |
| 16 | 0.915 | at/above | Muslim 2581 | رياض الصالحين | أتدرون ما المفلس | same wording |
| 17 | 0.894 | at/above | Muslim 2676 | شعب الإيمان | سبق المفردون… الذاكرون الله كثيرا | same wording |
| 18 | 0.887 | at/above | Bukhari 5792 | الأدب المفرد | هي النخلة | same story |
| 19 | 0.850 | at/above | Muslim 251 | رياض الصالحين | ألا أدلكم على ما يمحو الله به الخطايا | same wording |
| 20 | 0.896 | at/above | Bukhari 5947 | الأدب المفرد | سيد الاستغفار | same dua |
| 21 | 0.833 | at/above | Bukhari 847 | رياض الصالحين | لولا أن أشق على أمتي… بالسواك مع كل صلاة | same wording |
| 22 | 0.761 | at/above | Muslim 2573 | شعب الإيمان | ما يصيب المؤمن من نصب ولا وصب… | same isnad and matn |
| 23 | 0.805 | at/above | Muslim 8 | صحيح الترغيب | حديث جبريل. A Quran verse is pasted into the answer about iman. Same narration. OCR, so not public | Muslim 8 |
| 24 | 0.757 | at/above | Muslim 2179 | الأدب المفرد | إذا قام أحدكم من مجلسه ثم رجع إليه فهو أحق به | same wording |
| 25 | 0.768 | at/above | Muslim 2829 | صحيح الترغيب | إن الله يقول لأهل الجنة… أحل عليكم رضواني | same wording |
| 26 | 0.786 | at/above | Bukhari 1357 | شعب الإيمان | سبعة يظلهم الله في ظله | same seven, small wording differences |
| 27 | 0.753 | at/above | Muslim 2551 | صحيح الترغيب | رغم أنفه… من أدرك والديه عند الكبر | same wording |
| 28 | 0.794 | at/above | Bukhari 881 | رياض الصالحين | أتي بمال أو سبي فقسمه | same wording, عمرو بن تغلب |
| 29 | 0.763 | at/above | Bukhari 5607 | رياض الصالحين | إن الذين يصنعون هذه الصور… أحيوا ما خلقتم | our text has أحبوا where the reference has أحيوا |
| 30 | 0.804 | at/above | Muslim 338 | شعب الإيمان | لا ينظر الرجل إلى عورة الرجل | same wording |
| 31 | 0.782 | at/above | Bukhari 69 | صحيح الترغيب | يسروا ولا تعسروا وبشروا ولا تنفروا | same wording |
| 32 | 0.805 | at/above | Muslim 669 | شعب الإيمان | من غدا إلى المسجد أو راح أعد الله له نزلا | same wording |
| 33 | 0.750 | at/above | Muslim 1054 | شعب الإيمان | قد أفلح من أسلم ورزق كفافا | same wording |
| 34 | 0.796 | at/above | Bukhari 6008 | الأدب المفرد | اللهم إني أعوذ بك من الهم والحزن | same dua |
| 35 | 0.840 | at/above | Bukhari 5663 | شعب الإيمان | بينما رجل يمشي بطريق اشتد عليه العطش… كل ذات كبد رطبة | same wording |
| 36 | 0.720 | below | Bukhari 2848 | رياض الصالحين | عجب الله من قوم يدخلون الجنة في السلاسل | same wording, plus a gloss |
| 37 | 0.726 | below | Muslim 2255 | الأدب المفرد | هل معك من شعر أمية بن أبي الصلت | same isnad and matn |
| 38 | 0.741 | below | Muslim 876 | الأدب المفرد | رجل غريب جاء يسأل عن دينه | same story |
| 39 | 0.730 | below | Bukhari 1376 | شعب الإيمان | على كل مسلم صدقة… فليعمل بيده | excerpt of the longer narration |
| 40 | 0.733 | below | Bukhari 2308 | الأدب المفرد | إذا خلص المؤمنون من النار حبسوا بقنطرة | same wording |
| 41 | 0.742 | below | Muslim 251 | صحيح الترغيب | ألا أدلكم على ما يمحو الله به الخطايا | same wording |
| 42 | 0.748 | below | Muslim 2807 | صحيح الترغيب | يؤتى بأنعم أهل الدنيا من أهل النار | same wording |
| 43 | 0.738 | below | Bukhari 5743 | رياض الصالحين | إن الصدق يهدي إلى البر | same wording |
| 44 | 0.720 | below | Bukhari 3034 | الأدب المفرد | ما أدري لعله كما قال قوم… عارضا مستقبل أوديتهم | قال الله / قال قوم, same narration |
| 45 | 0.738 | below | Bukhari 6084 | شعب الإيمان | اطلعت في الجنة فرأيت أكثر أهلها الفقراء | same wording |
| 46 | 0.742 | below | Muslim 2674 | رياض الصالحين | من دعا إلى هدى كان له من الأجر | same wording |
| 47 | 0.720 | below | Muslim 2839 | رياض الصالحين | سيحان وجيحان والفرات والنيل كل من أنهار الجنة | same wording |
| 48 | 0.746 | below | Muslim 2088 | شعب الإيمان | بينما رجل يتبختر… فخسف الله به الأرض | same wording |
| 49 | 0.724 | below | Muslim 8 | رياض الصالحين | حديث جبريل, with a verse pasted into the iman answer | Muslim 8 |
| 50 | 0.736 | below | Muslim 476 | الأدب المفرد | اللهم طهرني بالثلج والبرد والماء البارد | same dua, clause order differs |

### Grades by source book

1,008 quotes are `AUTO_SAHIHAYN` after the reload onto the standard numbers (407 Bukhari only, 497 Muslim only, 104 both). Five more matched and stayed `MANUAL`. «Bukhari» means a strong Bukhari match and no strong Muslim match, and the reverse for «Muslim».

| Source | Bukhari | Muslim | Both |
| --- | --- | --- | --- |
| الأدب المفرد | 149 | 43 | 37 |
| الجامع لشعب الإيمان | 109 | 136 | 27 |
| رياض الصالحين | 121 | 185 | 25 |
| صحيح الترغيب والترهيب | 26 | 129 | 12 |
| الزهد والرقائق | 2 | 4 | 3 |

### What stopped being public

Before any match, **903** hadiths were sahih or hasan from a stored authority grade and would have been public. Curated seed hadiths are `MANUAL`, so they stay public and are not in that count. The number is in `backend/.corpus/takhrij-policy-count.json`.

After the 0.75 cut:

- **171** of those 903 are public again (strong sahihayn match, text already public, no open HIGH flag).
- **729** are still `AUTHORITY_LEGACY` with a sahih or hasan grade and public text, so the new rule keeps them hidden.
- **330** further quotes are newly public on a strong match (501 public `AUTO_SAHIHAYN` rows, minus the 171 that returned).
- **507** strong matches are unverified OCR and stay off the public API until `textVerifiedAt` is set. 501 + 507 = 1,008.
- Three of the original 903 are in neither of the first two rows (an open HIGH flag, or a grade that is no longer sahih or hasan). Five curated hadiths matched and stayed `MANUAL`.

### Flags

| Type | Severity | Open |
| --- | --- | --- |
| WEAK_MATCH | MEDIUM | 3,046 |
| OCR_SUSPECT | MEDIUM | 32 |
| DUPLICATE_DIFFERENT_GRADE | HIGH | 11 |
| REFERENCE_MISMATCH | HIGH | 0 |
| QURAN_MISMATCH | HIGH | 0 |
| USER_REPORT | MEDIUM | 1 |

`QURAN_MISMATCH` ran against `backend/.corpus/waqfeya/uthmani.json` and the verse keys already stored on the Waqfeya quotes. An open HIGH flag hides the quote on every public route. `POST /v1/quotes/:id/reports` files a `USER_REPORT` (no account; reason from a short list; 8 requests per minute per IP; the IP is not stored). Three open reports on one quote raise that flag to HIGH. Review routes are `GET/POST /v1/review/*`, for `ADMIN` or `REVIEWER`.

### Twenty strong matches

Ordered by `md5(quote id)`, score at least 0.75, after the standard-number reload. The reference column is the stored matn.

| Score | Citation | Source | Ours | Reference |
| --- | --- | --- | --- | --- |
| 0.830 | Bukhari 750 | صحيح الترغيب والترهيب | ما بال أقوام يرفعون أبصارهم | «ما بال أقوام يرفعون أبصارهم إلى السماء في صلاتهم» |
| 0.766 | Muslim 2549 | شعب الإيمان | أقبل رجل إلى نبي الله… أبايعك على الهجرة | أقبل رجل إلى نبي الله صلى الله عليه وسلم فقال أبايعك على الهجرة والجهاد |
| 0.785 | Bukhari 3124 | رياض الصالحين | غزا نبي من الأنبياء | غزا نبي من الأنبياء، فقال لقومه: لا يتبعني رجل ملك بضع امرأة |
| 0.826 | Muslim 1395 | شعب الإيمان | صلاة في مسجدي هذا | صلاة في مسجدي هذا أفضل من ألف صلاة فيما سواه إلا المسجد الحرام |
| 0.900 | Bukhari 2120 | الأدب المفرد | سموا باسمي ولا تكنوا بكنيتي | «سموا باسمي ولا تكنوا بكنيتي» |
| 0.755 | Muslim 2124 | رياض الصالحين | لعن الواصلة والمستوصلة | لعن الواصلة والمستوصلة والواشمة والمستوشمة |
| 0.831 | Muslim 2577 | صحيح الترغيب والترهيب | يا عبادي إني حرمت الظلم على نفسي | يا عبادي إني حرمت الظلم على نفسي وجعلته بينكم محرما |
| 0.767 | Bukhari 2374 | رياض الصالحين | لأن يحتطب أحدكم حزمة على ظهره | «لأن يحتطب أحدكم حزمة على ظهره، خير له من أن يسأل أحدا» |
| 0.780 | Muslim 2573 | شعب الإيمان | ما يصيب المؤمن من وصب ولا نصب | ما يصيب المؤمن من وصب ولا نصب ولا سقم ولا حزن |
| 0.852 | Muslim 2588 | شعب الإيمان | ما نقصت صدقة من مال | ما نقصت صدقة من مال وما زاد الله عبدا بعفو إلا عزا |
| 0.755 | Bukhari 594 | شعب الإيمان | من ترك صلاة العصر حبط عمله | «من ترك صلاة العصر حبط عمله» |
| 0.767 | Bukhari 5458 | رياض الصالحين | كان إذا رفع مائدته قال الحمد لله | كان إذا رفع مائدته قال: «الحمد لله كثيرا طيبا مباركا فيه» |
| 0.791 | Bukhari 5991 | شعب الإيمان | ليس الواصل بالمكافئ | «ليس الواصل بالمكافئ، ولكن الواصل الذي إذا قطعت رحمه وصلها» |
| 0.770 | Muslim 669 | رياض الصالحين | من غدا إلى المسجد أو راح | من غدا إلى المسجد أو راح أعد الله له في الجنة نزلا |
| 0.794 | Muslim 2959 | شعب الإيمان | يقول العبد مالي مالي | يقول العبد مالي مالي إنما له من ماله ثلاث |
| 0.926 | Muslim 720 | صحيح الترغيب والترهيب | يصبح على كل سلامي من أحدكم صدقة | يصبح على كل سلامي من أحدكم صدقة فكل تسبيحة صدقة |
| 0.920 | Bukhari 7097 | الأدب المفرد | ائذن له وبشره بالجنة | «ائذن له وبشره بالجنة، معها بلاء يصيبه» |
| 0.788 | Muslim 815 | رياض الصالحين | لا حسد إلا في اثنتين | لا حسد إلا في اثنتين رجل آتاه الله القرآن |
| 0.752 | Bukhari 2017 | رياض الصالحين | تحروا ليلة القدر في الوتر | «تحروا ليلة القدر في الوتر، من العشر الأواخر من رمضان» |
| 0.772 | Muslim 118 | رياض الصالحين | بادروا بالأعمال فتنا | بادروا بالأعمال فتنا كقطع الليل المظلم |

### Re-run

The run after the standard numbers were stored, and the in-memory citation was the one just written, created 0 corpus rows, 0 matches, 0 grade writes, and 0 flags.

## Sources cleanup

The two «القرآن الكريم» rows are one public source. Quotes, explanations, chapter maps, branches, and sin ranks that pointed at `10000000-0000-4000-8000-000000000005` (Quran.com) now point at `10000000-0000-4000-8000-000000000001`. The Quran.com row remains, with `canonicalId` set, so `GET /v1/sources/10000000-0000-4000-8000-000000000005` still returns the Quran and the sync log stays on the API source. The catalog hides that alias. A later Quran.com sync writes new verses onto the canonical source.

The four seed rows on «ابن القيم» were not moved. Aljam3 (author 4407, https://aljam3.com/ar/authors/4407) did not return these sentences as his own words in a book I can cite:

| Quote | What the search showed |
| --- | --- |
| اللسان سبع إن أطلق أكل | No hit in his books. A close proverb, «مثل اللسان مثل السبع», is quoted by Ibn Allan in الفتوحات الربانية (book 11113, file «الجزء 06», page 373, https://aljam3.com/ar/11113/27007/373), not as Ibn al-Qayyim's sentence. |
| الغضب جمرة يلقيها الشيطان في قلب ابن آدم | Cited as a hadith (Ahmad / Tirmidhi) in سبل الوقاية من السحر والعين (book 24003, file KTB_0119230, page 28, https://aljam3.com/ar/24003/52122/28). He also quotes that hadith inside الداء والدواء (book 38283, file KTB_0093854, page 122, https://aljam3.com/ar/38283/71255/122). |
| الغيبة أن تذكر أخاك بما يكره… | The seed names Madarij al-Salikin. The search returned this definition from other authors (Ghazali, via طريق النجاة, book 37731, page 128), not a Madarij page. |
| إن الغضب إذا تمكن من القلب أعمى صاحبه… | The seed names Al-Jawab al-Kafi. Searching his books for «حجب عنه نور العقل» and «أعمى صاحبه وأصمه» did not return this sentence. |

They stay on the scholar source until a page that contains the sentence is in hand.


## Full corpus and classification

Date: 2026-10-12. Dev database `thekra`. A second run of each importer below created 0 rows, except where a gap is named.

### Numbering anchors (stored ReferenceHadith and the public Quote)

| Book | Number | Opening of the stored matn |
| --- | --- | --- |
| Bukhari | 1 | إنما الأعمال بالنيات |
| Bukhari | 3261 | الحمى من فيح جهنم |
| Bukhari | 6094 | إن الصدق يهدي إلى البر |
| Bukhari | 7563 | كلمتان حبيبتان إلى الرحمن |
| Muslim | 8 | الإسلام أن تشهد أن لا إله إلا الله (حديث جبريل؛ عبد الباقي prints ١ - (٨)) |
| Muslim | 2564 | لا تحاسدوا ولا تناجشوا |

Muslim 1 remains the muqaddima «لا تكذبوا علي». Jibril is not renumbered to 1.

### Rows

| Source | Imported | Public |
| --- | --- | --- |
| القرآن الكريم (one source, id …0001) | 6236 Uthmani verses, textSource DIGITAL, apiProvider quran.com | 6236 |
| صحيح البخاري | 7380 quotes, gradeSource SAHIHAYN, identity link to ReferenceHadith | 7380 |
| صحيح مسلم | 3027 quotes, same rule | 3027 |
| تفسير السعدي (Quran.com resource 91) | 6177 Explanation rows | shown under the verse |
| التحرير والتنوير | 3843 passages | shown under the verse when the range covers it |

Quran.com has no git commit. The Uthmani sha256 is `589dd914c7e101715c1f0cc1d4a38c2809e8a8c8f78adfd31348e3575b15d3db`. The second stable Quran run was `created=0 updated=0 unchanged=6236`.

Al-Sa'di sha256 `3819e32040dfeff0dcfa9a25ebde49662997b9875580a779c1990a6ae55ac71d`. The chapter pages omit 59 ayat, and a per-ayah fill did not return text for them: 56:48, 2:107, 2:109, 2:111, 2:286, 19:82, 77:37, 6:105, 6:106, 6:107, 12:111, 37:82, 37:96, 16:64, 19:81, 22:18, 26:144, 26:180, 26:183, 79:33, 29:18, 21:110, 37:176, 37:179, 38:85, 43:14, 44:14, 44:44, 44:46, 44:47, 44:48, 50:43, 53:12, 54:26, 54:39, 54:40, 56:60, 56:61, 64:15, 69:15, 74:36, 77:4, 77:9, 77:14, 77:47, 78:11, 79:10, 79:46, 83:19, 83:20, 86:2, 88:18, 89:3, 91:8, 96:10, 55:22, 74:17, 56:30, 109:4. The owner still has to check Quran.com's terms for resource 91.

Ibn Ashur is OpenITI `1400AH` commit `9ecd69d142e2f165f80a52a958aa2cda09048e03`, sha256 `72a02504a798f31092daceb1883f0d4f11c8b0f1ca5fe23e6660b0261e7989a0`. Second run `created=0 updated=0 unchanged=3843`. One heading was not a range (`[سورة إبراهيم: 28] ، وقيل: إلى قوله…`). Two ayat have no passage: 34:5 and 58:16.

### OpenITI text for the four books

A narration that overlaps a Waqfeya row of the same work replaces that row's text and keeps the PDF page. The pin is `rawPayload.openitiExternalId`. A second run created 0 rows and updated 0 rows.

| Work | OpenITI | Result |
| --- | --- | --- |
| رياض الصالحين | `0700AH` `6dca5e250b9e4405b93c4a5e73cfffdef5d7fef7`, sha256 `a601cbcb6b1846c00f10e9fb38377bb1609fe664d90fe01f1506aa9c10d5d88e` | 1894 narrations, 422 Quran spans. 1847 Waqfeya rows updated in place. 47 narrations had no OCR twin and were added. |
| الزهد والرقائق | `0200AH` `62b3ebfde6886b17b0ad6c346d7fc79f8ac0fcd8`, sha256 `0c2b26f6bf959f301467a493af0714debb8c0350597df465eadaf2fcce46da3a` | 1604 narrations, 360 Quran spans. 956 Waqfeya rows updated in place. 648 narrations had no OCR twin. |
| مختصر منهاج القاصدين | `0700AH` `6dca5e250b9e4405b93c4a5e73cfffdef5d7fef7`, sha256 `68939b45c8c8a60b3dbf145a0c0bc17e9fccbfc05a2278b30757160bad556ed3` | 161 chapters and 105 prophet-speech paragraphs (266 rows), 229 Quran spans. There were no OCR quotes to replace. |
| الكبائر | `0750AH` `9168f4a124537948de88cba6adfacf560bc35d35`, sha256 `4cccf7f3de5da10fcc52f78422f5a03dfc6ea4fd29ac15da72935be169783b1a` | 67 sections and 144 narrations (211 rows), 348 Quran spans. Each row is linked to the sin already ranked from that كبيرة. |

The new hadith rows are UNGRADED. They are not public until a later sahihayn match. The kabira section itself is the author's prose (BOOK_EXCERPT) and can be read on the sin. The rank import is unchanged.

### Takhrij

Standing AUTO_SAHIHAYN grades were not re-counted in this pass. The public Sahihayn quotes are gradeSource SAHIHAYN (7380 + 3027) and are excluded from the matcher so they are not graded a second time as matches of themselves. Footnote markers on ReferenceHadith.matnText remain 0.

### Flags

| Type | Open |
| --- | --- |
| WEAK_MATCH | 3046 |
| WEAK_TAFSIR_SUPPORT | 2226 |
| AMBIGUOUS_CHAPTER | 129 |
| OCR_SUSPECT | 32 |
| DUPLICATE_DIFFERENT_GRADE | 11 |
| USER_REPORT | 1 |

### Chapters and entities

Distinct titles after the OpenITI chapters were included: AVOID 590, DO 884, NEUTRAL 2108, AMBIGUOUS 45. A repeat of that run created 0 entities and 0 links.

Entities created (origin AUTO_CHAPTER): 422 sins, 721 deeds. Curated rows were left as they were (73 sins, 8 deeds). The name is whatever follows the class word, so some names are a whole chapter remainder or a fragment. They need the owner's review before they are treated as settled topics.

Links from chapters: 1939 sin links, 2898 deed links, ACCEPTED when the title had one class word and a topic. Ambiguous titles were flagged and not attached to a single entity. A second classification run created 0 entities, 0 links, and 0 flags.

Al-Sa'di links: 2891, of which 670 are ACCEPTED (the sentence names the subject and the warning or the praise matches). The rest are NOT_REVIEWED with WEAK_TAFSIR_SUPPORT.

Chapter-map suggestions started at 172 unreviewed. 35 were marked reviewed because the rule and the suggested entity's name are the same topic. The rest stay unreviewed because the suggested name is not that topic. Restoring the Riyad OCR text before the OpenITI pass created 355 further suggestions, so 470 remain unreviewed.

A public list hides an entity with 0 published texts until «إظهار الكل». Sins with none: 325. Deeds with none: 515.

#### Top published texts

| Kind | Name | Published texts |
| --- | --- | --- |
| SIN | المنكر | 37 |
| SIN | السباب | 36 |
| SIN | تولي | 22 |
| SIN | الرياء | 17 |
| SIN | الغيبة | 15 |
| SIN | المسألة | 12 |
| SIN | الفواحش | 10 |
| SIN | استعمال إناء الذهب والفضة على الرجال والنساء وخاتم | 10 |
| SIN | تصوير صورة الحيوان وتحريم اتخاذ ما فيه صورة غير | 9 |
| SIN | الانتباذ في المزفت والدباء والحنتم والنقير وبيان | 9 |
| SIN | الشرك بالله | 8 |
| SIN | أكل لحوم الأضاحي بعد ثلاث في أول | 8 |
| SIN | البصاق في المسجد في الصلاة وغيرها | 8 |
| SIN | أكل لحم الحمر الإنسية | 7 |
| SIN | السرقة | 7 |
| SIN | اقتنائها إلا | 7 |
| SIN | الظلم | 7 |
| SIN | الفروج، وما يجب من التعفف عنها | 7 |
| SIN | فعل الواصلة والمستوصلة والواشمة والمستوشمة والنامصة | 6 |
| SIN | الخيانة | 6 |
| SIN | بناء المساجد على القبور واتخاذ الصور فيها والنهي | 5 |
| SIN | ابتداء أهل الكتاب بالسلام وكيف يرد عليهم | 5 |
| SIN | قتل الإنسان نفسه وإن من قتل نفسه بشيء عذب به في | 5 |
| SIN | قطيعتها | 5 |
| SIN | الصيد للمحرم | 5 |
| SIN | 1 ( 24 باب النهى عن لعن الدواب وغيرها | 5 |
| SIN | التكني بأبي القاسم وبيان ما يستحب من الأسماء | 5 |
| SIN | الغدر | 4 |
| SIN | الخمر وبيان أنها تكون من عصير العنب ومن التمر والبسر | 4 |
| SIN | النميمة | 4 |
| DEED | السلام | 123 |
| DEED | سبيل | 73 |
| DEED | الصلاة في مسجد مكة والمدينة | 49 |
| DEED | أن لا | 42 |
| DEED | الإخلاص | 30 |
| DEED | الدعاء | 28 |
| DEED | الصدقة | 27 |
| DEED | التوبة | 27 |
| DEED | الكبير | 23 |
| DEED | الصلوات | 16 |
| DEED | المعروف | 16 |
| DEED | ليلة القدر | 15 |
| DEED | الرجاء | 13 |
| DEED | المدينة ودعاء النبي صلى الله عليه وسلم فيها بالبركة | 12 |
| DEED | عائشة رضي الله تعالى عنهما | 10 |
| DEED | التداوي | 9 |
| DEED | التواضع | 9 |
| DEED | الأول فالأول منها والازدحام | 9 |
| DEED | التهليل والتسبيح والدعاء | 8 |
| DEED | إيثاره | 8 |
| DEED | الاستغفار | 8 |
| DEED | بناء | 8 |
| DEED | الرقية من العين والنملة والحمة والنظرة | 7 |
| DEED | صلاة الضحى وأن أقلها ركعتان وأكملها ثمان ركعات | 7 |
| DEED | 1 ( 26 باب إستحباب الذكر بعد الصلاة وبيان صفته | 7 |
| DEED | طلبها وبيان محلها وأرجى أوقات | 7 |
| DEED | الصلوات الخمس | 6 |
| DEED | تقديم دفع الضعفة من النساء وغيرهن من مزدلفة إلى | 6 |
| DEED | النفقة والصدقة على الأقربين والزوج والأولاد والوالدين | 6 |
| DEED | تحنيك المولود عند ولادته وحمله إلى صالح يحنكه | 6 |

#### Sins with no published text

- أخذ الرشوة على الحكم
- أذى الجار
- أذى الجار ٢٥٤٨ و ٢٥٤٩ - حدیث
- أذى الجار ٢٥٥٢ - ٢٥٥٥ - حديث
- أذى الجار ٢٥٦١ و ٢٥٦٢ .
- أذى المسلمين وشتمهم
- أذية عباد الله والتطول عليهم
- أكل الحرام وتناوله على أي وجه كان
- أكل المال الباطل
- أكل مال اليتيم ..
- أكل مال اليتيم بغير حق )
- أكل مال اليتيم وظلمه
- أن يأمر ... ويخالف
- أن يأمر ... ويخالف ۲۳۲۸ - ۲۳۳۱ - حدیث
- أن يأمر بمعروف وينهى عن منكر ويخالف قوله فعله )
- أن يجلس مجلساً لا يذكر الله فيه . ١٥١٤ و ١٥١٥ - حديث
- أن يدعى إلى الطعام .... ٢١٥٢ و ٢١٥٣ - حدیث
- أن يدعى إلى الطعام .... ٢١٥٤ - ٢١٥٧ - حدیث
- أن يعلم ولا يعمل
- أن يعلم ولا يعمل ..
- أن يقتل الإنسان نفسه
- أن يموت الإنسان ولم يغز . ۱۳۹۰ - ۱۳۹۳ - حدیث
- أن يموت الإنسان ولم يغز . ۱۳۹۵ و ١٣٩٦ - حدیث
- أن ينام الإنسان على وجهه من غير عذر )
- أن ينام المرء على سطح لا تحجير له ،
- أن ينتسب إلى غير أبيه ١٩٨٧
- إباق العبد
- إحداد المرأة على غير زوجها فوق ثلاث
- إخافة أهل المدينة أو إرادتهم بسوء )
- إخافة أهل المدينة أو إرادتهم بسوء ١٢١٤ و ١٢١٥۔ حدیث
- إسبال الإزار والثوب واللباس والسراويل تعززا وعجبا وفخرا وخيلاء
- إصابة البول الثوب
- إصابة البول الثوب ... ١٦١ - ١٦٣ - حديث
- إفساد المرأة على زوجها والعبد على سيده )
- إفشاء السر سيما ما كان بين الزوجين )
- إفطار شيء من رمضان من غير عذر ١٠٠٥ - حديث
- إفطار يوم من رمضان بلا عذر
- إمامة الرجل القوم وهم له كارهون )
- احتقار المسلم . ٢٩٦٠ - ٢٩٦٢ - حديث
- احتقار المسلم ٢٩٦٣ و ٢٩٦٤ - حدیث
- ارتكاب الصغائر
- ارتكاب الصغائر .
- ارتكاب الصغائر والمحقرات من الذنوب ،
- استبطاء الإجابة وقوله : دعوت فلم يستجب لي )
- استعمال أواني الذهب والفضة ،
- اصطحاب الكلب ۳۱۱۰ - ۳۱۱۹ - حدیث
- اصطحاب الكلب ۳۱۲۰ و ۳۱۲۱ - حدیث
- اقتناء الكلب إلا لصيد أو ماشية )
- الأكل بالشمال . ٢١١٦ - ۲۱۱۹ - حدیث
- الأكل بالشمال . ۲۱۲۰ و ۲۱۲۱ - حدیث
- الأمن من مكر الله
- الإصرار على ترك صلاة الجمعة والجماعة من غير عذر
- الإضرار في الوصية
- الإمعان في التشبع . ۲۱۳۵ - ۱۲۳۷ - حدیث
- الإمعان في التشبع ٢۱۳۸ - ٢١٤١ - حديث
- الإمعان في التشبع. ٢١٥٠ و ٢١٥١ - حدیث
- الإمعان في التشيع ٢١٤٦ - ٢١٤٩ - حديث
- الاحتكار )
- الاستطالة على الضعيف والمملوك والجارية والزوجة والدابة
- الالتفات في الصلاة
- الالتفات في الصلاة وغيره مما يذكر )
- البخل
- البغي
- البناء فوق الحاجة
- البناء فوق الحاجة . ۱۸۷۵۰ و ١٨٧٦ - حدیث
- البناء فوق الحاجة تفاخراً وتكاثراً )
- البناء فوق الحاجة ١٦ - كتاب البيوع وغيرها
- البول في الماء والمغتسل والجخر )
- التخلي على طرق الناس
- التخلي على طرق الناس . ١٤٥ و ١٤٦ - حديث
- التخلي على طرق الناس . ١٤٧ - ١٤٩ - حديث
- التسمع على الناس وما يسرون
- التصوير في الثياب والحيطان والحجر والدراهم وسائر الأشياء سواء كانت من شمع أو عجين أو حديد أو نحاس أو صوف أو غير ذلك والأمر بإتلافها
- التعلم للدنيا وكتمان العلم
- التفريق بين الوالدة وولدها بالبيع ونحوه )
- التكذيب بالقدر
- التهاجر
- التهاجر ..
- التهاجر والتشاحن والتدابر )
- الجدل والمراء واللدد
- الجلوس بين الظل
- الجلوس بين الظل والشمس ،
- الجلوس على القبر . ٣٥٦٧ - حدیث
- الجلوس على القبر ، وكسر عظم الميت )
- الحلف بغير الله . ٢٩٥٣ - ٢٩٥٦ - حديث
- الحلف بغير الله ٢٩٥١ و ٢٩٥٢ - حدیث
- الخروج من المسجد بعد الأذان لغير عذر )
- الدعوى في العلم والقرآن )
- الدين
- الدين .
- الدين ، وترغيب المستدين والمتزوج أن
- الديوث المستحسن على أهله والقواد الساعي بين الإثنين بالفساد
- الذبح لغير الله عز وجل
- الربا
- الربا )
- الرياء وما يقوله من خاف شيئاً منه )
- الزنا
- الزنا .
- الزنا.
- السباب واللعن سيما لمعين ،
- السحر
- السحر .
- السحر ، وإتيان الكهان والعرافين والمنجمين بالرمل والحصى أو نحو ذلك وتصديقهم )
- الطيرة )
- الظلم .
- العُقوقِ وقَطِيعَةِ الرَّحِم
- الغدر وعدم الوفاء بالعهد
- الغش ١٦ - كتاب البيوع وغيرها
- الغلول من الغنيمة
- الغلول والتشديد فيه
- الغلول والتشديد فيه ، وما جاء
- الغيبة .
- الفرار من الزحف )
- القاضي السوء
- الكبر، والإعجاب
- الكذب على الله عز وجل وعلى رسوله صلى الله عليه وسلم
- الكذب في غالب أقواله
- اللطم والنياحة وشق الثوب وحلق الرأس ونتفه والدعاء بالويل والثبور عند المصيبة
- اللعب بالنرد (۱) )
- المثلة بالحيوان ، ومن قتله لغير الأكل ،
- المحلل والمحلل له
- المرأة لوحدها .
- المراء والجدال
- المرور بقبور .
- المرور بقبور . ٣٥٤٨ - ٣٥٥٠ - حديث
- المرور بقبور . ٣٥٥١ و ٣٥٥٢ - حدیث
- المرور بقبور الظالمين وديارهم ومصارعهم
- المرور بين يدي المصلي )
- المرور بين يدي المصلي ٥٦١ و ٥٦٢ ـ حدیث
- المسألة وتحريمها مع الغنى
- المسألة وتحريمها مع الغنى .
- المسلم .
- الملاعب والملاهي
- المنان
- النار
- النار .
- النار أعاذنا الله منها بمنه وكرمه [ويشتمل على فصول] )
- النميمة )
- النياحة .
- النياحة على الميت والنعي ولطم الخد وخمش الوجه وشق الجيب )
- اليمين الغموس
- اليمين الكاذبة . ١٨٤٢ و ١٨٤٣ - حدیث
- اليمين الكاذبة الغموس )
- اليمين الكاذبة ١٨٣٤ - ١٨٣٦- حديث
- اليمين الكاذبة ۱۸۳۰ و ۱۸۳۱ حدیث
- اليمين الكاذبة ۱۸۳۷ و ۱۸۳۸- حدیث
- بابُ النَّهْي عَنِ المَنُ بِالعَطِيَّةِ وَنَحْوِهَا
- بخس الكيل والوزن )
- بَاب النَّهْي عَنْ إِضَاعَةِ المَالِ
- بَابُ التَّعْلِيطِ فِي تَحْرِيمِ السِّحْرِ بَابُ النَّهْي عَنِ المُسَافِرَةِ بِالمُصْحَفِ إِلَى بِلادِ الكُفَّارِ
- بَابُ الجُودِ وَفِعْلِ المَعْرُوفِ - بَابُ النَّهْي عَنْ تَقَدَّم رَمَضَانَ بِصَوْمٍ بَعْدَ نِصْفِ شَعْبَانَ
- بَابُ الحَقِّ عَلَى التَثَبَّتِ فِيمَا يَقُولُهُ وَيَحْكِيهِ - بَابُ بَيَان غِلَظِ تَحْرِيم شَهَادَةِ الرُّورِ
- بَابُ النَّهْي عَنِ الإِشَارَةِ إِلَى مُسْلِمٍ بِسِلاح
- بَابُ النَّهْي عَنِ التَّكَلُّفِ
- بَابُ النَّهْي عَنِ الحَلِفِ بِمَخْلُوقِ
- بَابُ النَّهْي عَنِ القَزَع
- بَابُ النَّهْي عَنِ القِرَانِ بَيْنَ تَمْرَتَيْنِ - بَابُ الأمْرِ بِالأكْلِ مِنْ جَانِبِ القَصْعَةِ
- بَابُ النَّهْي عَنِ تَوْلِيَةِ الإِمَارَةِ وَالقَضَاءِ - وَغَيْرِهِمَا مِنَ الوِلايَاتَ - لِمَنْ سَأَلَهَا
- بَابُ النَّهْي عَنْ تَعْذِيبِ العَبْدِ وَالدَّابَّةِ وَالمَرْأَةِ وَالوَلَدِ
- بَابُ النَّهْي عَنْ تَنَاجِي اثْنَيْنِ دُونَ الثَّالِثِ بِغَيْرِ إِذْنِهِ إِلَّا لِحَاجَةٍ
- بَابُ النَّهْي عَنْ سُوءِ الظَّنِّ بِالمُسْلِمِينَ
- بَابُ النَّهْي عَنْ قَوْلِ الإِنْسَانِ : مُطِرْنَا بِنَوْءِ كَذَا - بَابُ النَّهْي عَنِ الفُحْشِ وَبَذَاءِ النِّسَانِ
- بَابُ النَّهْي عَنْ نَقْلِ الحَدِيثِ وَكلام النَّاسِ - بَابُ دَمَ ذِي الوَجْهَيْنِ
- بَابُ النَّهْيِ عَنِ التَّشَبُهِ بِالشَّيْطَانِ وَالكُفَّارِ - بَابُ النَّهْيِ عَنْ الخِضَابِ بِالسَّوادِ
- بَابُ النَّهْيِ عَنِ التَّطَيُّ
- بَابُ النَّهْيِ عَنْ إِثْيَانِ الكُهَّانِ
- بَابُ النَّهْيِ عَنْ نَتْفِ الشَّيْبِ
- بَابُ تَحْرِيم الظُّلْم وَالأَمْرِ بِرَدُ المَظَالم
- بَابُ تَحْرِيم الغَيْبَةِ، وَالأمْرِ بحِفْظِ اللَّسَانِ
- بَابُ تَحْرِيم بَيْع الحَاضِرِ لِلْبَادِي وَتَلَقَّي الرُّكْبَانِ
- بَابُ تَحْرِيم تَشَبُّهِ الرِّجَالِ بِالنِّسَاءِ وَالنِّسَاءِ بِالرِّجَالِ
- بَابُ تَحْرِيم تَصْوِيرِ الحَيَوَانِ
- بَابُ تَحْرِيم سَبِّ الْمُسْلِم بِغَيْرِ حَقٍّ
- بَابُ تَحْرِيم سَمَاعِ الغيبة
- بَابُ تَحْرِيم قَوْلِهِ : شَاهِنشَاهُ ؛ - بَابُ النَّهْي عَنْ مُخَاطَبَةِ الفَاسِقِ - بَابُ كَرَاهَةِ سَبُ الحُمَّى
- بَابُ تَحْرِيم لَعْنِ إِنْسَانِ بِعَيْنِهِ، أَوْ دَابَّةٍ
- بَابُ تَحْرِيم وَصْلِ الشَّعْرِ وَالوَشْمِ وَالوَشْرِ
- بَابُ تَحْرِيمِ اتِّخَاذِ الكَلْبِ
- بَابُ تَحْرِيمِ الخُلْوَةِ بِالْأَجْنَبِيَّةِ
- بَابُ تَحْرِيمِ الطَّعْنِ فِي الأَنْسَابِ ـ بَابُ النَّهْيِ عَنِ الغِسُ وَالْخِدَاعِ
- بَابُ تَحْرِيمِ امْتِنَاعِ المَرْأَةِ مِنْ فِرَاشِ زَوْجِهَا - بَابُ تَحْرِيم صَوْمِ الْمَرْأَةِ تَطَوُّعاً وَزَوْجُهَا حَاضِرٌ
- بَابُ تَحْرِيمِ ِاسْتِعْمَالِ إِنَاءِ الذَّهَبِ - بَابُ تَحْرِيم لُبْس الرَّجُلِ ثَوْباً مُزَعْفَراً
- بَابُ جَوَازِ لُبْسِ الحَرِيرِ لِمَنْ بِهِ حِكَةُ - بَابُ النَّهِي عَنِ افْتِرَاشِ جُلُودِ النَمُورِ
- بَابُ سَتْرِ عَوْرَاتِ المُسْلِمِينَ، وَالنَّهْي عَنْ إِشَاعَتِهَا - لِغَيْرِ ضَرُورَةِ -
- بَابُ كَرَاهِيَةِ تَعْلِيقِ الجَرَس فِي البَعِيرِ - بَابُ النَّهْي عَنِ البَصَاقِ فِي المَسْجِدِ
- تأخير الغُسل لغير عذر )
- تارك الجماعة فيصلي وحده من غير عذر
- تخطي الرقاب يوم الجمعة )
- ترجيح إحدى الزوجات، وترك العدل بينهن )
- ترك التسمية على الوضوء
- ترك التسمية على الوضوء ۲۰۲ و ۲۰۳ - حدیث
- ترك الجمعة لغير عذر
- ترك الجمعة لغير عذر )
- ترك الحج مع القدرة عليه
- ترك السنة وارتكاب البدع والأهواء
- ترك السنة وارتكاب البدع والأهواء )
- ترك السنة وارتكاب البدع والأهواء ٥٩ و ٦٠ - حديث
- ترك الصلاة تعمداً ..
- ترك الصلاة تعمداً ... ٥٧١ - ٥٧٣ - حديث
- ترك الصلاة تعمداً .... ٥٦٩ و ٥٧٠ - حدیث
- ترك الصلاة تعمداً ، وإخراجها عن وقتها تهاوناً )
- ترك حضور الجماعة
- ترك حضور الجماعة لغير عذر )
- ترويع المسلم
- ترويع المسلم .. ۲۸۰۸ - ۲۸۱۱ - حدیث
- ترويع المسلم ، ومن الإشارة إليه بسلاح ونحوه جاداً أو مازحاً )
- تشبه الرجل بالمرأة
- تشبه الرجل بالمرأة ، أو المرأة بالرجل في لباس أو كلام أو حركة أو نحو ذلك )
- تشبه النساء بالرجال وتشبه الرجال بالنساء
- تصديق الكاهن والمنجم
- تصوير الحيوانات
- تصوير الحيوانات .
- تصوير الحيوانات والطيور في البيوت وغيرها ) (۱)
- تعلم العلم لغير وجه
- تعلم العلم لغير وجه الله
- تعلم العلم لغير وجه الله تعالى )
- تعليق التمائم .
- تعليق التمائم ... ٣٤٥٥ و ٣٤٥٦ - حديث
- تولي السلطنة ٢١٦٩ - ۲۱۷۱ - حدیث
- تولي السلطنة ۲۱۷۲ و ۱۲۷۳ - حدیث
- خضب اللحية بالسواد )
- دعاء الإنسان على نفسه
- رفع البصر إلى السماء
- رفع البصر إلى السماء في الصلاة )
- رفع المأموم رأسه قبل الإمام في الركوع والسجود )
- رفع المصلي رأسه إلى السماء .... ١٦٥١ - ١٦٥٣ - حديث
- سب أحد من الصحابة رضوان الله عليهم
- سب الدهر )
- سفر الرجل وحده أو مع آخر فقط ،
- سفر المرأة لوحدها .
- شرب الخمر .
- شرب الخمر.
- شهادة الزور .
- صلاة الإنسان وقراءته حال النعاس )
- ع الأجير أجره ، والأمر بتعجيل إعطائه )
- ع الزكاة .
- ع الزكاة .... ٧٥٨ و ٧٥٩ - حدیث
- ع الزكاة ، وما جاء في زكاة الحلي )
- عدم إتمام الركوع واسجود ٥٢٥ - ٥٢٧ - حدیث
- عدم إتمام الركوع والسجود
- عدم إتمام الركوع والسجود ، وإقامة الصلب
- عدم إتمام الركوع والسجود ٥٣٠ - ٥٣٢ - حديث
- عدم التنزه من البول وهو شعار النصارى
- عقوق الوالدين )
- عقوق الوالدين . ٢٥٠٩ و ٢٥١٠ - حدیث
- عقوق الوالدين . ٢٥١١ - ٢٥١٣ - حدیث
- عَوْدِ الإنسان في هِبَتِهِ )
- غش الإمام الرعية وظلمه لهم
- غصب الأرض وغيرها ... ۱۸۷۱ - حدیث
- غصب الأرض وغيرها ١٨٦٨ - ۱۸۷۰ - حدیث
- فوات العصر بغير عذر
- فوات العصر بغير عذر )
- فيمن ادعى إلى غير أبيه وهو يعلم
- قتل الإنسان نفسه )
- قتل الإنسان نفسه ٢٤٥٦ و ٢٤٥٧ - حدیث
- قتل النفس
- قتل النفس .
- قذف المحصنات
- قطع الطريق
- قوله المسلم
- قوله لفاسق
- قوله لمسلم : یا کافر ! )
- كتم العلم
- كراهية الموت . ٣٤٨٤ و ٣٤٨٥ - حدیث
- كراهية الموت . ٣٤٨٦ - ٣٤٨٨ - حديث
- لبس الحرير والذهب للرجال
- لبس النساء الرقيق من الثياب التي تصف البشرة )
- لبس النساء الرقيق ٢٠٤٤ و ٢٠٤٥ - حدیث
- مسح الحصى وغيره في موضع
- مطل الغني
- من جس على المسلمين ودل على عورتهم
- منع الزكاة
- منع فضل الماء
- مواقعة الحدود
- مواقعة الحدود وانتهاك المحارم )
- نسيان القرآن بعد تعلمه ، وما جاء فيمن ليس في
- نشوز المرأة على زوجها
- نقص الكيل والزراع وما أشبه ذلك
- نوم الإنسان إلى الصباح ، وترك قيام شيء من الليل )
- وضع اليد على الخاصرة في الصلاة )
- ١٥٣ - بَابُ جَوازِ البُكَاءِ عَلَى المَيِّتِ؛ بِغَيْرِ نَدْبِ وَلَا نِيَاحَةٍ أَمَّا النِّيَاحَةُ فَحَرَامٌ، وَسَيَأْتِي فِيهَا بَابٌ فِي كِتَابِ النَّهْيِ - إِنْ شَاءَ اللَّهُ
- ٢٥٥ - بَابُ تَحْرِيم سَمَاع الغِيبَةِ، وَأَمْرِ مَنْ سَمِعَ غِيبَةٌ مُحَرَّمَةَ بِرَدْهَا وَالإِنْكَارِ عَلَى قَائِلِهَا ؛ فَإِنْ عَجَزَ أَوْ لَمْ يَقْبَلْ مِنْهُ فَارَقَ المَجْلِسَ - إِنْ أَمْكَنَهُ
- ٢٥٨ - بَابُ النَّهْي عَنْ نَقْلِ الحَدِيثِ وَكَلامِ النَّاسِ إِلَى وَلَاةِ الأمورِ إِذَا لَمْ تَدْعُ إِلَيْهِ حَاجَةٌ - كَخَوْفِ مَفْسَدَةٍ وَنَحْوِهِا -
- ٢٦٧ - بَابُ تَحْرِيم سَبِّ الأَمْوَاتِ بِغَيْرِ حَقٌّ وَمَصْلَحَةِ شَرْعِيَّةِ - وَهُوَ التَّحْذِيرُ مِنَ الاقْتِدَاءِ بِهِ فِي بِدْعَتِهِ، وَفِسْقِهِ، وَنَحْو ذَلِكَ .
- ٢٦٨ - بَابُ النَّهْيِ عَنِ الإِيدَاءِ
- ٢٦٩ - بَابُ النَّهْيِ عَنِ التَّبَاغُضِ وَالتَّقَاطُعِ وَالتَّدَابُرِ
- ٢٧٦ - بَابُ النَّهْي عَنِ الغِشُ وَالخِدَاع
- ٢٩٦ - بَابُ تَحْرِيمِ وَصْلِ الشَّعْرِ وَالوَشْمِ وَالوَشْرِ ـ وَهُوَ تَحْدِيدُ الأَسْنَانِ -
- ٣٠١ - بَابُ النَّهْي عَنِ التَّكَلُّفِ ـ وَهُوَ فِعْلُ وَقَوْلُ مَا لا
- ٣٠٤ - بَابُ النَّهْيِ عَنِ التَّطَيُّرِ
- ٣٠٥ - بَابُ تَحْرِيم تَصْوِيرِ الحَيَوَانِ فِي بِسَاطِ أَوْ حَجَرٍ أَوْ ثَوْبٍ أَوْ دِرْهَم أَوْ مَخَدَّةٍ أَوْ دِينَارٍ أَوْ وِسَادَةٍ وَغَيْرِ ، وَتَحْرِيمِ اتِّخَاذِ الصُّوَرِ فِي حَائِطِ وَسَقْفِ وَسِتْرِ
- ٣٢٦ - بَابُ تَحْرِيمُ قَوْلِهِ لِمُسْلَم : يا كَافِرُ
- ٣٣٥ - بَابُ تَحْرِيمِ امْتِنَاعِ المَرْأَةِ مِنْ فِرَاشِ زَوْجِهَا إِذَا دَعَاهَا وَلَمْ يَكُنْ لَهَا عُذْرٌ شَرْعِيٌّ
- ٣٣٦ - بَابُ تَحْرِيم صَوْمِ الْمَرْأَةِ تَطَوْعاً وَزَوْجُهَا حَاضِرٌ
- ٣٤٢ - بَابُ النَّهْي عَنِ الصَّلَاةِ إِلَى القُبُورِ
- ٣٤٧ ـ بَابُ تَحْرِيمِ الجُلُوسِ عَلَى قَبْرِ
- ٣٥١ ـ بَابُ النَّهْي عَنِ التَّغَوُّطِ فِي طَرِيقِ النَّاسِ وَظِلِّهِمْ
- ٣٥٤ - بَابُ تَحْرِيمِ إِحْدَادِ المَرْأَةِ عَلَى مَيْتٍ فَوْقَ ثَلَاثَةِ أَيَّامٍ، إِلا عَلَى زَوْجِهَا: أَرْبَعَةَ أَشْهُرٍ وَعَشَرَةَ أَيَّامٍ ۱۷۸۳ - عَنْ زَيْنَبَ بِنْتِ أَبِي سَلَمَةَ نَا، قَالَتْ: دَخَلْتُ عَلَى أُمِّ
- ٣٥٦ - بَابُ النَّهْي عَنْ إِضَاعَةِ المَالِ فِي غَيْرِ وُجُوهِهِ الَّتِي أَذِنَ الشَّرْعُ فِيهَا
- ٣٦٥ - بَابُ تَحْرِيمِ لُبْس الرَّجُلِ ثَوْباً مُزَعْفَراً
- ٣٦٦ - بَابُ النَّهْيِ عَنْ صَمْتِ يَوْمِ إِلَى اللَّيْلِ
- ٦١ - بَابُ النَّهْي عَنِ البُخْلِ وَالشُّحْ
- ۱۲۲ - بَابُ تَحْرِيمِ لِبَاسِ الحَرِيرِ عَلَى الرِّجَالِ، وَتَحْرِيمِ جُلُوسِهِمْ عَلَيْهِ وَاسْتِنَادِهِمْ إِلَيْهِ، وَجَوَازِ لُبْسِهِ لِلنِّسَاءِ
- ۱۷۱ - بَابُ تَكْبِيرِ المُسَافِرِ إِذَا صَعِدَ الثَّنَايَا وَشِبْهَهَا، وَتَسْبِيحِهِ إِذَا هَبَطَ الأَوْدِيَةَ وَنَحْوَهَا، وَالنَّهْي عَنِ المُبَالَغَةِ برفع الصَّوْتِ بِالتَّكْبِيرِ وَنَحْوِهِ
- ۱۷۹ - بَابُ تَحْرِيمِ سَفَرِ المَرْأَةِ وَحْدَهَا
- ۱۹۳ - بَابُ الأَمْرِ بِالمُحَافَظَةِ عَلَى الصَّلَوَاتِ المَكْتُوبَاتِ، وَالنَّهْي الأكِيدِ وَالوَعِيدِ الشَّدِيدِ فِي تَرْكِهِنَّ
- ۲۱۹ - بَابُ النَّهْي عَنْ تَقَدُّم رَمَضَانَ بِصَوْمِ بَعْدَ نِصْفِ شَعْبَانَ ؛ إِلا لِمَنْ وَصَلَهُ بِمَا قَبْلَهُ، أَوْ وَافَقَ عَادَةً لَهُ؛ بِأَنْ
- ۲۷۱ - بَابُ النَّهْيِ عَنِ التَّجَسُّسِ، وَالتَّسَمُّعِ لِكَلامِ مَنْ يَكْرَهُ
- ۲۷۳ - بَابُ تَحْرِيمِ احْتِقَارِ الْمُسْلِمِينَ
- ۲۷۸ - بابُ النَّهْي عَنِ الْمَنْ بِالعَطِيَّةِ وَنَحْوِهَا قَالَ اللَّهُ - تَعَالَى -: ﴿يَتأَيُّهَا الَّذِينَ ءَامَنُوا لَا تُبْطِلُوا صَدَقَتِكُم بِالْمَنْ
- ۲۷۹ - بَابُ النَّهْي عَنِ الْافْتِخَارِ وَالْبَغْيِ
- ۲۸۰ - بَابُ تَحْرِيمِ الهِجْرَانِ بَيْنَ المُسْلِمِينَ فَوْقَ ثَلَاثَةِ أَيَّامٍ؛ إِلا لِبِدْعَةٍ فِي الْمَهْجُورِ أَوْ تَظَاهُرٍ بِفِسْقٍ أَوْ نَحْوِ ذَلِكَ قَالَ اللَّهُ - تَعَالَى -: إِنَّمَا ٱلْمُؤْمِنُونَ إِخْوَةٌ فَأَصْلِحُوا۟ بَيْنَ أَخَوَيْكُمْ ۚ وَٱتَّقُوا۟ ٱللَّهَ لَعَلَّكُمْ تُرْحَمُونَ ﴾ [الحجرات : ١٠] .
- ۲۸۳ - بَابُ تَحْرِيمِ التَّعْذِيبِ بِالنَّارِ فِي كُلِّ حَيَوَانِ حَتَّى
- ۲۹۰ - بابُ تَحْرِيمِ النَّظَرِ إِلَى المَرْأَةِ الأَجْنَبِيَّةِ وَالْأَمْرَدِ
- ۲۹۲ - بَابُ تَحْرِيم تَشَبُّهِ الرِّجَالِ بِالنِّسَاءِ وَالنِّسَاءِ بِالرِّجَالِ؛ في لِبَاسِ وَحَرَكَةٍ وَغَيْر ذَلِكَ
- ۲۹۷ - بَابُ النَّهْي عَنْ نَتْفِ الشَّيْبِ مِنَ اللَّحْيَةِ وَالرَّأْسِ وَغَيْرِهِمَا، وَعَنْ نَتَفِ الأَمْرَدِ شَعْرَ لِحْيَتِهِ عِنْدَ أَوَّلِ طُلُوعِهِ
- ۳۰۰ - بَابُ النَّهْيِ عَنْ تَرْكِ النَّارِ فِي البَيْتِ عِنْدَ النَّوْمِ وَنَحْوِهِ؛ سَوَاءٌ كَانَتْ فِي سِرَاجِ أَوْ غَيْرِهِ
- ۳۲۰ - بَابُ تَحْرِيم قَوْلِهِ : شَاهِنشَاهُ؛ لِلسُّلْطَانِ وَغَيْرِهِ؛ لأَنَّ مَعْنَاهُ : مَلِكُ المُلُوكِ، وَلا يُوْصَفُ بِذَلِكَ غَيْرُ اللَّهِ ـ سُبْحَانَهُ وَتَعَالَى -
- ۳۲۱ - بَابُ النَّهْيِ عَنْ مُخَاطَبَةِ الفَاسِقِ وَالْمُبْتَدِعِ وَنَحْوِهِمَا بِـ (سَيْدِي) وَنَحْوِهِ
- ۳۲۳ - بَابُ النَّهْي عَنْ سَبِّ الرِّيحِ، وَبَيَانِ مَا يُقَالُ عِنْدَ
- ۳۲۷ - بَابُ النَّهْي عَنِ الفُحْشِ وَبَذَاءِ النِّسَانِ
- ۳۳۷ - بَابُ تَحْرِيم رَفْعِ المَأْمُوم رَأْسَهُ مِنَ الرُّكُوعِ أَوِ السُّجُودِ قَبْلَ الإِمَامِ
- ۷۸ - بَابُ أَمْرِ وَلاةِ الأُمُورِ بِالرِّفْقِ بِرَعَايَاهُمْ وَنَصِيحَتِهِمْ وَالشَّفَقَةِ عَلَيْهِمْ وَالنَّهْي عَنْ عِشْهِمْ وَالتَّشْدِيدِ عَلَيْهِمْ وَإِهْمَالِ مَصَالِحِهِمْ وَالغَفْلَةِ عَنْهُمْ
- ۸۰ - بَابُ وجُوبِ طَاعَةِ وَلَاةِ الْأُمُورِ فِي غَيْرِ مَعْصِيَةِ، وَتَحْرِيم طَاعَتِهِمْ فِي المَعْصِيَةِ
- ۸۱ - بَابُ النَّهْي عَنْ سُؤَالِ الإِمَارَةِ وَاخْتِيَارِ تَرْكِ الوِلايَاتِ؛ إِذَا لَمْ يَتَعَيَّنْ عَلَيْهِ أَوْ تَدْعُ حَاجَةٌ إِلَيْهِ

#### Deeds with no published text

- . اليد
- .. قتل الحيات
- .. قتل الحيات وغيرها .
- .. قتل الحيات وغيرها ... ۲۹۸۹ - حدیث
- .. قتل الحيات وغيرها.
- .. قتل الحيات. ٢٩٨٤ - ۲۹۸۷ - حدیث
- آيات وأذكار بعد الصلوات .
- آيات وأذكار بعد الصلوات ... ١٥٩٣ و ١٥٩٤ - حديث
- آيات وأذكار يقولها إذا أصبح
- آيات وأذكار يقولها إذا أصبح وإذا أمسى )
- آيات وأذكار يقولها إذا أصبح ٦٥٣ - ٦٥٥ - حديث
- آيات وأذكار يقولها إذا أصبح ٦٥٧ و ٦٥٨
- أداء الزكاة وتأكيد وجوبها ٧٤٠ - ٧٤٣ - حدیث
- أذكار تقال بالليل
- أذكار يقولها بعد صلاة الصبح والعصر والمغرب )
- إبقاء الشيب وكراهة نتفه )
- إبقاء الشيب ٢٠١٤ - ٢٠٩٦ - حديث
- إجابة المؤذن .
- إجابة المؤذن ، وبماذا يجيبه ، وما يقول بعد الأذان ؟ )
- إخلاص النية في
- إخلاص النية في الجهاد
- إخلاص النية في الجهاد .
- إخلاص النية في الجهاد ۱۳۳۰ و ۱۳۳۱ - حدیث
- إطعام الصائم )
- إطعام الطعام .
- إطعام الطعام.
- إفشاء السلام .
- إفشاء السلام .. ۲۷۰۰ - ۲۷۰۸ - حدیث
- إفشاء السلام .... ۲۷۰۰ و ۲۷۰۱ - حدیث
- إقامة الحدود ٢٣٥٣ و ٢٣٥٤ - حدیث
- إكثار الصلاة على النبي
- إكثار الصلاة على النبي صلى الله عليه وسلم ١٦٦٥ - ١٦٦٧- حدیث
- إماطة الأذى
- إماطة الأذى . ٢٩٧٣ - ٢٩٧٦ - حدیث
- إماطة الأذى عن الطريق ، وغير ذلك مما يذكر )
- إنجاز الوعد
- إنجاز الوعد ....
- إنجاز الوعد والأمانة .
- اتباع الكتاب والسنة
- اتباع الكتاب والسنة )
- احتباس الخيل للجهاد لا رياء . . . ١٢٥٠ - ١٢٥٣- حدیث
- احتباس الخيل للجهاد لا رياء ...
- احتباس الخيل للجهاد لا رياء ... ١٢٤٤ و ١٢٤٥ - حديث
- احتباس الخيل للجهاد لا رياء ... ١٢٤٦ - ١٢٤٩ - حديث
- احتباس الخيل للجهاد لا رياءً . ١٢٤١ و ١٢٤٢- حديث
- الأذان (۱) ، وما جاء في فضله )
- الأذان .
- الأسماء الحسنة ،
- الأكل من جوانب القصعة دون وسطها )
- الأمر بالمعروف
- الأمر بالمعروف .
- الأمر بالمعروف . ٢٣٠٤ - ٢٣٠٦ - حديث
- الأمر بالمعروف . ٢٣١٤ و ٢٣١٥ - حدیث
- الإحرام والتلبية ورفع الصوت بهما -
- الإحرام والتلبية ورفع الصوت بهما ١١٣٦ - ١١٣٨- حديث
- الإخلاص والصدق
- الإخلاص والصدق .
- الإخلاص والصدق . ۱۱ و ۱۲ ـ حدیث
- الإخلاص والصدق والنية الصالحة )
- الإسراع بالجنازة وتعجيل الدفن )
- الإصلاح .
- الإصلاح .. ٢٨١٦ - ۲۸۱۸ - حدیث
- الإصلاح بين الناسِ )
- الإكثار من ذكر الله تعالى
- الإكثار من ذكر الله تعالى . ١٤٩٣ - ١٤٩٥ - حديث
- الإكثار من ذكر الله تعالى ١٤٨٩ - ١٤٩٢ - حديث
- الإنفاق في وجوه الخير . ٩١٦ و ۹۱۷ - حدیث
- الإنفاق في وجوه الخير ۹۱۹ - ۹۲۱ - حدیث
- الاجتماع على الطعام )
- الاجتماع على الطعام ۲۱۳۲ و ۲۱۳۳ - حدیث
- الاستغفار )
- الاقتصاد في الرزق
- الاقتصاد في طلب الرزق . ١٧٠٢ - ١٧٠٤ - حديث
- الاقتصاد في طلب الرزق ... ١٧١٥ و ١٧١٦ - حديث
- الاقتصاد في طلب الرزق ۱۷۰۸ - ۱۷۱۰ - حدیث
- الاكتساب بالبيع
- الاكتساب بالبيع وغيره )
- الامتناع عن الدخول .
- الامتناع عن الدخول . ٢٢٤٠ - ٢٢٤٢ - حديث
- الامتناع عن الدخول ٢٢٤٦ و
- البداءة بالخير ليستن به
- البداءة بالخير ليستن به ،
- البكاء من خشية الله ۳۳۲۰ - ۳۳۲۳ - حدیث
- التأمين خلف الإمام . ٥١٥ و ٥١٦ - حديث
- التأمين خلف الإمام وفي الدعاء ،
- التبكير إلى الجمعة
- التسبيح والتكبير
- التسمية على الطعام .
- التكبير في العيد وذكر فضله )
- التوا
- التواضع .
- التواضع في الحج والتبذل
- التواضع في الحج والتبذل . ۱۱۲۸ - ۱۱۳۱ - حدیث
- التواضع في الحج والتبذل ولبس الدون من الثياب ؛ اقتداء بالأنبياء عليهم السلام)
- التوبة .
- التوبة والمبادرة بها وإتباع السيئة الحسنة )
- التيسير على المعسر ، وإنظاره والوضع عنه )
- الجليس الصالح .. ۳۰۷۱ - ٣٠٧٥ - حدیث
- الجليس الصالح ٣٠٦٤ - ٣٠٦٦ - حديث
- الجهاد في سبيل الله تعالى
- الجهاد في سبيل الله تعالى ۱۲۹۰ - ۱۲۹۷ - حدیث
- الجهاد في سبيل الله تعالى ۱۲۹۸ و ۱۲۹۹ - حدیث
- الحب الله .
- الحب في الله ٣٠٢٣ - ٣٠٢٥ - حدیث
- الحب في الله ٣٠٢٦ و ۳۰۲۷ - حدیث
- الحج والعمرة ، وما جاء فيمن خرج يقصدهما فمات)
- الحجامة . ٣٤٦٤ و ٣٤٦٥ - حديث
- الحجامة ، ومتى يحتجم )
- الحراسة في سبيل الله تعالى
- الحراسة في سبيل الله تعالى )
- الحياء وما جاء في فضله ،
- الخلق الحسن
- الخلق الحسن .. ٢٦٤٦ - ٢٦٤٨ - حديث
- الخلق الحسن .. ٢٦٥٣ و ٢٦٥٤ - حديث
- الخلق الحسن وفضله ،
- الخوف ، وفضله )
- الخوف وفضله
- الخوف وفضله . ٣٣٧٤ - ٣٣٧٦ - حديث
- الدعاء عند النوم
- الدعاء في السجود ، ودبر الصلوات ، وجوف الليل الأخير )
- الدعاء للميت . ٣٥١٤ - ٣٥١٥ - حديث
- الدلجة
- الرباط في سبيل الله عز وجل )
- الرباط في سبيل الله عز وجل ۱۲۱۷ و ۱۲۱۸ - حدیث
- الرجاء وحسن الظن
- الرحلة في طلب العلم
- الرحلة في طلب العلم )
- الرفق .
- الرمي في سبيل الله وتعلمه
- الرمي في سبيل الله وتعلمه . ۱۲۸۷ - ۱۲۹۰ - حدیث
- الرمي في سبيل الله وتعلمه . ۱۲۹۰- ۱۲۹۲ - حدیث
- الرمي في سبيل الله وتعلمه ۱۲۷۹ و ۱۲۸۰ - حدیث
- الزهد
- الزهد .... ۳۲۲۷ و ۳۲۲۸ - حدیث
- الزهد في الدنيا والاكتفاء منها بالقليل ،
- السحور سيما بالتمر )
- السـ البيع والشراء . ١٧٤٢٠٠ - ١٧٤٤ - حديث
- السماحة في البيع والشراء . ١٧٥٢ و ١٧٥٣ - حدیث
- السماحة في البيع والشراء ١٧٤٥٠٠٠ - ١٧٥١ - حديث
- السواك وما جاء في فضله )
- السواك وما جاء وفي فضله
- السواك وما جاء وفي فضله ۲۰۹ - ۲۱۲ - حدیث
- الشهادة ، وضل الشهداء ۱۳۷۰ - ۱۳۷۷ - حدیث
- الشهادة ، وفضل الشهداء
- الشهادة ، وفضل الشهداء ١٣٥٦ و ١٣٥٧ - حدیث
- الشهادة ، وفضل الشهداء ۱۲ - كتاب الجهاد
- الشهادة ، وما جاء في فضل الشهداء )
- الصبر
- الصبر .
- الصبر . ٣٤٠٥ - ٣٤٠٨ - حديث
- الصدق
- الصدقة على الزوج والأقارب وتقديمهم على غيرهم )
- الصدقة والحث عليها
- الصدقة والحث عليها .
- الصف الأول
- الصف الأول .
- الصف الأول ، وما جاء في تسوية الصفوف والتراص فيها ، وفضل ميامنها ... )
- الصلاة الفلاة
- الصلاة بعد العشاء )
- الصلاة في أول وقتها
- الصلاة في أول وقتها )
- الصلاة في الفلاة )
- الصلاة في المسجد
- الصلاة في المسجد الحرام . ۱۱۷۹ و ۱۱۸۰۔ حدیث
- الصلاة في المسجد الحرام .. ۱۱۸۱ - ۱۱۸۳- حدیث
- الصلاة في المسجد الحرام ومسجد المدينة ،
- الصلاة قبل الظهر وبعدها
- الصلاة قبل الظهر وبعدها )
- الصلاة قبل العصر )
- الصلاة مطلقاً ، وفضل الركوع والسجود والخشوع )
- الصلوات الخمس . ٣٥٢ - ٣٥٤ - حديث
- الصلوات الخمس . ٣٦١ و ٣٦٢ - حدیث
- الصلوات الخمس ۳۷۹ و ۳۸۰ - حدیث
- الصمت
- الصمت .
- الصمت . ۲۸۷۳ - ٢٨٧٥ - حدیث
- الصوات الخمس، والمحافظة عليها ، والإيمان بوجوبها )
- الصوم مطلقاً
- الصوم مطلقاً ...
- الصوم مطلقاً ، وما جاء في فضله ...
- الضيافة وإكرام الضيف ، وتأكيد حقه وترهيب الضيف أن يُقيم حتى يُؤْثِمَ أَهْلَ المنزل )
- الطواف واستلام الحجر الأسود . . ١١٤٥٠ - ١١٤٧ - حديث
- الطواف واستلام الحجر الأسود . ۱۱۳۹ - حدیث
- الطواف واستلام الحجر الأسود ١١٤٠ و ١١٤١۔ حدیث
- العتق .
- العتق . ١٨٩٥ و ١٨٩٦ - حدیث
- العزلة
- العزلة لمن لا يأمن على نفسه عند الاختلاط )
- العفو عن القاتل .. ٢٤٦٣ - ٢٤٦٥ - حديث
- العفو عن القاتل والجاني والظالم ،
- العفو عن القاتل ٢٤٦٦ - ٢٤٦٨ - حديث
- العلم وطلبه
- العلم وطلبه وتعلمه وتعليمه ، وما جاء في فضل العلماء والمتعلمين )
- العمل الصالح . ۳۱۷۲ و ۳۱۷۳ - حدیث
- العمل الصالح في العشر
- العمل الصالح في العشر ١١٤٨ و ١١٤٩۔ حدیث
- العمل على الصدقة بالتقوى
- الغدوة في سبيل الله والروحة .. ١٢٦٩ - ۱۲۷۱ - حدیث
- الغدوة في سبيل الله والروحة ١٢٦١ - ١٢٦٣ - حديث
- الغدوة في سبيل الله والروحة ۱۲۷۲ و ۱۲۷۳ - حدیث
- الغزاة في البحر ، وأنها أفضل من عشر غزوات في البر ) .
- الغسل يوم الجمعة
- الغُسل يوم الجمعة )
- الفراغ للعبادة
- الفراغ للعبادة .
- الفراغ للعبادة . ۳۱٦٩ و ۳۱۷۰ - حدیث
- الفراغ للعبادة والإقبال على الله تعالى
- القرض
- القرض وما جاء في فضله )
- القميص
- القميص .
- الكحل بالإثمد للرجال والنساء )
- المؤذن .
- المحافظة على الصبح والعصر )
- المحافظة على ثنتي عشرة ركعة من السنة في اليوم والليلة )
- المحافظة على ركعتين قبل الصبح )
- المداومة على العمل .
- المداومة على العمل وإن قل )
- المرأة إذا تصبرت على ولدها ولم تتزوج
- المشي إلى المساجد سيما في الظلم ، وما جاء في فضلها )
- المصافحة
- المصافحة ،
- الموت في الغربة )
- النفقة على الزوجة . ١٩٦٢ و ١٩٦٣- حدیث
- النفقة على الزوجة ٠٠ ٠ ١٩٦٤ - ١٩٦٦ - حديث
- النفقة على الزوجة ١٩٥١-١٩٥٣ - حدیث
- النفقة على الزوجة ١٩٥٩٠٠٠ - ١٩٦١ - حديث
- النفقة على الزوجة ۱۹۷۲۰۰۰ و ۱۹۷۳ - حدیث
- النفقة في الحج والعمرة ، وما جاء فيمن أنفق فيهما من مال حرام )
- النفقة في سبيل الله وتجهيز الغزاة . . .١٢٣٨ - ١٢٤٠ - حديث
- النفقة في سبيل الله وتجهيز الغزاة وخلفهم(۱) في أهلهم )
- النكاح ... ۱۹۱۷ و ۱۱۸
- النكاح سيما بذات الدين الولود )
- الورع وترك الشبهات
- الورع وترك الشبهات وما يحوك (۱) في الصدور )
- الورع وترك الشبهات ۰۰۰ ۱۷۳۹ - ١٧٤١ - حديث
- الورع وترك الشبهات ۱۷۳۳ - ١٧٣٥ - حدیث
- الوصية . ٣٤٨٢ و ٣٤٨٣ - حدیث
- الوضوء وإسباغه
- الوقوف بعرفة والمزدلفة
- الوقوف بعرفة والمزدلفة ، وفضل يوم عرفة )
- انتظار الصلاة بعد الصلاة
- انتظار الصلاة بعد الصلاة ٤٥٣ و ٤٥٤ - حدیث
- بابُ اسْتِحْبَابِ سُجُودِ الشَّكْرِ
- بر الوالدين
- بر الوالدين .
- بر الوالدين .. ٢٤٨١ و ٢٤٨٢ - حدیث
- بر الوالدين .. ٢٤٩٢ - ٢٤٩٦ - حديث
- بر الوالدين ٢٤٨٥ و ٢٤٨٦ - حدیث
- بناء المساجد في الأمكنة المحتاجة إليها )
- بَاب اسْتِحْبَاب الثوب الأبيض
- بَاب اسْتِحْبَاب العُزُلَةِ عِنْدَ فَسَادِ الزَّمَانِ
- بَاب اسْتِحْبَاب المُصَافَحَةِ عِنْدَ اللقَاء
- بَاب اسْتِحْبَاب طَلَب الرِّفْقَةِ
- بَاب عَلامَاتِ حُبِّ اللَّهِ - تَعَالَى - العَبْدَ والحَثُ عَلَى التَّخَلُقِ بِهَا
- بَابٌ فِي الحَثُ عَلَى سُوَرٍ وَآيَاتِ مَحْصُوصَةٍ
- بَابٌ فِي الحَثُ عَلَى سُوَرٍ وَآيَاتِ مَخْصُوصَةٍ
- بَابُ اسْتِحْبَاب التَّبْشِيرِ، وَالتَّهْنِئَةِ بالخَيْرِ
- بَابُ اسْتِحْبَاب التَّبْشِيرِ، وَالنَّهْنِئَةِ بِالخَيْرِ
- بَابُ اسْتِحْبَاب تَسْمِيتِ العَاطِس إِذَا حَمِدَ اللَّهَ - تَعَالَى -
- بَابُ اسْتِحْبَاب وَصِيَّةِ أهْل المَريض - بَابُ جَوَانِ قَوْلِ المَريض : أنا وَجِعٌ
- بَابُ اسْتِحْبَابِ الاجْتِمَاعِ عَلَى القِرَاءَةِ - بَابُ فَضْلِ الوُضُوءِ
- بَابُ اسْتِحْبَابِ الاضْطِجَاعِ بَعْدَ رَكْعَتَي الفَجْرِ ـ بَابُ سُنَّةِ الظُّهْرِ
- بَابُ اسْتِحْبَابِ السَّلامِ إِذَا قَامَ عَنِ المَجْلِسِ - بَابُ الاسْتِنْذَانِ وَآدَابِهِ
- بَابُ اسْتِحْبَابِ بَيَانِ الكَلام - بَابُ إِصْغَاءِ الجَلِيسِ لِحَدِيثِ جَلِيسِهِ الَّذِي لَيْسَ بِحَرَامٍ
- بَابُ اسْتِحْبَابِ تَرْكِ التَّرَفْعِ فِي اللُّبَاسِ تَوَاضُعاً
- بَابُ اسْتِحْبَابِ تَقْدِيمِ اليَمِينِ فِي كُلِّ مَا هُوَ مِنْ بَابِ التَّكْرِيمِ
- بَابُ اسْتِحْبَابِ تَقْدِيمِ الْيَمِينِ فِي كُلِّ مَا هُوَ مِنْ بَابِ
- بَابُ اسْتِحْبَابِ زِيَارَةِ القُبُورِ لِلرِّجَالِ، وَمَا يَقَوْلُهُ الزَّائِرُ
- بَابُ اسْتِحْبَابِ سُؤَالِ أَهْلِ المَرِيضِ عَن حالِهِ ـ بَابُ مَا يَقُولُهُ مَنْ أَيْسَ مِنْ حَيَاتِهِ
- بَابُ اسْتِحْبَابِ صَوْمِ ثَلَاثَةِ أَيَّامٍ مَنْ كُلِّ شَهْرٍ
- بَابُ اسْتِحْبَابِ قِيَام رَمَضَانَ - بَابُ فَضْلِ قِيَامِ لَيْلَةِ الْقَدْرِ
- بَابُ الأَمْرِ بِالمُحَافَظَةِ عَلَى مَا اعْتَادَهُ مِنَ الخَيْرِ - بَابُ اسْتِحْبَابِ طِيبِ الكلام
- بَابُ الحَثُ عَلَى حُضُورِ الجَمَاعَةِ فِي الصُّبْحِ وَالعِشَاءِ
- بَابُ فَضْل البُكَاءِ مِنْ خَشْيَةِ اللَّهِ - تَعَالَى
- بَابُ فَضْل السِّوَاكِ
- بَابُ فَضْل ضَعَفَةِ المُسْلِمِينَ وَالفُقَرَاءِ وَالخَامِلِينَ
- بَابُ فَضْل قِرَاءَةِ القُرْآنِ
- بَابُ فَضْل قِيَامِ اللَّيْل
- بَابُ فَضْلٍ مَنْ فَطْرَ صَائِماً
- بَابُ فَضْلُ صَلاةِ الصُّبْحِ وَالعَصْرِ
- بَابُ فَضْلِ الاخْتِلاطِ بِالنَّاسِ، وَحُضُورِ جَمْعِهِمْ وَجَمَاعَاتِهِمْ
- بَابُ فَضْلِ الحُبِّ في الله وَالحَقِّ عَلَيْهِ
- بَابُ فَضْلِ الدُّعَاءِ بِظَهْرِ الْغَيْبِ
- بَابُ فَضْلِ السَّلامِ، وَالْأَمْرِ بِإِفْشَائِهِ
- بَابُ فَضْلِ السَّمَاحَةِ فِي البَيْعِ وَالشِّرَاء
- بَابُ فَضْلِ السُّنَنِ الرَّانِيَةِ مَعَ الفَرائِضِ
- بَابُ فَضْلِ الصَّفُ الأَوَّلِ وَالأمْرِ بِإِثْمَامِ الصُّفُوفِ الأَوَلِ
- بَابُ فَضْلِ الصَّوْمِ - بَابُ فَضْلِ صَوْم يَوْمَ عَرَفَةَ وَعَاشُورَاءَ وَتَاسُوعَاءَ
- بَابُ فَضْلِ العِلْمِ تَعَلَّماً وتَعْلِيماً لِلَّهِ
- بَابُ فَضْلِ الغَنِي الشَّاكِرِ
- بَابُ فَضْلِ المَشْيِ إِلَى الْمَسَاجِدِ
- بَابُ فَضْلِ انْتِظَارِ الصَّلَاةِ
- بَابُ فَضْلِ بِرْ أَصْدِقَاءِ الأَبِ وَالأُمِّ وَالأَقَارِبِ وَالزَّوْجَةِ
- بَابُ فَضْلِ حِلَقِ الذِّكْرِ
- بَابُ مَا يَقُولُ إِذَا لَبِسَ ثَوْباً جَدِيداً - اَبُ اسْتِحْبَابِ الابْتِدَاءِ بِاليَمِينِ فِي اللُّبَاسِ
- بَابُ مَا يُقَالُ عِنْدَ رُؤيَةِ الهِلالِ ـ بَابُ فَضْلِ السَّحُورِ وَتَأْخِيرِهِ
- ة في البيع والشراء .١٧٥٤٠٠ - ١٧٥٦ - حديث
- تخليل الأصابع
- ترك الترفع في اللباس ٢٠٧٥ و ٢٠٧٦ ـ حدیث
- ترك الترفع في اللباس ۲٠٨٦ - ۲۰۸۹ - حدیث
- ترك الترفع في اللباس ۲۰۷۷۰۰۰ و ۲۰۸۰ - حدیث
- تشييع الميت وحضور دفنه )
- تشييع الميت ٣٤٩٩ - ٣٥٠١ - حديث
- تشييع الميت. ٣٥٠٢ و ٣٥٠٣ - حدیث
- تعاهد القرآن وتحسين .
- تعاهد القرآن وتحسين . ١٤٤٥ و ١٤٤٦ - حديث
- تعجيل الفطر وتأخير السحور ١٠٧٣ - ١٠٧٦ - حديث
- تنظيف المساجد وتطهيرها ۲۷۸ و ۲۷۹ - حدیث
- جلوس المرء في مصلاه بعد صلاة الصبح وصلاة العصر )
- جلوس المرء في مصلاه ٤٧٠ و ٤٧١ - حدیث
- حضور مجالس الذكر والاجتماع . ١٥٠٢ - حديث
- حضور مجالس الذكر والاجتماع . ١٥٠٧ و ١٥٠٨ - حديث
- حلق الرأس بمنى )
- حمد الله تعالى بعد الأكل )
- دخل بيته بسلام
- دعاء المرء لأخيه بظهر الغيب سيما المسافر )
- ذكر الله لمن ركب دابته )
- ذكر الله لمن عثرت دابته )
- ذكر الموت ... ۳۳۳۹ - ٣٣٤١ - حديث
- ذكر الموت ٣٣٥٥ - ٣٣٥٨ - حديث
- ركعتين بعد الوضوء )
- ركعتين بعد الوضوء ۲۲۹ و ۲۳۰ - حدیث
- زرع وغرس الأشجار ... ٢٥٩٨ - ٢٦٠٠ - حديث
- زرع وغرس الأشجار المثمرة )
- زيارة الإخوان والصالحين ، وما جاء في إكرام الزائرين )
- زيارة الإخوان ٢٥٨٠ - ٢٥٨٢ - حديث
- زيارة الرجال .
- سؤال الجنة
- سؤال الجنة والاستعاذة من النار )
- سؤال الشهادة في سبيل الله تعالى ١٢٧٦ - ١٢٧٨ - حديث
- سؤال العفو . ۳۳۸۹ - ۳۳۹۱ - حدیث
- سؤال العفو والعافية )
- سبيل الله تعالى
- ستر المسلم
- سكنى الشأم (۱) وما جاء في فضلها )
- سكنى الشام
- سكنى الشام .. ۳۰۸۸ - ۳۰۹۰ - حدیث
- سكنى الشام ... ٣٠٩٦ و ۳۰۹۷ ـ حدیث
- سكنى المدينة إلى
- سكنى المدينة إلى الممات
- سكنى المدينة إلى الممات . ۱۱۸۹ و ۱۰ ۱۔ حدیث
- سكنى المدينة إلى الممات . ۱۱۹۱ و ۱۱۹۲۔ حدیث
- سكنى المدينة إلى الممات ، وما جاء في فضلها ، وفضل أحد ووادي العقيق (۱) )
- سكنى المدينة إلى الممات ١٢٠٤ و ١٢٠٥ - حدیث
- سكنى المدينة إلى الممات ۱۱۹۵ - ۱۱۹۷- حدیث
- سماع الحديث وتبليغه
- شرب ماء زمزم . ١١ - كتاب الحج
- شكر المعروف .... ۹۷۱ - ۹۷۵ - حدیث
- شكر المعروف ومكافأة فاعله والدعاء له ، وما جاء فيمن لم يشكر ما أولي إليه )
- صدقة السر
- صدقة السر )
- صدقة الفطر
- صدقة الفطر ، وبيان تأكيدها (۱) )
- صلاة الاستخارة .... )
- صلاة التسبيح
- صلاة التسبيح )
- صلاة التوبة )
- صلاة الجماعة ، وما جاء فيمن خرج يريد الجماعة فوجد الناس قد صلوا )
- صلاة الجمعة والسعي إليها ، وما جاء في فضل يومها وساعتها )
- صلاة الجمعة.
- صلاة الضحى
- صلاة الضحى )
- صلاة العشاء والصبح خاصة في جماعة ،
- صلاة النافلة في البيوت )
- صلة الرح
- صلة الرحم . ٢٥٢٩ - ٢٥٣١ - حدیث
- صلة الرحم .. ٢٥٢١ و ٢٥٢٢ - حدیث
- صلة الرحم ٢٥٣٨ - ٢٥٤٠ - حديث
- صلة الرحم ٢٥۲۳ و ٢٥٢٤ - حدیث
- صوم الأربعاء والخميس .. 1045 - ١٠٤٧ - حديث
- صوم الأربعاء والخميس ١٠٤٨ و ١٠٤٩ - حديث
- صوم الاثنين والخميس
- صوم الاثنين والخميس )
- صوم ثلاثة أيام من كل شهر سيما الأيام (١) البيض )
- صوم ثلاثة أيام من كل شهر ١٠٣٦ و ۱۰۳۷ - حدیث
- صوم ثلاثة أيام من كل شهر ۱۰۳۱ - ١٠٣٥ - حديث
- صوم ست من شوال )
- صوم شعبان . . وفضل ليلة نصفه ١٠٢٢ - ١٠٢٤ - حديث
- صوم يوم وإفطار يوم ، وهو صوم داود عليه السلام )
- صيام رمضان احتساباً
- صيام رمضان احتساباً .
- صيام رمضان احتساباً . ۱۰۰۰ - ۱۰۰۲ - حدیث
- صيام رمضان احتساباً . ۹٩٦ و ۹۹۷ - حدیث
- صيام رمضان احتساباً ، وقيام ليله
- صيام شهر الله المحرم )
- صيام يوم عرفة لمن لم يكن بها .... ۱۰۱۰ - ۱۰۱۳ - حدیث
- طلاقة الوجه
- طلاقة الوجه وطيب الكلام ، وغير ذلك مما يذكر )
- طلب الحلال
- عال ابنته المردودة
- عيادة |
- عيادة المرضـ
- عيادة المرضى
- عيادة المرضى ٣٤٦٧ و ٣٤٦٨ - حديث
- عيادة المرضى ٣٤٧٢ - ٣٤٧٤ - حديث
- غض البصر .
- غض البصر .. ۱۹۰۳ و ١٩٠٤ - حديث
- فى انتظار الصلاة بعد الصلاة )
- فى صلاة الحاجة ودعائها )
- فى قراءة سورة الفاتحة ) .
- قتل الوزغ .
- قتل الوزغ ، وما جاء في قتل الحيات وغيرها مما يذكر )
- قراءة  قُلْ هُوَ ٱللَّهُ أَحَدٌ ) ١٤٨٣ و ١٤٨٤ - حدیث
- قراءة  قُلْ هُوَ ٱللَّهُ أَحَدٌ ١٤٨٠ - ١٤٨٢ - حديث
- قراءة (  قُلْ هُوَ ٱللَّهُ أَحَدٌ ) ) ﴿قل
- قراءة ) إذا زلزلت ) وما يذكر معها )
- قراءة آية الكرسي )
- قراءة القرآن في الصلاة
- قراءة القرآن في الصلاة ١٤۲۰ و ١٤٢١ - حدیث
- قراءة القرآن في الصلاة ١٤۲۷ - ١٤٢٩ - حديث
- قراءة المعوذتين )
- قراءة سورة  تَبَـٰرَكَ ٱلَّذِى بِيَدِهِ ٱلْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَىْءٍ قَدِيرٌ ) )
- قراءة سورة البقرة
- قراءة سورة البقرة ) . ١٤٥٨ - ١٤٦٠ - حديث
- قراءة سورة البقرة ) ١٤٦٦ - ١٤٦٨ - حديث
- قراءة سورة الفاتحة
- قراءة سورة الفاتحة )
- قراءة سورة الفاتحة ) ١٤٥٥ و ١٤٥٦ - حديث
- قراءة سورة الكهف ) . ١٤٧٢ و ١٤٧٣ - حديث
- قضاء الإنسان ورده إذا فاته من الليل )
- قضاء حوائج المسلمين
- قضاء حوائج المسلمين وإدخال السرور عليهم ،
- قضاء حوائج المسلمين ٢٦٢٤ - حديث
- قضاء حوائج ٢٦١٦ - ٢٦١٩ - حدیث
- قول : لا إله إلا الله وحده لا شريك له )
- قول : لا حول ولا قوة إلا بالله )
- قول : لا حول ولا قوة إلا بالله ١٥٨١ و ١٥٨٢ - حدیث
- قول لا إله إلا الله
- قول لا إله إلا الله وحده
- قيام الليل )
- كثرة الجماعة )
- كثرة الدعاء
- كثرة المصلين على الجنازة ، وفي التعزية )
- كثرة المصلين ٣٥٠٧ و ٣٥٠٨
- كفالة اليتيم ورحـ
- كفالة اليتيم ورحمته ٢٥٤١ - ٢٥٤٣ - حديث
- كلمات يدعى ٣٤٨٠ و ٣٤٨١ - حدیث
- كلمات يستفتح بها الدعاء
- كلمات يستفتح بها الدعاء ، وبعض ما جاء في اسم الله الأعظم )
- كلمات يستفتح بها الدعاء ١٦٤٢ و ١٦٤٣- حديث
- كلمات يقولهن .
- كلمات يقولهن إذا استيقظ من الليل )
- كلمات يقولهن بعد الوضوء
- كلمات يقولهن بعد الوضوء )
- كلمات يقولهن بعد الوضوء ٢٢۳ و ٢٢٤ - حدیث
- كلمات يقولهن حين يأوي
- كلمات يقولهن حين يأوي إلى فراشه
- كلمات يقولهن حين يأوي ٦٠٤ - ٦٠٦ - حديث
- كلمات يقولهن حين يأوي ٦٠٨ و ٦٠٩ - حديث
- كلمات يقولهن من آلمه شيء من جسده )
- كلمات يقولهن من خاف ظالماً)
- كلمات يقولهن من رأى مبتلى )
- كلمات يقولهن من لبس ثوباً جديداً )
- كلمات يقولهن من نزل منزلاً )
- كلمات يكفرن لغط المجلس )
- كلمات يكفرن لغط المجلس ١٥١٨ و ١٥١٩ - حدیث
- لبس الأبيض من الثياب )
- لزوم المساجد والجلوس فيها
- لزوم المساجد والجلوس فيها )
- لعق الأصابع ... ٢١٦٢ و ٢١٦٣ - حدیث
- لعق الأصابع قبل مسحها لإحراز البركة )
- لم يتطير
- ما يقول إذا خرج من بيته
- ما يقوله من حصلت له وسوسة ١٦١٠ - ١٦١٣ - حديث
- ما يقوله ويفعله من رأى في منامه ۱۳۹۷ - ١٥٩٩- حديث
- نشر العلم
- ها عند عدمهما )
- وصل الصفوف .
- وصل الصفوف وسد الفرج )
- يصل ذا الرحم الظالم
- يعول يتيما
- ١٠١ - بَابُ لا يَعِيبُ الطَّعَامَ، وَاسْتِحْبَابِ مَدْحِهِ
- ١٠٩ - بَابُ اسْتِحْبَاب الأكل بِثَلاثِ أَصَابِعَ، وَاسْتِحْبَابِ لَعْقِ الأصابع، وَكَرَاهَةِ مَسْحِهَا قَبْلَ لَعْقِهَا، وَاسْتِحْبَابِ لَعْقِ القَصْعَةِ وَأَخْذِ اللّقْمَةِ الَّتِي تَسْقُطُ مِنْهُ وَأَكْلِهَا، وَجَوَازِ مَسْجِهَا بَعْدَ اللَّعْقِ بِالسَّاعِدِ وَالقَدَم - وَغَيْرِهِمَا -
- ١١٥ - بَابُ اسْتِحْبَابِ كَوْنِ سَاقِي القَوْمِ آخِرَهُمْ شُرْباً
- ١٣٤ - بَابُ اسْتِحْبَابِ إِعَادَةِ السَّلام عَلَى مَنْ تَكَرَّرَ لِقَاؤُهُ عَلَى قُرْبِ؛ بِأَنْ دَخَلَ ثُمَّ خَرَجَ فِي الحَالِ، أَوْ حَالَ بَيْنَهُمَا شَجَرَةٌ وَنَحْوُهَا
- ١٣٥ - بَابُ اسْتِحْبَابِ السَّلامِ إِذَا دَخَلَ بَيْتَهُ
- ١٤٢ - بَابُ اسْتِحْبَابِ تَشْمِيتِ العَاطِسِ إِذَا حَمِدَ اللَّهَ - تَعَالَى ، وَكَرَاهِيَّةِ تَشْمِيتِهِ إِذَا لَمْ يَحْمَدِ اللَّهَ - تَعَالَى . وَبَيَانِ آدَابِ التَّشْمِيتِ وَالعُطَاسِ وَالتَّثَاؤُبِ
- ١٤٣ - بَابُ اسْتِحْبَابِ المُصَافَحَةِ عِنْدَ اللَّقَاءِ، وَبَشَاشَةِ الوَجْهِ، وَتَقْبِيلِ يَدِ الرَّجُلِ الصَّالِحٍ، وَتَقْبِيلِ وَلَدِهِ شَفَقَةً،
- ١٤٨ - بَابُ اسْتِحْبَابِ وَصِيَّةِ أهْلِ الْمَرِيضِ وَمَنْ يَخْدُمُهُ بِالإِحْسَانِ إِلَيْهِ وَاحْتِمَالِهِ ، وَالصَّبْرِ عَلَى مَا يَشُقُّ مِنْ أَمْرِهِ، وَكَذَا بِالوَصِيَّةِ بِمَنْ قَرُبَ سَبَبُ مَوْتِهِ بِحَدٌ أَوَ قِصَاصِ
- ١٦٤ - بَابُ فَضْل مَنْ مَاتَ لَهُ أَوْلَادٌ صِغَارٌ
- ١٦٦- بَابُ اسْتِحْبَابِ الخُرُوجِ يَوْمَ الخَمِيسِ ، وَاسْتِحْبَابِهِ أَوَّلَ النَّهَارِ
- ١٦٧ - بَابُ اسْتِحْبَابِ طَلَبِ الرِّفْقَةِ، وَتَأْمِيرِهِمْ عَلَى أَنْفُسِهِمْ وَاحِداً يُطِيعُونَهُ
- ١٦٨ - بَابُ آدَابِ السَّيْرِ وَالنُّزُولِ وَالمَبِيتِ وَالنَّوْمِ فِي السَّفَرِ، وَاسْتِحْبَابِ السُّرَى ، وَالرِّفْقِ بِالدَّوَابِّ وَمُراعَاةِ مَصْلَحَتِهَا
- ١٧٥ - بَابُ اسْتِحْبَابِ تَعْجِيلِ المُسَافِرِ الرُّجُوعَ إِلَى أَهْلِهِ إِذَا قَضَى حَاجَتَهُ
- ١٧٦ - بَابُ اسْتِحْبَابِ القُدُومِ عَلَى أَهْلِهِ نَهَاراً، وَكَرَاهَتِهِ فِي اللَّيْلِ لِغَيْرِ حَاجَةٍ
- ١٩٤ - بَابُ فَضْلِ الصَّفُ الأَوَّلِ، وَالأَمْرِ بِإِثْمَامِ الصُّفُوفِ الأولِ وَتَسْوِيَتِهَا وَالتَّرَاصٌ فِيهَا
- ١٩٥ - بَابُ فَضْل السُّنَنِ الرَّاتِبَةِ مَعَ الفَرائِضِ . وَبَيَانِ أَقَلُّهَا وَأَكْمَلِهَا وَمَا بَيْنَهُمَا
- ٢٠٤ - بَابُ اسْتِحْبَابِ جَعَلِ النَّوافِلِ فِي الْبَيْتِ ؛ سَوَاءٌ الرَّاتِبَةُ وَغَيْرُهَا، وَالأمْرِ بِالتَّحَوُّلِ لِلنَّافِلَةِ مِنْ مَوْضِع الفَرِيضَةِ، أَوِ الْفَصْلِ بَيْنَهُمَا بِكَلامِ
- ٢٠٦ - بَابُ فَضْل صَلاةِ الضُّحَى، وَبَيَانِ أَقَلُّهَا وَأَكْثَرِهَا وَأَوْسَطِهَا، وَالحَقِّ عَلَى المُحَافَظَةِ عَلَيْهَا
- ٢١٤ - بَابُ فَضْل قِيَام لَيْلَةِ القَدْرِ، وَبَيَانِ أَرْجَى لَيَالِيهَا قَالَ اللَّهُ - تَعَالَى -: ﴿ إِنَّا أَنزَلْتَهُ فِي لَيْلَةِ الْقَدْرِ ﴾ [القدر: ١) إِلَى آخِرِ السُّورَةِ . وَقَالَ - تَعَالَى: ﴿إِنَّا أَنزَلْنَهُ فِي لَيْلَةٍ مُبَرَكَة الآيات [الدخان: ٣].
- ٢١٥ - بَابُ فَضْل السِّوَاكِ، وَخِصَالِ الفِطْرَةِ
- ٢٤٤ - بَابُ فَضْل الذِّكْرِ وَالحَثَّ عَلَيْهِ
- ٤٢ - بَابُ فَضْلِ بِرِّ أَصْدِقَاءِ الأَبِ وَالأُمِّ وَالْأَقَارِبِ وَالزَّوْجَةِ، وَسَائِرِ مَنْ يُنْدَبُ إِكْرَامُهُ
- ٥٥ - بَابُ فَضْلِ الزُّهْدِ فِي الدُّنْيَا، وَالحَقِّ عَلَى التَّقَلُّل مِنْهَا، وَفَضْلِ الفَقْرِ
- ٥٦ - بَابُ فَضْلِ الجُوعِ وَخُشُونَةِ العَيْشِ، وَالاقْتِصَارِ عَلَى القَلِيلِ مِنَ المَأْكُولِ وَالمَشْرُوبِ وَالمَلْبُوس
- ٦٦ - بَابُ اسْتِحْبَاب زِيَارَةِ القُبُورِ لِلرِّجَالِ (۳) ،
- ۱۱۱ - بَابُ أَدَبِ الشَّرْبِ ، وَاسْتِحْبَابِ التَّنَفْسِ ثَلاثاً خَارِجَ الإِنَاءِ، وَكَرَاهِيَةِ التَّنَفُسِ فِيهِ، وَإِدَارَةِ الإِنَاءِ عَلَى الْأَيْمَنِ فَالأَيْمَن بَعْدَ المُبْتَدِي
- ۱۱۷ - بَابُ اسْتِحْبَابِ الثَّوْبِ الأَبْيَضِ، وَجَوَازِ الْأَحْمَرِ وَالأَخْضَرِ وَالأصْفَرِ وَالأسْوَدِ، وَجَوَازِهِ مِنْ قُطْنِ وَكَتَّانِ وَشَعْرِ وَصُوفِ وَغَيْرِهَا؛ إِلَّا الحَرِيرَ
- ۱۲۱ - بَابُ اسْتِحْبَابِ التَّوَسُطِ فِي اللُّبَاسِ، وَلَا يَقْتَصِرُ عَلَى مَا يُزْرِي بِهِ لِغَيْرِ حَاجَةٍ وَلَا مَقْصُودٍ شَرْعِيٌّ
- ۱۳۱ - بَابُ فَضْلِ السَّلام، وَالأَمْرِ بِإِفْشَائِهِ قَالَ اللَّهُ - تَعَالَى -: ﴿يَتَأَيُّهَا يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ لَا تَدْخُلُوا۟ بُيُوتًا غَيْرَ بُيُوتِكُمْ حَتَّىٰ تَسْتَأْنِسُوا۟ وَتُسَلِّمُوا۟ عَلَىٰٓ أَهْلِهَا ۚ ذَٰلِكُمْ خَيْرٌ لَّكُمْ لَعَلَّكُمْ تَذَكَّرُونَ ﴾ [النور: ٢٧] .
- ۱۳۹ - بَابُ اسْتِحْبَابِ السَّلام إِذَا قَامَ عَنِ الْمَجْلِسِ وَفَارَقَ جُلَسَاءَهُ أَوْ جَلِيسَهُ
- ۱۷۲ - بَابُ اسْتِحْبَابِ الدُّعَاءِ فِي السَّفَرِ
- ۱۷۸ - بَابُ اسْتِحْبَابِ ابْتِدَاءِ القَادِمِ بِالمَسْجِدِ الَّذِي فِي جِوَارِهِ، وَصَلَاتِهِ فِيهِ رَكْعَتَيْن
- ۱۸۲ - بَابُ اسْتِحْبَابِ تَحْسِينِ الصَّوْتِ بِالْقُرْآنِ، وَطَلَبِ
- ۲۰۹ - بَابُ اسْتِحْبَابِ رَكْعَتَيْنِ بَعْدَ الوُضُوءِ
- ۲۱۱ - بَابُ اسْتِحْبَابِ سُجُودِ الشَّكْرِ عِنْدَ حُصُولِ نِعْمَةٍ ظَاهِرَةِ، أَوِ انْدِفَاعِ بَلِيَّةِ ظَاهِرَةِ
- ۲۲۲ - بَابُ فَضْلِ تَعْجِيلِ الفِطْرِ، وَمَا يُفْطِرُ عَلَيْهِ، وَمَا يَقُولُهُ بَعْدَ الإِفْطَارِ
- ۲۲۸ - بَابُ اسْتِحْبَابِ صَوْمِ سِتَّةِ أَيَّامٍ مِنْ شَوَّالٍ
- ۲۳۰ - بَابُ اسْتِحْبَابِ صَوْمِ ثَلَاثَةِ أَيَّامٍ مَنْ كُلِّ شَهْرٍ وَالأفْضَلُ صَوْمُهَا فِي الأَيَّامِ البِيضِ ، وَهِيَ : الثَّالِثَ عَشَرَ، وَالرَّابِعَ عَشَرَ، وَالخَامِسَ عَشَرَ ، وَقِيلَ: الثَّانِيَ عَشَرَ، وَالثَّالِثَ عَشَرَ، وَالرَّابِعَ عَشَرَ، وَالصَّحِيحُ المَشْهُورُ هُوَ الأَوَّلُ .
- ۲۳۱ - بَابُ فَضْلِ مَنْ فَطَّرَ صَائِماً، وَفَضْلِ الصَّائِمِ الصَّائِمِ الَّذِي يُؤْكَلُ عِنْدَهُ، وَدُعَاءِ الآكِلِ لِلْمَأْكُولِ عِنْدَهُ
- ۲۳۷ - بَابُ فَضْلِ الإِحْسَانِ إِلَى المَمْلُوكِ
- ۲۳۸ - بَابُ فَضْل المَمْلُوكَ الَّذِي يُؤَدِّي حَقَّ اللَّهِ
- ۸۹ - بَابُ اسْتِحْبَابِ بَيَانِ الكَلامِ، وَإِيضَاحِهِ لِلْمُخَاطَبِ، وَتَكْرِيرِهِ ؛ لِيَفْهَمَ إِذَا لَمْ يَفْهَمْ إِلَّا بِذَلِكَ
- ۹۸ - بَابُ اسْتِحْبَابِ الذَّهَابِ إِلَى العِيدِ، وَعِيَادَةِ المَرِيضِ ) ، وَالحَجِّ - وَنَحْوِهَا ـ مِنْ طَرِيقِ، وَالرُّجُوعِ مِنْ طَرِيقِ آخَرَ ؛ لِتَكْثِيرِ مَوَاضِع العِبَادَةِ

### Twenty classified links for the owner

| Entity | Status | Note |
| --- | --- | --- |
| بَابُ تَحْرِيم الظُّلْم وَالأَمْرِ بِرَدُ المَظَالم | ACCEPTED | باب بَاب تَحْرِيمِ الظُّلْمِ، وَالْأَمْرِ بِرَدُ المَظَالَم — رياض الصالحين |
| أعراض الناس وما يلزم من ترك الوقوع فيها | ACCEPTED | باب تحريم أعراض الناس وما يلزم من ترك الوقوع فيها — الجامع لشعب الإيمان (ط الرشد) |
| أعراض الناس وما يلزم من ترك الوقوع فيها | ACCEPTED | باب تحريم أعراض الناس وما يلزم من ترك الوقوع فيها — الجامع لشعب الإيمان (ط الرشد) |
| الرضاعة من ماء الفحل | ACCEPTED | باب 1 ( 2 باب تحريم الرضاعة من ماء الفحل — صحيح مسلم |
| ۲۸۰ - بَابُ تَحْرِيمِ الهِجْرَانِ بَيْنَ المُسْلِمِينَ فَوْقَ ثَلَاثَةِ أَيَّامٍ؛ إِلا لِبِدْعَةٍ فِي الْمَهْجُورِ أَوْ تَظَاهُرٍ بِفِسْقٍ أَوْ نَحْوِ ذَلِكَ قَالَ اللَّهُ - تَعَالَى -: إِنَّمَا ٱلْمُؤْمِنُونَ إِخْوَةٌ فَأَصْلِحُوا۟ بَيْنَ أَخَوَيْكُمْ ۚ وَٱتَّقُوا۟ ٱللَّهَ لَعَلَّكُمْ تُرْحَمُونَ ﴾ [الحجرات : ١٠] . | ACCEPTED | باب ۲۸۰ - بَابُ تَحْرِيمِ الهِجْرَانِ بَيْنَ المُسْلِمِينَ فَوْقَ ثَلَاثَةِ أَيَّامٍ؛ إِلا لِبِدْعَةٍ فِي الْمَهْجُورِ أَوْ تَظَاهُرٍ بِفِسْ |
| اصطحاب الكلب ۳۱۱۰ - ۳۱۱۹ - حدیث | ACCEPTED | باب ۲۳ - كتاب الأدب وغيره ٤٥ - الترهيب من اصطحاب الكلب ۳۱۱۰ - ۳۱۱۹ - حدیث — صحيح الترغيب والترهيب |
| المنكر | ACCEPTED | باب الأمر بالمعروف والنهي عن المنكر — الجامع لشعب الإيمان (ط الرشد) |
| 1 ( 11 باب النهى عن الشحناء والتهاجر | ACCEPTED | باب 1 ( 11 باب النهى عن الشحناء والتهاجر — صحيح مسلم |
| بيع الحاضر للبادي | ACCEPTED | باب 1 ( 6 باب تحريم بيع الحاضر للبادي — صحيح مسلم |
| الفروج، وما يجب من التعفف عنها | ACCEPTED | باب تحريم الفروج، وما يجب من التعفف عنها — الجامع لشعب الإيمان (ط الرشد) |
| بيع الثمار قبل بدو صلاحها بغير شرط القطع | ACCEPTED | باب 1 ( 13 باب النهي عن بيع الثمار قبل بدو صلاحها بغير شرط القطع — صحيح مسلم |
| أعراض الناس وما يلزم من ترك الوقوع فيها | ACCEPTED | باب تحريم أعراض الناس وما يلزم من ترك الوقوع فيها — الجامع لشعب الإيمان (ط الرشد) |
| أذى الجار ٢٥٤٨ و ٢٥٤٩ - حدیث | ACCEPTED | باب ۲۲ - كتاب البر والصلة وغيرهما ه - الترهيب من أذى الجار ٢٥٤٨ و ٢٥٤٩ - حدیث — صحيح الترغيب والترهيب |
| الملاعب والملاهي | ACCEPTED | باب تحريم الملاعب والملاهي — الجامع لشعب الإيمان (ط الرشد) |
| ٢٩٦ - بَابُ تَحْرِيمِ وَصْلِ الشَّعْرِ وَالوَشْمِ وَالوَشْرِ ـ وَهُوَ تَحْدِيدُ الأَسْنَانِ - | ACCEPTED | باب ٢٩٦ - بَابُ تَحْرِيمِ وَصْلِ الشَّعْرِ وَالوَشْمِ وَالوَشْرِ ـ وَهُوَ تَحْدِيدُ الأَسْنَانِ - — رياض الصالحين |
| أعراض الناس وما يلزم من ترك الوقوع فيها | ACCEPTED | باب تحريم أعراض الناس وما يلزم من ترك الوقوع فيها — الجامع لشعب الإيمان (ط الرشد) |
| الاحتكار في الأقوات | ACCEPTED | باب 1 ( 26 باب تحريم الاحتكار في الأقوات — صحيح مسلم |
| المراء والجدال | ACCEPTED | باب ١١ - الترهيب من المراء والجدال — صحيح الترغيب والترهيب |
| الزنا . | ACCEPTED | باب ۲۱ ـ كتاب الحدود وغيرها ۷ - الترهيب من الزنا . — صحيح الترغيب والترهيب |
| الهجر فوق ثلاث بلا عذر شرعى | ACCEPTED | باب 1 ( 8 باب تحريم الهجر فوق ثلاث بلا عذر شرعى — صحيح مسلم |

### Twenty strong matches (standard number in gradeReference)

The stored text is still the original book's text. The reader replaces it with the clean matn when gradeSource is AUTO_SAHIHAYN.

| Reference | Book | Stored opening |
| --- | --- | --- |
| البخاري 750 | صحيح الترغيب والترهيب | ٥٤٧ - (١) عن أنس بن مالك رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : م |
| مسلم 2549 | الجامع لشعب الإيمان (ط الرشد) | أخبرنا أبو عبد الله الحافظ، نا أبو الحسن أحمد بن محمد العنبري، نا عثمان بن سعيد  |
| البخاري 3124 | رياض الصالحين | ٥٩ - الخَامِسُ : عَنْ أبِي هُرَيْرَةَ لله ، قَالَ : قَالَ رَسُولُ اللَّهِ صلى ال |
| مسلم 1395 | الجامع لشعب الإيمان (ط الرشد) | أخبرنا عبد الله بن يوسف، أخبرنا أبو الحسن محمد بن رافع بن إسحاق الخزاعي، أخبرنا  |
| البخاري 2120 | الأدب المفرد | حدثنا آدم قال: حدثنا شعبة، عن حميد الطويل، عن أنس بن مالك قال: كان النبي صلى الل |
| مسلم 2124 | رياض الصالحين | ١٦٥٣ - وَعَنْ ابْنِ عُمر لهلهلهلهله ، أن رسُولَ اللَّهِ صلى الله عليه وسلم لَعَن |
| مسلم 2577 | صحيح الترغيب والترهيب | ١٦٢٣ - (۸) ورواه الحاكم من حديث ابن مسعود وقال : صحيح على شرطهما » ؛ إلا أنه قال |
| البخاري 2374 | رياض الصالحين | ٥٤٥ - وَعَنْ أَبِي هُرَيْرَةَ لله، قَالَ: قَالَ رَسُولُ اللَّهِ صلى الله عليه وس |
| مسلم 2573 | الجامع لشعب الإيمان (ط الرشد) | أخبرنا أبو عبد الله الحافظ , أنا أبو العباس محمد بن يعقوب , نا أبو جعفر أحمد بن  |
| مسلم 2588 | الجامع لشعب الإيمان (ط الرشد) | أخبرنا أبو عمر محمد بن الحسين بن محمد بن الهيثم، نا أبو العباس الحسين بن سعيد ال |
| البخاري 594 | الجامع لشعب الإيمان (ط الرشد) | أخبرنا علي بن أحمد بن عبدان، حدثنا أحمد بن عبيد، حدثنا أبو مسلم إبراهيم بن عبد ا |
| البخاري 5458 | رياض الصالحين | ۷۳۸ - وَعَنْ أَبِي أُمَامَةَ الله ، أَنَّ النَّبِيَّ صلى الله عليه وسلم كَانَ إِ |
| البخاري 5991 | الجامع لشعب الإيمان (ط الرشد) | حدثنا أبو محمد بن يوسف، حدثنا أبو سعيد بن الأعرابي، حدثنا أبو عثمان سعيد بن محمد |
| مسلم 669 | رياض الصالحين | ١٠٦٠ - عَنْ أَبِي هُرَيْرَةَ لله ، أَنَّ النَّبِيَّ صلى الله عليه وسلم قَالَ: «م |
| مسلم 2959 | الجامع لشعب الإيمان (ط الرشد) | أخبرنا أبو طاهر الفقيه , أنا أبو حامد بن بلال , نا محمد بن يونس السرخسي , نا عبد |
| مسلم 720 | صحيح الترغيب والترهيب | ٦٦٤ - (١) عن أبي هريرة رضي الله عنه قال : أوصاني خليلي بصيام ثلاثة أيام من كل شه |
| البخاري 7097 | الأدب المفرد | حدثنا سعيد بن أبي مريم قال: حدثنا محمد بن جعفر، عن شريك بن عبد الله، عن سعيد بن  |
| مسلم 815 | رياض الصالحين | ۵۷۷ - وَعَنِ ابْنِ عُمَرَ الله ، عَنِ النَّبِيِّ ، الله، قَالَ: «لا حَسَد إِلا ف |
| البخاري 2017 | رياض الصالحين | ١٣٠٠ - وَعَنْهَا نَا ، أَنَّ رَسُولَ اللهِ صلى الله عليه وسلم قَالَ: «تَحرَّوْا  |
| مسلم 118 | رياض الصالحين | ۸۸ - فَالأَوَّلُ : عَنْ أَبِي هُرَيْرَةَ لله ، أَنَّ رَسُولَ اللَّهِ صلى الله عل |
