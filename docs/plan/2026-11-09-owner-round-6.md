# Owner round 6 — decisions after comparing with the reference design (2026-11-09)

Sources, in priority order (later overrides earlier):
1. The owner's chat message of 2026-11-09 (tabs, archive limit, «صلّحها», reciters, read/unread, phasing).
2. The owner's choices + notes on the comparison page (C-01a … C-32), exported to the session scratchpad
   `r6/r6-plan-input.txt` (each item: owner choice, owner note, designer answer).
3. The designer's answers (`r6/response/…/DECISIONS-AR.md`) — used only where the owner left an item without a note
   or explicitly accepted it.
4. Earlier plans (`2026-11-07-owner-round-5.md`) and the standing rules in `docs/guide/PROJECT_HISTORY_AND_LESSONS.md`.

The reference preview (scratchpad `ref-handoff/Thekra-Claude-Handoff/dist`, served on :8077) is the LAYOUT reference:
«تعلّم من ديزاينه بس خلّي الأشياء بالديزاين الحالي — خذ منه اللايوت وتوزيع العناصر». Our colours, type, components,
content rules and every working feature stay. Nothing is deleted unless listed under §9 (owner-chosen removals).

Phasing (owner): build everything agreed now; anything still unclear or needing more design goes to «المرحلة القادمة» (§11).
Do not ask the owner about things that follow from the current product.

---

## 1. Navigation and naming

- **Web header (C-07 b):** الرئيسية · الطاعات · تخفّف من ذنب · شعب الإيمان · عاداتي · المزيد ▾. «المزيد» holds
  الاستراتيجيات، المحفوظات، رفقة (في التطبيق). An item in «المزيد» never also appears in the header, and vice versa.
  «تصفّح النصوص» is removed (C-01l). Settings are ONLY in the account-avatar menu (C-05 a): الحساب، الإعدادات، الخروج.
- **App:** tabs stay الرئيسية · عاداتي · المزيد. «المزيد» list mirrors the web «المزيد» + الإعدادات, without «تصفّح
  النصوص» and without a people page.
- **«أهلي وناسي» does not exist any more (C-05, C-10, C-01i — «للمرة المليون»).** It becomes the periodic act
  «صلة الرحم والأحباب», one item INSIDE the periodic acts, never a main page, menu entry or tab. Same in every place
  (nav map, menus, notifications, strategies targets, redirects, copy).
- **Sin wording (C-01f):** never «ترك معصية» as a label; use «تخفّف من ذنب / من معصية» consistently.
- Update `packages/practice-core/src/nav-map.ts` + its tests to this.

## 2. «عاداتي» (owner chat + C-02a/b + C-01r + C-01d)

- **Top tabs (reference underline-tab style):** «اليوم · العادات · الأعمال الدورية · محاسبتي · سجلّي». No «الخطة»
  tab and no «ما يساند خطتك» block (owner: bad; those links belong in the menu).
- **Week calendar strip at the top (reference style) instead of the plain date.** The week starts on the user's review
  day (default Friday — the weekly review + next-week planning session). Unlogged past days are marked «لم تتم» in a calm,
  non-discouraging style. Future days are view-only.
- **«اليوم» tab:** its groups — «الفرائض» · «عادات اليوم» · «الأعمال الدورية» (due today) — are reachable WITHOUT
  scrolling: a badge/segment row (reference tab style) selects the group on phones; on desktop several groups show side
  by side. Habits grouped by time of day (بداية/خلال/ختام اليوم), inline counter for counted habits (reference).
- **«حال يومي» (C-01r):** opens a list: يوم عادي · مرض شديد · انشغالات طارئة · سفر … Choosing a hard state shows a
  gentle line («سامح نفسك اليوم…» for habits) and asks for the habit's minimum. Each habit has a «القدر الأدنى» the user
  sets (in the habit page / add flow) that is never lowered further. For sin programs the wording is different (no
  «سامح نفسك» on a slip; firm and kind). Replaces the current يومي ثقيل/عذر toggles (keep their data meaning).
- **Unlogged day (C-01j):** a past day with no entry asks «هل فعلتها؟» (فعلتها / لم أفعل); after the day ends without an
  answer it counts as «لم تتم». No empty entries. «صلّحها» keeps its name (owner chat) and lives in the gap context:
  the habit row when the gap condition holds, and the habit page tab «العودة بعد انقطاع».
- **«العادات» tab (C-02b, C-01d):** the user's habits with completion percentage and milestone lines
  («تعدّيت أصعب فترة»، «صنعت العادة»، «شارك تطورك مع الرفقة»); the archive (see below); a section «استراتيجيات صناعة
  العادات والثبات» instead of «ما يساند خطتك».
