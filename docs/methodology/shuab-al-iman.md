# أحاديث شعب الإيمان: الوضع الحالي والخيارات

> **لقطة البيانات:** 2026-10-22 15:10 (UTC) · **للقراءة فقط:** لم يُعدَّل أي كود أو بيانات أو قاعدة بيانات.
> **إعادة إنتاج الأرقام:** `psql "postgresql://thekra:thekra_dev_password@localhost:5432/thekra" -v ON_ERROR_STOP=1 -P pager=off -f docs/methodology/queries.sql` (الاستعلامات `Q07` و`Q08` و`Q09` و`Q17` و`Q26` و`Q25` في هذه الوثيقة). التفاصيل المشتركة مع الوثيقة الأولى في `docs/methodology/hadith-methodology.md`.
> **القاعدة المعتمدة للعرض:** نص يظهر على صفحة الشعبة = `ImanBranchQuote` مقبول، وتمرّ الصفوف من `readerClause` ومن قائمة الدرجات `SAHIH/HASAN` أو قرار `KEEP` للأثر (`Q07`).

## 1. الخلاصة

- الكتاب موجود في القاعدة كمصدر كامل: «الجامع لشعب الإيمان (ط الرشد)»، المؤلف البيهقي، `book:shuab-iman`، بـ**10,841** نصًا: 8,724 حديثًا و2,001 أثرًا و116 نص مؤلف.
- **10,639** حديثًا وأثرًا مربوطة بشعبتها، وكلها من بنية الكتاب نفسه. **لا يوجد ربط موضوعي** لأي نص من الكتاب (`Q09b`).
- المنشور قليل: **523** حديثًا و**196** أثرًا على صفحات الشعب، والسبب أن 8,194 حديثًا بلا درجة مقبولة (`UNGRADED`).
- **13** شعبة بلا أي حديث منشور، و**12** شعبة بلا أي نص منشور (حديث أو أثر أو آية).
- مجموع روابط الأحاديث المنشورة على صفحات الشعب **875** رابطًا: 523 من البيهقي، و187 من البخاري، و165 من مسلم (`Q26`). النص الواحد قد يظهر في أكثر من شعبة.
- القرار المطلوب من المالك والشيخ: طريقة حكم الدرجة للنصوص المنشورة، واختيار الموضوعات أو الأبواب التي تُكمل الشعب الفارغة (القسم 7).

## 2. الشعب الـ77: ما هي وأين عناوينها

| الحقل في `ImanBranch` | ما فيه | المصدر |
|---|---|---|
| `number` | رقم الشعبة 1–77، فريد | `backend/prisma/imports/shuab/import.ts` و`parse.ts`. `schema.prisma` يذكر أن الترقيم «يتبع طبعة يؤكدها المالك» |
| `titleAr` | عنوان الشعبة كما في الكتاب (مثل «الإيمان بالله عز وجل») | عناوين الأبواب في طبعة الرشد عبر `parseShuab` |
| `sourceReference` | «ج{الجزء} ص{الصفحة} — {الترقيم} من شعب الإيمان، وهو باب في …» | `branchSourceReference()` في `shuab/import.ts` (وهو مكتوب من الكتاب) |
| `sourceId` | المصدر «الجامع لشعب الإيمان (ط الرشد)» لكل الشعب الـ77 (`Q26` و`Q09`) | `shuab/import.ts` |
| `title` | ترجمة إنجليزية لكل شعبة | `backend/prisma/imports/shuab/branch-titles-en.ts`. الملف يصفها بأنها عناوين إنجليزية منشورة لا ترجمة آلية، ولا يذكر مرجعًا محددًا |
| `summaryAr` / `summary` | فارغة في الشعب كلها (0) | — |

ملاحظة على المصدر: كل الشعب الـ77 لها `titleAr` و`title` و`sourceId`، ولا شعبة بلا عنوان.

## 3. جدول الشعب

«مربوط» = كل `ImanBranchQuote` مقبول. «من بنية الكتاب» = `basis = MANUAL` (ربط الشعبة نفسها). «من الصحيحين» = `TAKHRIJ` و`REVIEWER_SECTION`. «منشورة» = تُعرض على صفحة الشعبة كما هي. «ImanBranchSin / GoodDeed» = عدد الموضوعات المزدوجة المرتبطة بالشعبة. «وصول عبر الموضوعات» = أحاديث منشورة لكل موضوع مزدوج تصل إلى الشعبة بلا ربط مباشر (`Q17c`، وهي عدّ لكل شعبة لا عدّ لنص واحد).

