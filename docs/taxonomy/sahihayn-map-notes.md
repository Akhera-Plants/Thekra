# Sahihayn chapter map — reviewer notes (batch 2)

File: `backend/prisma/taxonomy/sahihayn-map.yaml`. Batch 1 (21 prayer chapters) is unchanged. Batch 2 appends **641 chapters** (Bukhari and Muslim `BAB` rows with `hadith > 0`), grouped by primary topic with a `# ── slug (SIDE) ──` header. The map now has 662 rows, 720 topic links and 2,519 hadith-item links, spread over 136 topics.

## How chapters were chosen

- Every chapter was picked from its **title** (the scholar's tabwib), not from keyword hits. The chapter's hadith must be what the title says. When the title was only a verse, a bare «باب», a ruling, a narrative or a prophecy, it was left out.
- Side follows the title's verb. `تحريم / النهي / إثم / ما يكره / التغليظ / الوعيد / ذم` → AVOID topic. `فضل / الحث / الأمر / استحباب / الترغيب` → DO topic. A chapter that states both (e.g. «باب صلة الرحم وتحريم قطيعتها», «باب قبح الكذب وحسن الصدق») lists both.
- Excluded on purpose: fiqh-procedure chapters (zakat rates, fast-breaking rulings, hudud procedure, sales technicalities such as «باب الربا» on exchange rules in Muslim, nadhr/oath rulings), sira/maghazi, tafsir, fitan and the signs of the Hour, «رفع العلم/الأمانة» prophecies, and hidden topics (`jihad`, `firar-zahf`, `kaffarat`, `tasweer`: the jihad, ‘itq and taswir chapters are not mapped). Contemporary topics are never targets.
- Batch-1 topics only got chapters about attending or abandoning prayer and congregation: «باب وجوب صلاة الجماعة», «باب فضل صلاة الجماعة وبيان التشديد في التخلف عنها», «باب التغليظ في ترك الجمعة», plus three Bukhari fadl-al-jama‘a chapters.
- Titles: Bukhari titles are copied verbatim. Muslim titles drop the export's trailing ` )`, the `msNNNN` page markers, and turn `@QB@…@QE@` into `{…}`, the same way batch 1 did. Titles with `:` `,` `{` `[` are double-quoted so the file is valid YAML. The importer only uses `id`/`book`/`topics`; the public note comes from the DB section title.

## Per-topic table (whole map, batch 1 included)

| topic | ar | side | Bukhari bab | Muslim bab | chapters | hadith items | of which batch 1 |
|---|---|---|---:|---:|---:|---:|---:|
| `intihar` | قتل الإنسان نفسه | AVOID | 1 | 2 | 3 | 14 |  |
| `qatl` | قتل النفس | AVOID | 4 | 5 | 9 | 30 |  |
| `zulm-raiyya` | خيانة الأمانة في الولاية والقضاء | AVOID | 1 | 2 | 3 | 19 |  |
| `iftar-ramadan` | الفطر في رمضان بلا عذر | AVOID | 0 | 1 | 1 | 9 |  |
| `tanazzuh-bawl` | عدم التنزّه من البول | AVOID | 1 | 0 | 1 | 1 |  |
| `tark-as-salah` | ترك الصلاة والتهاون بها | AVOID | 4 | 5 | 9 | 36 | 6 |
| `qawl-bila-amal` | أن تقول ما لا تفعل | AVOID | 0 | 1 | 1 | 2 |  |
| `amn-makr` | الأمن من مكر الله واليأس من رحمته | AVOID | 0 | 1 | 1 | 1 |  |
| `bida` | البدع ومحدثات الأمور | AVOID | 1 | 1 | 2 | 9 |  |
| `hilf-bighayr-allah` | الحلف بغير الله | AVOID | 4 | 2 | 6 | 16 |  |
| `sabb-sahaba` | سبّ الصحابة | AVOID | 0 | 1 | 1 | 3 |  |
| `shirk` | الشرك بالله | AVOID | 2 | 3 | 5 | 13 |  |
| `sihr-kahana` | السحر وإتيان الكهان والعرافين | AVOID | 2 | 1 | 3 | 15 |  |
| `tatayyur` | التطيّر وتعليق التمائم | AVOID | 1 | 1 | 2 | 17 |  |
| `dhul-wajhayn` | ذو الوجهين والنفاق في التعامل | AVOID | 2 | 2 | 4 | 11 |  |
| `ghibah` | الغيبة | AVOID | 2 | 1 | 3 | 3 |  |
| `jidal` | الجدال والمراء | AVOID | 3 | 1 | 4 | 4 |  |
| `kadhib` | الكذب | AVOID | 5 | 5 | 10 | 26 |  |
| `namimah` | النميمة | AVOID | 2 | 2 | 4 | 6 |  |
| `qadhf` | قذف المحصنات | AVOID | 1 | 1 | 2 | 3 |  |
| `sabb-lan` | السبّ واللعن والفحش | AVOID | 5 | 5 | 10 | 37 |  |
| `shahadat-zur` | شهادة الزور | AVOID | 1 | 0 | 1 | 2 |  |
| `sukhriya` | احتقار الناس والسخرية منهم والشماتة | AVOID | 0 | 2 | 2 | 4 |  |
| `yamin-ghamus` | اليمين الكاذبة | AVOID | 4 | 2 | 6 | 19 |  |
| `akl-haram` | أكل الحرام والمكوس | AVOID | 1 | 0 | 1 | 1 |  |
| `akl-mal-yatim` | أكل مال اليتيم | AVOID | 1 | 0 | 1 | 1 |  |
| `bukhl` | البخل والشح | AVOID | 2 | 3 | 5 | 14 |  |
| `ghish` | الغش والخداع وبخس الكيل | AVOID | 3 | 1 | 4 | 5 |  |
| `ihtikar` | الاحتكار | AVOID | 0 | 1 | 1 | 2 |  |
| `israf` | الإسراف وإضاعة المال | AVOID | 1 | 1 | 2 | 3 |  |
| `man-ajr` | منع الأجير أجره | AVOID | 1 | 0 | 1 | 1 |  |
| `man-zakah` | منع الزكاة | AVOID | 1 | 2 | 3 | 14 |  |
| `masala` | سؤال الناس من غير حاجة | AVOID | 3 | 2 | 5 | 23 |  |
| `mutl` | المماطلة في الحقوق والديون | AVOID | 1 | 1 | 2 | 3 |  |
| `qimar` | القمار والميسر | AVOID | 1 | 0 | 1 | 1 |  |
| `riba` | الربا | AVOID | 4 | 1 | 5 | 7 |  |
| `rishwa` | الرشوة | AVOID | 1 | 1 | 2 | 9 |  |
| `sariqa` | السرقة والغصب والغلول | AVOID | 6 | 3 | 9 | 22 |  |
| `adha-jar` | أذى الجار | AVOID | 2 | 1 | 3 | 4 |  |
| `adha-muslimin` | أذى الناس وترويعهم | AVOID | 0 | 4 | 4 | 15 |  |
| `ghadr` | الغدر ونقض العهد وإخلاف الوعد | AVOID | 0 | 1 | 1 | 10 |  |
| `hijran` | الهجر والتدابر والتقاطع | AVOID | 2 | 3 | 5 | 19 |  |
| `khiyana` | الخيانة | AVOID | 0 | 1 | 1 | 2 |  |
| `mann` | المنّ بالعطية | AVOID | 1 | 2 | 3 | 17 |  |
| `niyaha` | النياحة والتسخّط عند المصيبة | AVOID | 7 | 4 | 11 | 50 |  |
| `su-dhann` | سوء الظن بالناس | AVOID | 1 | 1 | 2 | 6 |  |
| `tadhib-hayawan` | تعذيب الحيوان والضعفاء | AVOID | 0 | 4 | 4 | 23 |  |
| `tajassus` | التجسس وتتبّع عورات الناس | AVOID | 2 | 2 | 4 | 14 |  |
| `zulm` | الظلم | AVOID | 6 | 4 | 10 | 32 |  |
| `ghadab` | الغضب | AVOID | 1 | 1 | 2 | 11 |  |
| `hasad` | الحسد والغل | AVOID | 1 | 2 | 3 | 12 |  |
| `istihana-saghair` | الاستهانة بالصغائر | AVOID | 1 | 0 | 1 | 1 |  |
| `kibr` | الكبر والعُجب | AVOID | 2 | 4 | 6 | 27 |  |
| `riya` | الرياء | AVOID | 2 | 1 | 3 | 10 |  |
| `tul-amal` | التعلق بالدنيا وطول الأمل | AVOID | 3 | 3 | 6 | 29 |  |
| `idaat-al-waqt` | إضاعة الوقت واللغو | AVOID | 1 | 0 | 1 | 1 |  |
| `isbal-harir` | الإسبال ولبس الحرير والذهب للرجال | AVOID | 4 | 4 | 8 | 78 |  |
| `khamr` | الخمر والمسكرات والمخدّرات | AVOID | 8 | 6 | 14 | 42 |  |
| `malahi` | اللهو المحرّم | AVOID | 0 | 1 | 1 | 1 |  |
| `nazar-muharram` | النظر المحرّم والخلوة بالأجنبية | AVOID | 2 | 3 | 5 | 12 |  |
| `tabarruj` | التبرّج وتغيير خلق الله | AVOID | 6 | 1 | 7 | 35 |  |
| `tashabbuh` | تشبّه الرجال بالنساء والنساء بالرجال | AVOID | 3 | 1 | 4 | 6 |  |
| `zina` | الزنا | AVOID | 1 | 1 | 2 | 14 |  |
| `intisab` | الانتساب إلى غير الأب | AVOID | 0 | 1 | 1 | 4 |  |
| `nushuz` | إفساد الحياة الزوجية وعصيان الزوج | AVOID | 1 | 1 | 2 | 6 |  |
| `qat-al-rahim` | قطيعة الرحم | AVOID | 2 | 1 | 3 | 12 |  |
| `uquq` | عقوق الوالدين | AVOID | 2 | 1 | 3 | 7 |  |
| `zulm-zawja` | ظلم الزوجة والميل بين الزوجات | AVOID | 1 | 0 | 1 | 1 |  |
| `adab-majlis` | آداب المجلس والاستئذان | DO | 4 | 3 | 7 | 25 |  |
| `adab-masjid` | آداب المسجد | DO | 0 | 2 | 2 | 30 |  |
| `adab-taam` | آداب الطعام والشراب | DO | 2 | 4 | 6 | 29 |  |
| `taat-wulat` | طاعة ولاة الأمر في المعروف | DO | 3 | 4 | 7 | 39 |  |
| `adab-salah` | الخشوع وآداب الصلاة | DO | 2 | 3 | 5 | 13 |  |
| `dhikr` | ذكر الله | DO | 10 | 11 | 21 | 98 |  |
| `dua` | الدعاء | DO | 18 | 14 | 32 | 107 |  |
| `hajj` | الحج والعمرة | DO | 4 | 2 | 6 | 14 |  |
| `jumua` | يوم الجمعة وصلاتها | DO | 6 | 3 | 9 | 16 |  |
| `nawafil` | النوافل وقيام الليل | DO | 14 | 6 | 20 | 99 |  |
| `quran` | تلاوة القرآن وتعاهده | DO | 19 | 14 | 33 | 104 |  |
| `salah` | المحافظة على الصلاة | DO | 6 | 3 | 9 | 31 | 9 |
| `salat-ala-nabi` | الصلاة على النبي ﷺ | DO | 1 | 0 | 1 | 2 |  |
| `salat-fi-jamaah` | صلاة الجماعة والمشي إلى المساجد | DO | 7 | 5 | 12 | 54 | 6 |
| `siyam` | الصيام | DO | 15 | 6 | 21 | 61 |  |
| `tahara` | الطهارة والوضوء | DO | 1 | 4 | 5 | 16 | 1 |
| `zakah` | أداء الزكاة | DO | 4 | 0 | 4 | 9 |  |
| `nashr-ilm` | نشر العلم والدلالة على الخير | DO | 4 | 1 | 5 | 10 |  |
| `talab-ilm` | طلب العلم | DO | 5 | 0 | 5 | 5 |  |
| `dhikr-akhira` | التشويق إلى الجنة وتذكّر الآخرة | DO | 1 | 7 | 8 | 54 |  |
| `mahabbat-allah` | محبة الله ورسوله وتعظيمهما | DO | 2 | 1 | 3 | 8 |  |
| `sunna` | اتباع السنة | DO | 2 | 0 | 2 | 13 |  |
| `tawhid` | التوحيد وإفراد الله بالعبادة | DO | 2 | 2 | 4 | 28 |  |
| `hifz-al-lisan` | حفظ اللسان والصمت إلا عن خير | DO | 3 | 2 | 5 | 18 |  |
| `islah-bayn-nas` | الإصلاح بين الناس | DO | 4 | 0 | 4 | 5 |  |
| `kalam-tayyib` | الكلمة الطيبة وطلاقة الوجه | DO | 1 | 1 | 2 | 4 |  |
| `nasiha` | النصيحة | DO | 1 | 1 | 2 | 8 |  |
| `tathabbut` | التثبّت في نقل الأخبار | DO | 0 | 1 | 1 | 1 |  |
| `kasb-halal` | الكسب الحلال وطلب الرزق | DO | 2 | 0 | 2 | 10 |  |
| `sadaqah` | الصدقة والإنفاق في الخير | DO | 23 | 19 | 42 | 128 |  |
| `samaha` | السماحة في البيع والشراء | DO | 3 | 1 | 4 | 13 |  |
| `adl` | العدل ورد المظالم | DO | 0 | 2 | 2 | 24 |  |
| `afw` | العفو والصفح | DO | 0 | 1 | 1 | 1 |  |
| `amana-wafa` | أداء الأمانة والوفاء بالعهد | DO | 4 | 1 | 5 | 9 |  |
| `haqq-jar` | إكرام الجار | DO | 3 | 2 | 5 | 17 |  |
| `hubb-fillah` | الحب في الله والصحبة الصالحة | DO | 1 | 3 | 4 | 19 |  |
| `ikram-dayf` | إكرام الضيف | DO | 4 | 2 | 6 | 24 |  |
| `imatat-adha` | إماطة الأذى عن الطريق | DO | 1 | 1 | 2 | 7 |  |
| `iyadat-marid` | عيادة المريض واتباع الجنائز | DO | 6 | 3 | 9 | 26 |  |
| `qada-hawaij` | قضاء حوائج الناس والتيسير على المعسر | DO | 1 | 3 | 4 | 16 |  |
| `rahma-khalq` | الرحمة بالخلق والحيوان | DO | 2 | 4 | 6 | 30 |  |
| `salam` | إفشاء السلام | DO | 8 | 2 | 10 | 15 |  |
| `satr-muslim` | ستر المسلم | DO | 1 | 1 | 2 | 3 |  |
| `taawun` | التعاون على البر والتقوى | DO | 1 | 0 | 1 | 1 |  |
| `haya` | الحياء | DO | 3 | 1 | 4 | 12 |  |
| `husn-khuluq` | حسن الخلق والحلم والرفق | DO | 3 | 2 | 5 | 25 |  |
| `ikhlas` | الإخلاص | DO | 2 | 0 | 2 | 6 |  |
| `kaff-al-ghadab` | كظم الغيظ | DO | 1 | 1 | 2 | 11 |  |
| `khawf-raja` | الخوف من الله ورجاؤه | DO | 4 | 2 | 6 | 29 |  |
| `muraqaba` | مراقبة الله والتقوى | DO | 0 | 1 | 1 | 3 |  |
| `sabr` | الصبر والرضا بالقضاء | DO | 11 | 6 | 17 | 53 |  |
| `salamat-sadr` | سلامة الصدر ومحبة الخير للناس | DO | 1 | 1 | 2 | 3 |  |
| `shukr` | شكر النعم | DO | 0 | 2 | 2 | 3 |  |
| `sidq` | الصدق | DO | 2 | 3 | 5 | 14 |  |
| `tawadu` | التواضع | DO | 1 | 1 | 2 | 3 |  |
| `tawakkul` | اليقين والتوكل على الله | DO | 2 | 1 | 3 | 4 |  |
| `tawba` | التوبة والاستغفار | DO | 3 | 7 | 10 | 46 |  |
| `wara` | الورع وترك الشبهات | DO | 1 | 1 | 2 | 5 |  |
| `zuhd` | الزهد والقناعة وتذكّر الموت | DO | 7 | 2 | 9 | 23 |  |
| `ightinam-waqt` | اغتنام الوقت والمبادرة إلى الخير | DO | 2 | 3 | 5 | 17 |  |
| `ghadd-basar` | غضّ البصر | DO | 0 | 1 | 1 | 2 |  |
| `iffa` | العفّة وحفظ الفرج | DO | 3 | 1 | 4 | 13 |  |
| `birr-al-walidayn` | بر الوالدين | DO | 5 | 5 | 10 | 25 |  |
| `husn-ishra` | حسن العشرة بين الزوجين | DO | 6 | 0 | 6 | 9 |  |
| `kafalat-yatim` | كفالة اليتيم والإحسان إلى الضعفاء | DO | 3 | 1 | 4 | 5 |  |
| `nafaqa-ahl` | النفقة على الأهل وتربية الأولاد | DO | 1 | 2 | 3 | 12 |  |
| `nikah` | الزواج والعفة | DO | 2 | 2 | 4 | 14 |  |
| `silat-ar-rahim` | صلة الرحم | DO | 7 | 2 | 9 | 31 |  |

## Core topics with no chapter, and why

| topic | why not mapped |
|---|---|
| `takdhib-qadar` | Kitab al-Qadar chapters (Bukhari and Muslim) state the creed: «جف القلم», «العمل بالخواتيم», «كل شيء بقدر». None is a chapter *warning against denial*. Muslim's first iman bab mentions «التبري ممن لا يؤمن بالقدر», but its content is the whole Jibril hadith. |
| `amr-maruf` | Neither export has a dedicated chapter. Muslim's «من رأى منكم منكرا» bab is missing from `muslim.tsv`, probably merged into another row. Only the AVOID twin `qawl-bila-amal` could be mapped. |
| `hajr-quran` | «باب نسيان القرآن، وهل يقول: نسيت آية كذا» asks whether the phrase is permitted; it is not a warning against neglect. Its tone does not fit an AVOID page. |
| `kitman-ilm` | No chapter title names concealment. «باب حفظ العلم» contains the Abu Hurayra «لولا آيتان» hadith, but the title is about memorising. |
| `liwat` | Only Ahadith al-Anbiya / tafsir verse chapters on Lut's people exist (narrative). |
| `tark-hajj` | No chapter. |
| `dayyuth` | «باب الغيرة» praises ghira (Sa‘d, «إن الله يغار»). No chapter condemns its absence, so the side would not match. |
| `baghy-fakhr` | No title states it. «باب ما جاء في البناء» is too loose. |
| `muhasaba`, `iqtisad` | No chapter. «القصد» in «باب القصد والمداومة على العمل» means moderation in worship, so it went to `ightinam-waqt`, not spending. |
| `iman-ghayb` | Iman/Tawhid chapters on angels and revelation are verse-titled creed discussions. |
| `tawqir-kibar`, `adab-safar`, `adab-libas` | Not core. Candidate chapters («باب خدمة الصغار الكبار», travel etiquette) are mostly fiqh detail. Left for a later adab pass. |

Thinly covered (1–2 chapters) despite searching: `ghibah` (3: Bukhari's «باب الغيبة» carries the two-graves hadith), `su-dhann` (2), `ikhlas` (2: Bukhari's niyya chapter plus «العمل الذي يبتغى به وجه الله»), `shukr` (2), `tawadu` (2), `afw` (1), `amn-makr` (1), `tathabbut` (1).

## 30 example mappings for spot-checking

| # | book | chapter title | topics |
|---:|---|---|---|
| 1 | bukhari | باب الغيبة | `ghibah` |
| 2 | muslim | باب تحريم الغيبة | `ghibah` |
| 3 | bukhari | باب: النميمة من الكبائر | `namimah` |
| 4 | bukhari | باب إثم من كذب على النبي صلى الله عليه وسلم | `kadhib` |
| 5 | muslim | باب قبح الكذب وحسن الصدق وفضله | `sidq`, `kadhib` |
| 6 | bukhari | باب ما ينهى عن التحاسد والتدابر | `hasad`, `hijran` |
| 7 | muslim | باب تحريم الكبر | `kibr` |
| 8 | bukhari | باب الرياء والسمعة | `riya` |
| 9 | bukhari | باب الحذر من الغضب | `ghadab`, `kaff-al-ghadab` |
| 10 | muslim | باب تحريم الظلم | `zulm` |
| 11 | bukhari | باب: عقوق الوالدين من الكبائر | `uquq` |
| 12 | bukhari | باب إثم القاطع | `qat-al-rahim` |
| 13 | muslim | باب بر الوالدين وأنهما أحق به | `birr-al-walidayn` |
| 14 | bukhari | باب فضل صلة الرحم | `silat-ar-rahim` |
| 15 | bukhari | باب: اتقوا النار ولو بشق تمرة والقليل من الصدقة | `sadaqah` |
| 16 | bukhari | باب: الحياء من الإيمان | `haya` |
| 17 | bukhari | باب الصبر عند الصدمة الأولى | `sabr` |
| 18 | muslim | باب المؤمن أمره كله خير | `sabr`, `shukr` |
| 19 | bukhari | باب أفضل الاستغفار | `tawba` |
| 20 | bukhari | باب فضل التهليل | `dhikr` |
| 21 | bukhari | باب يستجاب للعبد ما لم يعجل | `dua` |
| 22 | bukhari | باب الوصاة بالجار | `haqq-jar` |
| 23 | bukhari | باب إكرام الضيف، وخدمته إياه بنفسه | `ikram-dayf` |
| 24 | bukhari | باب رحمة الناس والبهائم | `rahma-khalq` |
| 25 | bukhari | باب إثم الزناة | `zina` |
| 26 | muslim | باب تحريم الخمر وبيان أنها تكون من عصير العنب ومن التمر والبسر والزبيب وغيرها مما يسكر | `khamr` |
| 27 | bukhari | باب آكل الربا وشاهده وكاتبه … | `riba` |
| 28 | bukhari | باب السارق حين يسرق | `sariqa` |
| 29 | muslim | باب من أشرك في عمله غير الله وفي نسخة باب تحريم الرياء | `riya` |
| 30 | bukhari | باب فضل الصوم | `siyam` |

## Borderline calls — please check these first

| book | chapter title | topics | concern |
|---|---|---|---|
| bukhari | باب الغيبة / باب عذاب القبر من الغيبة والبول | `ghibah` (+`tanazzuh-bawl`) | The hadith says «يمشي بالنميمة». Mapped per the title, as the brief's example asks. |
| bukhari / muslim | باب علامة المنافق / باب بيان خصال المنافق | `dhul-wajhayn` | Mapped to the topic's «النفاق في التعامل» half (lies, broken promises, betrayal). |
| bukhari | باب قول الله تعالى: {واجتنبوا قول الزور} | `kadhib` | The hadith is «من لم يدع قول الزور…» (false speech in general), not testimony, so not `shahadat-zur`. |
| bukhari | باب ما يكره من قيل وقال | `idaat-al-waqt` | Idle talk. The same hadith also names إضاعة المال. |
| bukhari | باب قتل الولد خشية أن يأكل معه | `qatl` | The hadith lists shirk → killing one's child → zina with the neighbour's wife. |
| bukhari | باب {إن الذين يأكلون أموال اليتامى ظلما…} | `akl-mal-yatim` | The hadith is the «سبع الموبقات» list. |
| bukhari / muslim | باب هدايا العمال / باب تحريم هدايا العمال | `rishwa` | Gifts to officials treated as bribery (Ibn al-Lutbiyya). |
| bukhari | باب الاستعفاف عن المسألة | `kasb-halal`, `masala` | A virtue title about a prohibition, so it lists both sides. |
| muslim | باب في الكنازين للأموال والتغليظ عليهم | `bukhl` | Hoarding without spending. |
| muslim | باب غيرة الله تعالى وتحريم الفواحش | `zina` | General فواحش. |
| muslim | باب حديث توبة كعب بن مالك وصاحبيه | `tawba`, `sidq` | A long sira-style narrative, but it is the classical proof-text for both. |
| muslim | باب إطلاق اسم الكفر على الطعن في النسب والنياحة | `sukhriya`, `niyaha` | — |
| bukhari | باب: كل لهو باطل إذا شغله عن طاعة الله، ومن قال لصاحبه: تعال أقامرك | `qimar`, `hilf-bighayr-allah` | The hadith opens with «من حلف باللات». |
| bukhari | باب السمع والطاعة للإمام (كتاب الجهاد) | `taat-wulat` | Sits in Kitab al-Jihad, but the hadith is general obedience. |

## Validation

`python3 /tmp/validate_sahihayn.py` (kept outside the repo) checks:

- the YAML parses;
- every id is in `bukhari.tsv`/`muslim.tsv` as a `BAB` with `hadith > 0`, and its book matches;
- there are no duplicate ids;
- every slug exists in `taxonomy.yaml` and is neither `contemporary` nor `hidden`;
- the importer's own line splitter (`sahihayn-map.ts`) reads each row as `id/book/title/topics`.

Result: 0 errors.