- **Archive = pause (one concept, name «الأرشيف») (owner chat + C-01d):** max **10** archived habits; beyond that the
  user must delete. Archiving more than **3 days** resets the habit's progress (streak/ladder start over when restored)
  — say so clearly when archiving. Logged history stays readable in سجلّي (no data deletion).
- **Limit (C-01d):** pressing «أضف» with 3 habits simply says: you have 3 — archive or delete one (two buttons), with the
  3-day progress note. «3 عادات كحد أقصى» line visible in «العادات».
- **«رسائلي إلى نفسي» (C-02c):** moves OUT of محاسبتي to a button at the top of «عاداتي» (or beside strategies): a list
  with add / edit / delete and a max count; also an optional, skippable step in the add-habit flow.
- **Sin programs become habits (C-02e):** «تخفّف» programs appear in «العادات» as habits of type «تخفّف». They are
  COVERED (hidden) by default: tapping asks fingerprint/PIN (app) or the privacy code (web) before showing details; the
  user may turn the covering off. Never blurred text — a neutral covered row. Encryption unchanged.

## 3. Habit page (C-02e a, C-27 a, C-03c)

- Reference tabs: «المتابعة · حلقة العادة · التذكيرات · العودة بعد انقطاع». Logging and a day note ARE on the habit page
  (owner overrides F-31). Keep our heading «آيات وأحاديث تعينك على هذه الطاعة» / «…على التخفّف من هذه المعصية» by type.
- **Two optional questions per day (C-27):** «ما الذي أعانك على الالتزام؟» / «ما الذي صعّب عليك؟» (for sins: «ما الذي
  أعانك على تجنّبها؟» / «ما الذي صعّب عليك تركها؟»). Their answers appear in سجلّي when a day is opened (week/month).
- Habit loop answers have their own form in «حلقة العادة»; for sins «حلقة المعصية».
- Desktop: wide header + two columns (follow-up | the texts).

## 4. «محاسبتي» (C-02c) and «سجلّي» (C-02d)

- محاسبتي = tabs «اليوم / الأسبوع» (+ «خطوتك القادمة» from the reference), desktop side column «وقفات سابقة». Kind but
  firm language; **no «حاسب نفسك الآن»**. Weekly review copy must be strong: e.g. «حاسب نفسك اليوم ليخفّ حسابك غدًا»،
  «ثقيلٌ الآن، خفيفٌ بعد». Do NOT quote «الكيّس من دان نفسه» as a hadith (weak); our own wording only, or a public text
  from the DB. Previous reviews are always reachable to learn from mistakes.
- **Uncertain labels** go into ONE list for the owner to decide later (`docs/plan/labels-to-decide.md`), not scattered.
- سجلّي = tabs أسبوع (table; future disabled) · شهر (our calendar + Hijri) · حصيلة (each habit's commitment, الفرائض,
  تخفّف). Full useful statistics. Tapping a slipped day: if that day/week has no review → offer to do it; if it has →
  show it, plus «تعلّم من الخطأ»: the path the habit took to being dropped; for تخفّف, the path of the sin and how to
  avoid it. The same reflection appears in the daily and weekly reviews.

## 5. الفرائض (C-01a)

Keep as is, plus **«قضاء الفوائت»**: the user enters how many prayers he owes (per prayer or total), sets a pace, logs
make-ups; a circular progress chart shows how much is done. Synced with the account. Kind wording.

## 6. Periodic acts (C-10, C-17, C-01i)

«الأعمال الدورية» is a main tab. It contains ALL periodic acts: 1) صلة الرحم والأحباب (the people lists — relatives,
parents, neighbours, friends, the sick — live INSIDE this act), 2) صدقة, 3) صيام الاثنين والخميس, 4) الأيام البيض,
5–8) four more worthy acts from the catalog (e.g. سورة الكهف يوم الجمعة، ختمة شهرية، عيادة المريض، صلاة التسابيح —
choose from `deed-schedules.yaml`, evidence-backed only), and the user can add his own and get reminders. Rows follow the
reference (C-24 a): visible **trash icon** (not ×) with confirm and an «تعديل» link. Migrate existing kinship data —
no data loss; old links redirect.

## 7. تخفّف and «لحظة مجاهدة» (C-15, C-16, C-01c)