| # | الشعبة | مربوط | من بنية الكتاب | من الصحيحين | آيات منشورة | أحاديث منشورة | آثار منشورة | ImanBranchSin | ImanBranchGoodDeed | وصول عبر الموضوعات (أحاديث) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | الإيمان بالله عز وجل | 38 | 35 | 3 | 0 | 6 | 1 | 0 | 1 | 45 |
| 2 | الإيمان برسل الله صلوات الله عليهم عامة | 16 | 16 | 0 | 0 | 1 | 0 | 0 | 1 | 3 |
| 3 | **الإيمان بالملائكة** | 27 | 27 | 0 | 0 | 0 | 0 | 0 | 1 | 3 |
| 4 | **الإيمان بالقرآن المنزل على نبينا محمد صلى الله عليه وسلم وسائر الكتب المنزلة على الأنبياء صلوات الله عليهم أجمعين** | 11 | 11 | 0 | 0 | 0 | 0 | 0 | 1 | 3 |
| 5 | القدر خيره وشره من الله عز وجل | 75 | 74 | 1 | 0 | 2 | 4 | 1 | 0 | 0 |
| 6 | **الإيمان باليوم الآخر** | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 1 | 166 |
| 7 | **الإيمان بالبعث والنشور بعد الموت** | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 166 |
| 8 | حشر الناس بعد ما يبعثون من قبورهم إلى الموقف الذي بين لهم من الأرض | 112 | 105 | 7 | 0 | 15 | 0 | 0 | 1 | 166 |
| 9 | **أن دار المؤمنين، ومآبهم الجنة ودار الكافرين ومآبهم النار** | 39 | 39 | 0 | 0 | 0 | 0 | 0 | 1 | 166 |
| 10 | محبة الله عز وجل | 321 | 316 | 5 | 0 | 16 | 5 | 0 | 1 | 27 |
| 11 | الخوف من الله تعالى | 250 | 250 | 0 | 0 | 3 | 8 | 0 | 1 | 99 |
| 12 | الرجاء من الله تعالى وفيه فصول | 156 | 153 | 3 | 0 | 9 | 3 | 0 | 1 | 99 |
| 13 | التوكل بالله عز وجل والتسليم لأمره تعالى في كل شيء | 191 | 189 | 2 | 0 | 5 | 4 | 0 | 1 | 27 |
| 14 | حب النبي صلى الله عليه وسلم | 123 | 114 | 9 | 0 | 17 | 0 | 0 | 1 | 27 |
| 15 | تعظيم النبي صلى الله عليه وسلم وإجلاله وتوقيره صلى الله عليه وسلم | 81 | 79 | 2 | 0 | 9 | 0 | 0 | 1 | 27 |
| 16 | **شح المرء بدينه** | 33 | 33 | 0 | 0 | 0 | 0 | 0 | 1 | 26 |
| 17 | طلب العلم | 67 | 66 | 1 | 0 | 4 | 3 | 0 | 1 | 20 |
| 18 | نشر العلم وألا يمنعه أهله أهله | 176 | 176 | 0 | 0 | 1 | 6 | 0 | 1 | 23 |
| 19 | تعظيم القرآن | 689 | 665 | 24 | 0 | 68 | 12 | 0 | 1 | 117 |
| 20 | الطهارات | 86 | 81 | 5 | 0 | 13 | 0 | 0 | 1 | 46 |
| 21 | الصلاة | 520 | 486 | 34 | 0 | 79 | 7 | 0 | 1 | 48 |
| 22 | الزكاة التي جعلها الله تعالى جده قرينة للصلاة | 286 | 268 | 18 | 0 | 45 | 1 | 0 | 1 | 24 |
| 23 | الصيام | 400 | 385 | 15 | 0 | 36 | 8 | 0 | 1 | 94 |
| 24 | **الاعتكاف** | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 1 | 94 |
| 25 | المناسك | 228 | 220 | 8 | 0 | 20 | 0 | 0 | 1 | 28 |
| 26 | الجهاد | 79 | 73 | 6 | 0 | 12 | 0 | 0 | 1 | 88 |
| 27 | المرابطة في سبيل الله عز وجل | 27 | 20 | 7 | 0 | 14 | 0 | 0 | 1 | 88 |
| 28 | الثبات للعدو وترك الفرار من الزحف | 21 | 19 | 2 | 0 | 4 | 0 | 0 | 1 | 88 |
| 29 | أداء خمس المغنم إلى الإمام أو عامله على الغانمين | 9 | 8 | 1 | 0 | 2 | 0 | 0 | 1 | 88 |
| 30 | العتق ووجه التقرب إلى الله عز وجل | 17 | 13 | 4 | 0 | 7 | 0 | 0 | 1 | 2 |
| 31 | **الكفارات الواجبات بالجنايات** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| 32 | الإيفاء بالعقود | 17 | 17 | 0 | 0 | 2 | 0 | 0 | 1 | 27 |
| 33 | تعديد نعم الله عز وجل، وما يجب من شكرها | 393 | 390 | 3 | 0 | 10 | 12 | 0 | 1 | 17 |
| 34 | حفظ اللسان | 435 | 425 | 10 | 0 | 32 | 9 | 1 | 1 | 49 |
| 35 | **الأمانات وما يجب من أدائها إلى أهلها** | 60 | 60 | 0 | 0 | 0 | 0 | 0 | 1 | 27 |
| 36 | تحريم النفوس والجنايات عليها | 47 | 45 | 2 | 0 | 5 | 0 | 1 | 0 | 45 |
| 37 | تحريم الفروج، وما يجب من التعفف عنها | 132 | 124 | 8 | 0 | 17 | 0 | 1 | 2 | 32 |
| 38 | قبض اليد عن الأموال المحرمة، ويدخل فيه تحريم السرقة، وقطع الطريق | 79 | 76 | 3 | 0 | 9 | 0 | 1 | 0 | 23 |
| 39 | المطاعم والمشارب وما يجب التورع عنه منها | 518 | 500 | 18 | 0 | 47 | 2 | 1 | 0 | 10 |
| 40 | الملابس والزي والأواني وما يكره منها | 403 | 391 | 12 | 0 | 39 | 1 | 1 | 0 | 49 |
| 41 | **تحريم الملاعب والملاهي** | 50 | 50 | 0 | 0 | 0 | 0 | 1 | 0 | 1 |
| 42 | الاقتصاد في النفقة وتحريم أكل المال الباطل | 54 | 54 | 0 | 0 | 1 | 3 | 1 | 1 | 30 |
| 43 | الحث على ترك الغل والحسد | 54 | 52 | 2 | 0 | 4 | 2 | 1 | 1 | 7 |
| 44 | تحريم أعراض الناس وما يلزم من ترك الوقوع فيها | 161 | 156 | 5 | 0 | 12 | 6 | 1 | 0 | 23 |
| 45 | إخلاص العمل لله عز وجل وترك الرياء | 210 | 206 | 4 | 0 | 6 | 5 | 1 | 1 | 56 |
| 46 | **السرور بالحسنة والاغتمام بالسيئة** | 29 | 29 | 0 | 0 | 0 | 0 | 0 | 1 | 58 |
| 47 | معالجة كل ذنب بالتوبة | 323 | 316 | 7 | 0 | 23 | 12 | 0 | 1 | 58 |
| 48 | القرابين والأمانة عن معناها وعرضها وجملته الهدي، والأضحية، والعقيقة | 26 | 26 | 0 | 0 | 2 | 0 | 0 | 1 | 28 |
| 49 | طاعة أولي الأمر بفصولها | 132 | 126 | 6 | 0 | 12 | 0 | 0 | 1 | 47 |
| 50 | التمسك بما عليه الجماعة | 33 | 32 | 1 | 0 | 4 | 1 | 0 | 1 | 44 |
| 51 | الحكم بين الناس | 18 | 16 | 2 | 0 | 3 | 0 | 0 | 1 | 27 |
| 52 | الأمر بالمعروف والنهي عن المنكر | 63 | 63 | 0 | 0 | 1 | 1 | 0 | 1 | 35 |
| 53 | التعاون على البر والتقوى | 105 | 101 | 4 | 0 | 9 | 1 | 0 | 1 | 15 |
| 54 | الحياء بفصوله | 142 | 137 | 5 | 0 | 11 | 2 | 0 | 1 | 16 |
| 55 | بر الوالدين | 123 | 118 | 5 | 0 | 13 | 1 | 0 | 1 | 40 |
| 56 | صلة الأرحام | 52 | 50 | 2 | 0 | 5 | 0 | 0 | 1 | 47 |
| 57 | حسن الخلق ودخل في هذا كظم الغيظ، ولين الجانب، والتواضع | 598 | 585 | 13 | 0 | 37 | 16 | 0 | 1 | 73 |
| 58 | الإحسان إلى المماليك | 46 | 38 | 8 | 0 | 11 | 0 | 0 | 0 | 0 |
| 59 | حق السادة على المماليك | 29 | 21 | 8 | 0 | 9 | 0 | 0 | 0 | 0 |
| 60 | حقوق الأولاد والأهلين | 122 | 119 | 3 | 0 | 9 | 3 | 0 | 2 | 70 |
| 61 | مقاربة أهل الدين وموادتهم، وإفشاء السلام بينهم | 293 | 291 | 2 | 0 | 8 | 12 | 0 | 2 | 109 |
| 62 | رد السلام | 71 | 70 | 1 | 0 | 4 | 1 | 0 | 1 | 65 |
| 63 | عيادة المريض | 72 | 70 | 2 | 0 | 10 | 3 | 0 | 1 | 67 |
| 64 | الصلاة على من مات من أهل القبلة | 74 | 73 | 1 | 0 | 4 | 0 | 0 | 1 | 67 |
| 65 | تشميت العاطس | 52 | 47 | 5 | 0 | 9 | 0 | 0 | 1 | 65 |
| 66 | مباعدة الكفار والمفسدين والغلظة عليهم | 155 | 154 | 1 | 0 | 4 | 5 | 0 | 0 | 0 |
| 67 | إكرام الجار | 68 | 57 | 11 | 0 | 16 | 1 | 0 | 1 | 19 |
| 68 | **إكرام الضيف** | 67 | 67 | 0 | 0 | 0 | 1 | 0 | 1 | 22 |
| 69 | الستر على أصحاب القروف | 32 | 29 | 3 | 0 | 5 | 0 | 0 | 1 | 9 |
| 70 | الصبر على المصائب، وعما تنزع إليه النفس من لذة وشهوة | 534 | 522 | 12 | 0 | 31 | 8 | 0 | 1 | 109 |
| 71 | الزهد وقصر الأمل | 566 | 552 | 14 | 0 | 33 | 16 | 0 | 1 | 117 |
| 72 | **الغيرة والمذاء** | 7 | 7 | 0 | 0 | 0 | 0 | 1 | 1 | 11 |
| 73 | الإعراض عن اللغو | 18 | 18 | 0 | 0 | 1 | 3 | 1 | 1 | 49 |
| 74 | الجود والسخاء | 140 | 138 | 2 | 0 | 4 | 4 | 0 | 1 | 156 |
| 75 | رحم الصغير وتوقير الكبير | 106 | 103 | 3 | 0 | 12 | 0 | 0 | 3 | 100 |
| 76 | الإصلاح بين الناس إذا مرجوا وفسدت ذات بينهم | 37 | 37 | 0 | 0 | 1 | 0 | 0 | 1 | 12 |
| 77 | أن يحب الرجل لأخيه المسلم ما يحب لنفسه ويكره له ما يكره لنفسه ويدخل فيه إماطة الأذى عن الطريق | 154 | 147 | 7 | 0 | 12 | 3 | 0 | 1 | 2 |

