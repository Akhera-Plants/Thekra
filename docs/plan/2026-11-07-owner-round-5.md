# Owner round 5 — decisions from the review page (2026-11-07)

Source: the owner's choices on the interactive review (106 items: O-xx his own, F-xx feature critique, A-xx app,
W-xx web). Raw choices: `chosen.json` in the session scratchpad. Where two choices conflict, the owner said:
«خذ الأفضل عند التعارض حسب الـ UX» (F-34 note). Every resolution is listed here. Nothing outside this file is built.

## 1. Information architecture (O-03, F-01 b, F-33 note, F-32 a, A-02 note)

The owner: «ورد اليوم» and «عاداتي» must not both exist; «ورد اليوم» does not need to be a page of its own; inside
«عاداتي» the first tab is «ورد اليوم» and periodic acts are a separate tab; the home page has an entry to log habits.

### App (Expo Router)
- Tabs (3): **الرئيسية · عاداتي · المزيد**. The «ورد اليوم» tab and the «الإعدادات» tab are removed; the side drawer is
  removed (its groups move into «المزيد»). The header keeps the wordmark and gets one generic icon button
  «لحظة مجاهدة» (F-32 a, F-09).
- **عاداتي** (`app/(tabs)/habits.tsx`) has segmented tabs: **ورد اليوم · الدورية · محاسبتي · سجلّي**.
  - ورد اليوم: title row (date, next prayer line F-27, «حال يومي» chip, «أضف»); ONE heart card (priority: نية اليوم
    in the morning → evening review in its time → weekly review on its day → «عملك المعتاد يُكتب لك» the morning after an
    excuse, F-06/F-35/A-01: a one-line card with «ابدأ» that opens a sheet); «الفرائض» rows if enabled (F-05); habits of
    today (circle logs; the row opens the habit page; «صلّحها» offers the make-up deed after two missed days, F-08);
    periodic acts due today or overdue only (F-14); one collapsed «المزيد لليوم» row (شعبة الأسبوع, حصيلتي); «صحبتك: n
    حضروا اليوم» for circle members only (F-16). No top verse line (O-06 b).
  - الدورية: every periodic act + add; entry to «أهلي وناسي» (F-15).
  - محاسبتي: نية اليوم (its switch lives here), محاسبة المساء (start now), المحاسبة الأسبوعية, رسائلي إلى نفسي, the
    archive (F-07 a, A-12 a, A-25).
  - سجلّي: month calendar with occasion marks (F-17), per-habit commitment, the user's «تخفَّف» programs by name (A-22).
- **الرئيسية**: visitor = fixed order. Member = customizable sections (F-02 a) with «خصّص الرئيسية» at the end:
  ورد اليوم (progress + inline circles for the unchecked habits, logs directly — O-03), نص اليوم (F-23), شعبة الأسبوع
  (F-18), مناسبة قريبة (F-17), أبواب الخير, في لحظات مثل هذه, تذكرة مختارة, المصادر. Order/visibility synced.
- **المزيد**: تخفَّف · أهلي وناسي · صحبة · المحفوظات (النصوص | تذكيراتي) · استكشف النصوص · شعب الإيمان ·
  استراتيجيات العادات · then الإعدادات (الحساب, التنبيهات, أوقات الصلاة, اللغة والمظهر, عن ذكرى).
- Removed screens: `practice/calendar` (folded into سجلّي; F-17), `practice/duties` (F-28), `practice/pledges` (F-08),
  `practice/loops` entry (F-13: two optional questions in «أضف»), `names/*` UI (F-19; API stays), `practice/daily-text`
  (F-23: a home section with «⋯» for its source). `garden` stays as is (F-20 skip). Browse stays (F-21 skip).

### Web (Next.js)
| Page | URL | Old URL (redirect) |
|---|---|---|
| عاداتي › ورد اليوم | `/practice` | — |
| عاداتي › الدورية | `/practice/periodic` | — |
| عاداتي › محاسبتي | `/practice/review` | `/practice/reviews`, `/practice/pledges` |
| عاداتي › سجلّي | `/practice/record` | `/calendar`, `/practice/habits` |
| صفحة العادة | `/practice/habits/[id]` | — |
| أهلي وناسي | `/practice/people` | `/practice/kinship` |
| تخفَّف | `/practice/leave-sin` | — |
| المحفوظات (النصوص · تذكيراتي) | `/favorites`, `/favorites/reminders` | `/practice/my-reminders` |
| التنبيهات | `/settings/notifications` | `/practice/notifications` |
| أوقات الصلاة | `/settings/prayer-times` | `/practice/prayer-times` |
| استراتيجيات العادات | `/practice/strategies` | — |
`/names/*` is removed (redirect to `/`). Header: ONE menu for visitor and member (W-10 a): «أبواب الخير» (تخفَّف، الطاعات،
شعب الإيمان، تصفّح) then «للأعضاء» (عاداتي، أهلي وناسي، المحفوظات، الإعدادات، «صحبة (في التطبيق)» W-12 b).

