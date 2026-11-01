# Thekra redesign — final decisions and execution order (owner-approved 2026-10-31)

Source: the owner-reviewed plan (artifact «خطة إعادة تصميم ذكرى», v1–v3) plus the owner's answers. This file is the
single reference for every phase. Arabic is the product language; English strings mirror it.

## 0. Product philosophy («لِمَن كان له قلب»)

App name and tagline come from one verse: ﴿إِنَّ فِى ذَٰلِكَ لَذِكْرَىٰ لِمَن كَانَ لَهُۥ قَلْبٌ أَوْ أَلْقَى ٱلسَّمْعَ وَهُوَ شَهِيدٌ﴾ (ق ٣٧).
Following Ibn al-Qayyim (opening of «الفوائد»), every feature must serve one of four conditions:

1. «لذكرى» — the authentic text (library, «الميزان», daily text). Only sahih/hasan; source always shown.
2. «لمن كان له قلب» — a living heart: habits that revive it (dhikr, Quran, prayer), «تخفَّف» that cleans it, شعب الإيمان.
   Supporting text: «مثل الذي يذكر ربه والذي لا يذكر ربه مثل الحي والميت» (sahih in the site DB).
3. «أو ألقى السمع» — attention: one text at a time, one job per screen, one helper line max, few notifications.
4. «وهو شهيد» — presence: «نية اليوم», «لحظة ضعف», المحاسبة; no points, ranks or comparisons.

## 1. Names (final)

| Concept | Arabic | English |
| --- | --- | --- |
| Daily screen | ورد اليوم | Today's wird |
| Library | أبواب الخير (tab/nav: الأبواب) | Gateways of good |
| Progress area | سجلّي | My record |
| Settings | الإعدادات | Settings |
| Habits being built | غِراس (state «قيد الغرس») | Saplings |
| Established habits | عادات راسخة | Established habits |
| Periodic acts | أعمال دورية | Periodic acts |
| Streak | المداومة (number + gold flame) | Streak |
| Make-up of a missed day | قضاء | Make-up |
| Excused day (sick/travel) | عذر | Excused |
| Running total | حصيلتي | My tally |
| Topic header | الميزان | The scale |
| Private sin program | تخفَّف | Lighten |
| Rescue button | لحظة ضعف | A weak moment |
| Morning card | نية اليوم | Today's intention |
| Self-pledge | التزام شخصي | Personal pledge |
| Review | المحاسبة (evening, Friday) | Self-review |
| Strategies library | استراتيجيات العادات | Habit strategies |
| Curated text sets | مجموعات التذكير | Reminder sets |
| User's own lines | تذكيراتي | My reminders |
| Occasions | مواسم الخير | Seasons of good |
| Kept: | عاداتي، يومي ثقيل، خربانة؟ صلّحها (sin program), صحّح سجلّك (web log fix), شُعب الإيمان | |

No person's name (lecturer, author) inside the product. «بستاني» is removed from the UI (data kept).

## 2. Structure

- Mobile tabs: الرئيسية · ورد اليوم · سجلّي · الإعدادات (done in be74a0f).
- Web header: ورد اليوم · الأبواب · سجلّي (+ account menu; a real mobile menu). «التقويم» leaves the header.
- Web home and flow (owner, 2026-11-01): no verse hero; «لِمَن كَانَ لَهُۥ قَلْبٌ» stays the header tagline. «أبواب الخير» is the
  top of the page for guests, with the original names «أعنّي على ترك معصية» · «أعنّي على فعل طاعة» · «شُعَب الإيمان»; then
  moments, «تذكرة مختارة» with «باب من الخير», reflection, sources. «مواسم الخير» and «الأسماء الحسنى» are not on the home
  (the Names are hidden everywhere; pages answer with noindex).
- Practice is for members: every `/practice/*` page sends a guest to «تسجيل الدخول» and back (`?next=`); the
  `NEXT_PUBLIC_ACCOUNTS_ENABLED` switch is removed, accounts are always on. Header: guest «الأبواب» + «تسجيل الدخول» ·
  «إنشاء حساب»; member «ورد اليوم» · «الأبواب» · «السجل» + account menu (sign-out). On the home a member sees «ورد اليوم»
  and «السجل» as two door-sized cards above the doors. «سجلّي» is renamed «السجل» (web and app).
