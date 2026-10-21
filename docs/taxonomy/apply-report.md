# Taxonomy apply report

The reviewer taxonomy in `backend/prisma/taxonomy/taxonomy.yaml` and `docs/taxonomy/content-map.tsv` was applied as written. Names, slugs, domains, and section decisions were not redesigned.

## Phase 1 — structure

```
 ibn_qayyim_sources = 0
 ibn_qayyim_quotes  = 0
```

Hadith quotes with no section item:

| Book | Hadith outside every section |
| --- | ---: |
| رياض الصالحين | 0 |
| صحيح الترغيب والترهيب | 0 |
| مختصر منهاج القاصدين | 0 |
| الأدب المفرد | 0 |
| صحيح مسلم | 0 |
| الجامع لشعب الإيمان | 0 |
| سلسلة أعمال القلوب | 0 |
| الزهد والرقائق | 17 |
| الكبائر | 67 |
| صحيح البخاري | 1 |

The structure importer's leftover counts, re-measured in this session, are kabair 131, minhaj 86, zuhd 17, shuab 2, bukhari 1, and 0 for the other books. Those leftovers are the ones already explained in `docs/taxonomy/structure-report.md`. Riyad has no hadith outside a section.

Kabira 43 (`الكبيرة الثالثة والأربعون`) begins with an AUTHOR_TEXT definition («وهو من ينقل الحديث بين الناس على جهة الإفساد بينهم…»), then AYAH 68:10, AYAH 68:11, then the hadith «وفي الصحيحين أن رسول الله صلى الله عليه وسلم قال لا يدخل الجنة نمام».

سلسلة أعمال القلوب: 12 sections, and every AUTHOR_TEXT item stores 0 characters. Ayah and hadith items per chapter:

| Order | Chapter | Page | Ayah | Hadith |
| --- | --- | ---: | ---: | ---: |
| 1 | الإخلاص | 7 | 33 | 1 |
| 2 | الخوف | 36 | 68 | 0 |
| 3 | الرجاء | 68 | 34 | 0 |
| 4 | الرضا | 91 | 45 | 1 |
| 5 | الصبر | 122 | 77 | 0 |
| 6 | الشكر | 153 | 61 | 1 |
| 7 | التفكر | 177 | 41 | 1 |
| 8 | التوكل | 200 | 68 | 2 |
| 9 | المحبة | 233 | 28 | 0 |
| 10 | المحاسبة | 257 | 40 | 0 |
| 11 | التقوى | 285 | 76 | 0 |
| 12 | الورع | 315 | 5 | 0 |

## Phase 3 — match totals against section 3.2

This session re-ran `import:taxonomy`. Coverage is computed before the write, so the line is the same match the first apply produced:

```
coverage: targhib 339/512, zuhd 59/85, minhaj 113/140, unmapped 381
items: ghibah 51, kadhib 18, khiyana 5, salah 125, salat-fi-jamaah 168, siyam 108, dhikr 964, dhikr-akhira 215, adha-muslimin 22
links planned: 12828, proposals: 1314, skipped items: 0
```

Section 3.2 expected Targhib 338/512, Zuhd 59/85, Minhaj 113/140, and 384 unmapped sections. The differences are Targhib +1 and unmapped −3, both inside 2%. The three sections the unmapped file still lists, and the YAML now matches, are:

- رياض الصالحين: باب توقير العلماء والكبار وأهل الفضل وتقديمهم على غيرهم ورفع مجالسهم وإظهار مرتبتهم
- رياض الصالحين: باب وجوب طاعة ولاة الأمر في غير معصية وتحريم طاعتهم في المعصية
- صحيح الترغيب والترهيب: الترهيب من قوله لمسلم : یا کافر ! (Persian yeh)

The anchored item counts match section 3.2 exactly.

The first write, from the apply that produced `abd26fd`:

```
taxonomy write: created=12862 updated=703 deleted=12206
taxonomy topics write: created=291 updated=446 deleted=11678
taxonomy links write: created=12571 updated=257 deleted=528
```

The idempotent re-run in this session:

```
taxonomy write: created=0 updated=0 deleted=0
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=0 updated=0 deleted=0
```

Database after that re-run: 89 sins (84 shown, 5 hidden) and 79 good deeds (77 shown, 2 hidden), all `origin = TAXONOMY`. `AUTO_CHAPTER` rows: 0. Domains 12, labels 20, derivations 24. Hidden sins: `tasweer` (kabira 48 merged here), `firar-zahf`, `kabira-35`, `kabira-57`, `kabira-67`. Hidden deeds: `jihad`, `kaffarat`. Kabira 64 has no row. `tark-lillah` is shown and `isListed = false`.

Links now in the database (12,854 = 12,828 planned + 26 MANUAL rows the importer left in place):

| Basis | classifiedBy | reviewStatus | Count |
| --- | --- | --- | ---: |
| CHAPTER | BOOK | ACCEPTED | 5815 |
| CHAPTER_AYAH | BOOK | ACCEPTED | 1376 |
| TAKHRIJ | BOOK | ACCEPTED | 408 |
| TAKHRIJ | REVIEWER | ACCEPTED | 79 |
| AUTHOR_CITATION | BOOK | ACCEPTED | 481 |
| REVIEWER_SECTION | REVIEWER | ACCEPTED | 890 |
| AI_ITEM | AI | ACCEPTED | 67 |
| KEYWORD_PROPOSAL | AI | NOT_REVIEWED | 3712 |
| MANUAL | BOOK | ACCEPTED | 26 |

## Per topic

`public` is the count of ACCEPTED links whose quote passes the public reader clause. Contemporary topics have no texts of their own; their pages add the public texts of the topics they derive from, which is why the catalog shows counts for them while this column is 0.

