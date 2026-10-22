# Cursor task — Shu'ab al-Iman re-matching, «من أقوال السلف», hide auth UI, Ibn Abi al-Dunya books

Paste everything below the line into Cursor. Phases in order; after each: backend + frontend tsc, lint, unit, e2e,
importer re-run (second run writes 0), commit, push.

---

FIRST read docs/handoff/ui-port-session-context.md. The public UI described there is final: extend, never revert.
Owner decisions for this task (do not ask again):
- Bayhaqi's chains (isnad) are NOT shown to readers.
- Sayings of the early generations (athar) MAY be shown, in a separate section «من أقوال السلف», ONLY when the
  speaker is a Companion or a senior Successor from backend/prisma/taxonomy/athar-speakers.yaml, and always labelled
  «أثر، وليس حديثًا». Never mixed with hadith, never given a hadith grade.
- Login, registration, favorites/saving and everything that needs an account are hidden from the public UI for now
  (next phase). Keep the code and API; only hide the UI. The «أبلغ عن خطأ» report (no login) stays.
- Ibn Abi al-Dunya's books are imported (structure only now; the reviewer maps chapters to topics by hand later).

## Phase 1 — Shu'ab al-Iman: match on the matn, show the clean text
Current state (verified): 10,841 narrations, ~409 public; best-match scores of ~800 rows sit between 0.6 and 0.75
because matching compared the whole text including the long chain.
- Split the isnad from the matn for every Shu'ab quote with the existing tested splitter (src/lib/format/isnad.ts
  logic / the backend splitter used for the Sahihayn); store matnAr separately (keep the full text in rawPayload).
- Re-run matching on the matn only against: Bukhari + Muslim (ReferenceHadith), the Sunan graded by al-Arna'ut, and
  HadeethEnc (if Phase 1 of docs/build/CURSOR_STUDY_PANEL_AND_SHARH.md has run; otherwise skip and note it).
  Threshold stays 0.75. Strong match → the existing rules (AUTO_SAHIHAYN / SUNAN_TAHQIQ / HADEETHENC), and the
  matched clean quote is linked to the same iman branch (ImanBranchQuote, basis TAKHRIJ) and to the topics that
  branch maps to only if the reviewer's taxonomy already links that branch.
- Display: Shu'ab texts never show the chain publicly — show the matn; when a Sahihayn/Sunan match exists show that
  clean text first and «ورد في الجامع لشعب الإيمان للبيهقي، رقم N» as the second citation.
- Report before/after: public Shu'ab-derived texts, branches with ≥1 public text, matches per target.

## Phase 2 — «من أقوال السلف» (athar)
- Classify every narration in Shu'ab, al-Zuhd, Mukhtasar Minhaj and (after Phase 4) Ibn Abi al-Dunya: MARFU (the
  Prophet's words or action: «قال رسول الله»، «عن النبي»، «صلى الله عليه وسلم» quoting him) vs ATHAR (the final words
  belong to a Companion or later person). Unit-test the classifier on 30 real samples printed in the report.
- For ATHAR, extract the speaker (the last «قال فلان» / «عن فلان قال» before the quoted words) and match it against
  backend/prisma/taxonomy/athar-speakers.yaml (normalised forms). Store Quote.kind/athar fields: isAthar, speakerKey.
- Public only when the speaker is in the YAML. Others stay hidden; export docs/taxonomy/athar-unlisted-speakers.tsv
  (speaker as written, count, 2 example quotes) for the reviewer.
- Show on topic and branch pages as a separate section «من أقوال السلف» after the hadith, each item:
  the saying (no chain), «— <speaker ar>», and a small line «أثر، وليس حديثًا · <book>، رقم N». No grade badge, not
  counted in the «الأحاديث» tab (add a fourth tab «الآثار» only if the item count > 0; en: «Sayings of the Salaf»,
  label «A saying, not a hadith»). Build it with the existing reader/kit components.

## Phase 3 — hide account features from the public UI
- Hide: Sign in / Create account in the header and mobile menu, /login and /register (redirect to home), favorites
  nav link, /favorites (redirect), and every Save / bookmark control on quote cards. Put it behind one flag
  (e.g. NEXT_PUBLIC_ACCOUNTS_ENABLED=false) so the next phase can turn it back on. Admin login at /admin still works
  (admin route keeps its own login entry).
- Update the stale Playwright test that looks for the mobile «القائمة» button to the current header (do not change
  the header) and make the full Playwright suite green.

## Phase 4 — Ibn Abi al-Dunya (structure only, no topic links)
- Source: OpenITI 0300AH/data/0281IbnAbiDunya (64 entries, digital text; licence accepted). Import every work (pin
  commit + SHA-256 like the other importers) with the existing BookSection / SectionItem structure importer: kitab /
  bab headings in order, items AYAH (canonical verse via citation or quran-detector), HADITH, ATHAR (Phase 2
  classifier), AUTHOR_TEXT. One Source per work (Arabic title, e.g. «الصمت وآداب اللسان»، «ذم الغيبة والنميمة»،
  «التوبة»، «الصبر»، «الشكر»، «الرضا»، «اليقين»، «التوكل»، «الورع»، «الإخلاص والنية»، «محاسبة النفس»، «الحلم»،
  «التواضع والخمول»، «مكارم الأخلاق»، «مداراة الناس»، «ذم المسكر»، «ذم الملاهي»، «ذم الدنيا»، «قصر الأمل»، «قضاء
  الحوائج»، «اصطناع المعروف»، «الإخوان»، «ذكر الموت»، «القبور»، «صفة الجنة»، «صفة النار»، «التهجد»…).
- Run takhrij (matn only) on its hadith. Do NOT link any of it to topics — no book-level links (the Ibn Rajab error).
- Export docs/taxonomy/sections/ibn-abi-dunya/<work>.tsv (same columns as the other sections files) for the reviewer.

## Report — docs/build/SHUAB_ATHAR_REPORT.md
Phase 1 before/after numbers; classifier samples and counts (marfu / athar / listed speakers / unlisted);
screenshots of a branch page and /sins/ghibah showing «من أقوال السلف» (1440 + 390, ar + en); the hidden-auth check
(no sign-in, register, favorites or save visible); Ibn Abi al-Dunya works imported with section and item counts; real
output of every check.