**ملخص الجدول** (`Q07b` و`Q17`):
- الشعب بلا حديث منشور: **13** من 77 (الأرقام 3 و4 و6 و7 و9 و16 و24 و31 و35 و41 و46 و68 و72).
- الشعب بلا أي نص منشور: **12**، وهي الـ13 بلا حديث ما عدا الشعبة 68 (لها أثر منشور واحد).
- الشعب الـ74 لها موضوع مزدوج، و3 بلا زوج (58 و59 و66). الشعبة 31 لها موضوع مزدوج، لكن لا نص مربوط بها أصلًا.
- مجموع الموضوعات المزدوجة المرتبطة: 14 `ImanBranchSin` و72 `ImanBranchGoodDeed` (`Q07`).
- عدد النصوص المنشورة الفريدة الواصلة عبر الموضوعات المزدوجة: **2,974** نصًا (حديث أو أثر أو آية)، وفي الجدول مجموع كل شعبة على حدة، وهو أكبر لأن النص الواحد يظهر في عدة شعب (`Q17d` و`Q17`).

## 4. كيف رُبطت الشعب حتى الآن

- **من بنية الكتاب (10,639 رابطًا).** الاستيراد يضع كل حديث تحت الشعبة التي وضعه البيهقي تحتها، وفق قاعدة المالك «بنية الكتاب هي التصنيف» (`shuab/import.ts`، الترويسة). الرابط `MANUAL/BOOK`.
- **من الصحيحين مباشرة (20 رابطًا، `REVIEWER_SECTION`).** مصدرها `sahihayn-hadith-map.tsv` (الصفوف الـ20 التي تحمل هدفًا من نوع `branch:`، كلها عالية الثقة). توزيعها كما في القاعدة (`Q08`): الشعبة 30: 2 بخاري. الشعبة 40: 1 بخاري. الشعبة 54: 1 بخاري. الشعبة 58: 2 بخاري و4 مسلم. الشعبة 59: 3 بخاري و4 مسلم. الشعبة 65: 3 بخاري. المجموع 12 بخاري + 8 مسلم = 20، وهو ما تذكره `sahihayn-hadith-map-notes.md` و`apply-report.md`.
- **نقل بالمطابقة (`TAKHRIJ`، 332 رابطًا).** أحاديث الشعب التي تطابق البخاري أو مسلم تُربط بالنص نفسه في الصحيح (175 بخاري و157 مسلم، `Q05`). الكود: `backend/prisma/imports/shuab/rematch.ts`.
- **موضوعات مزدوجة (14 + 72).** `ImanBranchSin` و`ImanBranchGoodDeed` في الكتابة الحالية؛ الزوج يُعرّف في `taxonomy.yaml` بالحقل `branches:` لكل موضوع.