| domain | side | slug | name | rank | visibility | CHAPTER | CHAPTER_AYAH | TAKHRIJ | AUTHOR_CITATION | REVIEWER_SECTION | AI_ITEM | KEYWORD_PROPOSAL | MANUAL | BOOK | REVIEWER | AI | public |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iman | AVOID | amn-makr | الأمن من مكر الله واليأس من رحمته | KABIRA | shown | 8 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 0 | 0 | 3 |
| iman | AVOID | bida | البدع ومحدثات الأمور | — | shown | 12 | 5 | 0 | 0 | 0 | 0 | 12 | 0 | 17 | 0 | 12 | 5 |
| iman | AVOID | hilf-bighayr-allah | الحلف بغير الله | — | shown | 10 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 10 | 0 | 1 | 0 |
| iman | AVOID | sabb-sahaba | سبّ الصحابة | KABIRA | shown | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 3 |
| iman | AVOID | shirk | الشرك بالله | KABIRA | shown | 1 | 7 | 0 | 0 | 0 | 0 | 33 | 0 | 8 | 0 | 33 | 7 |
| iman | AVOID | sihr-kahana | السحر وإتيان الكهان والعرافين | KABIRA | shown | 29 | 8 | 1 | 0 | 0 | 0 | 28 | 0 | 38 | 0 | 28 | 9 |
| iman | AVOID | takdhib-qadar | التكذيب بالقدر | KABIRA | shown | 10 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 15 | 0 | 0 | 5 |
| iman | AVOID | tatayyur | التطيّر وتعليق التمائم | — | shown | 9 | 1 | 0 | 0 | 0 | 0 | 11 | 0 | 10 | 0 | 11 | 1 |
| iman | DO | dhikr-akhira | التشويق إلى الجنة وتذكّر الآخرة | — | shown | 110 | 102 | 32 | 0 | 68 | 5 | 395 | 0 | 221 | 91 | 400 | 146 |
| iman | DO | iman-ghayb | الإيمان بالملائكة والرسل والكتب | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| iman | DO | mahabbat-allah | محبة الله ورسوله وتعظيمهما | — | shown | 31 | 30 | 1 | 25 | 0 | 0 | 14 | 0 | 87 | 0 | 14 | 63 |
| iman | DO | sunna | اتباع السنة | — | shown | 21 | 18 | 4 | 0 | 9 | 0 | 6 | 0 | 43 | 9 | 6 | 24 |
| iman | DO | tawhid | التوحيد وإفراد الله بالعبادة | — | shown | 0 | 0 | 0 | 0 | 5 | 1 | 20 | 0 | 0 | 5 | 21 | 0 |
| qalb | AVOID | ghadab | الغضب | — | shown | 22 | 16 | 1 | 0 | 0 | 0 | 17 | 1 | 40 | 0 | 17 | 25 |
| qalb | AVOID | hasad | الحسد والغل | — | shown | 15 | 16 | 0 | 0 | 0 | 2 | 44 | 2 | 33 | 0 | 46 | 25 |
| qalb | AVOID | istihana-saghair | الاستهانة بالصغائر | — | shown | 2 | 1 | 1 | 0 | 23 | 0 | 1 | 0 | 3 | 24 | 1 | 10 |
| qalb | AVOID | kibr | الكبر والعُجب | KABIRA | shown | 43 | 13 | 5 | 0 | 6 | 0 | 32 | 0 | 61 | 6 | 32 | 20 |
| qalb | AVOID | riya | الرياء | KABIRA | shown | 46 | 19 | 2 | 0 | 0 | 0 | 5 | 1 | 68 | 0 | 5 | 24 |
| qalb | AVOID | tul-amal | التعلق بالدنيا وطول الأمل | — | shown | 68 | 14 | 0 | 0 | 0 | 0 | 0 | 0 | 82 | 0 | 0 | 15 |
| qalb | DO | haya | الحياء | — | shown | 10 | 0 | 2 | 0 | 0 | 4 | 18 | 0 | 12 | 0 | 22 | 2 |
| qalb | DO | husn-khuluq | حسن الخلق والحلم والرفق | — | shown | 58 | 6 | 9 | 0 | 3 | 0 | 49 | 0 | 73 | 3 | 49 | 15 |
| qalb | DO | ikhlas | الإخلاص | — | shown | 88 | 9 | 4 | 33 | 2 | 1 | 19 | 1 | 135 | 2 | 20 | 48 |
| qalb | DO | kaff-al-ghadab | كظم الغيظ | — | shown | 4 | 2 | 1 | 0 | 1 | 0 | 0 | 2 | 9 | 1 | 0 | 6 |
| qalb | DO | khawf-raja | الخوف من الله ورجاؤه | — | shown | 209 | 43 | 14 | 82 | 2 | 0 | 22 | 0 | 348 | 2 | 22 | 142 |
| qalb | DO | muhasaba | محاسبة النفس | — | shown | 0 | 0 | 0 | 35 | 2 | 0 | 0 | 0 | 35 | 2 | 0 | 36 |
| qalb | DO | muraqaba | مراقبة الله والتقوى | — | shown | 42 | 17 | 1 | 97 | 10 | 0 | 3 | 0 | 156 | 11 | 3 | 117 |
| qalb | DO | sabr | الصبر والرضا بالقضاء | — | shown | 96 | 17 | 17 | 101 | 12 | 1 | 58 | 0 | 231 | 12 | 59 | 140 |
| qalb | DO | salamat-sadr | سلامة الصدر ومحبة الخير للناس | — | shown | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 0 | 1 | 0 | 3 | 0 |
| qalb | DO | shukr | شكر النعم | — | shown | 12 | 10 | 0 | 55 | 7 | 0 | 0 | 0 | 77 | 7 | 0 | 69 |
| qalb | DO | sidq | الصدق | — | shown | 100 | 20 | 10 | 0 | 0 | 1 | 98 | 0 | 130 | 0 | 99 | 29 |
| qalb | DO | tark-lillah | أجر من ترك شيئًا لله | — | shown | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 |
| qalb | DO | tawadu | التواضع | — | shown | 92 | 12 | 3 | 0 | 8 | 0 | 5 | 0 | 107 | 8 | 5 | 15 |
| qalb | DO | tawakkul | اليقين والتوكل على الله | — | shown | 30 | 3 | 0 | 48 | 4 | 0 | 18 | 0 | 81 | 4 | 18 | 53 |
| qalb | DO | tawba | التوبة والاستغفار | — | shown | 124 | 82 | 9 | 0 | 35 | 0 | 114 | 0 | 215 | 35 | 114 | 109 |
| qalb | DO | wara | الورع وترك الشبهات | — | shown | 15 | 2 | 5 | 5 | 17 | 0 | 6 | 0 | 24 | 20 | 6 | 15 |
| qalb | DO | zuhd | الزهد والقناعة وتذكّر الموت | — | shown | 296 | 31 | 24 | 0 | 20 | 0 | 1 | 0 | 349 | 22 | 1 | 60 |
| ibadat | AVOID | hajr-quran | هجر القرآن ونسيانه | — | shown | 3 | 0 | 2 | 0 | 0 | 0 | 3 | 0 | 5 | 0 | 3 | 2 |
| ibadat | AVOID | iftar-ramadan | الفطر في رمضان بلا عذر | KABIRA | shown | 2 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 4 |
| ibadat | AVOID | tanazzuh-bawl | عدم التنزّه من البول | KABIRA | shown | 8 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 2 |
| ibadat | AVOID | tark-as-salah | ترك الصلاة والتهاون بها | KABIRA | shown | 91 | 20 | 7 | 0 | 12 | 0 | 5 | 2 | 118 | 14 | 5 | 29 |
| ibadat | AVOID | tark-hajj | ترك الحج مع القدرة | KABIRA | shown | 7 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 3 |
| ibadat | DO | dhikr | ذكر الله | — | shown | 803 | 136 | 12 | 0 | 30 | 2 | 54 | 2 | 950 | 33 | 56 | 161 |
| ibadat | DO | dua | الدعاء | — | shown | 38 | 15 | 2 | 0 | 17 | 0 | 174 | 0 | 55 | 17 | 174 | 21 |
| ibadat | DO | hajj | الحج والعمرة | — | shown | 42 | 4 | 1 | 0 | 6 | 1 | 282 | 0 | 47 | 6 | 283 | 7 |
| ibadat | DO | jumua | يوم الجمعة وصلاتها | — | shown | 36 | 2 | 4 | 0 | 6 | 0 | 90 | 0 | 41 | 7 | 90 | 6 |
| ibadat | DO | kaffarat | الكفارات والعتق | — | hidden | 9 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 0 | 3 |
| ibadat | DO | nawafil | النوافل وقيام الليل | — | shown | 123 | 12 | 20 | 0 | 25 | 0 | 87 | 0 | 154 | 26 | 87 | 36 |
| ibadat | DO | quran | تلاوة القرآن وتعاهده | — | shown | 75 | 15 | 7 | 0 | 15 | 0 | 143 | 0 | 97 | 15 | 143 | 29 |
| ibadat | DO | salah | المحافظة على الصلاة | — | shown | 120 | 12 | 15 | 0 | 42 | 0 | 7 | 0 | 141 | 48 | 7 | 31 |
| ibadat | DO | salat-ala-nabi | الصلاة على النبي ﷺ | — | shown | 22 | 2 | 0 | 0 | 0 | 0 | 10 | 0 | 24 | 0 | 10 | 2 |
| ibadat | DO | salat-fi-jamaah | صلاة الجماعة والمشي إلى المساجد | — | shown | 167 | 12 | 13 | 0 | 8 | 0 | 65 | 2 | 194 | 8 | 65 | 27 |
| ibadat | DO | siyam | الصيام | — | shown | 105 | 10 | 6 | 0 | 21 | 0 | 146 | 0 | 120 | 22 | 146 | 16 |
| ibadat | DO | tahara | الطهارة والوضوء | — | shown | 43 | 1 | 8 | 0 | 19 | 0 | 96 | 0 | 52 | 19 | 96 | 14 |
| ibadat | DO | zakah | أداء الزكاة | — | shown | 23 | 8 | 2 | 0 | 3 | 0 | 37 | 0 | 33 | 3 | 37 | 13 |
| lisan | AVOID | dhul-wajhayn | ذو الوجهين والنفاق في التعامل | — | shown | 6 | 2 | 1 | 0 | 0 | 0 | 4 | 0 | 9 | 0 | 4 | 3 |
| lisan | AVOID | ghibah | الغيبة | — | shown | 42 | 11 | 6 | 0 | 5 | 0 | 10 | 6 | 64 | 6 | 10 | 23 |
| lisan | AVOID | jidal | الجدال والمراء | KABIRA | shown | 8 | 6 | 0 | 0 | 0 | 0 | 8 | 0 | 14 | 0 | 8 | 6 |
| lisan | AVOID | kadhib | الكذب | KABIRA | shown | 23 | 10 | 1 | 0 | 0 | 3 | 12 | 0 | 34 | 0 | 15 | 10 |
| lisan | AVOID | namimah | النميمة | KABIRA | shown | 16 | 5 | 0 | 0 | 0 | 0 | 7 | 0 | 21 | 0 | 7 | 5 |
| lisan | AVOID | qadhf | قذف المحصنات | KABIRA | shown | 3 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 4 |
| lisan | AVOID | sabb-lan | السبّ واللعن والفحش | KABIRA | shown | 39 | 8 | 2 | 0 | 6 | 11 | 35 | 0 | 49 | 6 | 46 | 13 |
| lisan | AVOID | shahadat-zur | شهادة الزور | KABIRA | shown | 7 | 5 | 2 | 0 | 0 | 0 | 5 | 0 | 14 | 0 | 5 | 7 |
| lisan | AVOID | sukhriya | احتقار الناس والسخرية منهم والشماتة | — | shown | 12 | 6 | 0 | 0 | 0 | 0 | 3 | 0 | 18 | 0 | 3 | 6 |
| lisan | AVOID | yamin-ghamus | اليمين الكاذبة | KABIRA | shown | 24 | 4 | 0 | 0 | 0 | 1 | 2 | 0 | 28 | 0 | 3 | 4 |
| lisan | DO | amr-maruf | الأمر بالمعروف والنهي عن المنكر | — | shown | 34 | 19 | 11 | 0 | 6 | 0 | 0 | 0 | 59 | 11 | 0 | 31 |
| lisan | DO | hifz-al-lisan | حفظ اللسان والصمت إلا عن خير | — | shown | 70 | 8 | 5 | 0 | 0 | 1 | 9 | 1 | 84 | 0 | 10 | 14 |
| lisan | DO | islah-bayn-nas | الإصلاح بين الناس | — | shown | 27 | 4 | 0 | 0 | 4 | 0 | 6 | 0 | 31 | 4 | 6 | 4 |
| lisan | DO | kalam-tayyib | الكلمة الطيبة وطلاقة الوجه | — | shown | 13 | 10 | 3 | 0 | 9 | 0 | 4 | 0 | 24 | 11 | 4 | 13 |
| lisan | DO | nasiha | النصيحة | — | shown | 4 | 3 | 0 | 0 | 0 | 0 | 5 | 0 | 7 | 0 | 5 | 3 |
| lisan | DO | tathabbut | التثبّت في نقل الأخبار | — | shown | 3 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 5 | 0 | 2 | 2 |
| usra | AVOID | dayyuth | الدياثة وقلّة الغيرة على الأهل | KABIRA | shown | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| usra | AVOID | intisab | الانتساب إلى غير الأب | KABIRA | shown | 15 | 1 | 2 | 0 | 0 | 0 | 3 | 0 | 18 | 0 | 3 | 3 |
| usra | AVOID | nushuz | إفساد الحياة الزوجية وعصيان الزوج | KABIRA | shown | 18 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 2 |
| usra | AVOID | qat-al-rahim | قطيعة الرحم | KABIRA | shown | 10 | 7 | 0 | 0 | 0 | 0 | 4 | 2 | 19 | 0 | 4 | 9 |
| usra | AVOID | uquq | عقوق الوالدين | KABIRA | shown | 23 | 17 | 0 | 0 | 0 | 0 | 7 | 0 | 40 | 0 | 7 | 17 |
| usra | AVOID | zulm-zawja | ظلم الزوجة والميل بين الزوجات | — | shown | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 1 |
| usra | DO | birr-al-walidayn | بر الوالدين | — | shown | 54 | 10 | 3 | 0 | 0 | 0 | 78 | 0 | 67 | 0 | 78 | 13 |
| usra | DO | husn-ishra | حسن العشرة بين الزوجين | — | shown | 43 | 6 | 1 | 0 | 3 | 0 | 0 | 0 | 50 | 3 | 0 | 7 |
| usra | DO | kafalat-yatim | كفالة اليتيم والإحسان إلى الضعفاء | — | shown | 33 | 5 | 6 | 0 | 0 | 0 | 31 | 0 | 44 | 0 | 31 | 12 |
| usra | DO | nafaqa-ahl | النفقة على الأهل وتربية الأولاد | — | shown | 21 | 9 | 1 | 0 | 3 | 0 | 2 | 0 | 31 | 3 | 2 | 11 |
| usra | DO | nikah | الزواج والعفة | — | shown | 4 | 2 | 0 | 0 | 0 | 0 | 31 | 0 | 6 | 0 | 31 | 2 |
| usra | DO | silat-ar-rahim | صلة الرحم | — | shown | 42 | 12 | 3 | 0 | 2 | 0 | 34 | 0 | 57 | 2 | 34 | 15 |
| mujtama | AVOID | adha-jar | أذى الجار | KABIRA | shown | 27 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 0 | 3 |
| mujtama | AVOID | adha-muslimin | أذى الناس وترويعهم | KABIRA | shown | 37 | 10 | 0 | 0 | 6 | 0 | 3 | 0 | 47 | 6 | 3 | 10 |
| mujtama | AVOID | baghy-fakhr | البغي والفخر والتعالي | KABIRA | shown | 6 | 5 | 1 | 0 | 0 | 1 | 21 | 0 | 12 | 0 | 22 | 6 |
| mujtama | AVOID | ghadr | الغدر ونقض العهد وإخلاف الوعد | KABIRA | shown | 8 | 2 | 0 | 0 | 0 | 0 | 20 | 0 | 10 | 0 | 20 | 2 |
| mujtama | AVOID | hijran | الهجر والتدابر والتقاطع | — | shown | 16 | 4 | 2 | 0 | 0 | 4 | 6 | 0 | 22 | 0 | 10 | 6 |
| mujtama | AVOID | khiyana | الخيانة | KABIRA | shown | 10 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 0 | 2 |
| mujtama | AVOID | mann | المنّ بالعطية | KABIRA | shown | 8 | 3 | 1 | 0 | 0 | 0 | 182 | 0 | 12 | 0 | 182 | 4 |
| mujtama | AVOID | niyaha | النياحة والتسخّط عند المصيبة | KABIRA | shown | 57 | 5 | 7 | 0 | 0 | 0 | 10 | 0 | 69 | 0 | 10 | 12 |
| mujtama | AVOID | su-dhann | سوء الظن بالناس | — | shown | 1 | 1 | 2 | 0 | 7 | 0 | 14 | 0 | 3 | 8 | 14 | 4 |
| mujtama | AVOID | tadhib-hayawan | تعذيب الحيوان والضعفاء | — | shown | 13 | 4 | 0 | 0 | 0 | 0 | 6 | 0 | 17 | 0 | 6 | 4 |
| mujtama | AVOID | tajassus | التجسس وتتبّع عورات الناس | KABIRA | shown | 8 | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 11 | 0 | 1 | 3 |
| mujtama | AVOID | zulm | الظلم | KABIRA | shown | 58 | 13 | 10 | 0 | 2 | 4 | 34 | 0 | 81 | 2 | 38 | 23 |
| mujtama | DO | adl | العدل ورد المظالم | — | shown | 36 | 8 | 8 | 0 | 7 | 1 | 10 | 0 | 51 | 8 | 11 | 17 |
| mujtama | DO | afw | العفو والصفح | — | shown | 19 | 6 | 4 | 0 | 0 | 0 | 10 | 0 | 29 | 0 | 10 | 11 |
| mujtama | DO | amana-wafa | أداء الأمانة والوفاء بالعهد | — | shown | 26 | 8 | 0 | 0 | 2 | 0 | 13 | 0 | 34 | 2 | 13 | 8 |
| mujtama | DO | haqq-jar | إكرام الجار | — | shown | 10 | 2 | 1 | 0 | 0 | 1 | 32 | 0 | 13 | 0 | 33 | 4 |
| mujtama | DO | hubb-fillah | الحب في الله والصحبة الصالحة | — | shown | 76 | 16 | 7 | 0 | 7 | 2 | 2 | 0 | 99 | 7 | 4 | 27 |
| mujtama | DO | ikram-dayf | إكرام الضيف | — | shown | 10 | 4 | 1 | 0 | 0 | 0 | 30 | 0 | 15 | 0 | 30 | 5 |
| mujtama | DO | imatat-adha | إماطة الأذى عن الطريق | — | shown | 11 | 0 | 2 | 0 | 0 | 0 | 4 | 0 | 13 | 0 | 4 | 2 |
| mujtama | DO | iyadat-marid | عيادة المريض واتباع الجنائز | — | shown | 39 | 0 | 7 | 0 | 35 | 0 | 34 | 0 | 44 | 37 | 34 | 9 |
| mujtama | DO | qada-hawaij | قضاء حوائج الناس والتيسير على المعسر | — | shown | 27 | 24 | 6 | 0 | 9 | 0 | 11 | 0 | 56 | 10 | 11 | 31 |
| mujtama | DO | rahma-khalq | الرحمة بالخلق والحيوان | — | shown | 50 | 7 | 11 | 0 | 0 | 0 | 3 | 0 | 68 | 0 | 3 | 18 |
| mujtama | DO | salam | إفشاء السلام | — | shown | 55 | 5 | 7 | 0 | 17 | 0 | 132 | 0 | 65 | 19 | 132 | 12 |
| mujtama | DO | satr-muslim | ستر المسلم | — | shown | 9 | 2 | 0 | 0 | 1 | 0 | 5 | 0 | 11 | 1 | 5 | 3 |
| mujtama | DO | taawun | التعاون على البر والتقوى | — | shown | 4 | 2 | 3 | 0 | 3 | 0 | 1 | 0 | 9 | 3 | 1 | 5 |
| mujtama | DO | tawqir-kibar | توقير العلماء والكبار وأهل الفضل | — | shown | 12 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 15 | 0 | 0 | 3 |
| mal | AVOID | akl-haram | أكل الحرام والمكوس | KABIRA | shown | 10 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 13 | 0 | 0 | 3 |
| mal | AVOID | akl-mal-yatim | أكل مال اليتيم | KABIRA | shown | 7 | 9 | 1 | 0 | 0 | 0 | 2 | 0 | 17 | 0 | 2 | 10 |
| mal | AVOID | bukhl | البخل والشح | KABIRA | shown | 69 | 6 | 1 | 0 | 0 | 1 | 23 | 0 | 76 | 0 | 24 | 11 |
| mal | AVOID | ghish | الغش والخداع وبخس الكيل | KABIRA | shown | 17 | 5 | 0 | 0 | 0 | 0 | 14 | 0 | 22 | 0 | 14 | 5 |
| mal | AVOID | ihtikar | الاحتكار | — | shown | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 0 |
| mal | AVOID | israf | الإسراف وإضاعة المال | — | shown | 2 | 0 | 1 | 0 | 12 | 0 | 5 | 0 | 2 | 13 | 5 | 1 |
| mal | AVOID | man-ajr | منع الأجير أجره | — | shown | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| mal | AVOID | man-zakah | منع الزكاة | KABIRA | shown | 34 | 10 | 0 | 0 | 0 | 0 | 4 | 0 | 44 | 0 | 4 | 10 |
| mal | AVOID | masala | سؤال الناس من غير حاجة | — | shown | 45 | 2 | 4 | 0 | 1 | 0 | 13 | 0 | 50 | 2 | 13 | 6 |
| mal | AVOID | mutl | المماطلة في الحقوق والديون | — | shown | 22 | 12 | 1 | 0 | 2 | 0 | 20 | 0 | 35 | 2 | 20 | 13 |
| mal | AVOID | qimar | القمار والميسر | KABIRA | shown | 0 | 3 | 0 | 0 | 0 | 0 | 6 | 0 | 3 | 0 | 6 | 3 |
| mal | AVOID | riba | الربا | KABIRA | shown | 11 | 4 | 0 | 0 | 0 | 0 | 16 | 0 | 15 | 0 | 16 | 4 |
| mal | AVOID | rishwa | الرشوة | KABIRA | shown | 9 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 1 |
| mal | AVOID | sariqa | السرقة والغصب والغلول | KABIRA | shown | 16 | 5 | 0 | 0 | 0 | 0 | 31 | 0 | 21 | 0 | 31 | 5 |
| mal | DO | iqtisad | الاقتصاد في الإنفاق | — | shown | 16 | 4 | 5 | 0 | 0 | 0 | 10 | 0 | 25 | 0 | 10 | 9 |
| mal | DO | kasb-halal | الكسب الحلال وطلب الرزق | — | shown | 73 | 12 | 7 | 0 | 1 | 0 | 9 | 0 | 92 | 1 | 9 | 21 |
| mal | DO | sadaqah | الصدقة والإنفاق في الخير | — | shown | 138 | 25 | 9 | 0 | 9 | 0 | 100 | 2 | 174 | 9 | 100 | 37 |
| mal | DO | samaha | السماحة في البيع والشراء | — | shown | 23 | 8 | 2 | 0 | 6 | 0 | 1 | 0 | 33 | 6 | 1 | 11 |
| shahawat | AVOID | isbal-harir | الإسبال ولبس الحرير والذهب للرجال | KABIRA | shown | 43 | 4 | 3 | 0 | 6 | 0 | 35 | 0 | 48 | 8 | 35 | 7 |
| shahawat | AVOID | khamr | الخمر والمسكرات والمخدّرات | KABIRA | shown | 34 | 12 | 0 | 0 | 0 | 0 | 47 | 0 | 46 | 0 | 47 | 12 |
| shahawat | AVOID | liwat | اللواط | KABIRA | shown | 11 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 14 | 0 | 0 | 3 |
| shahawat | AVOID | malahi | اللهو المحرّم | — | shown | 2 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 2 | 0 | 12 | 0 |
| shahawat | AVOID | nazar-muharram | النظر المحرّم والخلوة بالأجنبية | — | shown | 10 | 5 | 1 | 0 | 0 | 0 | 7 | 0 | 16 | 0 | 7 | 6 |
| shahawat | AVOID | tabarruj | التبرّج وتغيير خلق الله | — | shown | 12 | 3 | 2 | 0 | 3 | 0 | 8 | 0 | 17 | 3 | 8 | 5 |
| shahawat | AVOID | tashabbuh | تشبّه الرجال بالنساء والنساء بالرجال | KABIRA | shown | 11 | 1 | 1 | 0 | 0 | 0 | 4 | 0 | 13 | 0 | 4 | 1 |
| shahawat | AVOID | tasweer | تصوير ذوات الأرواح | KABIRA | hidden | 6 | 1 | 3 | 0 | 22 | 0 | 0 | 0 | 7 | 25 | 0 | 7 |
| shahawat | AVOID | zina | الزنا | KABIRA | shown | 50 | 8 | 1 | 0 | 0 | 0 | 27 | 0 | 59 | 0 | 27 | 9 |
| shahawat | DO | ghadd-basar | غضّ البصر | — | shown | 9 | 1 | 0 | 0 | 0 | 0 | 3 | 0 | 10 | 0 | 3 | 1 |
| shahawat | DO | iffa | العفّة وحفظ الفرج | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| dima | AVOID | firar-zahf | الفرار من الزحف والتولي يوم القتال | KABIRA | hidden | 28 | 10 | 1 | 0 | 0 | 0 | 0 | 0 | 39 | 0 | 0 | 11 |
| dima | AVOID | intihar | قتل الإنسان نفسه | KABIRA | shown | 10 | 3 | 0 | 0 | 0 | 1 | 6 | 0 | 13 | 0 | 7 | 3 |
| dima | AVOID | qatl | قتل النفس | KABIRA | shown | 24 | 11 | 0 | 0 | 0 | 0 | 14 | 0 | 35 | 0 | 14 | 11 |
| dima | AVOID | zulm-raiyya | خيانة الأمانة في الولاية والقضاء | KABIRA | shown | 25 | 7 | 1 | 0 | 0 | 14 | 14 | 0 | 33 | 0 | 28 | 9 |
| dima | DO | jihad | الجهاد في سبيل الله | — | hidden | 157 | 24 | 23 | 0 | 19 | 0 | 30 | 0 | 203 | 20 | 30 | 51 |
| dima | DO | taat-wulat | طاعة ولاة الأمر في المعروف | — | shown | 11 | 1 | 4 | 0 | 0 | 0 | 0 | 0 | 16 | 0 | 0 | 5 |
| ilm | AVOID | kitman-ilm | كتمان العلم وطلبه للدنيا | KABIRA | shown | 36 | 5 | 0 | 0 | 2 | 0 | 0 | 0 | 41 | 2 | 0 | 5 |
| ilm | AVOID | qawl-bila-amal | أن تقول ما لا تفعل | — | shown | 2 | 3 | 0 | 0 | 7 | 0 | 0 | 0 | 5 | 7 | 0 | 5 |
| ilm | DO | nashr-ilm | نشر العلم والدلالة على الخير | — | shown | 16 | 12 | 2 | 0 | 7 | 0 | 3 | 0 | 29 | 8 | 3 | 14 |
| ilm | DO | talab-ilm | طلب العلم | — | shown | 52 | 18 | 6 | 0 | 0 | 0 | 103 | 0 | 76 | 0 | 103 | 24 |
| raqami | AVOID | alab-mulhiya | الألعاب التي تُلهي عن الواجبات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | ghibah-raqamiya | الغيبة في المجموعات والتعليقات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | idaat-al-waqt | إضاعة الوقت واللغو | — | shown | 5 | 1 | 0 | 0 | 0 | 0 | 15 | 0 | 6 | 0 | 15 | 1 |
| raqami | AVOID | ishaat | نشر الشائعات والأخبار دون تثبّت | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | istirad | الاستعراض والتباهي بالنشر | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | murahanat | المراهنات الإلكترونية | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | nazar-shashat | النظر المحرّم عبر الشاشات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | tanammur | السخرية والتنمّر على الإنترنت | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | tashhir | التشهير وكشف عيوب الناس على المنصات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | waqt-tawasul | إضاعة الوقت على وسائل التواصل | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | DO | ightinam-waqt | اغتنام الوقت والمبادرة إلى الخير | — | shown | 198 | 41 | 20 | 0 | 4 | 0 | 11 | 0 | 259 | 4 | 11 | 62 |
| raqami | DO | nashr-khayr-raqami | نشر الخير والعلم النافع على المنصات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | DO | silah-raqamiya | صلة الرحم بالتواصل والرسائل | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| adab | DO | adab-libas | آداب اللباس والزينة | — | shown | 0 | 0 | 1 | 0 | 50 | 0 | 0 | 0 | 0 | 51 | 0 | 5 |
| adab | DO | adab-majlis | آداب المجلس والاستئذان | — | shown | 0 | 0 | 0 | 0 | 16 | 0 | 0 | 0 | 0 | 16 | 0 | 1 |
| adab | DO | adab-masjid | آداب المسجد | — | shown | 0 | 0 | 1 | 0 | 23 | 0 | 0 | 0 | 0 | 24 | 0 | 1 |
| adab | DO | adab-safar | آداب السفر | — | shown | 0 | 0 | 3 | 0 | 49 | 0 | 0 | 0 | 0 | 52 | 0 | 8 |
| adab | DO | adab-taam | آداب الطعام والشراب | — | shown | 0 | 0 | 6 | 0 | 79 | 3 | 0 | 0 | 0 | 85 | 3 | 8 |
| — | AVOID | kabira-35 | المحلل والمحلل له | KABIRA | hidden | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| — | AVOID | kabira-57 | إباق العبد | KABIRA | hidden | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 |
| — | AVOID | kabira-67 | الإضرار في الوصية | KABIRA | hidden | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 |

