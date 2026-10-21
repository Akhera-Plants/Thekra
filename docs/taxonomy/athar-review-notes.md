# Athar review notes

Decisions for [athar-review.tsv](athar-review.tsv), applying [athar-review-rubric.md](athar-review-rubric.md).
I made one pass over all 1,172 rows and read every row in full. Where I was unsure, I dropped the row (precision over recall).
Row numbers (#) count data rows from 1, excluding the header, in file order.

## Counts

| | rows |
|---|---|
| keep | 505 |
| drop | 667 |
| total | 1172 |
| keep with `correctedText` (trailing chain / author note / gloss / added saying trimmed) | 27 |
| keep with `correctedAttribution` | 21 (→ SAID 9, → NARRATED 12) |

Every `correctedText` is a verbatim prefix of `atharTextAr`, cut at the end of the speaker's words. Only trailing whitespace was removed, and no word was added or edited.
`correctedAttribution` is filled only where it differs from `attribution`.

## Drops by reason

Each dropped row is counted once, under its main reason.

| reason | rows |
|---|---|
| prophetic (hadith in disguise / hadith wording) | 107 |
| Israʾiliyyat / past prophets & nations | 56 |
| creed-sensitive | 12 |
| fragment / noise (cut-off, mid-dialogue, chain/editor notes, OCR corruption, narrator doubt) | 156 |
| strange / unhelpful (odd natural or unseen claims, tafsir glosses, obscure wording, harsh or misreadable) | 240 |
| fiqh / political | 82 |
| other (wrong speaker: the words belong to someone not on the list) | 14 |
| **total** | **667** |

How some borderline cases were handled:
- **Prophetic:** I dropped a row when its wording matches or closely tracks a known marfuʿ hadith, even when the source gives it as mawquf (e.g. «كفى بالمرء كذبا أن يحدث بكل ما سمع», «الدنيا سجن المؤمن», «وفد الله ثلاثة», «تعس عبد الدينار», «مائة رحمة»). I also dropped rows with «رفعه», «أنبئت/كان يقال» + divine speech, or reports of the Prophet's own household.
- **Israʾiliyyat:** I dropped every story of Adam, Nuh, Ibrahim, Dawud, Sulayman, Yusuf/Yaʿqub, Ayyub, Musa or ʿIsa that goes beyond the Quran, and «في بعض الكتب/في الحكمة مكتوبا». Luqman's sayings were kept only when narrated by al-Hasan and purely moral (rows 456, 702, 809, 862, 1079). The Luqman saying narrated by Qatada (row 331) was dropped.
- **Strange/unhelpful:** this is the largest drop group. It includes thunder or wind as angels, unseen details of Hell and Paradise with sizes and years, single-word tafsir glosses, obscure vocabulary an ordinary reader would not follow, sayings that are easily misread (e.g. «السهو والأمل نعمتان», «الغفلة رحمة»), and generalisations about women or groups.
- **Fragment/noise:** rows starting mid-dialogue («فقال عمر…»), cut-off endings, editor or chain notes inside the text, narrator doubt inside the saying («أو قال…», «شك…»), and OCR corruption («روعه» for «ورعه», «فتنة الضراء» twice). I dropped a row when the problem was not a single trailing fragment.
- **Other:** the frame shows the words belong to someone else. For example «قال أبو بكر» in Ibn Abi al-Dunya is the author himself (rows 31, 350, 556, 1162). Other cases: al-Ahnaf rather than Ibn al-Zubayr, ʿAli b. ʿAbd Allah b. ʿAbbas, ʿAbd al-Rahman b. Zayd b. Aslam, ʿAbd Allah b. ʿUrwa, al-Hajjaj, Kurayb, and probably Hudhayfa al-Marʿashi.

## Example keeps (15)

| # | quoteId | speaker | text (start) | reason |
|---|---|---|---|---|
| 3 | `0097e9d1-d7f7-4ac2-b15c-5c9543482099` | عمر بن عبد العزيز | قال عمر بن عبد العزيز: «تذاكروا نعم الله , فإن ذكرها شكرها | remember Allah's blessings, remembering them is gratitude |
| 14 | `03d1cee0-ed6c-487f-a0b9-6af2c83687c7` | عمر بن الخطاب | قال عمر بن الخطاب: " التؤدة في كل شيء إلا في أمر الآخرة | deliberation except in Hereafter matters |
| 28 | `07c5f35c-f4b0-4a06-a643-c419abb82b0f` | عمر بن الخطاب | قال عمر بن الخطاب رضي الله عنه: «آخ الإخوان على قدر التقوى ولا تجعل حد… | brotherhood based on taqwa |
| 71 | `10527566-0f2e-49be-90b7-9b72bed4b794` | عمر بن الخطاب | قال عمر بن الخطاب لجلسائه: «ما الذي نقيم به وجوهنا عند الله يوم القيام… | ʿUmar: fulfilling obligations and good intention |
| 124 | `1b32f6ca-e5c6-416d-92e2-5a6145665f1f` | علي بن أبي طالب | قال علي بن أبي طالب رضي الله عنه: " ألا إن الصبر من الإيمان بمنزلة الر… | patience is to faith as head to body |
| 206 | `2d4bb52c-ff7a-4b8e-bfee-03afc0ba7ec4` | علي بن أبي طالب | قال علي بن أبي طالب: " إنما أخشى عليكم اثنين: طول الأمل، واتباع الهوى،… | long hope and following desire |
| 408 | `56daf257-da07-4bde-ac2d-2c1d001c9930` | الحسن البصري | عن الحسن رضي الله عنه قال: «اعتبروا الناس بأعمالهم، ودعوا قولهم، فإن ا… | judge people by deeds |
| 1000 | `d8211abd-ec5c-4655-b59c-bfe3f10a177a` | الحسن البصري | عن الحسن قال: " إن المؤمن قوام على نفسه، يحاسب نفسه لله عز وجل، وإنما … | the believer takes account of himself |
| 1034 | `df48d740-1c07-4282-90c8-dd91426ca8fb` | عبد الله بن مسعود | قال عبد الله بن مسعود : ' كونوا ينابيع العلم ، مصابيح الليل ، أحلاس ال… | be springs of knowledge, lamps of the night |
| 1167 | `fec3d069-6a8c-44ec-8823-f55e91e0e877` | أبو موسى الأشعري | قال أبو موسى: " إن هذا القرآن كائن لكم أجرا، وكائن لكم ذخرا، وكائن لكم… | follow the Quran, do not let it pursue you |
| 2 | `0089159c-02bb-46b7-9976-e4811a496232` | أبو ذر الغفاري | قال أبو ذر : ' الصاحب الصالح خير من الوحدة ، والوحدة خير من صاحب السوء… | moral advice on company; trailing «صفحة فارغة» noise trimmed (correctedText) |
| 125 | `1b57f378-90eb-40dc-9a7d-eea889d13521` | أبو ذر الغفاري | قال أبو ذر: " إذا صمت فتحفظ ما استطعت | guard your fast; trailing narrator note on Tulayq trimmed (correctedText) |
| 52 | `0c124ed8-a7ee-4afa-bb7c-aeb7ad59af3a` | عبد الله بن مسعود | عن ابن مسعود قال: «يذهب الصالحون ويبقى أهل الريب» قالوا: يا أبا عبد ال… | people of doubt who do not enjoin good; Ibn Masʿud's own words (correctedAttribution → SAID) |
| 222 | `3021f46b-7475-4b9b-8922-53aa655f7e90` | مجاهد بن جبر | عن مجاهد قال: مررت مع عبد الله بن عمر بخربة فقال: " يا مجاهد، ناده: يا… | ruins: people gone, deeds remain; Mujahid tells what Ibn ʿUmar did (correctedAttribution → NARRATED) |
| 297 | `3ebafa16-48e3-4b21-a1e1-0baea05aae2f` | عروة بن الزبير | عن عروة بن الزبير قال: «لقد تصدقت - يعني عائشة - بسبعين ألفا، وإن درعه… | ʿAʾisha's charity with patched garment; ʿUrwa tells what she did (correctedAttribution → NARRATED) |

## Example drops (15)

| # | quoteId | speaker | text (start) | reason |
|---|---|---|---|---|
| 1 | `0005a2ad-de89-451a-a3a1-b6d414a21742` | الحسن البصري | عن الحسن، قال: «بكى آدم عليه السلام حين أهبط من الجنة ثلاثمائة عام، حت… | I — Adam weeping 300 years (Israʾiliyyat) |
| 74 | `11315c37-7fea-4e1c-a380-499628d90c40` | مجاهد بن جبر | عن مجاهد، قال: " ألقي على الأسد الحمى وهو في سفينة نوح عليه السلام، فم… | I — lion on Noah's ship |
| 16 | `043e9669-7316-4da3-bd57-29072d6d8676` | الحسن البصري | عن الحسن قال: " ما اغرورقت عين بمائها إلا حرم الله جسدها على النار فإن… | P — reward claims match a marfu' hadith wording |
| 66 | `0ecaff00-220e-4a24-93b5-10daec277d64` | عبد الله بن عباس | عن ابن عباس قال: «ما يمنع أحدكم إذا رجع من سوقه، أو من حاجته إلى أهله … | P — ten good deeds per letter is hadith wording |
| 207 | `2d58a033-1d12-4f05-ae4a-9172b997cbc7` | أبو هريرة | عن أبي هريرة قال: " يؤتى بالموت يوم القيامة، فيقال: يا أهل الجنة فيطلع… | P — slaughter of death is hadith wording |
| 26 | `072eeade-18e5-4196-9d13-874a94639c44` | عامر بن عبد قيس | قال عامر بن عبد قيس: " إلهي خلقتني ولم تؤامرني في خلقي وخلقت معي عدوا،… | C — complaining-to-Allah supplication, creed-sensitive |
| 623 | `84693b00-0668-4d35-8a4d-5f1d97968e66` | عبد الله بن عمرو | سمعت عبد الله بن عمرو يقول: " ليس شيء أكرم على الله عز وجل من ابن آدم … | C — creed-sensitive ranking, angels «مجبورون» |
| 19 | `05555730-18d3-4eca-83fb-4d157a831f93` | الحسن البصري | عن الحسن قال : قال عمر بن معمر (۹۱۷) ابن طاووس ( ) . طاووس ( ) . عمر ب… | F — chain/editor notes only |
| 135 | `1cb9b779-1668-4287-b95b-45c67d8dbbcf` | أبو هريرة | فقال أبو هريرة: " بلى والله، حتى الحبارى لتموت في وكرها هزالا لظلم الظ… | F — starts mid-dialogue «فقال... بلى» |
| 534 | `7243b180-8c45-4976-9ed6-d0ba56aa3878` | معاذ بن جبل | قال معاذ: " إنكم قد ابتليتم بفتنة الضراء فصبرتم، وإني أخاف عليكم فتنة … | F — corrupted «فتنة الضراء» twice |
| 10 | `01c2fdbc-8e86-40e6-9430-ebe52ef72258` | عبد الله بن عباس | عن ابن عباس، قال: «الرعد ملك يحدو، يزجر السحاب بالتسبيح والتكبير | S — odd natural claim about thunder |
| 138 | `1ce6cc60-7484-4f87-9783-19e506a3834c` | الحسن البصري | قال الحسن : البرد : النوم . ( إلا حميما وغساقا ) قال الحسن : شرابين في… | S — tafsir glosses and numbers of years |
| 12 | `035e9979-c500-4e91-b031-45a3e9df3b2e` | عبد الله بن مسعود | عن ابن مسعود، قال: " نفقة الرجل على نفسه وأهله، وصديقه وبهيمته له فيها… | Q — fiqh detail on spending on buildings |
| 221 | `3009e4c7-ade9-412b-9f42-1118686c3b9c` | عبد الله بن عباس | قال ابن عباس: قد علمت بما كان معاوية يغلب الناس؛ كان إذا طاروا وقع، وإ… | Q — political remark on Muʿawiya |
| 31 | `08b3491a-af7a-458d-8514-9b7d4afca000` | أبو بكر الصديق | قال أبو بكر: بلغني أن الأحنف بن قيس قيل له: " ما الحلم؟ قال: أن تصبر ع… | O — «أبو بكر» is the author, not the Companion; saying of al-Ahnaf |

## Limits

- This was a single reviewer pass. The calls on what counts as hadith wording are mine, made from memory without checking hadith databases. The `P` drops and the kept sayings that are close to known hadith (e.g. rows 129, 211, 320, 418, 589, 843) are the most useful to spot-check.
- Near-duplicate sayings were all judged on their own and not de-duplicated, because the rubric has no duplicate rule. Several kept pairs are duplicates (e.g. 27/42, 5/20, 52/98, 408/470, 41/605/751/1143).
- Where a fuller version of the same saying exists, I usually kept the clean version and dropped the corrupted or cut-off variant (e.g. 136 dropped, 1000 kept; 493 dropped, 480 kept).