## 5. هل توجد كتب أخرى للشعب في القاعدة؟

- الكتاب موجود: `Source` بالاسم «الجامع لشعب الإيمان (ط الرشد)»، `apiProvider = book:shuab-iman`، `isExternalApi = false` (`Q09`).
- لا يوجد في الـ88 مصدرًا الأصليين عنوان آخر يخص شعب الإيمان. أقرب ما فيها عامّ: الترغيب والترهيب، ورياض الصالحين، والأذكار.
- توزيع الدرجات لنصوص الكتاب (`Q09`، المجموع 10,841):

| الدرجة (`gradeSource`، `grade`) | نصوص | ملاحظة |
|---|---:|---|
| `AUTHORITY_LEGACY` / `UNGRADED` (حديث) | 8,194 | غير منشورة |
| `AUTHORITY_LEGACY` / `UNGRADED` (أثر) | 2,001 | لا تُنشر إلا بقرار `KEEP` |
| `AUTO_SAHIHAYN` / `SAHIH` | 272 | من الصحيحين |
| `SUNAN_TAHQIQ` / `SAHIH` | 63 | تحقيق الأرنؤوط |
| `SUNAN_TAHQIQ` / `HASAN` | 71 | تحقيق الأرنؤوط |
| `HADEETHENC` / `SAHIH` | 97 | الموسوعة |
| `HADEETHENC` / `HASAN` | 27 | الموسوعة |
| بلا درجة (نص مؤلف `BOOK_EXCERPT`) | 116 | ليس حديثًا |

## 6. مشكلات في بنية الشعب