### Shown topics with fewer than 3 direct public texts

Contemporary rows are filled from their derivations. `tark-lillah` is the unlisted reward pool. The other rows with 0 stay off the public catalogs.

| domain | side | slug | name | rank | visibility | CHAPTER | CHAPTER_AYAH | TAKHRIJ | AUTHOR_CITATION | REVIEWER_SECTION | AI_ITEM | KEYWORD_PROPOSAL | MANUAL | BOOK | REVIEWER | AI | public |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iman | AVOID | hilf-bighayr-allah | الحلف بغير الله | — | shown | 10 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 10 | 0 | 1 | 0 |
| iman | AVOID | tatayyur | التطيّر وتعليق التمائم | — | shown | 9 | 1 | 0 | 0 | 0 | 0 | 11 | 0 | 10 | 0 | 11 | 1 |
| iman | DO | iman-ghayb | الإيمان بالملائكة والرسل والكتب | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| iman | DO | tawhid | التوحيد وإفراد الله بالعبادة | — | shown | 0 | 0 | 0 | 0 | 5 | 1 | 20 | 0 | 0 | 5 | 21 | 0 |
| qalb | DO | haya | الحياء | — | shown | 10 | 0 | 2 | 0 | 0 | 4 | 18 | 0 | 12 | 0 | 22 | 2 |
| qalb | DO | salamat-sadr | سلامة الصدر ومحبة الخير للناس | — | shown | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 0 | 1 | 0 | 3 | 0 |
| qalb | DO | tark-lillah | أجر من ترك شيئًا لله | — | shown | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 |
| ibadat | AVOID | hajr-quran | هجر القرآن ونسيانه | — | shown | 3 | 0 | 2 | 0 | 0 | 0 | 3 | 0 | 5 | 0 | 3 | 2 |
| ibadat | AVOID | tanazzuh-bawl | عدم التنزّه من البول | KABIRA | shown | 8 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 2 |
| ibadat | DO | salat-ala-nabi | الصلاة على النبي ﷺ | — | shown | 22 | 2 | 0 | 0 | 0 | 0 | 10 | 0 | 24 | 0 | 10 | 2 |
| lisan | DO | tathabbut | التثبّت في نقل الأخبار | — | shown | 3 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 5 | 0 | 2 | 2 |
| usra | AVOID | dayyuth | الدياثة وقلّة الغيرة على الأهل | KABIRA | shown | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| usra | AVOID | nushuz | إفساد الحياة الزوجية وعصيان الزوج | KABIRA | shown | 18 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 2 |
| usra | AVOID | zulm-zawja | ظلم الزوجة والميل بين الزوجات | — | shown | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 1 |
| usra | DO | nikah | الزواج والعفة | — | shown | 4 | 2 | 0 | 0 | 0 | 0 | 31 | 0 | 6 | 0 | 31 | 2 |
| mujtama | AVOID | ghadr | الغدر ونقض العهد وإخلاف الوعد | KABIRA | shown | 8 | 2 | 0 | 0 | 0 | 0 | 20 | 0 | 10 | 0 | 20 | 2 |
| mujtama | AVOID | khiyana | الخيانة | KABIRA | shown | 10 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 0 | 2 |
| mujtama | DO | imatat-adha | إماطة الأذى عن الطريق | — | shown | 11 | 0 | 2 | 0 | 0 | 0 | 4 | 0 | 13 | 0 | 4 | 2 |
| mal | AVOID | ihtikar | الاحتكار | — | shown | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 0 |
| mal | AVOID | israf | الإسراف وإضاعة المال | — | shown | 2 | 0 | 1 | 0 | 12 | 0 | 5 | 0 | 2 | 13 | 5 | 1 |
| mal | AVOID | man-ajr | منع الأجير أجره | — | shown | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| mal | AVOID | rishwa | الرشوة | KABIRA | shown | 9 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 1 |
| shahawat | AVOID | malahi | اللهو المحرّم | — | shown | 2 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 2 | 0 | 12 | 0 |
| shahawat | AVOID | tashabbuh | تشبّه الرجال بالنساء والنساء بالرجال | KABIRA | shown | 11 | 1 | 1 | 0 | 0 | 0 | 4 | 0 | 13 | 0 | 4 | 1 |
| shahawat | DO | ghadd-basar | غضّ البصر | — | shown | 9 | 1 | 0 | 0 | 0 | 0 | 3 | 0 | 10 | 0 | 3 | 1 |
| shahawat | DO | iffa | العفّة وحفظ الفرج | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| raqami | AVOID | alab-mulhiya | الألعاب التي تُلهي عن الواجبات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | ghibah-raqamiya | الغيبة في المجموعات والتعليقات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | idaat-al-waqt | إضاعة الوقت واللغو | — | shown | 5 | 1 | 0 | 0 | 0 | 0 | 15 | 0 | 6 | 0 | 15 | 1 |
| raqami | AVOID | ishaat | نشر الشائعات والأخبار دون تثبّت | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | istirad | الاستعراض والتباهي بالنشر | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | murahanat | المراهنات الإلكترونية | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | nazar-shashat | النظر المحرّم عبر الشاشات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | tanammur | السخرية والتنمّر على الإنترنت | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | tashhir | التشهير وكشف عيوب الناس على المنصات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | AVOID | waqt-tawasul | إضاعة الوقت على وسائل التواصل | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | DO | nashr-khayr-raqami | نشر الخير والعلم النافع على المنصات | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raqami | DO | silah-raqamiya | صلة الرحم بالتواصل والرسائل | — | shown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| adab | DO | adab-majlis | آداب المجلس والاستئذان | — | shown | 0 | 0 | 0 | 0 | 16 | 0 | 0 | 0 | 0 | 16 | 0 | 1 |
| adab | DO | adab-masjid | آداب المسجد | — | shown | 0 | 0 | 1 | 0 | 23 | 0 | 0 | 0 | 0 | 24 | 0 | 1 |

