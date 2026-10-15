# مراجعة عمل «حكم السنن» و«ابن رجب» — نتيجة الفحص

راجع هذا الملفَّ المراجعُ (كلود) على قاعدة التطوير والكود غير المحفوظ، مقابل `docs/review/sunan-tahqiq.md`.
كل رقم هنا مأخوذ من استعلام فعلي على القاعدة.

## الخلاصة

- **حكم السنن (شعيب الأرنؤوط): القاعدة سليمة في جملتها.** الدرجات المقبولة صحيحة، والموقوف والمقطوع مرفوضان، والألباني غائب (٠ صفوف). فيه ثلاثة إصلاحات (القسم ب).
- **ابن رجب: خطأ جسيم، يجب سحبه فورًا.** ٩٧٩ نصًا منشورة بحكم «صحيح» منسوب إلى ابن رجب، وابن رجب لم يحكم عليها. الاستخراج يأخذ أي جملة بعد «قال رسول الله» ما لم يجد كلمة تضعيف قريبة. فدخل كلام المؤلف، وأحاديث ضعيفة معروفة، وجمل نقدية.

## أ. ابن رجب — أمثلة حقيقية منشورة الآن بدرجة «صحيح»

| النص المنشور | المشكلة |
|---|---|
| «وأحاديث يعلى بن الأشدق باطلة منكرة» | كلام ابن رجب في **تضعيف** أحاديث، نُشر حديثًا صحيحًا، ومربوط بموضوع «التشويق إلى الجنة». الصفحة العامة ترجعه (200). |
| «اللهم بارك لنا في رجب وشعبان وبلغنا رمضان» | حديث ضعيف مشهور، خُزّن «صحيحًا» (مخفي حاليًا لعدم الربط فقط). |
| «خير منازل المسلمين يومئذ (ه). إخواني! من كان من هذه الأمة…» | وعظ المؤلف مع رمز حاشية. |
| «…» وقد أشكل على بعض الناس الجمع بين هذا الحديث… | نص الحديث ممزوج بشرح المؤلف. |
| «ما اعلموا أنكم لن تروا ربكم حتى تموتوا» وهذا يدل بمفهومه… | الحديث مقطوع البداية وممزوج بالشرح. |

أسباب جذرية:
1. **حكم مخترع:** `import.ts` يكتب `grade: SAHIH` و`gradeAuthority` ابن رجب لكل نص مستخرج. عدم وجود كلمة تضعيف بجانب النص ليس حكمًا بالصحة.
2. **ترقية نصوص كتب أخرى:** ٧٦ حديثًا من الترغيب ورياض الصالحين وشعب الإيمان والأدب المفرد كانت `AUTHORITY_LEGACY` (أي غير منشورة)، فرقّاها الاستيراد إلى «صحيح — ابن رجب» لأنها شابهت نصًا عنده. ودرجتها السابقة لم تُحفظ.
3. **تجاوز بوابة المسح الضوئي:** كتب ابن رجب نصها مسح ضوئي، ووُضع لـ ٩٣٥ صفًا منها `textVerifiedAt` آليًا في نفس اليوم، فمرّت من البوابة. التقرير يذكر خمسين فقط أظهرها المالك، والقاعدة فيها ٩٨٥ صفًا مسحًا ضوئيًا «مُراجَعًا».
4. ٨٤ نصًا من دفعة ابن رجب نصّها نفسه يقول «في الصحيحين / خرجه البخاري / خرّجاه»، و٦٩ منها عليها علامة «ليس من الصحيحين». التعبير النمطي لا يلتقط «وفى» و«خرجه» و«خرجاه».

**التوصية:** ابن رجب مصدر **اختيار** وتبويب، لا مصدر **حكم**. نصوصه تبقى مربوطة بمواضيعها، وما طابق البخاري أو مسلم يظهر بنص الصحيحين. ما لم يطابق لا يُنشر.

## ب. حكم السنن — ما يحتاج إصلاحًا

