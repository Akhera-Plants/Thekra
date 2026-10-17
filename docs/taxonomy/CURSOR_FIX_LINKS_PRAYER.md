# Cursor task — remove wrong links, apply the reviewer's fixes, pair pages, Sahihayn chapters (batch 1: prayer)

Paste everything below the line into Cursor. Do the steps in order; after each: backend + frontend tsc, lint,
unit, e2e, the importer re-run (second run writes 0), commit, push. Do not redesign or re-decide anything in the
reviewer's files — apply them. If a number below does not match your DB, STOP and report.

---

The owner opened /sins/tark-as-salah («ترك الصلاة والتهاون بها») and found wrong texts under «أجر من تركها لله»,
e.g. «لا يصبر على لأواء المدينة…» (Muslim 1378) and «إذا نعس أحدكم في الصلاة فليرقد…» (Muslim 786), and only 3 public
hadith on abandoning prayer. The reviewer traced it in the DB. Causes and fixes:

## 1. Ibn Rajab whole-book links (the biggest error)
- The Ibn Rajab importer linked EVERY passage of a book to that book's topics (`RAJAB_BOOKS[].topics` in
  backend/prisma/imports/ibn-rajab/books.ts), notes «من كتاب ذم الخمر» / «من كتاب لطائف المعارف» …, basis
  REVIEWER_SECTION. When a passage was merged into a Sahihayn quote, that quote inherited all of them: Muslim 1378 is
  linked to khamr, dhikr, mahabbat-allah, tawakkul, salat-fi-jamaah, tahara, dhikr-akhira, zuhd, nawafil, siyam, hajj,
  tawba. There are 1,465 such links on 1,119 quotes.
- Delete every SinQuote/GoodDeedQuote whose note starts with «من كتاب » and whose basis is REVIEWER_SECTION (print
  the count before/after). Remove `topics` from RAJAB_BOOKS and the code that links by book; Ibn Rajab passages get
  topics ONLY through a chapter-level mapping (none exists yet) or TAKHRIJ from a correctly mapped section.
- Add a unit test: an Ibn Rajab import creates 0 topic links.

## 2. Reviewer corrections to the content map (already edited by the reviewer)
- docs/taxonomy/content-map.tsv: 16 prayer-etiquette sections (raising the gaze, hand on the waist, turning in prayer,
  passing in front of the one praying, praying while drowsy, praying with food present, the adhan, saying amin …) moved
  from salah / tark-as-salah to the new topic `adab-salah`; the 3 «الصلاة في المسجد الحرام» sections are now SKIP
  (virtues of places).
- backend/prisma/taxonomy/taxonomy.yaml: new DO topic `adab-salah` («الخشوع وآداب الصلاة», domain ibadat); the
  etiquette phrases were removed from tark-as-salah's targhib anchors and given to adab-salah.
- Re-apply the taxonomy: links created from the old mapping of those 19 sections (and the TAKHRIJ links propagated
  from them) are deleted, then recreated from the new decisions. Expected: Muslim 1378 and Muslim 786 no longer linked
  to salah; Muslim 786 linked to adab-salah through TAKHRIJ from «الترهيب من صلاة الإنسان وقراءته حال النعاس».
- Also delete the TAKHRIJ link of Muslim 82 («إن بين الرجل وبين الشرك والكفر ترك الصلاة») to salat-fi-jamaah if it does
  not come from a section mapped to salat-fi-jamaah (print where it came from).

## 3. Sahih al-Bukhari / Muslim chapter map (new reviewer file)
- backend/prisma/taxonomy/sahihayn-map.yaml lists Bukhari/Muslim BookSection ids → topics. Batch 1 covers salah,
  tark-as-salah, salat-fi-jamaah (21 chapters, e.g. Muslim «باب بيان إطلاق اسم الكفر على من ترك الصلاة», Bukhari «باب من ترك
  العصر», «باب فضل الصلاة لوقتها»).
- Import it in `import:taxonomy`: every HADITH item under a listed section → ACCEPTED link, basis CHAPTER,
  classifiedBy REVIEWER, note «من باب: <title> — <book>». The matching KEYWORD_PROPOSAL rows become redundant — delete
  proposals for the same (topic, quote). Chapters not in the file stay proposals (not public).
- Verify by id that these are now public on the prayer page: Muslim 82, Bukhari 527 («أي العمل أحب إلى الله؟ الصلاة على
  وقتها»), Bukhari 528 (the river), Bukhari 553 («من ترك صلاة العصر فقد حبط عمله»), Muslim 668.

## 4. Paired topic pages (owner decision)
- A sin and its opposite deed are ONE topic. taxonomy.yaml now ends with `pairs:` (41 pairs, e.g.
  {avoid: tark-as-salah, do: salah, ar: الصلاة}). For each pair:
  · One page with a single title (`ar` if given, else the deed's name; English from the deed's name) and two parts:
    «ما جاء في التحذير» (AVOID texts) and «الفضل والثواب» (DO texts). No text appears twice on the page (dedupe by quote).
  · Both URLs keep working: /sins/<avoid> and /good-deeds/<do> render the same page, opening on the side the visitor
    came from. The «كبيرة» badge and its reference stay.
  · Lists (/sins, /good-deeds, home index) show the pair once, under the side being listed.
  · Contemporary topics and unpaired topics are unchanged.
- The tabs on the page (الكل / الآيات / الأحاديث) count the deduplicated pair.

## 5. Report — append «Prayer audit» to docs/taxonomy/apply-report.md
- Counts before/after: links deleted in step 1, links re-created in step 2, links added in step 3, proposals removed.
- For the prayer pair: public texts by part and type, and the list of public hadith with book + number.
- 20 random links from step 3 (topic, bab, first 80 chars) for the reviewer.
- Screenshots of /sins/tark-as-salah and /good-deeds/salah (1440 and 390, dark and light) into docs/design/after/topics/.