## Samples

Stable sample: `order by md5(id) limit 20`. Text is the first 80 characters.

### 20 ACCEPTED links

| side | slug | basis | classifiedBy | note | text |
| --- | --- | --- | --- | --- | --- |
| DO | khawf-raja | CHAPTER | BOOK | من باب: باب ما جاء في الحزن والبكاء — الزهد والرقائق | ) ١٣٦ ) أخبرنا مسعر قال : حدثنا شيخ أنه سمع جابر بن عبد عبد الله عبید عبد لهيعة  |
| DO | zuhd | CHAPTER | BOOK | من باب: الترغيب في الزهد — صحيح الترغيب والترهيب | ٣٢٥٧ - (٤٥) وعن عوف بن مالك رضي الله عنه قال : قام رسول الله صلى الله عليه وسلم  |
| DO | dhikr | CHAPTER | BOOK | من باب: الترغيب في التسبيح والتكبير — صحيح الترغيب والترهيب | ١٥٤٤ - (٨) وعن مصـ بن سعد قال : حدثني أبي قال : كنا عند رسول الله فقال : (۱) تعق |
| AVOID | riba | CHAPTER_AYAH | BOOK | أورده المنذري في باب: الترهيب من الربا — صحيح الترغيب والترهيب | وَلَا يَحْسَبَنَّ ٱلَّذِينَ يَبْخَلُونَ بِمَآ ءَاتَىٰهُمُ ٱللَّهُ مِن فَضْلِهِۦ |
| DO | sidq | CHAPTER | BOOK | من باب: ترغيب المرأة في الصدقة من مال زوجها — صحيح الترغيب والترهيب | ٩٤٢ - (٥) وعن عائشة عن النبي صلى الله عليه وسلم قال : إذا تصدقت المرأة من بيت زو |
| AVOID | adha-muslimin | CHAPTER_AYAH | BOOK | أورده الذهبي في باب: فصل — الكبائر | وَٱصْبِرْ نَفْسَكَ مَعَ ٱلَّذِينَ يَدْعُونَ رَبَّهُم بِٱلْغَدَوٰةِ وَٱلْعَشِىِّ  |
| DO | tawadu | CHAPTER | BOOK | من باب: باب التواضع — الزهد والرقائق | أخبركم أبو عمر بن حيويه قال: حدثنا يحيى قال: حدثنا الحسين قال: أخبرنا عبد الله ق |
| DO | dhikr | CHAPTER | BOOK | من باب: باب فضل ذكر الله عز وجل — الزهد والرقائق | أخبركم أبو عمر بن حيويه قال: حدثنا يحيى قال: حدثنا الحسين، قال: أخبرنا الهيثم بن |
| DO | kafalat-yatim | CHAPTER | BOOK | من باب: باب ملاطفة اليتيم والبنات وسائر الضعفة والمساكين والمنكسرين والإحسان إليهم والشفقة | وعن أنس - رضي الله عنه - عن النبي - صلى الله عليه وسلم - قال: «من عال (1) جاريتي |
| AVOID | ghibah | CHAPTER | BOOK | من باب: باب تحريم سماع الغيبة وأمر من سمع غيبة محرمة بردها والإنكار على قائلها — رياض الصا | وعن عتبان بن مالك - رضي الله عنه - في حديثه الطويل المشهور الذي تقدم في باب الرج |
| DO | khawf-raja | CHAPTER_AYAH | BOOK | أورده المنذري في باب: الترغيب في الخوف ، وفضله — صحيح الترغيب والترهيب | قَالَ ٱللَّهُ إِنِّى مُنَزِّلُهَا عَلَيْكُمْ ۖ فَمَن يَكْفُرْ بَعْدُ مِنكُمْ فَإ |
| DO | jumua | CHAPTER | BOOK | من باب: الترغيب في صلاة الجمعة — صحيح الترغيب والترهيب | ٦٩٧ - (١٥) وعن أبي هريرة رضي الله عنه ؛ أن رسول الله عنه ؛ أن رسول الله صلى الله |
| DO | tawadu | TAKHRIJ | BOOK | رواه البخاري (1517) — ورد في باب: الترغيب في التواضع في الحج والتبذل ولبس الدون من الثياب  | حج على رحل وكانت زاملته» |
| DO | hubb-fillah | CHAPTER_AYAH | BOOK | أورده النووي في باب: باب فضل الحب في الله والحث عليه وإعلام الرجل من يحبه، أنه يحبه، وماذا | مُّحَمَّدٌ رَّسُولُ ٱللَّهِ ۚ وَٱلَّذِينَ مَعَهُۥٓ أَشِدَّآءُ عَلَى ٱلْكُفَّارِ |
| DO | amr-maruf | CHAPTER | BOOK | من باب: باب في الأمر بالمعروف والنهي عن المنكر — رياض الصالحين | السابع: عن أبي سعيد الخدري - رضي الله عنه - عن النبي - صلى الله عليه وسلم - قال: |
| AVOID | bida | CHAPTER | BOOK | من باب: الترهيب من ترك السنة وارتكاب البدع والأهواء — صحيح الترغيب والترهيب | ٥١ - (٣) وعن معاوية رضي الله عنه قال : قام فينا رسول الله صلى الله عليه وسلم فقا |
| DO | hifz-al-lisan | CHAPTER | BOOK | من باب: الترغيب في الصمت إلا عن خير ، والترهيب من كثرة الكلام — صحيح الترغيب والترهيب | ٢٨٥٠ - (١) عن أبي موسى رضي الله عنه قال : قلتُ : يا رسول الله ! أَيُّ المسلمينَ  |
| DO | tawba | CHAPTER_AYAH | BOOK | أورده المنذري في باب: الترغيب في التوبة والمبادرة بها وإتباع السيئة الحسنة — صحيح الترغيب  | هَلْ يَنظُرُونَ إِلَّآ أَن تَأْتِيَهُمُ ٱلْمَلَـٰٓئِكَةُ أَوْ يَأْتِىَ رَبُّكَ  |
| AVOID | mutl | TAKHRIJ | BOOK | رواه مسلم (1619) — ورد في باب: الترهيب من الدين من صحيح الترغيب والترهيب | كان يؤتى بالرجل الميت عليه الدين فيسأل هل ترك لدينه من قضاء فإن حدث أنه ترك وفاء |
| DO | dhikr | CHAPTER | BOOK | من باب: باب فضل ذكر الله عز وجل — الزهد والرقائق | حدثنا الحسين، أخبرنا ابن المبارك، أخبرنا يحيى بن عبيد الله قال: سمعت أبي يقول: س |

### 20 REVIEWER_SECTION links