1. **حقل «بشار عواد معروف» في ملف الترمذي يكرر حكم الترمذي نفسه غالبًا.** قارنتُ الحقل بعبارة الترمذي في آخر الحديث: «حسن صحيح» = «حسن صحيح» في ١٦١٥ حديثًا، و«حسن» = «حسن» في ٣٥٥. النمط يدل على أن الحقل في هذا الملف (جمعٌ من sunnah.com) قد لا يكون تحقيق بشار المطبوع. الأحاديث المنشورة **ببشار وحده: ٣٢**. تُحجب حتى تُطابَق عيّنة منها مع طبعة بشار المطبوعة. الأحاديث المشتركة مع شعيب (٩) تبقى باسم شعيب وحده.
2. **«ليس من الصحيحين» خاطئة في ٩ أحاديث** نصها يقول «وفى "الصحيحين"» ونحوه. مثال: «وفى "الصحيحين" عن ابن عمر… إن أحدكم إذا مات عرض عليه…». يوسَّع التعبير النمطي.
3. **أحاديث في الصحيحين فاتتها المطابقة:** مثال «لا ترجعوا بعدي كفارًا يضرب بعضكم رقاب بعض» نُشر بحكم شعيب على ابن ماجه ٣٩٤٢ مع أنه في البخاري ومسلم. ٢٢ حديثًا من ٢٦٧ أقوى مطابقة لها مع الصحيحين بين ٠٫٦ و٠٫٧٥. تُفحص يدويًا بالجدول، ولا تُخفض العتبة.
4. **التوثيق:** الملف من مستودع `fawazahmed0/hadith-api` (رخصة Unlicense)، وهو جمعٌ لا طبعة. تُطابَق ٢٠ عيّنة عشوائية مع «سنن أبي داود» و«سنن ابن ماجه» بتحقيق الأرنؤوط عبر MCP الجامع، وتُكتب النتيجة.

## ج. أجوبة أسئلة الملف (١–١١)

1. «حسن صحيح» → حسن: صحيح كقاعدة تخزين، ويُعرض بنص الشيخ.
2. الأقوى عند الروايات المتقاربة: يكفي. لا دمج للمتون.
3. استبعاد ما نصه «رواه البخاري»: نعم، ويُكمَّل بالمطابقة، فإن طابق يظهر بنص الصحيحين.
4. الخمسون من الترغيب: مقبولة بقرار المالك. بقية الـ ٩٨٥ لا.
5. الإعادة بلا كتابة: ستتغير الأرقام بعد الإصلاح؛ المطلوب `0` في الإعادة الثانية بعده.
6. جدول العبارات في `provenance.ts` يكفي.
7. ابن رجب: نعم، الاستخراج يُدخل كلام المؤلف (القسم أ). يُسحب.
8. ذم الخمر ٨: لا يُبنى عليه، يُعاد مع القاعدة الجديدة.
9. السعدي الإنجليزي (IIPH، تجاري، مسح ضوئي): **يُحجب** حتى ترخيص. ١٩٦٨ موضعًا محفوظة ولا تُعرض.
10. التحرير والتنوير بالإنجليزية: يُخفى من `/en` حتى يوجد مصدر.
11. لا ترجمة آلية لأي نص شرعي. ما لا ترجمة موثقة له يبقى عربيًا مع ملاحظة «لا توجد ترجمة معتمدة».

## د. الحالة في git

٥٢ ملفًا غير محفوظ، منها هجرتان (`add_sunan_tahqiq`، `add_ibn_rajab`) ومجلد `frontend/test-results/` الذي لا يجب أن يُرفع.

---

# برومبت كيرسر (الصق ما تحت الخط)

---

Fix the Sunan-tahqiq and Ibn Rajab work after the reviewer's audit. Read `docs/review/sunan-tahqiq-review.md` first;
every number there comes from the DB. Do the steps in order. After each: backend + frontend tsc, lint, unit, e2e,
the importer re-run, commit, push to origin. Do not change the 0.75 match threshold. Do not touch the taxonomy.

## 0. Git hygiene
- Add `frontend/test-results/` to `.gitignore`. Commit the current uncommitted work as-is first, in logical commits
  (the two migrations each alone), so the fixes below are reviewable as diffs.

## 1. Ibn Rajab is a source of SELECTION, never of GRADE
- Ibn Rajab did not grade these narrations. Stop writing `grade: SAHIH` / `gradeSource: IBN_RAJAB` /
  `gradeAuthority` Ibn Rajab anywhere. Remove `IBN_RAJAB` from the publishable sources in `grade-policy.ts` (keep the
  enum value; data migration below).
- The 979 rows with gradeSource IBN_RAJAB:
  · 903 rows whose Source is an Ibn Rajab book (لطائف المعارف، التخويف من النار، أهوال القبور، اختيار الأولى، المحجة،
    استنشاق نسيم الأنس، ذم الخمر، شرح حديث يتبع الميت): set grade UNGRADED, gradeSource AUTHORITY_LEGACY,
    gradeAuthority/gradeReference null, clear `textVerifiedAt` (their text is OCR). Keep their topic links.
  · 76 rows from other books (Targhib, Riyad, Shu'ab, Adab) that the import upgraded: restore gradeSource
    AUTHORITY_LEGACY and the grade they had before. Recover it from the row's own payload (Targhib
    `rawPayload.gradeToken`, Adab `rawPayload.albani`) or by re-running that book's importer for those ids; print a
    before/after table. No row may stay SAHIH because of Ibn Rajab.
