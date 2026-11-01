# Owner round 3 (2026-11-01): build 16 feedback

Source: the owner's notes on test build 16 (screenshots of a contemporary sin page, «ورد اليوم» after the day is
done, «أضف», «لحظة ضعف»). His answers to the four open questions are included. Everything applies to the app AND
the website wherever the feature exists on both, with the same names.

## Decisions (owner answers)
- «خربانة؟ صلّحها» moves inside each habit in «عاداتي»: when a habit is missed or stumbled, its own row offers
  «صلّحها» (good deeds and «تخفَّف» programs alike).
- «تخفَّف» data (programs, check-ins, sin loops) is always stored in the account **encrypted** (the server cannot
  read the sin); the device unlocks it (fingerprint/biometrics on the app). Nothing says «على جهازك فقط» anywhere.
- «لحظة ضعف» is renamed **«لحظة مجاهدة»** everywhere.
- «مواسم الخير» gets two tabs: «المناسبات القادمة» (with «اشترك في التقويم» and «نزّل ملف التقويم» = all upcoming
  occasions, «أضفها إلى تقويمك») and «الشهر» (the month calendar). The Hijri adjustment opens from an icon (popup),
  not inline under the page.

## Items
1. Screenshots: never block screenshots anywhere in the app (remove any FLAG_SECURE / screen-capture prevention).
2. Topic pages: the type filter tabs (الكل · الآيات · الأحاديث · الآثار/أقوال العلماء) must exist on EVERY topic page,
   including contemporary topics (e.g. «النظر المحرّم عبر الشاشات», whose texts come from derived topics) — they are
   missing there today.
3. Remove «الميزان» entirely (every page, app and web). The API field stays for old builds.
4. Day done («تمّ وردك اليوم»): no hadith. One short achievement line from a rotating list, e.g. «أكملتَ يومًا آخر من
   عملٍ يحبّه الله», «ازددتَ قربًا من الله اليوم». Plain UI copy, no attributed text.
5. «ليست مطلوبة اليوم» → a kinder label, e.g. «اليوم استراحة من هذه العادة».
6. A habit is never shown under «أعمال دورية» (Duha appeared in both). «أعمال دورية» always comes after all the
   habit sections.
7. «شعبة الأسبوع» shows only if the member chose to study the branches of faith (a setting/opt-in); long titles must
   wrap inside the card (it overflowed the screen).
8. «عملك المعتاد يُكتب لك» (the hadith about sickness/travel): not after tapping «يومي ثقيل» / «عذر». Show it only
   when a day has passed and the member's commitment over the period is above 60%. Remove «عذر أمس» entirely.
9. Add a chart of the commitment rate per habit (in «عاداتي» › statistics).
10. «أضف» sheet: «عادة» · «عمل دوري» (with ALL periodic templates, not only «قريب»; say clearly these are reminders
    only, no commitment tracking like habits) · «تخفَّف».
11. Adding a habit from inside another flow (e.g. «عادات خير بديلة» in «تخفَّف») must use the same stepper as the
    normal add, never a wall of text.
12. Inside «تخفَّف»: tabs instead of one long page.
13. Strategies («استراتيجيات العادات»), «جرّبها»: each option is practical and general, not tied to one sin. A sin-
    specific example appears only after tapping «مثال» (popup). Each strategy gives fitting content: «أتبِع السيئةَ
    الحسنة» offers a short list of easy, high-reward good deeds (catalog `easyHighReward`: e.g. برّ الوالدين، صدقة
    السر، الإصلاح بين الناس…) that link to those deeds/habits — never a jump into «تخفَّف».
14. «لا تفوّتها مرتين» is not listed in strategies. It appears in context the day after a habit is missed (not on the
    first missed day's list of strategies), in «ورد اليوم» / the habit row.
15. «لحظة مجاهدة» (was «لحظة ضعف»):
    - Verses of patience and steadfastness, rotating (catalog `mujahadaVerses`), and Ibn al-Qayyim sayings if in the
      DB (`mujahadaSayings`) — never «قل يا عبادي الذين أسرفوا» during the struggle.
    - Remove the option «يفتح الهاتف بلا رقم/هدف».
    - «افعل واحدة الآن» goes to the TOP. Every option either does something (opens a tool) or is clearly display-only;
      nothing that looks tappable and does nothing.
    - New option while the timer runs: an electronic tasbih/dhikr counter that shows the timer and counts, and shows
      the reward arithmetic (count × 10 up to × 700, «إن قبله الله», from `multiplierHadith`).
    - Minimum-wird option: do a smaller amount of the usual wird and log it (e.g. a shorter prayer, or praying a
      nafl sitting: half the reward, from `sittingPrayerHadith`).
    - «عبرت الموجة» → a better line about the reward of striving (e.g. «جاهدتَ نفسك، والله يرى جهدك»).
    - Never «وقعت»; use healthy, non-shaming language for a slip.
16. Limits: up to 3 habits at once while they are under 3 months; after 3 months more can be added. Up to 3 sins at
    once, and each running one must have lasted at least 2 months before another starts (practice-core).
17. Habit loop builder: «ابنِ حلقة عادتك الخاصة» (طاعات) — pick a habit, answer a short template (cue, craving/
    intention, routine, reward, obstacle, if-then), saved on the plan (`loops`, synced), viewable and editable, more
    than one loop per habit. «حلقة المعصية» — same with the sin template, inside the encrypted «تخفَّف» data,
    unlocked with the fingerprint on the app.
18. Section dividers: on every page with more than one sub-section (e.g. strategies «قبل أن تبدأ» then the next),
    an ornamental divider like the home page's between sections. Whole app and website.
19. Remove every «على جهازك فقط» / device-only wording.
20. Fix the build-16 bugs found while capturing screens: «المحفوظات» crash after saving (wrong response shape and
    `/favorites/ids` vs `/favorites/quote-ids`), `type[]=`/`tag[]=` query encoding rejected by the API (sin tabs,
    feelings), «تذكيراتي» showing the raw «{n} من {max}».
</content>
</invoke>