| side | slug | note | text |
| --- | --- | --- | --- |
| DO | nawafil | تصنيف المراجع حسب موضوع الباب: باب استحباب الاضطجاع بعد ركعتي الفجر على جنبه الأيمن والحث  | وعنها، قالت: كان النبي - صلى الله عليه وسلم - يصلي فيما بين أن يفرغ من صلاة العش |
| AVOID | sabb-lan | تصنيف المراجع حسب موضوع الباب: باب النهي عن سب الريح، وبيان ما يقال عند هبوبها — رياض الصا | عن أبي المنذر أبي بن كعب - رضي الله عنه - قال: قال رسول الله - صلى الله عليه وسل |
| DO | salam | تصنيف المراجع حسب موضوع الباب: باب تحريم ابتدائنا الكافر بالسلام وكيفية الرد عليهم واستحبا | وعن أنس - رضي الله عنه - قال: قال رسول الله - صلى الله عليه وسلم: «إذا سلم عليكم |
| AVOID | istihana-saghair | تصنيف المراجع حسب موضوع الباب: الترهيب من مواقعة الحدود — صحيح الترغيب والترهيب | أُحِلَّ لَكُمْ لَيْلَةَ ٱلصِّيَامِ ٱلرَّفَثُ إِلَىٰ نِسَآئِكُمْ ۚ هُنَّ لِبَاسٌ |
| DO | sabr | تصنيف المراجع حسب موضوع الباب: باب جواز قول المريض: أنا وجع، أو شديد الوجع أو موعوك أو وار | عن ابن مسعود - رضي الله عنه - قال: دخلت على النبي - صلى الله عليه وسلم - وهو يوع |
| DO | adab-safar | تصنيف المراجع حسب موضوع الباب: الترغيب في الدلجة — صحيح الترغيب والترهيب | ٣١٢٥ - (٤) وعن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم ( إ |
| DO | nashr-ilm | تصنيف المراجع حسب موضوع الباب: باب الوعظ والاقتصاد فيه — رياض الصالحين | وعن معاوية بن الحكم السلمي - رضي الله عنه - قال: بينا أنا أصلي مع رسول الله - صل |
| DO | tahara | تصنيف المراجع حسب موضوع الباب: الترهيب من تأخير الغُسل لغير عذر — صحيح الترغيب والترهيب | يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ تُوبُوٓا۟ إِلَى ٱللَّهِ تَوْبَةً نَّصُوحًا عَ |
| DO | adab-libas | تصنيف المراجع حسب موضوع الباب: باب استحباب الثوب الأبيض، وجواز الأحمر والأخضر والأصفر والأ | وعن سمرة - رضي الله عنه - قال: قال رسول الله - صلى الله عليه وسلم: «البسوا البيا |
| DO | qada-hawaij | تصنيف المراجع حسب موضوع الباب: الترغيب في قضاء حوائج — صحيح الترغيب والترهيب | ٢٦١٨ - (٥) وعن ابن عباس رضي الله عنهما قال : قال رسول الله « ما مِنْ عبد وَإِذْ  |
| DO | kalam-tayyib | تصنيف المراجع حسب موضوع الباب: الترغيب في طلاقة الوجه — صحيح الترغيب والترهيب | ٢٦٩٣ - (۱) عن عبد الله بْنِ عَمْرِو بن العاصي رضي الله عنهما : أنَّ رجلاً سأل رس |
| DO | dua | تصنيف المراجع حسب موضوع الباب: باب استحباب الدعاء في السفر — رياض الصالحين | وعن أبي هريرة - رضي الله عنه - قال: قال رسول الله - صلى الله عليه وسلم: «ثلاث دع |
| DO | adab-taam | تصنيف المراجع حسب موضوع الباب: الترغيب في التسمية على الطعام — صحيح الترغيب والترهيب | ۲۱۰۹ - (۳) وعن حذيفة - هو ابن اليمان - رضي الله عنه قال : كنا إذا حضرنا مع رسول  |
| DO | tawba | تصنيف المراجع حسب موضوع الباب: باب توبة داود وذكر الأنبياء صلوات الله عليهم — الزهد والرقا | أخبركم أبو عمر بن حيويه، وأبو بكر الوراق قالا: أخبرنا يحيى قال: حدثنا الحسين، قا |
| DO | dhikr-akhira | تصنيف المراجع حسب موضوع الباب: باب أحاديث الدجال وأشراط الساعة وغيرها — رياض الصالحين | رَّبَّنَآ إِنِّىٓ أَسْكَنتُ مِن ذُرِّيَّتِى بِوَادٍ غَيْرِ ذِى زَرْعٍ عِندَ بَي |
| DO | dhikr-akhira | تصنيف المراجع حسب موضوع الباب: باب أحاديث الدجال وأشراط الساعة وغيرها — رياض الصالحين | وعنه - رضي الله عنه: {كنتم خير أمة أخرجت للناس} [البقرة: 110] قال: خير الناس للن |
| DO | dhikr-akhira | تصنيف المراجع حسب موضوع الباب: باب أحاديث الدجال وأشراط الساعة وغيرها — رياض الصالحين | وَأَقِيمُوا۟ ٱلصَّلَوٰةَ وَءَاتُوا۟ ٱلزَّكَوٰةَ ۚ وَمَا تُقَدِّمُوا۟ لِأَنفُسِكُ |
| DO | zuhd | تصنيف المراجع حسب موضوع الباب: باب الموعظة عند القبر — رياض الصالحين | عن علي - رضي الله عنه - قال: كنا في جنازة في بقيع الغرقد، فأتانا رسول الله - صلى |
| AVOID | israf | تصنيف المراجع حسب موضوع الباب: الترهيب من الإمعان في التشيع — صحيح الترغيب والترهيب | ٢١٤٨ - (١٥) وروي عن أبي أمامة رضي الله عنه قال : قال رسول الله صلى الله عليه وسل |
| DO | dhikr | تصنيف المراجع حسب موضوع الباب: الترغيب في التكبير في العيد وذكر فضله — صحيح الترغيب والتره | ۱۰۸۷ - (۱) وعن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : م |

### Every AI_ITEM (67, all ACCEPTED, classifiedBy AI, note «تصنيف آلي حسب محتوى النص»)

| side | slug | reviewStatus | text |
| --- | --- | --- | --- |
| AVOID | baghy-fakhr | ACCEPTED | ٢٩٦٥ - (۸) وعن أبي هريرة رضي الله عنه عن النبي صلى الله عليه وسلم أَنَّه قال : « |
| AVOID | bukhl | ACCEPTED | وَلَا يَحْسَبَنَّ ٱلَّذِينَ يَبْخَلُونَ بِمَآ ءَاتَىٰهُمُ ٱللَّهُ مِن فَضْلِهِۦ |
| AVOID | hasad | ACCEPTED | ۲۸۸۷ - (۳) وعن ضمرة بن ثعلبة رضي الله عنه قال : قال رسول الله لا يزال الناس بخير |
| AVOID | hasad | ACCEPTED | ٢٨٨٨ - (٤) وعن [ ابن ] (١) الزبير رضي الله عنه ؛ أنَّ رسول الله صلى الله عليه وس |
| AVOID | hijran | ACCEPTED | ٢٧٦٣ - (۹) وعن جابر رضي الله عنه قال : سمعت النبي صلى الله عليه وسلم يقول : إن ا |
| AVOID | hijran | ACCEPTED | ٢٧٦٠ - (٦) وعن ابن عباس رضي الله عنهما قال : قال رسول الله عنهما قال : قال رسول  |
| AVOID | hijran | ACCEPTED | ٢٧٦٢ - (٨) وعن أبي حراش حدرد بن أبي حدرد الأسلمي رضي الله عنه ؛ أنَّه صحيح سمع ا |
| AVOID | hijran | ACCEPTED | ٢٧٦١ - (٧) وعن فضالة بن عبيد رضي يد رضي الله عنه ؛ أن رسول الله صلى الله عليه وس |
| AVOID | intihar | ACCEPTED | ۲۷۹۰ - (۱۳) وعن ثابت بن الصَّحاكِ رضي الله عنه قال : قال رسول الله صلى الله عليه |
| AVOID | kadhib | ACCEPTED | ٢٢٤٥ - (٦) وعن عبد الله بن حباب عن أبيه رضي الله عنه قال : كنا قُعوداً على باب ا |
| AVOID | kadhib | ACCEPTED | ٢٢٤٤ - (٥) وعن النعمان بن بشير رضي الله عنهما قال : خرج علينا رسولُ الله الله ون |
| AVOID | kadhib | ACCEPTED | ٢٢٤٦ - (۷) وعن أبي سعيد الخدري رضي الله عنه عن النبي صلى الله عليه وسلم قال : يك |
| AVOID | sabb-lan | ACCEPTED | ۲۷۸۸ - (۱۱) وعن جُرمُود الجهني رضي ) عنه قال : قلت : يا رسول الله ! أوصني ؟ قال  |
| AVOID | sabb-lan | ACCEPTED | ٢٧٩٤ - (١٧) وعن عمران بن حصين رضي . بينما رسول الله صلى الله عليه وسلم في بعض أس |
| AVOID | sabb-lan | ACCEPTED | ٢٦٣٥ - (١١) وعن أنس رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم ما كانَ  |
| AVOID | sabb-lan | ACCEPTED | ٢٧٩٣ - (١٦) وعن عبدالله بن مسعود رضي الله عنه قال : سمعت رسول الله يقول : إن الل |
| AVOID | sabb-lan | ACCEPTED | ٢٧٨٣ - (٦) وعن عبد الله بن عمرو رضي الله عنهما قال : قال رسول الله صلى الله عليه |
| AVOID | sabb-lan | ACCEPTED | ۲۷۸۰ - (۸) وعن عائشة رضي الله عنها قالت : مر النبي بأبي بكر وهو يلْعَنُ بعض رقيق |
| AVOID | sabb-lan | ACCEPTED | ٢٧٩١ - (١٤) وعن سلمة بن الأكوع رضي الله عنه قال : كنا إذا رأينا الرجُلَ يلعن أخا |
| AVOID | sabb-lan | ACCEPTED | ۲۷۹۰ - (۱۳) وعن ثابت بن الصَّحاكِ رضي الله عنه قال : قال رسول الله صلى الله عليه |
| AVOID | sabb-lan | ACCEPTED | ٢٧٨٤ - (۷) وعن أبي هريرة رضي الله عنه ؛ أنَّ رسول الله صلى الله عليه وسلم قال :  |
| AVOID | sabb-lan | ACCEPTED | ۲۷۸۹ - (۱۲) وعن سمرة بن جندب رضي لا تلاعنوا بلعنة الله ، ولا بغضبه ، ولا بالنار  |
| AVOID | sabb-lan | ACCEPTED | ٢٧٨٦ - (۹) وعن أبي الدرداء رضي الله عنه قال : قال رسول الله الله لا يكون اللعانو |
| AVOID | yamin-ghamus | ACCEPTED | ۲۷۹۰ - (۱۳) وعن ثابت بن الصَّحاكِ رضي الله عنه قال : قال رسول الله صلى الله عليه |
| AVOID | zulm | ACCEPTED | ٢٢٤٩ - (٢) وعن عبد الرحمن بن عبد الله بن مسعود عن أبيه عن رسول الله قال : « مَثَ |
| AVOID | zulm | ACCEPTED | ٢٢٤٦ - (۷) وعن أبي سعيد الخدري رضي الله عنه عن النبي صلى الله عليه وسلم قال : يك |
| AVOID | zulm | ACCEPTED | ٢٢٤٤ - (٥) وعن النعمان بن بشير رضي الله عنهما قال : خرج علينا رسولُ الله الله ون |
| AVOID | zulm | ACCEPTED | ٢٢٤٨ - (١) عن ابن عمر رضي الله عنهما قال : سمعت رسول الله يقول : مَنْ حالت شفاعَ |
| AVOID | zulm-raiyya | ACCEPTED | ۲۱۷۹ - (۱۱) وعن أبي هريرة أيضاً ؛ أن رسول الله صلى الله عليه وسلم قال : ويل للأم |
| AVOID | zulm-raiyya | ACCEPTED | ٢١٧٤ - (٦) وعن أبي هريرة رضي الله عنه قال شريك : لا أدري رفعه أم لا - قال : الإم |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤٧ - (٨) وعن علقمة بن أبي وقاص الليثي : أنّه مرَّ برجل مِنْ أهل المدينةِ له شَ |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤٠ - (١) عن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : مَ |
| AVOID | zulm-raiyya | ACCEPTED | ٢١٧٥ - (۷) وعن أبي أمامة رضي الله عنه عن النبي صلى الله عليه وسلم ؛ أنه قال : ما |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤٣ - (٤) ورواه الترمذي والنسائي من حديث كعب بن عجرة قال : قال رسول الله صلى ال |
| AVOID | zulm-raiyya | ACCEPTED | ٢١٧٦ - (۸) وعن أبي ذر رضي الله عنه قال : قلت : يا رسول الله ! ألا تَسْتعْمِلني ق |
| AVOID | zulm-raiyya | ACCEPTED | ۲۱۸۱ - (۱۳) وعن عبد الرحمن بن سمرة رضي الله عنه قال : قال لي رسولُ الله : يا عبد |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤٦ - (۷) وعن أبي سعيد الخدري رضي الله عنه عن النبي صلى الله عليه وسلم قال : يك |
| AVOID | zulm-raiyya | ACCEPTED | ۲۱۷۸ - (۱۰) وعن أبي هريرة رضي الله عنه ؛ أنَّ رسول الله صلى الله عليه وسلم قال : |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤١ - (۲) وعنِ ابْنِ عَبَّاس رضي الله عنهما قال : قال رسول الله مَن بَدا جَفا ، |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤٢ - (۳) وعن جابر بن عبد الله أن النبي صلى الله عليه وسلم قال لكعب بن عجرة : أ |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤٤ - (٥) وعن النعمان بن بشير رضي الله عنهما قال : خرج علينا رسولُ الله الله ون |
| AVOID | zulm-raiyya | ACCEPTED | ٢٢٤٥ - (٦) وعن عبد الله بن حباب عن أبيه رضي الله عنه قال : كنا قُعوداً على باب ا |
| DO | adab-taam | ACCEPTED | ٢١٦٨ - (۳) وعن ابن عباس رضي الله عنهما ؛ أنَّ النبي صلى الله عليه وسلم قال : مَن |
| DO | adab-taam | ACCEPTED | ٢١٦٧ - (۲) ورواه ابن ماجه أيضاً عن فاطمة رضي الله عنها بنحوه . ( الغَمَرُ ) بفتح |
| DO | adab-taam | ACCEPTED | ٢١٦٦ - (١) وعن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : م |
| DO | adl | ACCEPTED | ٢٢٤٨ - (١) عن ابن عمر رضي الله عنهما قال : سمعت رسول الله يقول : مَنْ حالت شفاعَ |
| DO | dhikr | ACCEPTED | ۲۲۳۹ - (۳) وعن أبي مَجْلَز - واسمه لاحق بن حميد ـ قال : مَنْ خَافَ مِنْ أميرِ ظُ |
| DO | dhikr | ACCEPTED | ٣٤٩١ - (٣) وعن أبي موسى رضي الله عنه ؛ أن رسول الله صلى الله عليه وسلم قال : « إ |
| DO | dhikr-akhira | ACCEPTED | ٣٤٨٧ - (٤) وعن عبادة بن الصامت رضي الله عنه ؛ أن النبي صلى الله عليه وسلم قال :  |
| DO | dhikr-akhira | ACCEPTED | ٣٤٨٦ - (٣) وعن أبي هريرة رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم يعن |
| DO | dhikr-akhira | ACCEPTED | ٣٤٨٥ - (٢) وعن أنس رضي الله عنه قال : قال رسول الله « مَنْ أَحَبَّ لِقاءَ الله أ |
| DO | dhikr-akhira | ACCEPTED | إِنَّ ٱلَّذِينَ كَفَرُوا۟ لَوْ أَنَّ لَهُم مَّا فِى ٱلْأَرْضِ جَمِيعًا وَمِثْلَه |
| DO | dhikr-akhira | ACCEPTED | ٣٤٨٨ - (٥) وعن فضالة بن عبيد رضي الله عنه ؛ أنَّ رسول الله صلى الله عليه وسلم قا |
| DO | hajj | ACCEPTED | وَأَذِّن فِى ٱلنَّاسِ بِٱلْحَجِّ يَأْتُوكَ رِجَالًا وَعَلَىٰ كُلِّ ضَامِرٍ يَأْت |
| DO | haqq-jar | ACCEPTED | ٣٠١٥ - (٦) وعن عبدالله بن عمرو رضي - الله عنهما قال : قال رسول الله خيرُ الأصحاب |
| DO | haya | ACCEPTED | ٢٦٣٦ - (١٢) وعن ابن عمر رضي الله عنهما قال : قال رسول الله صلى الله عليه وسلم :  |
| DO | haya | ACCEPTED | ٢٦٣٢ - (٨) وعن زيد بن طلحة بن ركانة يرفعه ؛ قال : قال رسول الله « إِنَّ لِكُلِّ  |
| DO | haya | ACCEPTED | ٢٦٣٨ - (١٤) وعن عبد الله . بن مسعود رضي الله عنه قال : قال رسول الله استحيوا من  |
| DO | haya | ACCEPTED | ٢٦٣٥ - (١١) وعن أنس رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم ما كانَ  |
| DO | hifz-al-lisan | ACCEPTED | ٢٢٤٧ - (٨) وعن علقمة بن أبي وقاص الليثي : أنّه مرَّ برجل مِنْ أهل المدينةِ له شَ |
| DO | hubb-fillah | ACCEPTED | ٣٠١٥ - (٦) وعن عبدالله بن عمرو رضي - الله عنهما قال : قال رسول الله خيرُ الأصحاب |
| DO | hubb-fillah | ACCEPTED | ٣٠١٤ - (٥) وعن أنس بن مالك رضي الله عنه قال : قال رسول الله صلى الله عليه وسلم : |
| DO | ikhlas | ACCEPTED | ٢٢٥٠ - (١) عن رجل من أهل المدينة قال : كتب معاوية إلى عائشةَ : أَنِ اكْتُبي إليَ |
| DO | sabr | ACCEPTED | ٣٤٩١ - (٣) وعن أبي موسى رضي الله عنه ؛ أن رسول الله صلى الله عليه وسلم قال : « إ |
| DO | salamat-sadr | ACCEPTED | ۲۸۸۹ - (٥) وعن عبد الله بن عمرو رضي الله عنهما قال : قيل : يا رسول الله ! أَيُّ  |
| DO | sidq | ACCEPTED | ۲۸۸۹ - (٥) وعن عبد الله بن عمرو رضي الله عنهما قال : قيل : يا رسول الله ! أَيُّ  |
| DO | tawhid | ACCEPTED | ۲۲۳۹ - (۳) وعن أبي مَجْلَز - واسمه لاحق بن حميد ـ قال : مَنْ خَافَ مِنْ أميرِ ظُ |