- Re-run takhrij (`HadithMatch`, 0.75) on the Ibn Rajab rows. A strong Bukhari/Muslim match → link the Sahihayn quote to
  the same topic(s) (basis TAKHRIJ, note «رواه البخاري (رقم) — أورده ابن رجب في <الكتاب>»). That is the ONLY way an Ibn
  Rajab passage reaches readers.
- Extractor quality (`extract.ts`): reject passages containing the author's critique or commentary markers (باطلة،
  منكرة، وهذا يدل، وقد أشكل، إخواني، وفي حديثه زيادة، footnote marks like «(ه)» / «(٨»); stop the matn at the closing
  quote or at «وقد / وهذا / قال ابن» after it. Add unit tests with the 5 real examples in the review file.
- Remove the 'OUTSIDE_SAHIHAYN' flags on every row that is no longer publishable.

## 2. OCR gate
- `textVerifiedAt` may only be set by an explicit human action (admin endpoint) or by the owner's listed decision.
  The importer must never set it. Clear it on every OCR row except the 50 Targhib rows the owner revealed (list their
  ids in the report and keep them). Add an e2e test: an importer run leaves `textVerifiedAt` unchanged.

## 3. Sunan tahqiq fixes
- Sahihayn citation detector: extend to «وفى / وفي / في» + optional quote marks + «الصحيحين», «خرجه البخاري»،
  «خرجه مسلم»، «خرّجاه»، «أخرجه البخاري»، «أخرجه مسلم», with diacritics/shadda stripped before testing. Unit tests
  with «وفى "الصحيحين" عن ابن عمر…». Fix the 9 rows wrongly flagged.
- OWNER DECISION: the only Sunan grader is Shu'ayb al-Arna'ut. A hadith is publishable as sahih/hasan when it is in
  al-Bukhari / Muslim, or when al-Arna'ut graded it sahih or hasan in the Sunan. Bashar Awad Maarouf is NOT used at
  all (the Tirmidhi file's Bashar field equals Tirmidhi's own verdict in ~85% of rows: 1615 «Hasan Sahih» ↔
  «حسن صحيح», 355 «Hasan» ↔ «حسن»). Remove him from `SUNAN_SCHOLAR_NAMES`, the scholar order and every citation.
  The 32 Bashar-only rows → unpublished (gradeSource AUTHORITY_LEGACY, grade UNGRADED, OUTSIDE_SAHIHAYN flag removed);
  the 9 joint rows keep only «شعيب الأرنؤوط». Tirmidhi rows therefore get no Sunan grade (al-Arna'ut's grades exist
  only for Abu Dawud and Ibn Majah in this file) — say so in the report.
- Arnaut spot-check: same method for 20 random published Abu Dawud / Ibn Majah rows against the Arnaut editions.
- The 22 published Sunan rows whose best Sahihayn score is 0.6–0.75 (e.g. «لا ترجعوا بعدي كفارا»): list them with the
  best Bukhari/Muslim candidate side by side in the report for the reviewer. Do not change the threshold.

## 4. English side
- Owner decision: replace the unlicensed al-Sa'di English (IIPH via tafsirs.org, commercial + OCR) with a free,
  official, complete source: «المختصر في تفسير القرآن الكريم» (Tafsir Center for Quranic Studies) from QuranEnc.
  · English: `GET https://quranenc.com/api/v1/translation/sura/english_mokhtasar/{sura}` (verified for 49:12). Confirm
    the exact key and version with `GET /api/v1/translations/list` (filter `mokhtasar`), pin the version, cache in
    `backend/.corpus/quranenc/`, all 114 surahs → Explanation kind TAFSIR, languageCode en, Source «المختصر في تفسير
    القرآن الكريم» (nameEn «Al-Mukhtasar fi Tafsir al-Qur'an — Tafsir Center for Quranic Studies»), attribution
    «QuranEnc.com».
  · Arabic: import the same work's Arabic text (key `arabic_mokhtasar` if listed) so the work exists in both locales.
  · `/en` shows Al-Mukhtasar under every verse. al-Sa'di and al-Tahrir show in `/ar` only; in `/en` they are not listed
    (no empty heading). Delete the 1,968 tafsirs.org rows and the `sadi-en` importer; keep Ibn Kathir en hidden as is.
  · Record in the report that QuranEnc states free access; the owner confirms redistribution terms before launch.
- No machine translation of any Quran, hadith or tafsir text. Untranslated text stays Arabic with the note
  «No verified translation available».

## 5. Report — append «Audit fixes» to `docs/review/sunan-tahqiq.md`
- Before/after counts by gradeSource × grade; public hadith total before/after.
- The 76 restored rows (before/after grade); Ibn Rajab rows that became public through TAKHRIJ.
- OCR rows with textVerifiedAt before/after (expected after: 50).
- Bashar and Arnaut verification tables; the 22 near-match rows.
- Real output of tsc, lint, unit, e2e and two importer runs (second run writes 0).