- Less text (owner rule): no date line on «ورد اليوم» or «مواسم الخير» (the calendar holds the date). «مواسم الخير»: one
  action «أضف مواسم الخير إلى تقويمك» (no subscribe link), one lead line on tying a season to a habit, and «اجعلها عادة»
  on each occasion that has a habit. English face: Source Sans 3.
- مواسم الخير: one page inside أبواب الخير (occasions list/month + ICS subscribe); today's occasion shows in ورد اليوم.
- Gregorian dates by default; Hijri shown only when the setting is on (both clients).

## 3. Rules

- Limits: 3 غراس (daily or weekly building habits), 7 أعمال دورية (a kinship list counts as one), 1 «تخفَّف» program
  (a second only after the first reaches its last stage). At a limit: «أكمل ما عندي» (primary), «أوقِف غرسًا مؤقتًا»
  (pause keeps history), «احذف غرسًا»; plus «ثبّت … وابدأ الجديدة» when a sapling is graduation-ready.
- Graduation to راسخة: ≥ 66 days old and ≥ 80% adherence over the last 30 days; offered, never automatic. راسخة: lighter
  reminders, weekly glance, do not count toward the 3.
- Streak with mercy: counts days a habit is asked for; a missed day can be made up (قضاء) until Dhuhr of the next day
  (default 12:00 local when prayer times are unknown); «عذر» marks sick/travel days that keep the streak; heavy-day minimum
  counts; never show 0 in red — show «مداومتك الجديدة: يوم 1 · أطول مداومة: N». «لا تفوّتها مرتين»: after a miss, the habit
  is first in ورد اليوم with its minimum.
- Sin program: no streak that resets; show «ثبتّ X من 30» and «منذ آخر توبة: N».

## 4. Phases (execute in order; each ends with checks, commit, push to main+master, Android test APK)

1. Web: ورد اليوم + سجلّي (mirror mobile), header, home (§2), مواسم الخير page, philosophy in /about; mobile: remove
   بستاني entry, move calendar link to مواسم الخير.
2. Limits + pause + graduation; أعمال دورية as a real model (templates: صلة الرحم، برّ الوالدين، تفقّد الجيران، تفقّد صديق،
   عيادة المريض (on demand)، الأيام البيض، الاثنين والخميس، الكهف يوم الجمعة، صدقة أسبوعية، ختمة، زيارة القبور; rhythms;
   optional people); streak mercy (قضاء، عذر، لا تفوّتها مرتين). Web + mobile + extension rules agree (practice-core).
3. تخفَّف: لحظة ضعف (10-minute urge timer, rotating text, one-tap actions, «عبرت الموجة؟»), evening check-in with optional
   triggers (time/place/feeling), «متى تضعف؟» on-device summary after 14 check-ins, «خربانة؟ صلّحها» 4 steps, stages as a
   line with one weekly task, readable notebook, no-reset counters.
4. المقامات الستة (نية اليوم; reminders; evening + Friday المحاسبة; التزام شخصي opt-in; «أقل ما يمكن»; «رسالة إلى نفسي»),
   notification policy (≤ 4/day with digest, quiet 23:00–Fajr except night prayer, second slot only if not done, evening
   nudge opt-in, strategies ≤ 1/week opt-in, one settings screen for all).
5. Knowledge & heart: الميزان on topic pages, topic template (الميزان → one action → texts → شعب links → opposite),
   حصيلتي with ikhlas/gratitude lines, stories at moments, celebration «تقبّل الله منك», habit-loop & consistency cards,
   استراتيجيات العادات (14), شعب الإيمان map + «شعبة الأسبوع», onboarding stepper with skippable hints.
6. Screen & devices: home-screen widget (needs native targets), مجموعات التذكير (admin + 5 starter sets from published
   texts), تذكيراتي, extension new-tab page, prayer-time anchors (city; «دقيق» via AlAdhan).
7. Later: الأسماء الحسنى with the same topic template.

All new religious text shown to users must be sahih/hasan in the site DB or marked for the sheikh and hidden until reviewed.