### Low-confidence ITEM texts (not linked)

| quoteId | section | reason |
| --- | --- | --- |
| bf7465ed-abfc-4a1d-924c-05ff719b7977 | الترغيب في ا | إحالة «فذكره» بلا متن يُقرأ |
|  | باب في. . . | لا نص حديث أو آية في الباب |
|  | باب في | لا نص حديث أو آية في الباب |

### 20 KEYWORD_PROPOSAL rows (all NOT_REVIEWED)

| side | slug | note | text |
| --- | --- | --- | --- |
| AVOID | tark-as-salah | اقتراح من عنوان الباب: باب ترك الصلاة قبل العيد وبعدها في المصلى ) — صحيح مسلم | وحدثنيه عمرو الناقد حدثنا بن إدريس ح وحدثني أبو بكر بن نافع ومحمد بن بشار جميعا  |
| DO | hajj | اقتراح من عنوان الباب: باب وضع الصبي في الحجر — صحيح البخاري | «وضع صبيا في حجره يحنكه، فبال عليه، فدعا بماء فأتبعه» |
| AVOID | uquq | اقتراح من عنوان الباب: باب: عقوق الوالدين من الكبائر — صحيح البخاري | ذكر رسول الله صلى الله عليه وسلم الكبائر، أو سئل عن الكبائر فقال: " الشرك بالله، |
| DO | jihad | اقتراح من عنوان الباب: باب فضل الشهادة في سبيل الله تعالى ) — صحيح مسلم | ما من نفس تموت لها عند الله خير يسرها أنها ترجع إلى الدنيا ولا أن لها الدنيا وما |
| DO | hajj | اقتراح من عنوان الباب: باب قتل الخوارج والملحدين بعد إقامة الحجة عليهم — صحيح البخاري | «يخرج في هذه الأمة - ولم يقل منها - قوم تحقرون صلاتكم مع صلاتهم، يقرءون القرآن ل |
| DO | dhikr-akhira | اقتراح من عنوان الباب: باب: «الجنة أقرب إلى أحدكم من شراك نعله، والنار مثل ذلك» — صحيح الب | " أصدق بيت قاله الشاعر: [البحر الطويل] ألا كل شيء ما خلا الله باطل " |
| AVOID | tabarruj | اقتراح من عنوان الباب: باب تحريم فعل الواصلة والمستوصلة والواشمة والمستوشمة والنامصة والمت | عن ذلك فلعن الواصلة والمستوصلة |
| AVOID | baghy-fakhr | اقتراح من عنوان الباب: باب قول الله تعالى: {إن الله يأمر بالعدل والإحسان، وإيتاء ذي القربى | «أما الله فقد شفاني، وأما أنا فأكره أن أثير على الناس شرا» قالت: ولبيد بن أعصم،  |
| DO | dhikr-akhira | اقتراح من عنوان الباب: باب ما جاء في صفة الجنة وأنها مخلوقة — صحيح البخاري | بينا نحن عند رسول الله صلى الله عليه وسلم، إذ قال: " بينا أنا نائم رأيتني في الج |
| DO | ghadd-basar | اقتراح من عنوان الباب: باب حدثنا مسدد قال: حدثنا يزيد بن زريع قال: حدثنا عبد الرحمن، عن سع | حدثنا أحمد بن يونس قال: حدثنا زهير قال: حدثنا كنانة مولى صفية، عن أبي هريرة قال: |
| DO | dhikr-akhira | اقتراح من عنوان الباب: باب قوله: {فلا يخرجنكما من الجنة فتشقى} [طه: 117] — صحيح البخاري | ثُمَّ نُكِسُوا۟ عَلَىٰ رُءُوسِهِمْ لَقَدْ عَلِمْتَ مَا هَـٰٓؤُلَآءِ يَنطِقُونَ |
| AVOID | shirk | اقتراح من عنوان الباب: باب رؤيا أهل السجون والفساد والشرك — صحيح البخاري | «لو لبثت في السجن ما لبث يوسف، ثم أتاني الداعي لأجبته» |
| DO | salam | اقتراح من عنوان الباب: باب فضل السلام — الأدب المفرد | حدثنا عبد العزيز بن عبد الله قال: حدثني محمد بن جعفر بن أبي كثير، عن يعقوب بن زي |
| DO | salat-fi-jamaah | اقتراح من عنوان الباب: باب من جلس في المسجد ينتظر الصلاة وفضل المساجد — صحيح البخاري | سئل أنس بن مالك هل اتخذ رسول الله صلى الله عليه وسلم خاتما؟ فقال: نعم أخر ليلة ص |
| AVOID | mann | اقتراح من عنوان الباب: باب {فما لكم في المنافقين فئتين والله أركسهم بما كسبوا} [النساء: 88 | ۞ فَمَا لَكُمْ فِى ٱلْمُنَـٰفِقِينَ فِئَتَيْنِ وَٱللَّهُ أَرْكَسَهُم بِمَا كَسَب |
| DO | haqq-jar | اقتراح من عنوان الباب: باب شكاية الجار — الأدب المفرد | حدثنا مخلد بن مالك قال: حدثنا أبو زهير عبد الرحمن بن مغراء قال: حدثنا الفضل يعني |
| DO | dhikr-akhira | اقتراح من عنوان الباب: باب: يدخل الجنة سبعون ألفا بغير حساب — صحيح البخاري | " يدخل أهل الجنة الجنة وأهل النار النار، ثم يقوم مؤذن بينهم: يا أهل النار لا موت |
| DO | hajj | اقتراح من عنوان الباب: باب لا يحج البيت مشرك ولا يطوف بالبيت عريان وبيان يوم الحج الأكبر ) | بعثني أبو بكر الصديق في الحجة التي أمره عليها رسول الله صلى الله عليه وسلم قبل ح |
| DO | hajj | اقتراح من عنوان الباب: باب الحجامة والقيء للصائم — صحيح البخاري | سئل أنس بن مالك رضي الله عنه: أكنتم تكرهون الحجامة للصائم؟ قال: «لا، إلا من أجل  |
| DO | sadaqah | اقتراح من عنوان الباب: باب فضل النفقة والصدقة على الأقربين والزوج والأولاد والوالدين ولو ك | فذكرت ذلك لرسول الله صلى الله عليه وسلم فقال لو أعطيتها أخوالك كان أعظم لأجرك |

## Checks run for the catalog phase

Backend `tsc --noEmit`: exit 0. `oxlint --type-aware src/ test/`: exit 0, with the existing unbound-method warnings. Unit tests: 49 files, 415 passed. Frontend `tsc --noEmit` and `eslint .`: exit 0. E2e: 16 files, 256 passed, against `thekra_test`.

Structure re-run, every book `createdSections=0 createdItems=0`. Leftovers unchanged: kabair 131, minhaj 86, zuhd 17, shuab 2, bukhari 1.

Screenshots at 1440×900 and 390×900 are in `docs/design/after/` for `/sins`, `/sins/ghibah`, `/good-deeds`, `/good-deeds/silat-ar-rahim`, and `/sins/waqt-tawasul`.

`frontend/Thmanyah-Font-Family (1)/دليل جماليات خط ثمانية.pdf` is tracked (18,682,772 bytes). It was left in place.

## Prayer audit

Batch from `docs/taxonomy/CURSOR_FIX_LINKS_PRAYER.md` (steps 1–5). Counts from the live DB after each importer run.

### Counts before / after

| Step | What | Before | After / written |
| --- | --- | ---: | ---: |
| 1 | Ibn Rajab whole-book links (`من كتاب ` + `REVIEWER_SECTION`) | 1465 | 0 (deletedSin 9, deletedDeed 1456). Second `import:book ibn-rajab`: linked 0 |
| 2 | Taxonomy re-apply (adab-salah + content-map) | — | topics created 1; links created 96, updated 100, deleted 88. Second `import:taxonomy`: 0/0/0 |
| 3 | Sahihayn CHAPTER map (batch 1, 21 chapters) | proposals 1315 | links created 32, updated 18 (KEYWORD→CHAPTER); proposals 1308. Reviewer CHAPTER links now 50. Second run: 0/0/0 |
| 4 | Paired pages | — | no link writes (UI + `pair` on API). Second taxonomy: 0/0/0 |
| 4b | Wrong surah names (`surahNameAr='الناس'` AND `surahNumber<>114`) | 1852 | 0. Quran import: created 0 updated 1853 unchanged 4383. Second run: 0/0/6236. Spot-check 4:102 → «النساء» / An-Nisa |
| 4c | AYAH links from al-Kabair «فصل» under a kabira | 23 | 0 remaining. Taxonomy: deleted 20 (3 already absent from desired set). Second run: 0/0/0. Hadith under those فصل kept |
| 4d | Export `docs/taxonomy/ayah-review.tsv` | — | 491 rows (zuhd / minhaj / munajjid; AUTHOR_CITATION + REVIEWER_SECTION). No public data change |

Muslim 82 TAKHRIJ to `salat-fi-jamaah` came from a false HadithMatch (Riyad «باب فضل الصف الأول…» quote matched Muslim 82). Match deleted; link no longer recreates.

**STOP note (step 3 verify):** Muslim 668 (`مثل الصلوات الخمس كمثل نهر…`) lives under BookSection `025675c4-2de4-4c84-8137-6eab37f4e919` («باب المشي إلى الصلاة تمحى به الخطايا…»), which is **not** in `sahihayn-map.yaml`. Bukhari 527/528/553 and Muslim 82 are public CHAPTER links as expected. Muslim 668 stays without a public link until the reviewer adds that chapter.

### Prayer pair (`tark-as-salah` ↔ `salah`, title «الصلاة»)

Public pair tabs on the page (deduped; SAHIH/HASAN public filter), after steps 4b–4c:

| Tab | Count |
| --- | ---: |
| الكل | 78 |
| الآيات | 32 |
| الأحاديث | 46 |

ACCEPTED rows in DB (all grades, before public filter), after 4c verse removals:

| Part | Total | QURAN_VERSE | HADITH | BOOK_EXCERPT |
| --- | ---: | ---: | ---: | ---: |
| ما جاء في التحذير (AVOID) | 93 | 18 | 72 | 3 |
| الفضل والثواب (DO) | 171 | 14 | 157 | 0 |

#### Public Sahihayn hadith on the pair (book + number)

| Book | Number | Text (first ~90 chars) |
| --- | ---: | --- |
| صحيح البخاري | 521 | قرأت على مالك، عن ابن شهاب أن عمر بن عبد العزيز أخر الصلاة يوما فدخل عليه عروة ب |
| صحيح البخاري | 522 | كان يصلي العصر، والشمس في حجرتها قبل أن تظهر» |
| صحيح البخاري | 525 | كنا جلوسا عند عمر رضي الله عنه، فقال: أيكم يحفظ قول رسول الله صلى الله عليه وسلم |
| صحيح البخاري | 526 | الرجل: يا رسول الله ألي هذا؟ قال: «لجميع أمتي كلهم» |
| صحيح البخاري | 527 | أي العمل أحب إلى الله؟ قال: «الصلاة على وقتها»، قال: ثم أي؟ قال: «ثم بر الوالدين |
| صحيح البخاري | 528 | " أرأيتم لو أن نهرا بباب أحدكم يغتسل فيه كل يوم خمسا، ما تقول: ذلك يبقي من درنه  |
| صحيح البخاري | 529 | " ما أعرف شيئا مما كان على عهد النبي صلى الله عليه وسلم، قيل: الصلاة؟ قال: أليس  |
| صحيح البخاري | 530 | دخلت على أنس بن مالك بدمشق وهو يبكي، فقلت: ما يبكيك؟ فقال: «لا أعرف شيئا مما أدر |
| صحيح البخاري | 552 | «الذي تفوته صلاة العصر، كأنما وتر أهله وماله» قال أبو عبد الله: {يتركم} [محمد: 3 |
| صحيح البخاري | 553 | «من ترك صلاة العصر فقد حبط عمله» |
| صحيح البخاري | 554 | كنا عند النبي صلى الله عليه وسلم، فنظر إلى القمر ليلة - يعني البدر - فقال: «إنكم |
| صحيح البخاري | 555 | " يتعاقبون فيكم ملائكة بالليل وملائكة بالنهار، ويجتمعون في صلاة الفجر وصلاة العص |
| صحيح البخاري | 573 | لي جرير بن عبد الله: كنا عند النبي صلى الله عليه وسلم إذ نظر إلى القمر ليلة البد |
| صحيح البخاري | 574 | «من صلى البردين دخل الجنة»، وقال ابن رجاء، حدثنا همام، عن أبي جمرة، أن أبا بكر ب |
| صحيح البخاري | 614 | " من قال حين يسمع النداء: اللهم رب هذه الدعوة التامة، والصلاة القائمة آت محمدا ا |
| صحيح البخاري | 2689 | «لو يعلم الناس ما في النداء والصف الأول، ثم لم يجدوا إلا أن يستهموا عليه لاستهمو |
| صحيح البخاري | 7548 | له: إني أراك تحب الغنم والبادية، فإذا كنت في غنمك أو باديتك فأذنت للصلاة، فارفع  |
| صحيح مسلم | 81 | إذا قرأ بن آدم السجدة فسجد اعتزل الشيطان يبكي يقول يا ويله وفي رواية أبي كريب يا |
| صحيح مسلم | 82 | إن بين الرجل وبين الشرك والكفر ترك الصلاة |
| صحيح مسلم | 85 | حدثنا محمد بن بشار حدثنا محمد بن جعفر حدثنا شعبة * بهذا الإسناد مثله وزاد وأشار  |
| صحيح مسلم | 227 | لا يتوضأ رجل مسلم فيحسن الوضوء فيصلي صلاة إلا غفر الله له ما بينه وبين الصلاة ال |
| صحيح مسلم | 228 | ما من امرئ مسلم تحضره صلاة مكتوبة فيحسن وضوءها وخشوعها وركوعها إلا كانت كفارة لم |
| صحيح مسلم | 229 | أحاديث لا أدري ما هي إلا أني رأيت رسول الله صلى الله عليه وسلم توضأ مثل وضوئي هذ |
| صحيح مسلم | 230 | وا حدثنا وكيع عن سفيان عن أبي النضر عن أبي أنس أن عثمان توضأ بالمقاعد فقال ألا أ |
| صحيح مسلم | 231 | أبو كريب حدثنا وكيع عن مسعر عن جامعبن شداد أبي صخرة قال سمعت حمران بن أبان قال ك |
| صحيح مسلم | 232 | من توضأ للصلاة فأسبغ الوضوء ثم مشى إلى الصلاة المكتوبة فصلاها مع الناس أو مع الج |
| صحيح مسلم | 233 | الصلاة الخمس والجمعة إلى الجمعة كفارة لما بينهن ما لم تغش الكبائر |
| صحيح مسلم | 384 | إذا سمعتم المؤذن فقولوا مثل ما يقول ثم صلوا علي فإنه من صلى علي صلاة صلى الله عل |
| صحيح مسلم | 385 | أشهد أن محمدا رسول الله ثم قال حي على الصلاة قال لا حول ولا قوة إلا بالله ثم قال |
| صحيح مسلم | 387 | المؤذنون أطول الناس أعناقا يوم القيامة |
| صحيح مسلم | 437 | لو يعلم الناس ما في النداء والصف الأول ثم لم يجدوا إلا أن يستهموا عليه لاستهموا  |
| صحيح مسلم | 482 | أقرب ما يكون العبد من ربه وهو ساجد فأكثروا الدعاء |
| صحيح مسلم | 626 | من فاتته العصر فكأنما وتر أهله وماله |
| صحيح مسلم | 627 | يوم الأحزاب وهو قاعد على فرضه من فرض الخندق شغلونا عن الصلاة الوسطى حتى غربت الش |
| صحيح مسلم | 632 | يتعاقبون فيكم ملائكة بالليل وملائكة بالنهار ويجتمعون في صلاة الفجر وصلاة العصر ث |
| صحيح مسلم | 633 | كنا جلوسا عند رسول الله صلى الله عليه وسلم إذ نظر إلى القمر ليلة البدر فقال أما  |
| صحيح مسلم | 634 | نعم قال الرجل وأنا أشهد أني سمعته من رسول الله صلى الله عليه وسلم سمعته أذناي وو |
| صحيح مسلم | 635 | من صلى البردين دخل الجنة |
| صحيح مسلم | 635 | حدثنا بن أبي عمر حدثنا بشر بن السري ح قال وحدثنا بن خراش حدثنا عمرو بن عاصم قالا |
| صحيح مسلم | 648 | كما سألتني فضرب فخذي كما ضربت فخذك وقال صل الصلاة لوقتها فإن أدركتك الصلاة معهم  |
| صحيح مسلم | 652 | لقوم يتخلفون عن الجمعة لقد هممت أن آمر رجلا يصلي بالناس ثم أحرق على رجال يتخلفون |
| صحيح مسلم | 653 | أن يرخص له فيصلي في بيته فرخص له فلما ولى دعاه فقال هل تسمع النداء بالصلاة فقال  |
| صحيح مسلم | 657 | من صلى صلاة الصبح فهو في ذمة الله فلا يطلبنكم الله من ذمته بشيء فإنه من يطلبه من |
| صحيح مسلم | 667 | أرأيتم لو أن نهرا بباب أحدكم يغتسل منه كل يوم خمس مرات هل يبقى من درنه شيء قالوا |
| صحيح مسلم | 865 | على أعواد منبره لينتهين أقوام عن ودعهم الجمعات أو ليختمن الله على قلوبهم ثم ليكو |

### 20 random step-3 REVIEWER CHAPTER links

| Topic | Bab | Text (first 80 chars) |
| --- | --- | --- |
| salah | باب مواقيت الصلاة وفضلها " | كان يصلي العصر، والشمس في حجرتها قبل أن تظهر» |
| salah | باب فضل الوضوء والصلاة عقبه ) | أبو كريب حدثنا وكيع عن مسعر عن جامعبن شداد أبي صخرة قال سمعت حمران بن أبان قال ك |
| salah | باب مواقيت الصلاة وفضلها " | قرأت على مالك، عن ابن شهاب أن عمر بن عبد العزيز أخر الصلاة يوما فدخل عليه عروة ب |
| salah | باب فضل الوضوء والصلاة عقبه ) | من توضأ للصلاة فأسبغ الوضوء ثم مشى إلى الصلاة المكتوبة فصلاها مع الناس أو مع الج |
| salah | باب فضل صلاة الفجر | «من صلى البردين دخل الجنة»، وقال ابن رجاء، حدثنا همام، عن أبي جمرة، أن أبا بكر ب |
| salah | باب: الصلوات الخمس كفارة | " أرأيتم لو أن نهرا بباب أحدكم يغتسل فيه كل يوم خمسا، ما تقول: ذلك يبقي من درنه  |
| tark-as-salah | باب من ترك العصر | «من ترك صلاة العصر فقد حبط عمله» |
| salah | باب فضل صلاتي الصبح والعصر والمحافظة عليهما ) | نعم قال الرجل وأنا أشهد أني سمعته من رسول الله صلى الله عليه وسلم سمعته أذناي وو |
| tark-as-salah | باب التغليظ في تفويت صلاة العصر ) | من فاتته العصر فكأنما وتر أهله وماله |
| salah | باب فضل صلاتي الصبح والعصر والمحافظة عليهما ) | كنا جلوسا عند رسول الله صلى الله عليه وسلم إذ نظر إلى القمر ليلة البدر فقال أما  |
| salat-fi-jamaah | باب من جلس في المسجد ينتظر الصلاة وفضل المساجد | " سبعة يظلهم الله في ظله، يوم لا ظل إلا ظله: الإمام العادل، وشاب نشأ في عبادة رب |
| tark-as-salah | باب بيان إطلاق اسم الكفر على من ترك الصلاة ) | إن بين الرجل وبين الشرك والكفر ترك الصلاة |
| salah | باب فضل الوضوء والصلاة عقبه ) | ما من امرئ مسلم تحضره صلاة مكتوبة فيحسن وضوءها وخشوعها وركوعها إلا كانت كفارة لم |
| tahara | باب فضل الوضوء والصلاة عقبه ) | وا حدثنا وكيع عن سفيان عن أبي النضر عن أبي أنس أن عثمان توضأ بالمقاعد فقال ألا أ |
| salat-fi-jamaah | باب فضل الجلوس في مصلاه بعد الصبح وفضل المساجد ) | أحب البلاد إلى الله مساجدها وأبغض البلاد إلى الله أسواقها |
| tark-as-salah | باب تضييع الصلاة عن وقتها | دخلت على أنس بن مالك بدمشق وهو يبكي، فقلت: ما يبكيك؟ فقال: «لا أعرف شيئا مما أدر |
| salah | باب فضل الوضوء والصلاة عقبه ) | وا حدثنا وكيع عن سفيان عن أبي النضر عن أبي أنس أن عثمان توضأ بالمقاعد فقال ألا أ |
| salat-fi-jamaah | باب من جلس في المسجد ينتظر الصلاة وفضل المساجد | سئل أنس بن مالك هل اتخذ رسول الله صلى الله عليه وسلم خاتما؟ فقال: نعم أخر ليلة ص |
| salat-fi-jamaah | باب فضل صلاة العشاء والصبح في جماعة ) | من صلى العشاء في جماعة فكأنما قام نصف الليل ومن صلى الصبح في جماعة فكأنما صلى ال |
| salat-fi-jamaah | باب فضل الجلوس في مصلاه بعد الصبح وفضل المساجد ) | نعم كثيرا كان لا يقوم من مصلاه الذي يصلي فيه الصبح أو الغداة حتى تطلع الشمس فإذا |