- **الشعبة 31** («الكفارات الواجبات بالجنايات»): قسمها في النسخة فارغ، فلا نص له أي ربط (`Q09` وفحص `BookSection`).
- **الشعبة 41** («تحريم الملاعب والملاهي»): قسمها بمستوى `BRANCH` فارغ، والأحاديث الـ50 مربوطة بقسم آخر بمستوى `OTHER` وعنوانه «تحريم الملاعب والملاهي،» (بفاصلة). الربط صحيح لكن بنية الكتاب ليست منتظمة.
- **الترقيم:** `schema.prisma` يذكر أن الترقيم «يتبع طبعة يؤكدها المالك». قبل أي استعمال علني لأرقام الشعب يحتاج الترقيم تأكيد المالك.
- **الترجمة الإنجليزية** (`branch-titles-en.ts`): تصف نفسها بأنها عناوين منشورة، ولا تذكر مرجعًا محددًا. لا يُعتمد عليها في أي حكم.

## 7. الخيارات

| الخيار | ما يفعله | المزايا | العيوب | ما يحتاجه | القرار |
|---|---|---|---|---|---|
| **(1) الربط عبر الموضوعات المزدوجة فقط** | تعرض الشعبة نصوص موضوعيها المزدوجين (`Q17c`) | لا استيراد جديد؛ يعتمد على روابط مراجَعة؛ يغطي 74 شعبة فورًا | النص يظهر تحت عدة شعب (2,974 نصًا منشورًا فريدًا، من أي نوع)؛ الموضوع ليس الشعبة؛ لا يُصلح الشعب الـ13 الفارغة إلا جزئيًا | مهندس لعرض مشتق؛ مراجعة الأزواج في `taxonomy.yaml` (`branches:`) | **يحتاج قرار الشيخ** في الأزواج والمجال |
| **(2) قائمة منتقاة من أبواب الصحيحين** | تربط كل شعبة بأبواب مختارة من البخاري ومسلم عبر خريطة الأبواب | نصوص الصحيحين تُنشر مباشرة بدرجة `SAHIHAYN`؛ تملأ الشعب الفارغة | يدوي وبطيء؛ أبواب الصحيحين مرتبة بالموضوع لا بالشعبة؛ لا يشمل البيهقي | مراجعة الشيخ لكل باب؛ إضافة `branch` إلى الخريطة وإلى الاستيراد | **يحتاج قرار الشيخ** لكل باب |
| **(3) استيراد البيهقي أو مختصر له بدرجات مقبولة** | تمنح الأحاديث درجات من مصدر مقبول | النص موجود أصلًا (10,841)، فلا حاجة لاستيراد جديد | **مشكلة الدرجة**: البيهقي لا يحكم على أسانيده، والمستودع لا يتضمن مصدرًا مقبولًا يغطي الكتاب كله. أحكام الألباني تُخزَّن ولا تُنشر (874 صفًا). تحقيق الأرنؤوط يغطي 134 نصًا من الكتاب اليوم. لم أجد مختصرًا بحكم مقبول في المستودع أو القاعدة، ولم أبحث خارجه | مصدر درجات مقبول يحدده المالك؛ أو مراجعة كل نص | **يحتاج قرار المالك** في مصدر الدرجة |
| **(4) طابور مراجعة للشيخ** | يراجع الشيخ أو المراجع الأحاديث لكل شعبة ويُقرّ ما يُنشر | الأدق؛ يحسم حالة كل نص؛ يستعمل دور `REVIEWER` الموجود | بطيء؛ الحجم 8,194 حديثًا و2,001 أثرًا؛ يحتاج واجهة لم تُبنَ بعد | واجهة مراجعة (مهندس)؛ جدول حصص للشيخ | **يحتاج قرار الشيخ** في كل نص أو قرار المالك في النطاق |

**الترتيب المقترح:**

1. **الشعب الـ13 الفارغة أولًا (الشيخ).** اختيار أبواب من الصحيحين أو موضوع مزدوج لكل شعبة من الـ13 (الخيار 2). تبدأ بالشعبة 31 والشعبة 41 لأنهما فيهما بنية تحتاج تأكيدًا (القسم 6).
2. **عرض الموضوعات المزدوجة (الخيار 1).** تنفيذ عرض مشتق، مع مراجعة الشيخ للأزواج قبل النشر. يغطي 74 شعبة.
3. **طابور المراجعة (الخيار 4)** لأحاديث الشعب الأكثر إنتاجًا بعد الخطوتين السابقتين. أكبر عشر شعب من حيث النصوص غير المنشورة (من `Q07`): الشعبة 19 (609)، الشعبة 57 (545)، الشعبة 71 (517)، الشعبة 70 (495)، الشعبة 39 (469)، الشعبة 21 (434)، الشعبة 34 (394)، الشعبة 33 (371)، الشعبة 40 (363)، الشعبة 23 (356).
4. **الخيار 3 فقط بقرار المالك** في مصدر درجات مقبول. بدونه لا تُنشر نصوص البيهقي الجديدة.

**القرارات التي ليست للهندسة:** أزواج الموضوعات والأبواب المنتقاة والدرجات، وترقيم الشعب (القسم 6). كل ما عداها عمل هندسي.

## الملحق أ: الاستعلامات

منسوخة من `docs/methodology/queries.sql` عند كتابة الوثيقة.

<details>
<summary>`Q07`  Branches: linked texts, public texts (shown), topic links through ImanBranchSin / ImanBranchGoodDeed</summary>

