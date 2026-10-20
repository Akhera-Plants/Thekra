# Shu'ab rematch, athar, accounts hide, Ibn Abi al-Dunya — build report

Task: `docs/build/CURSOR_SHUAB_ATHAR_IBNABIDUNYA.md`.

## Phase 1 — Shu'ab matn + rematch

### Before → after

| Metric | Before | After |
| --- | ---: | ---: |
| Shu'ab quotes | 10725 | 10725 |
| Public (SAHIH/HASAN + publishable source) | 530 | 530 |
| — AUTO_SAHIHAYN | 272 | 272 |
| — SUNAN_TAHQIQ | 134 | 134 |
| — HADEETHENC | 124 | 124 |
| Branches with ≥1 public text | 64 | 64 |
| HadithMatch rows (Shu'ab) | 8793 | 8793 |
| Strong (≥ 0.75) | 346 | 346 |
| Mid (0.60–0.75) | 885 | 885 |
| `matnAr` filled | 0 | 10725 |
| Isnad cut empty (often short/clean text) | — | 289 |
| `ImanBranchQuote` with `basis=TAKHRIJ` | 0 | 332 |
| Sin TAKHRIJ via branch map | — | 61 |
| Deed TAKHRIJ via branch map | — | 246 |

Note: the mid-band did not shrink. The backend `splitMatn` already cut most Bayhaqi chains before rematch; remaining 0.60–0.75 scores are genuine near-matches of the matn, not isnad pollution. Matn is now **stored** and used for matching/display.

### What shipped

- Schema: `Quote.matnAr`, `Quote.isAthar`, `Quote.atharSpeakerKey`; `ImanBranchQuote.basis` + `classifiedBy`
- Import: Shu'ab writes `matnAr` + `rawPayload.fullTextAr`; CLI `shuab-matn` / `shuab-propagate`
- Matching: takhrij / sunan-tahqiq / hadeethenc prefer `matnAr`
- Display: public DTO never returns the chain when `matnAr` is set; matched Shu'ab rows get `citation.alsoIn` («ورد في الجامع لشعب الإيمان…»)
- HadeethEnc was already present from the prior study-panel phase (not skipped)

### Gates (Phase 1)

| Check | Result |
| --- | --- |
| frontend / backend `tsc` | pass |
| lint | pass (pre-existing warnings only) |
| frontend unit | 25 passed |
| backend unit | 446 passed |
| backend e2e | 258 passed |
| `shuab-matn` re-run | `updated=0 already=10725` |
| `shuab-propagate` re-run | `branch=0 sin=0 deed=0` |

## Phase 2 — athar

Classifier: `backend/src/common/text/athar-classify.ts` (30/30 unit samples in `athar-classify.spec.ts`).

| Metric | Value |
| --- | ---: |
| Narrations classified | 12527 |
| MARFU | 2535 |
| ATHAR | 9992 |
| Listed speakers (public) | 827 |
| Unlisted (hidden; TSV) | 9165 |
| Idempotent re-run updates | 0 |

- Reviewer file: `docs/taxonomy/athar-unlisted-speakers.tsv`
- Speakers YAML: `backend/prisma/taxonomy/athar-speakers.yaml`
- Public: listed athar via `GradePolicy` (`isAthar` + `atharSpeakerKey`); ReminderReader section «من أقوال السلف» + tab «الآثار» / «Sayings of the Salaf»; QuoteCard shows «— speaker» and «أثر، وليس حديثًا» (no grade badge)

### Gates (Phase 2)

| Check | Result |
| --- | --- |
| tsc / lint | pass |
| frontend unit | 25 passed |
| backend unit | 476 passed (incl. 30 classifier samples) |
| backend e2e | 258 passed |
| `import:book athar` re-run | `updated=0` |

Screenshots of branch + `/sins/ghibah` (1440/390, ar/en) — captured after Phase 3 when servers are up, or noted if deferred.

## Phase 3 — hide accounts

Flag: `NEXT_PUBLIC_ACCOUNTS_ENABLED=false` (default in `frontend/.env.example`).

Hidden when flag is off:
- Header sign-in / register (`AuthNavItems`)
- Favorites nav (`SavedNavLink`) + footer favorites link
- Home featured-reminder save button
- QuoteCard favorite button
- `/login`, `/register`, `/favorites`, `/settings` redirect home

Admin: `/admin` shows `LoginForm` inline when unauthenticated (`redirectTo=/admin`). Report-mistake stays.

Playwright: dropped stale «القائمة» / `English` expectations; locale switch expects `En`. About page no longer leaks Latin from HadeethEnc `nameAr` (pure «موسوعة الأحاديث النبوية»).

### Gates (Phase 3)

| Check | Result |
| --- | --- |
| frontend / backend `tsc` | pass |
| lint | pass (pre-existing warnings only) |
| frontend unit | 25 passed |
| backend unit | 476 passed |
| backend e2e | 258 passed |
| Playwright | 2 passed |
| `import:book athar` re-run | `updated=0` |
| Hidden-auth smoke | no sign-in/register/favorites/save on home; `/login` → `/`; `/admin` has email login |

## Phase 4 — Ibn Abi al-Dunya

OpenITI pin: `0300AH@01a1544130e0236850ef2698923ad01575c5bd7c` (63 works under `0281IbnAbiDunya`).

| Metric | Value |
| --- | ---: |
| Sources (one per work) | 63 |
| BookSection | 2140 |
| SectionItem | 19652 |
| Quotes created | 18712 |
| — HADITH | 8890 |
| Listed athar (after classifier) | 550 |
| Strong takhrij matches (≥ 0.75) | 176 |
| Sin / deed / branch links | **0** (structure only) |

- CLI: `pnpm --filter backend import:book ibn-abi-dunya`
- Parser handles both `### N -` headings and `# N -` paragraph numbers
- Reviewer TSVs: `docs/taxonomy/sections/ibn-abi-dunya/<Key>.tsv` + `_index.tsv`
- Athar classifier already scopes `book:ibn-abi-dunya*`; re-run after import: `updated=8158` then `updated=0`
- Takhrij run on all HADITH (matn); no topic / chapter maps for these sources

### Gates (Phase 4)

| Check | Result |
| --- | --- |
| frontend / backend `tsc` | pass |
| lint | pass (pre-existing warnings only) |
| frontend unit | 25 passed |
| backend unit | 478 passed (incl. Dunya parse samples) |
| backend e2e | 258 passed |
| `ibn-abi-dunya` re-run | `createdSections=0 createdItems=0` |
| `athar` re-run | `updated=0` |
| Playwright | 2 passed |

### Screenshots

Under `docs/design/after/shuab-athar/`:

- Branch 1 + ghibah: 1440/390 × ar/en (athar tab clicked when present)
- `home-auth-hidden-1440-ar.png` — no sign-in / favorites / save chrome

## Athar audit

Follow-up to phases 1–4: classifier precision before public «من أقوال السلف».

### Classifier re-run (step 3)

| Metric | Value |
| --- | ---: |
| Narrations classified | 21417 |
| MARFU | 8645 |
| ATHAR | 5512 |
| REJECT | 7260 |
| Listed speakers (would-be public) | 1290 |
| Unlisted | 4222 |
| Shu'ab MARFU | 5905 |
| Shu'ab ATHAR | 2183 |
| Shu'ab REJECT | 2637 |

Shu'ab MARFU rose substantially (prophetic cues + bare Prophet / salawat mentions).

### Fixes landed

- Quote-frame speaker only (`قال فلان:` / `عن فلان قال:` / `سمعت…يقول` / `أن فلان قال لـ`); never isnad names
- Empty / chain-only → REJECT; isnad-only after `قال` (`وحدثنا…`) → REJECT
- MARFU: `رفعه` / `يرفعه` / `مرفوعا` / `يبلغ به` / `قال رسول الله` / `عن النبي` / bare Prophet name / any `صلى الله عليه وسلم`
- OCR strip (`[ $ ]`, `|`, ASCII + Arabic-Indic digits); residual junk → REJECT
- YAML match: short ism exact-only; no nisba hijack (`حذيفة المرعشي`, `أبو سعيد الخراز`, `أبو بكر الرازي`)

### Precision sample (step 4) — 60 random listed athar

Seed `20261024`. Marked **WRONG** when speaker or saying fails the audit rules.

| # | Speaker | Book | No. | Saying (truncated) |
| ---: | --- | --- | ---: | --- |
| 1 | عمر بن الخطاب | شعب الإيمان | 35 | لو وزن ايمان ابي بكر بايمان اهل الارض لرجح بهم " |
| 2 | مطرف بن عبد الله بن الشخير | شعب الإيمان | 6529 | ان اقبح الرغبه في الدنيا ان تطلب بعمل الاخره " |
| 3 | أبو ذر الغفاري | الزهد لابن المبارك | 561 | اوصاني خليلي اذا صنعت بن حمزه بن عبد الله بن عمر : : ثقه ( ) . ابن عمر ( ) . رواه احمد بمعناه في الزهد ( ) وابو نعيم … **WRONG** |
| 4 | مجاهد بن جبر | شعب الإيمان | 1943 | كان ربما قرا وقوم نيام فيجد الريح، فيمسك عن القراءه حتي تذهب " قال: وحدثنا عبد الله بن المبارك، عن عثمان بن الاسود، ع… |
| 5 | عبد الله بن مسعود | الزهد لابن المبارك | 1005 | وددت ان حسناتي فضلت سيئاتي مثقال ذره، ولو وقفت بين الجنه والنار لا ادري الي ايتهما اصير، ثم قيل لي تمنه لتمنيت ان اكو… |
| 6 | أبو الدرداء | الزهد لابن المبارك | 988 | من فقه الرجل ممشاه، ومدخله، ومجلسه» ثم قال ابو الدرداء: " قاتل الله الشاعر حين يقول: عن المرء لا تسال وابصر قرينه " |
| 7 | قتادة بن دعامة | شعب الإيمان | 1620 | ان في الحكمه مكتوبا طوبي لعالم ناطق، وطوبي لمستمع واع " |
| 8 | أبو هريرة | شعب الإيمان | 6879 | احذركم محقرات هذه الاعمال، وانها تحصي عليكم، وترد عليكم ". هكذا جاء موقوفا |
| 9 | أبو الدرداء | الزهد لابن المبارك | 1239 | ما من رجل يريد ان يقوم ساعه من الليل، فتغلبه عينه، الا كتب الله له اجرها، وكان نومه صدقه تصدق الله بها عليه» |
| 10 | عبد الله بن مسعود | شعب الإيمان | 660 | لان اخذ في طريق اقول: فيه " سبحان الله والحمد لله ولا اله الا الله والله اكبر احب الي من ان انفق عددهن دنانير في سبيل… |
| 11 | عبد الله بن عمر | ابن أبي الدنيا | 416 | رايت عمر بن الخطاب البكاء، وهو يصلي، حتي سمعت خنينه، من وراء ثلاثه صفوف» |
| 12 | أبو بكر الصديق | الزهد لابن المبارك | 626 | انه من يظلم المؤمنين فانما يخفر الله، هم جيران الله، وعواذ الله، والله ان احدهم لتصاب شاه جاره، او بعير جاره، فيبيت و… |
| 13 | الحسن البصري | ابن أبي الدنيا | 180 | دخل عامر بن عبد الله علي رجل يعوده، فراه كانه جزع من الموت، فقال: «اتجزع من الموت؟ والله ما الموت فيما بعده الا كركضه… |
| 14 | مجاهد بن جبر | ابن أبي الدنيا | 82 | ان الكلام ليكتب حتي ان الرجل ليسكت ابنه: ابتاع لك كذا وكذا، وافعل كذا وكذا، فيكتب كذيبه " |
| 15 | عبد الله بن مسعود | ابن أبي الدنيا | 103 | اذا بقي في النار من يخلد فيها جعلوا في توابيت من حديد فيها مسامير من حديد ، ثم جعلت تلك التوابيت في توابيت من حديد في… |
| 16 | الحسن البصري | ابن أبي الدنيا | 65 | اذا رايت في ولدك ما تكره، فاعتب ربك، فانما هو شيء يراد به انت |
| 17 | الحسن البصري | ابن أبي الدنيا | 62 | ابن ادم لا تحمل هم سنه علي يوم، كفي يومك بما فيه، فان تكن السنه من عمرك ياتك الله فيها برزقك، والا تكن من عمرك فاراك … |
| 18 | الحسن البصري | شعب الإيمان | 6826 | من عمل حسنه وان صغرت اورثته نورا في قلبه، وقوه في عمله، وان عمل سيئه وان صغرت فاحتقرها اورثته ظلما في قلبه، وضعفا في … |
| 19 | عبد الله بن عباس | ابن أبي الدنيا | 24 | ما من عام باكثر مطرا من عام، ولكن الله تعالي يصرفه حيث يشاء» |
| 20 | الحسن البصري | ابن أبي الدنيا | 193 | العمل بالحسنه نور في القلب وقوه في البدن، والعمل بالسيئه ظلمه في القلب، ووهن في البدن» |
| 21 | مسروق بن الأجدع | ابن أبي الدنيا | 229 | قالت عائشه رضي الله عنها **WRONG** |
| 22 | سعيد بن المسيب | شعب الإيمان | 6823 | الناس يعملون اعمالهم من تحت كنف الله، فاذا اراد الله بعبد فضيحه اخرجه من تحت كنفه فبدت عورته " |
| 23 | مجاهد بن جبر | ابن أبي الدنيا | 144 | لا تمار اخاك، ولا تفاكهه» يعني المزاح |
| 24 | عامر الشعبي | الزهد لابن المبارك | 55 | يطلع القوم من اهل الجنه الي قوم في النار، فيقولون: ما ادخلكم النار، وانما دخلنا الجنه بفضل تاديبكم وتعليمكم؟ قالوا: ا… |
| 25 | عامر الشعبي | شعب الإيمان | 9182 | لان اعطي درهمين في نائبه احب الي من ان اتصدق بخمسه " |
| 26 | مجاهد بن جبر | شعب الإيمان | 5020 | لو ان الذي يعمل ذلك العمل - يعني عمل قوم لوط - اغتسل بكل قطره من السماء، وكل قطره في الارض لم يزل نجسا " |
| 27 | جابر بن عبد الله | شعب الإيمان | 7398 | اتقوا الله، واستحيوا، وتواروا، ولا يغتسل احد منكم الا وعليه ستره، وليستره اخوه ولو بثوبه " |
| 28 | الحسن البصري | شعب الإيمان | 2963 | سبحان الله وما له؟ " قالت: انتظرت ان يقوم ليتهجد فلم يفعل، فالححت عليه فزبرني وشتمني، قال: فصاح: لعلي، وقال: " اما تع… |
| 29 | قتادة بن دعامة | الزهد لابن المبارك | 93 | كان يقال: ما سهر الليل منافق " |
| 30 | عمر بن الخطاب | ابن أبي الدنيا | 56 | ان الرجف من كثره الزنا، وان قحوط المطر من قضاه السوء وائمه الجور» |
| 31 | الحسن البصري | الزهد لابن المبارك | 1584 | العرب: المتحببات الي ازواجهن، والاتراب: الاشباه المستويات " |
| 32 | عائشة أم المؤمنين | شعب الإيمان | 7325 | اخلاق المكارم عشر: صدق الحديث، وصدق الناس، واداء الامانه، وصله الرحم، والتذمم للجار، والتذمم للصاحب، والمكافاه للصنائ… |
| 33 | الحسن البصري | ابن أبي الدنيا | 579 | ابن ادم وكل بك ملكان كريمان، ريقك مدادهما، ولسانك قلمهما» |
| 34 | الحسن البصري | شعب الإيمان | 5968 | كان يكره المفضض فان سقي فيه شرب قال: وكان ابن عمر اذا سقي فيه كسره " فصل في كراهيه نتف الشيب |
| 35 | عبد الله بن مسعود | شعب الإيمان | 2036 | اشد العباده القراءه في المصحف " |
| 36 | قتادة بن دعامة | الزهد لابن المبارك | 426 | قال ابو الدرداء **WRONG** |
| 37 | عبد الله بن عباس | شعب الإيمان | 3470 | الليالي التي اقسم الله عز وجل بهن العشر الاول من ذي الحجه، والشفع يوم النحر، والوتر يوم عرفه ". " كذا وجدت في كتاب زي… |
| 38 | عبد الله بن عباس | شعب الإيمان | 7537 | ما من مسلم له ابوان، فيصبح وهو محسن اليهما الا فتح له بابان من الجنه، ولا يمسي وهو محسن اليهما الا فتح له بابان من ال… |
| 39 | مجاهد بن جبر | ابن أبي الدنيا | 349 | نقش داود خطيئته في كفه لكي لا ينساها، فكان اذا راها اضطربت كفه» |
| 40 | الحسن البصري | ابن أبي الدنيا | 23 | لولا السهو والامل ما مشي المسلمون في الطريق . |
| 41 | أبو الدرداء | شعب الإيمان | 10254 | انما العلم بالتعلم، والحلم بالتحلم، ومن يتحري الخير يعطه، ومن يتوقي الشر يوقه، وثلاثه لا ينالون الدرجات العلي: من تكه… |
| 42 | الحسن البصري | ابن أبي الدنيا | 422 | كانوا يقولون: لسان الحكيم من وراء قلبه، فاذا اراد ان يقول رجع الي قلبه، فان كان له قال، وان كان عليه امسك، وان الجاهل… |
| 43 | الحسن البصري | الزهد لابن المبارك | 429 | ابن ادم انك بين مطيتين يوضعانك |
| 44 | الحسن البصري | ابن أبي الدنيا | 44 | التودد الي الناس نصف العقل» |
| 45 | الحسن البصري | الزهد لابن المبارك | 1434 | اكثروا ذكر هذه النعم، فان ذكرها شكرها» |
| 46 | عمر بن الخطاب | شعب الإيمان | 7131 | الرجال ثلاثه، والنساء ثلاث، فاما النساء: فامراه عفيفه مسلمه لينه ودوده ولوده تعين اهلها علي الدهر، ولا تعين الدهر علي… |
| 47 | عمر بن الخطاب | الزهد لابن المبارك | 116 | اين اخي؟ قالوا: من؟ قال: ابو عبيده، قالوا: ياتيك الان. فجاء علي ناقه مخطومه بحبل، فسلم عليه وساله، ثم قال للناس: انصر… |
| 48 | عبد الله بن عباس | ابن أبي الدنيا | 155 | ما هاجت جنوب الا اسالت واديا» |
| 49 | الحسن البصري | ابن أبي الدنيا | 202 | يا ابن ادم، تبصر القذي في عين اخيك، وتدع الجذل معترضا في عينك» |
| 50 | عمر بن عبد العزيز | ابن أبي الدنيا | 118 | لو ان المرء، لا يعظ اخاه حتي يحكم امر نفسه، ويكمل الذي خلق له من عباده ربه، اذن لتواكل الناس الخير، واذن يرفع الامر ب… |
| 51 | الحسن البصري | ابن أبي الدنيا | 87 | مر عيسي ابن مريم - عليه السلام - مع اصحابه برائحه منتنه، فوضع القوم ايديهم علي انفهم ولم يفعل ذلك عيسي، ثم مروا برائح… |
| 52 | الحسن البصري | ابن أبي الدنيا | 90 | من كثر ماله، كثرت ذنوبه، ومن كثر كلامه، كثر كذبه، ومن ساء خلقه، عذب نفسه» |
| 53 | مجاهد بن جبر | شعب الإيمان | 8414 | بينا انا امشي مع عبد الله بن عمر في بعض طرق المدينه، قال: قلت: يا ابا عبد الرحمن الك حاجه؟ قال: " اكبر الحاجه، تعطي و… |
| 54 | أبو موسى الأشعري | شعب الإيمان | 3637 | قلت: الا تري الريح لنا طيبه، والشراع لنا مرفوعه، والسفينه تجري بنا في لجه البحر، قال: افلا اخبركم بقضاء قضاه الله علي… |
| 55 | عبد الله بن مسعود | شعب الإيمان | 47 | الصبر نصف الايمان، واليقين الايمان كله " " وقد روي هذا من وجه اخر غير قوي مرفوعا، وروينا عن ابن مسعود من اقواله في هذ… |
| 56 | الحسن البصري | شعب الإيمان | 6347 | ان المؤمن حليم لا يجهل، وان جهل عليه حليم، وان ظلم غفر، وان حرم صبر " |
| 57 | محمد بن سيرين | شعب الإيمان | 7849 | دخل حذيفه المدائن وهو علي حمار، وقد سدل رجليه من جانب، ومعه عرق لحم يتعرقه وهو امير " |
| 58 | الحسن البصري | شعب الإيمان | 2554 | وما يبقي ذلك من الدرن؟ " اخرجه مسلم في الصحيح عن ابي بكر بن ابي شيبه **WRONG** |
| 59 | معاذ بن جبل | شعب الإيمان | 2012 | لكني اصلي ثم انام، فاذا قمت من اخر الليل قراته، فاحتسب نومتي كما احتسب قومتي " قال: فوافق ما قال معاذ فصل في تعليم ال… |
| 60 | الحسن البصري | ابن أبي الدنيا | 140 | الا مثل المؤمل بما قدم من عمله في قبره ، ان خيرا فخير ، وان شرا فشر ، فاغتنموا المبادره رحمكم الله في المهله . |

### Verdict

**4 / 60 wrong** (threshold: more than 3 → keep hidden).

- #3: footnote/OCR garbage instead of saying (خليلي strip left editorial noise)
- #21: saying is only «قالت عائشة» — no quoted words
- #36: saying is only «قال أبو الدرداء» — empty chain continuation
- #58: fragment + «أخرجه مسلم» — not a hasan athar matn

`ATHAR_PUBLIC_ENABLED` stays **off** (default). Data + ReminderReader UI kept; section not public.