### Screenshots

Refreshed after steps 4b–4d into `docs/design/after/topics/` (1440×900 and 390×844, light + dark):

- `tark-as-salah-1440-light.png` / `tark-as-salah-1440-dark.png`
- `tark-as-salah-390-light.png` / `tark-as-salah-390-dark.png`
- `salah-1440-light.png` / `salah-1440-dark.png`
- `salah-390-light.png` / `salah-390-dark.png`

Both URLs open the paired page titled «الصلاة»; `/sins/tark-as-salah` opens on «ما جاء في التحذير», `/good-deeds/salah` on «الفضل والثواب». Kabira badge remains on the sin entry path.

### Steps 4b–4d (follow-up)

- **4b:** Importer `same` check now includes `surahName` / `surahNameAr`; chapters loaded from Quran.com `?language=ar` and `?language=en`.
- **4c:** `skipKabairFaslAyah` in `taxonomy/links.ts` — AYAH under `kabair` + `FASL` are not planned; existing ACCEPTED links removed on re-apply.
- **4d:** Reviewer file `docs/taxonomy/ayah-review.tsv` (linkId, side, topic, verse key/name/snippet, book, section, opening vs after first hadith). Await decisions; do not edit these links until then.

## Verse decisions

`docs/taxonomy/ayah-review-decisions.tsv`: 491 rows, 250 keep and 241 drop. A keep stays ACCEPTED; `classifiedBy` is REVIEWER and the basis is unchanged (245 AUTHOR_CITATION, 5 REVIEWER_SECTION). A drop is deleted. The importer reads `docs/taxonomy/ayah-dropped.tsv` (241 rows: linkId, sectionId, side, topic, verse, quoteId) and will not plan that topic and verse again.

Accepted verses on the sixteen topics, before the write and after it:

| Topic | Before | After |
| --- | ---: | ---: |
| sabr | 117 | 61 |
| muraqaba | 115 | 64 |
| khawf-raja | 125 | 82 |
| shukr | 64 | 39 |
| tawakkul | 51 | 39 |
| muhasaba | 36 | 23 |
| ikhlas | 41 | 32 |
| mahabbat-allah | 55 | 36 |
| wara | 10 | 6 |
| quran | 22 | 18 |
| zakah | 11 | 11 |
| salah | 14 | 12 |
| dhikr | 147 | 147 |
| tawba | 83 | 82 |
| satr-muslim | 3 | 2 |
| dua | 19 | 18 |