```sql
-- ---------------------------------------------------------------------------
-- Q07  Branches: linked texts, public texts (shown), topic links through ImanBranchSin / ImanBranchGoodDeed
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
pub AS (
  SELECT q.id, q.type, q."isAthar", q.grade,
         CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar'
              WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
         ((q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
           AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
           AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
           AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
           AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
                OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
         ) AS shown
  FROM "Quote" q
)
SELECT ib.number, ib."titleAr" AS branch,
       count(l."quoteId") AS linked,
       count(l."quoteId") FILTER (WHERE l.basis = 'MANUAL') AS shuab_book_structure,
       count(l."quoteId") FILTER (WHERE l.basis IN ('TAKHRIJ','REVIEWER_SECTION')) AS from_sahihayn,
       count(l."quoteId") FILTER (WHERE p.kind = 'verse' AND p.shown) AS public_verse,
       count(l."quoteId") FILTER (WHERE p.kind = 'hadith' AND p.shown) AS public_hadith,
       count(l."quoteId") FILTER (WHERE p.kind = 'athar' AND p.shown) AS public_athar,
       (SELECT count(*) FROM "ImanBranchSin" x WHERE x."imanBranchId" = ib.id) AS sins,
       (SELECT count(*) FROM "ImanBranchGoodDeed" y WHERE y."imanBranchId" = ib.id) AS deeds
FROM "ImanBranch" ib
LEFT JOIN "ImanBranchQuote" l ON l."imanBranchId" = ib.id AND l."reviewStatus" = 'ACCEPTED'
LEFT JOIN pub p ON p.id = l."quoteId"
GROUP BY ib.id, ib.number, ib."titleAr"
ORDER BY ib.number;
```

</details>

<details>
<summary>`Q07b`  Branch totals</summary>

```sql
-- Q07b  Branch totals
SELECT count(*) FILTER (WHERE public_hadith = 0) AS branches_with_0_public_hadith,
       count(*) FILTER (WHERE public_hadith + public_athar + public_verse = 0) AS branches_with_0_public_texts,
       sum(public_hadith) AS sum_public_hadith_links,
       sum(linked) AS sum_linked
FROM (
  SELECT ib.number,
         count(l."quoteId") FILTER (WHERE l."reviewStatus" = 'ACCEPTED') AS linked,
         count(l."quoteId") FILTER (WHERE p.kind = 'verse' AND p.shown) AS public_verse,
         count(l."quoteId") FILTER (WHERE p.kind = 'hadith' AND p.shown) AS public_hadith,
         count(l."quoteId") FILTER (WHERE p.kind = 'athar' AND p.shown) AS public_athar
  FROM "ImanBranch" ib
  LEFT JOIN "ImanBranchQuote" l ON l."imanBranchId" = ib.id
  LEFT JOIN (
    SELECT q.id, CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar'
                      WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
           ((q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
             AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
             AND NOT EXISTS (SELECT 1 FROM "QuoteFlag" f WHERE f."quoteId" = q.id AND f.status = 'OPEN' AND f.severity = 'HIGH')
             AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
             AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
           ) AS shown
    FROM "Quote" q
  ) p ON p.id = l."quoteId"
  GROUP BY ib.number
) per_branch;
```

</details>

<details>
<summary>`Q08`  Direct branch links from Sahihayn (`REVIEWER_SECTION`): the 20 rows documented in sahihayn-hadith-map-notes.md</summary>

```sql
-- ---------------------------------------------------------------------------
-- Q08  Direct branch links from Sahihayn (REVIEWER_SECTION): the 20 rows documented in sahihayn-hadith-map-notes.md
-- ---------------------------------------------------------------------------
SELECT s."nameAr" AS source, ib.number AS branch, l.basis, l."classifiedBy", count(*) AS links
FROM "ImanBranchQuote" l
JOIN "ImanBranch" ib ON ib.id = l."imanBranchId"
JOIN "Quote" q ON q.id = l."quoteId"
JOIN "Source" s ON s.id = q."sourceId"
WHERE l.basis = 'REVIEWER_SECTION' AND l."reviewStatus" = 'ACCEPTED'
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2;
```

</details>

<details>
<summary>`Q09`  Shu'ab al-Iman source: presence and grade mix (every narration)</summary>

```sql
-- ---------------------------------------------------------------------------
-- Q09  Shu'ab al-Iman source: presence and grade mix (every narration)
-- ---------------------------------------------------------------------------
SELECT s."nameAr", s.author, s."apiProvider", q."gradeSource", q.grade, q."isAthar", q."textSource",
       count(*) AS rows
FROM "Quote" q
JOIN "Source" s ON s.id = q."sourceId"
WHERE s."apiProvider" = 'book:shuab-iman'
GROUP BY 1, 2, 3, 4, 5, 6, 7
ORDER BY 8 DESC;
```

</details>

<details>
<summary>`Q09b`  Shu'ab: publish state and branch structure</summary>