- «تخفّف» (header/door) opens a searchable list of sins; from a sin page the title line has «تخفّف من هذه المعصية»
  (or, if already subscribed, the program's lock state). No «أنت مشترك» line there.
- Remove the visible «انتقل للمحتوى الرئيسي» text (skip link must be visually hidden until focused). Remove «محفوظ
  مشفّرًا في حسابك». Locked state shows «مقفل ✓»; tapping opens an unlock popup.
- «لحظة مجاهدة»: reference layout (one prominent act first, optional timer button). Each act is tied to the Qur'an/Sunnah
  or the salaf for that sin (current per-sin acts). **No «الدليل» buttons here**; instead two buttons: «نصوص تذكّرها»
  (the sin's texts) and «حلقة المعصية» (or «حلقة العادة»).

## 8. Home, reading, sharing, audio, settings

- **Home doors (C-06):** take the reference illustrations (leaf / arch / open book) into web and app, same look; take the
  WEBSITE button colours (text, background, border) into the app exactly.
- **«خصّص الرئيسية» (C-04):** only in Settings (not on the home page). Member default (C-11): short ورد اليوم then doors.
- **«في لحظات مثل هذه» (C-09):** controlled by us from the backend (API) for all users, not by the user. Negative states
  phrased as help: «تعينك على التخفّف من الغضب».
- **Topic page (C-12):** «أضف إلى خطتك» / «مُضاف إلى خطتك» on the title line opposite «ذكر الله» (for a sin: «تخفّف»);
  remove the imperative line; move «ابدأ صغيرًا» to the step before. Text cards: ONE button «عرض التفسير» (opens the
  reader); remove «لماذا هذه الآية؟» and the separate tafsir button from cards.
- **Reader (C-13, C-01n):** our design + three sections separated by the flower divider: the text · «وجه التذكير»
  (editorial, clearly labelled, with «أبلغ عن خطأ» under it) · the tafsir shown inline without a click: المختصر،
  السعدي، ابن عاشور (التحرير والتنوير) — from the DB. «وجه التذكير» content per (topic, text) is written later (§11);
  while linking texts, any text with no real link to its topic is REPORTED for the owner's review.
- **Read / unread (owner chat):** in topic pages, texts the user has read show «مقروء», others «غير مقروء» (+ filter).
- **Audio (owner chat):** several reciters to choose from (settings), not one.
- **Sharing (C-08):** image option (b design); text share properly wrapped and natural, ending «بواسطة تطبيق ذكرى» + link.
- **Favorites (C-14):** two tabs, with the reference line «احتفظ بما تحب أن تعود إليه».
- **Settings (C-03a):** reference two-column layout, our visuals; city name in Arabic; no decorative dividers between rows.
- **Notifications (C-19):** remove the calendar (ICS) file. Tabs: «العادات» · «الأعمال الدورية» (only the user's active
  ones; else an add button) · «النية والمحاسبة» · «الاستراتيجيات» (as the reference).
- **Strategies (C-18 a):** reference design: بناء / ترك / عودة + «طبّقها على عادة».
- **About (C-21):** reference design, our content. **404 (C-22):** reference component, button «العودة إلى الرئيسية».
- **Report a mistake (C-01s):** protect the endpoint from abuse (rate limit, size limits, dedupe).
- **رفقة (C-01k):** invite-only: the feature turns on for a user only when an existing member invites him.
- Keep: Western digits (C-23), our English/dark/footer/a11y (C-28–30, 32), prayer times (C-20).
- **Desktop (C-03b/d/e):** reference layouts with our visuals (ورد اليوم two columns; سجلّي calendar + side; forms ≤720px).

## 9. Owner-chosen removals (both platforms; API/data kept)

- «تصفّح النصوص» UI (C-01l). - «نص اليوم» home section and its source picker (C-01q). - ICS calendar file (C-19).
- «ما يساند خطتك» (C-02b). - «خصّص الرئيسية» button on the home page (moves to settings, C-04).

## 10. Unchanged on purpose

Onboarding (wording fixed), privacy/encryption, sync, account export/delete, widget, garden, prayer times, quran audio,
loading/error states, «شعب الإيمان».

## 11. «المرحلة القادمة» (not built now)

- «وجه التذكير» content for every (topic, text) link + causes of revelation summary — content work, owner reviews.
- The garden: ideas to give it deep meaning (proposals in the report, owner chooses).
- Occasions (C-01w): the owner is thinking of removing them and keeping only Mon/Thu + white-days reminders (opt-in in
  settings), or «في مثل هذا اليوم» from the Hijri calendar. Decide next phase; for now nothing new is added to occasions.
- C-31: explain to the owner (content-policy item) before acting.
- Labels the owner marks as uncertain (`labels-to-decide.md`).