The drops on these topics sum to 241. Zakah and dhikr had none.

First `import:book taxonomy` after the filter: `ayah review: keep=250 drop=241`. Link sync `created=384 updated=600 deleted=566` (topics 0). The 241 deletes are the dropped verses; the rest of that sync is the importer matching the current desired set (takhrij and chapter rows that had drifted). The 245 AUTHOR_CITATION keeps were updated to `classifiedBy = REVIEWER`.

Second `import:book taxonomy`:

```
taxonomy write: created=0 updated=0 deleted=0
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=0 updated=0 deleted=0
```

Verse counts on the second run were unchanged.

## Ibn Abi al-Dunya + HadeethEnc maps

Two reviewer maps applied by `pnpm import:taxonomy`:

- `backend/prisma/taxonomy/ibn-abi-dunya-map.yaml` (131 chapters across 16 works): every HADITH item (athar included — they are stored as HADITH items) under a listed chapter is linked to each listed topic, ACCEPTED, basis CHAPTER, classifiedBy REVIEWER, note «من باب: \<title\> — \<Source.nameAr\>». Takhrij propagation to the Sahihayn runs as for the other chapter maps. Publishing stays governed by GradePolicy (hadith need an accepted grade; athar need a reviewer keep).
- `docs/taxonomy/hadeethenc-map.tsv` (1454 rows; 1397 high / 57 low): the 175 high-confidence rows with topics were applied — each matching Quote (`apiProvider = hadeethenc.com`, `externalId` = HadeethEnc id; all 175 found) linked ACCEPTED, basis REVIEWER_SECTION, classifiedBy REVIEWER, note «تصنيف المراجع — موسوعة الأحاديث النبوية». Low/empty rows produce no link. The ayah exclusion list (`docs/taxonomy/ayah-dropped.tsv`) is unchanged.

First run:

```
taxonomy write: created=2998 updated=3 deleted=0
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=2998 updated=3 deleted=0
```

Second run:

```
taxonomy write: created=0 updated=0 deleted=0
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=0 updated=0 deleted=0
```

### Links created per source

All counts were 0 before the run. The 3 updates were pre-existing Sahihayn TAKHRIJ links re-attributed to a reviewer chapter (REVIEWER beats BOOK at equal basis).

| Source | Links |
| --- | ---: |
| العيال | 530 |
| الصمت وآداب اللسان | 493 |
| الإخوان | 324 |
| صفة الجنة | 270 |
| مداراة الناس | 203 |
| اصطناع المعروف | 143 |
| محاسبة النفس | 128 |
| قصر الأمل | 114 |
| الورع | 113 |
| ذم الغيبة والنميمة | 109 |
| القبور | 101 |
| قضاء الحوائج | 94 |
| ذم الملاهي | 75 |
| المحتضرين | 52 |
| القناعة | 21 |
| صفة النار | 16 |
| **Ibn Abi al-Dunya (chapter links)** | **2786** |
| موسوعة الأحاديث النبوية (hadeethenc.com, item links) | 175 |
| Takhrij propagated to the Sahihayn from these chapters | 40 |
| **Total** | **3001** |

### Public items gained — top 15 topics

From `GET /v1/{sins|good-deeds}/<slug>/quotes?limit=1&lang=ar` → `meta.countsByKind`, before vs after (API rebuilt and restarted). Across all 90 affected topics the public gain is +360 items.

| Topic | Side | All | Verse | Hadith | Athar | Gain |
| --- | --- | --- | --- | --- | --- | ---: |
| kadhib | sins | 34→64 | 10→10 | 24→43 | 0→11 | +30 |
| husn-khuluq | good-deeds | 48→71 | 6→6 | 42→61 | 0→4 | +23 |
| hubb-fillah | good-deeds | 55→76 | 17→17 | 36→41 | 2→18 | +21 |
| dua | good-deeds | 93→112 | 18→18 | 75→94 | 0→0 | +19 |
| husn-ishra | good-deeds | 28→42 | 6→6 | 22→36 | 0→0 | +14 |
| nafaqa-ahl | good-deeds | 34→47 | 10→10 | 24→34 | 0→3 | +13 |
| hifz-al-lisan | good-deeds | 37→50 | 8→8 | 27→31 | 2→11 | +13 |
| kalam-tayyib | good-deeds | 27→37 | 10→10 | 17→25 | 0→2 | +10 |
| idaat-al-waqt | sins | 7→17 | 1→1 | 6→6 | 0→10 | +10 |
| nawafil | good-deeds | 140→149 | 15→15 | 125→134 | 0→0 | +9 |
| muhasaba | good-deeds | 23→32 | 23→23 | 0→0 | 0→9 | +9 |
| khamr | sins | 39→48 | 12→12 | 27→36 | 0→0 | +9 |
| dhikr | good-deeds | 310→319 | 147→147 | 120→129 | 43→43 | +9 |
| sadaqah | good-deeds | 153→161 | 27→27 | 126→131 | 0→3 | +8 |
| sabr | good-deeds | 149→157 | 61→61 | 88→94 | 0→2 | +8 |

## Adhkar + Sahihayn hadith-level maps

The conservative Adhkar map contains 194 BAB/FASL sections with HADITH items across 18 topics. Titles and IDs match the section inventory; YAML parsing, uniqueness, allowed slugs, and positive hadith counts were checked. The notes include topic counts, a reproducible random sample of 25 mappings, and every skipped section with its reason. Only 566 high-confidence Sahihayn rows are executable; low/blank rows create no links. Topic links use REVIEWER_SECTION / REVIEWER / ACCEPTED, and ImanBranchQuote supports and uses the same values. Adhkar chapter links use CHAPTER / REVIEWER / ACCEPTED, with the requested Arabic note and existing TAKHRIJ propagation. The existing ayah review/exclusions and post-link theme computation remain in place.

### Verification

`pnpm exec tsc --noEmit -p tsconfig.json` passed. `pnpm lint` passed with 29 existing warnings and no errors. `pnpm test` passed: 73 files, 598 tests. `pnpm test:e2e` passed: 18 files, 282 tests. `pnpm build` passed; the API was restarted with `node --env-file=.env --enable-source-maps dist/main`, then public endpoint counts were fetched successfully. No GradePolicy, frontend, schema, or other importer changes were made. No commit or push. The working tree was clean at inspection; no unrelated concurrent edits were observed in the final status.

First write:

```text
taxonomy write: created=1388 updated=154 deleted=0
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=1368 updated=43 deleted=0
taxonomy themes write: themes=325 updated=111 tagged=9642/18114 links
taxonomy hadith branches write: created=20 updated=0 deleted=0
```

Second write:

```text
taxonomy write: created=0 updated=0 deleted=0
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=0 updated=0 deleted=0
taxonomy themes write: themes=325 updated=0 tagged=9642/18114 links
taxonomy hadith branches write: created=0 updated=0 deleted=0
```

### Links created per map source

Measured by comparing link IDs before the first run and after the second, grouped by the stored attribution note. These are newly inserted links, not all planned mappings; existing links can win deduplication or be updated. Total topic links rose from 16,748 to 18,116. Branch links rose from 10,971 to 10,991.

| Source / route | Created topic links |
| --- | ---: |
| الأذكار — chapter links | 689 |
| الأذكار — TAKHRIJ propagated to the Sahihayn | 40 |
| صحيح البخاري — hadith-level reviewer map | 508 |
| صحيح مسلم — hadith-level reviewer map | 131 |
| **Total** | **1368** |

Branch links created: **20** (12 Bukhari, 8 Muslim); zero branch updates or deletes. The first run also updated 43 existing topic links and 111 theme-key sets. All reported ayah verse counts remained unchanged, including dhikr 147, tawba 82, quran 18, and dua 18.

### Public gain — top 15 topics

Measured directly before import and after API rebuild/restart using `GET http://localhost:3001/v1/{sins|good-deeds}/<slug>/quotes?limit=1&lang=ar` → `meta.countsByKind`. All 151 non-hidden, non-contemporary topics were sampled. Their summed public gain was **+856 topic-items** (not globally unique quotes). Every count below is an observed endpoint value; public visibility still follows the unchanged GradePolicy.

| Topic | Side | All | Verse | Hadith | Athar | Gain |
| --- | --- | --- | --- | --- | --- | ---: |
| dhikr | good-deeds | 324→467 | 147→147 | 130→273 | 47→47 | +143 |
| dua | good-deeds | 113→157 | 18→18 | 95→139 | 0→0 | +44 |
| sadaqah | good-deeds | 161→186 | 27→27 | 131→156 | 3→3 | +25 |
| qatl | sins | 35→56 | 11→11 | 24→45 | 0→0 | +21 |
| tawhid | good-deeds | 26→45 | 0→0 | 26→45 | 0→0 | +19 |
| salam | good-deeds | 51→70 | 5→5 | 46→65 | 0→0 | +19 |
| sabb-lan | sins | 52→70 | 6→6 | 45→63 | 1→1 | +18 |
| nawafil | good-deeds | 149→167 | 15→15 | 134→152 | 0→0 | +18 |
| taat-wulat | good-deeds | 32→48 | 1→1 | 31→47 | 0→0 | +16 |
| khawf-raja | good-deeds | 175→190 | 82→82 | 84→99 | 9→9 | +15 |
| yamin-ghamus | sins | 23→37 | 4→4 | 19→33 | 0→0 | +14 |
| sabr | good-deeds | 162→175 | 61→61 | 96→109 | 5→5 | +13 |
| adab-safar | good-deeds | 31→44 | 5→5 | 26→39 | 0→0 | +13 |
| iyadat-marid | good-deeds | 57→69 | 2→2 | 55→67 | 0→0 | +12 |
| silat-ar-rahim | good-deeds | 48→59 | 12→12 | 36→47 | 0→0 | +11 |

## Riyad duplicate-number fix

**What was wrong.** Numeric Riyad anchors were matched against every BAB with that printed number. In this edition 227 appears twice: «باب فضل صوم يوم عرفة (1) وعاشوراء وتاسوعاء» (كتاب الفضائل) and «باب تحريم الغدر» (كتاب الأمور المنهي عنها). `siyam` anchors `riyad: [217, …, 227, …, 231]`, so the ghadr chapter was linked to fasting. The result was 10 wrong siyam links: 4 CHAPTER, 2 CHAPTER_AYAH and 4 TAKHRIJ copies in the Sahihayn (البخاري 34، 2270؛ مسلم 1736، 1738). The coverage baseline `siyam: 108` had counted that chapter's 2 ayahs and 4 hadiths.

**Fix.** `resolveRiyadNumbers` in `backend/prisma/imports/taxonomy/match.ts` resolves numeric anchors per topic. A number that is unique among BAB rows matches as before. For a repeated number, only the candidate whose `parentPath` (kitab) matches the kitab of the topic's unambiguous numeric anchors can match. If more than one candidate remains, or none does, the anchor matches nothing and the importer prints `taxonomy warning: riyad: topic <slug> anchor <n> is ambiguous…` with the candidate titles. Title anchors are unchanged; ghadr still reaches the chapter through `riyad: ["تحريم الغدر"]`. `EXPECTED_COVERAGE.items.siyam` is now 102. The real data produces no ambiguity warnings. The existing link sync already deletes stale non-MANUAL links, including TAKHRIJ propagation, so it did not need to change. The deleted rows had no theme keys.

First write: the 4 updates are ghadr's CHAPTER notes losing «(باب مشترك)», because the chapter is no longer shared with a DO topic.

```text
taxonomy write: created=0 updated=4 deleted=10
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=0 updated=4 deleted=10
taxonomy themes write: themes=325 updated=0 tagged=9642/18104 links
taxonomy hadith branches write: created=0 updated=0 deleted=0
```

Second write:

```text
taxonomy write: created=0 updated=0 deleted=0
taxonomy topics write: created=0 updated=0 deleted=0
taxonomy links write: created=0 updated=0 deleted=0
taxonomy themes write: themes=325 updated=0 tagged=9642/18104 links
taxonomy hadith branches write: created=0 updated=0 deleted=0
```

| Check | Before | After |
| --- | ---: | ---: |
| siyam `GoodDeedQuote` with note like `%الغدر%` | 10 | 0 |
| ghadr `SinQuote` with note like `%الغدر%` | 30 | 30 |
| siyam `GoodDeedQuote` rows (all statuses) | 329 | 319 |
| siyam API `countsByKind` (all / verse / hadith / athar) | 112 / 10 / 102 / 0 | 102 / 8 / 94 / 0 |

Checks: `pnpm exec tsc --noEmit -p tsconfig.json` passed. `pnpm lint` passed with 29 existing warnings and 0 errors. `pnpm test` passed with 73 files and 601 tests. `pnpm test:e2e` passed with 18 files and 282 tests. `pnpm build` passed, and the API was restarted. No commit or push.