```sql
-- Q09b  Shu'ab: publish state and branch structure
SELECT count(*) AS narrations,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "ImanBranchQuote" l WHERE l."quoteId" = q.id AND l."reviewStatus" = 'ACCEPTED')) AS with_branch_link,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "SinQuote" x WHERE x."quoteId" = q.id AND x."reviewStatus" = 'ACCEPTED')
                         OR EXISTS (SELECT 1 FROM "GoodDeedQuote" y WHERE y."quoteId" = q.id AND y."reviewStatus" = 'ACCEPTED')) AS with_topic_link,
       count(*) FILTER (WHERE q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS grade_source_publishable,
       count(*) FILTER (WHERE q."gradeSource" = 'SUNAN_TAHQIQ') AS sunan_tahqiq,
       count(*) FILTER (WHERE q."gradeSource" = 'HADEETHENC') AS hadeethenc,
       count(*) FILTER (WHERE q."gradeSource" = 'AUTO_SAHIHAYN') AS auto_sahihayn,
       count(*) FILTER (WHERE q."isAthar") AS athar
FROM "Quote" q
JOIN "Source" s ON s.id = q."sourceId"
WHERE s."apiProvider" = 'book:shuab-iman';
```

</details>

<details>
<summary>`Q17`  Branch reach through paired topics (option 1): public texts of the topics linked to each branch</summary>

```sql
-- ---------------------------------------------------------------------------
-- Q17  Branch reach through paired topics (option 1): public texts of the topics linked to each branch
--      Uses ImanBranchSin / ImanBranchGoodDeed, then the accepted topic links of those topics.
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
shown AS (
  SELECT q.id, q.type, q."isAthar"
  FROM "Quote" q
  WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
    AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
    AND q.id NOT IN (SELECT "quoteId" FROM open_high)
    AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
    AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
),
topic_texts AS (
  SELECT x."sinId" AS topic_id, 'sin' AS tk, x."quoteId" AS qid FROM "SinQuote" x WHERE x."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT y."goodDeedId", 'deed', y."quoteId" FROM "GoodDeedQuote" y WHERE y."reviewStatus" = 'ACCEPTED'
),
branch_topics AS (
  SELECT bs."imanBranchId" AS bid, 'sin' AS tk, bs."sinId" AS tid FROM "ImanBranchSin" bs
  UNION ALL
  SELECT bd."imanBranchId", 'deed', bd."goodDeedId" FROM "ImanBranchGoodDeed" bd
),
reach AS (
  SELECT DISTINCT bt.bid, tt.qid
  FROM branch_topics bt
  JOIN topic_texts tt ON tt.topic_id = bt.tid AND tt.tk = bt.tk
  JOIN shown s ON s.id = tt.qid
)
SELECT count(DISTINCT ib.id) AS branches_with_topic_pairs,
       count(DISTINCT r.bid) AS branches_with_reach,
       count(r.qid) AS reachable_public_texts_all_kinds,
       count(r.qid) FILTER (WHERE s.type = 'HADITH' AND NOT s."isAthar") AS reachable_public_hadith,
       count(r.qid) FILTER (WHERE s."isAthar") AS reachable_public_athar,
       count(r.qid) FILTER (WHERE s.type = 'QURAN_VERSE') AS reachable_public_verses
FROM "ImanBranch" ib
LEFT JOIN reach r ON r.bid = ib.id
LEFT JOIN shown s ON s.id = r.qid
WHERE EXISTS (SELECT 1 FROM branch_topics bt WHERE bt.bid = ib.id);
```

</details>

<details>
<summary>`Q17b`  Branches that have no topic pair at all (cannot be derived through topics)</summary>

```sql
-- Q17b  Branches that have no topic pair at all (cannot be derived through topics)
SELECT count(*) AS branches_without_topic_pair
FROM "ImanBranch" ib
WHERE NOT EXISTS (SELECT 1 FROM "ImanBranchSin" bs WHERE bs."imanBranchId" = ib.id)
  AND NOT EXISTS (SELECT 1 FROM "ImanBranchGoodDeed" bd WHERE bd."imanBranchId" = ib.id);
```

</details>

<details>
<summary>`Q17c`  Per branch: public texts reachable through its paired topics (distinct per branch)</summary>

```sql
-- Q17c  Per branch: public texts reachable through its paired topics (distinct per branch)
--       and the number of paired topics. Same definitions as Q17.
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
shown AS (
  SELECT q.id, q.type, q."isAthar"
  FROM "Quote" q
  WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
    AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
    AND q.id NOT IN (SELECT "quoteId" FROM open_high)
    AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
    AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
         OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
),
topic_texts AS (
  SELECT x."sinId" AS topic_id, 'sin' AS tk, x."quoteId" AS qid FROM "SinQuote" x WHERE x."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT y."goodDeedId", 'deed', y."quoteId" FROM "GoodDeedQuote" y WHERE y."reviewStatus" = 'ACCEPTED'
),
branch_topics AS (
  SELECT bs."imanBranchId" AS bid, 'sin' AS tk, bs."sinId" AS tid FROM "ImanBranchSin" bs
  UNION ALL
  SELECT bd."imanBranchId", 'deed', bd."goodDeedId" FROM "ImanBranchGoodDeed" bd
),
reach AS (
  SELECT DISTINCT bt.bid, tt.qid
  FROM branch_topics bt
  JOIN topic_texts tt ON tt.topic_id = bt.tid AND tt.tk = bt.tk
  JOIN shown s ON s.id = tt.qid
)
SELECT ib.number, ib."titleAr" AS branch,
       (SELECT count(*) FROM branch_topics bt WHERE bt.bid = ib.id) AS paired_topics,
       count(r.qid) FILTER (WHERE s.type = 'HADITH' AND NOT s."isAthar") AS reach_hadith,
       count(r.qid) FILTER (WHERE s."isAthar") AS reach_athar,
       count(r.qid) FILTER (WHERE s.type = 'QURAN_VERSE') AS reach_verse
FROM "ImanBranch" ib
LEFT JOIN reach r ON r.bid = ib.id
LEFT JOIN shown s ON s.id = r.qid
GROUP BY ib.id, ib.number, ib."titleAr"
ORDER BY ib.number;
```