### Shared map (F-34 a, W-11 c)
`packages/practice-core/src/nav-map.ts`: every feature's Arabic and English name and its web route and app route; a test
in each client fails when a name or place differs. The glossary inside it is for the owner to approve. «اقتباسات» → «نصوص».

## 2. Resolved conflicts
- F-01 b / W-01 a / A-02 a / F-33 note → the merge in §1 (logging only in «ورد اليوم» and the home entry).
- F-31 a vs A-14 a / W-02 a → F-31 a: the habit page is a summary (30 days, «زد خطوة», texts, loop answers) with one
  «عدّل» sheet (times, days, pause, delete behind «⋯» with confirm, A-15 a); no logging there except «صحّح السجل».
  The web gets the same page at `/practice/habits/[id]`.
- F-08 a vs F-07 a («التزاماتي» in محاسبتي) → F-08 a: no pledge set-up page; after two missed days «صلّحها» offers
  «أتبع السيئة الحسنة: اختر عملًا واحدًا اليوم» with the 12 deeds (+ sadaqah, custom). The «التزامك» card is removed.
- F-12 a vs A-24 a → F-12 a: strategies appear in their moment (add steps, «صلّحها», لحظة مجاهدة, المحاسبة); the
  library has one entry (المزيد); the weekly strategy reminder is removed (A-24 moot).
- F-22 a vs W-30 a → F-22 a: «تذكيراتي» lives in المحفوظات on both platforms; removed from web settings and from نص اليوم.
- F-29 note → the notifications page is rebuilt (one value-row style for day/time, A-29 a; feature switches move to
  their features); strategies are not there.
- F-17 note → no «مواسم الخير» page: occasions show on the سجلّي calendar and as an opt-in «مناسبة قريبة» reminder and
  home section; the ICS subscribe moves to التنبيهات.
- F-27 note → prayer times: the user types only a city (search), a trusted API (Aladhan `timingsByAddress` / city
  search) returns the times; no country code (A-32 superseded).
- F-09 note → «لحظة مجاهدة» tools are tied to the texts per sin (e.g. anger: seek refuge, sit down, silence), only where a
  public text supports them; generic tools otherwise. NOTE for the owner: the wudu-for-anger hadith (أبو داود 4784) is
  graded weak, so it is not used unless a public graded text supports it.
- A-17 note → home door cards: redo the branch art so it fits the card (as it did before), one button style on all cards.
- A-27 note, W-14, W-22, W-25, F-20, F-21 → not changed. A-19 (Arabic back label, contextual «الدليل» labels) is applied
  as an accessibility fix.

## 3. Everything else (as chosen)
O-02/A-06/W-03 pairs side by side, same size; O-04/A-05/W-23 flower SectionDivider between sections only; O-05/F-04/
A-03/W-05 heading «آيات وأحاديث تعينك على هذه الطاعة» / «…على ترك هذه المعصية»; O-07 auth throttle only on
login/register; F-03 a Quran audio (licensed per-ayah source, one reciter, no hadith audio); F-05 a «الفرائض» (opt-in,
outside the 3-habit limit, «صلّيتها في وقتها» / «قضاء»); F-10 a honest door labels + one primary «ابدأ» on topic pages;
F-11 a/A-21 a تخفَّف = «اليوم · رحلتي», one header, one counter; F-13 a; F-15 a «أهلي وناسي»; F-16 a; F-18 a; F-19 a;
F-23 a; F-24 a widget intro once + generic «لحظة مجاهدة» button; F-25 b extension link after the owner publishes it;
F-26 a onboarding (3 skippable steps); F-28 a; F-30 a; A-07..A-13, A-16, A-18, A-20, A-23, A-25, A-26, A-28..A-35 (as
recommended, except A-11 a toast, A-26 a field alignment); W-04, W-06, W-08, W-09, W-13, W-15..W-21, W-24 b (cards cut
to 4 lines + «اقرأ كاملًا»), W-27, W-28, W-29.

## 4. Data (needs the owner's go-ahead, backup first)
- A-04 a: rewrite `matnAr` of 3 quotes (7d5afc99…, 7935e301…, 2ec98004…) — verify on production first.
- W-07 b: a review list of every text with raw quote marks / footnote numbers / takhrij inside the matn; the owner
  reviews it, then a backup, then the update.
Neither runs before a fresh Neon backup and the owner's explicit OK.