</details>

<details>
<summary>`Q17d`  Distinct texts reachable through topic pairs (a text counted once across all branches)</summary>

```sql
-- Q17d  Distinct texts reachable through topic pairs (a text counted once across all branches)
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
),
topic_texts AS (
  SELECT x."quoteId" AS qid, x."sinId" AS tid, 'sin' AS tk FROM "SinQuote" x WHERE x."reviewStatus" = 'ACCEPTED'
  UNION ALL
  SELECT y."quoteId", y."goodDeedId", 'deed' FROM "GoodDeedQuote" y WHERE y."reviewStatus" = 'ACCEPTED'
),
paired AS (
  SELECT bs."sinId" AS tid, 'sin' AS tk FROM "ImanBranchSin" bs
  UNION
  SELECT bd."goodDeedId", 'deed' FROM "ImanBranchGoodDeed" bd
)
SELECT count(DISTINCT tt.qid) AS distinct_texts_on_paired_topics
FROM topic_texts tt
JOIN paired p ON p.tid = tt.tid AND p.tk = tt.tk
JOIN "Quote" q ON q.id = tt.qid
WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
  AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
  AND q.id NOT IN (SELECT "quoteId" FROM open_high)
  AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
       OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'));
```

</details>

<details>
<summary>`Q25`  Rule checks on grade attribution (expected: 0 in the publishable columns)</summary>

```sql
-- ---------------------------------------------------------------------------
-- Q25  Rule checks on grade attribution (expected: 0 in the publishable columns)
-- ---------------------------------------------------------------------------
SELECT count(*) FILTER (WHERE q."gradeAuthority" LIKE '%الألباني%' OR q."gradeAuthority" ILIKE '%albani%') AS albani_authority_rows,
       count(*) FILTER (WHERE (q."gradeAuthority" LIKE '%الألباني%' OR q."gradeAuthority" ILIKE '%albani%')
                         AND q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS albani_authority_publishable,
       count(*) FILTER (WHERE q."gradeAuthority" LIKE '%بشار%' OR q."gradeAuthority" ILIKE '%bashar%') AS bashar_authority_rows,
       count(*) FILTER (WHERE q."gradeSource" = 'IBN_RAJAB') AS ibn_rajab_grade_source_rows,
       count(*) FILTER (WHERE q."gradeAuthority" LIKE '%ابن رجب%' AND q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')) AS ibn_rajab_authority_publishable,
       count(*) FILTER (WHERE q."gradeSource" = 'SUNAN_TAHQIQ') AS sunan_tahqiq_rows,
       count(*) FILTER (WHERE q."gradeSource" = 'SUNAN_TAHQIQ' AND q."gradeAuthority" NOT LIKE '%الأرنؤوط%' AND q."gradeAuthority" NOT ILIKE '%arna%') AS sunan_rows_not_arnaut
FROM "Quote" q;
```

</details>

<details>
<summary>`Q26`  Public hadith/athar/verse links on branches, by source (what the branch pages show today)</summary>

```sql
-- ---------------------------------------------------------------------------
-- Q26  Public hadith/athar/verse links on branches, by source (what the branch pages show today)
-- ---------------------------------------------------------------------------
WITH open_high AS (
  SELECT DISTINCT "quoteId" FROM "QuoteFlag" WHERE status = 'OPEN' AND severity = 'HIGH'
)
SELECT s."nameAr" AS source,
       CASE WHEN q.type = 'QURAN_VERSE' THEN 'verse' WHEN q."isAthar" THEN 'athar' WHEN q.type = 'HADITH' THEN 'hadith' ELSE 'author' END AS kind,
       count(*) AS branch_links_accepted,
       count(*) FILTER (WHERE (q."textSource" <> 'OCR' OR q."textVerifiedAt" IS NOT NULL)
             AND NOT (q."apiProvider" = 'book-structure' AND q.type = 'BOOK_EXCERPT')
             AND NOT (q.id IN (SELECT "quoteId" FROM open_high))
             AND (q.type <> 'HADITH' OR q."gradeSource" IN ('SAHIHAYN','AUTO_SAHIHAYN','MANUAL','SUNAN_TAHQIQ','HADEETHENC')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
             AND (q.type <> 'HADITH' OR q.grade IN ('SAHIH','HASAN')
                  OR (q."isAthar" AND q."atharSpeakerKey" IS NOT NULL AND q."atharReviewDecision" = 'KEEP'))
       ) AS shown_on_branch_pages
FROM "ImanBranchQuote" l
JOIN "Quote" q ON q.id = l."quoteId"
JOIN "Source" s ON s.id = q."sourceId"
WHERE l."reviewStatus" = 'ACCEPTED'
GROUP BY s."nameAr", 2
ORDER BY 4 DESC, 1, 2;
```

</details>

