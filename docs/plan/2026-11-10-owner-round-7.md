# Owner round 7 — notes after round 6 (2026-11-10)

Source: the owner's message of 2026-11-10 (5 screenshots) and his answers to four questions. Each item has an id; the
QA pass checks every id on the web AND the app. Owner's closing line: «تأكد انك تصحح كل الي ذكرتلك ياه هون وتراجعه
منيح بعدين تطلع النتيجة».

## R7-A. Identity: colours, dialogs, toasts, icons (web + app + extension)
- **A1 colours.** The warm cream/ivory that comes with the green (page background `#fffcf9`, logo lines `#FFF5EE`,
  cream foregrounds such as `--destructive-foreground`) becomes white or near-white. Gold/cream accents that sit with
  the green go too («بدل الذهبي او الكريمي»). The green itself does not change. Owner: «هاد اهم جزء» — the colours read
  as AI-made. Applies to every button, surface and the logo, on web, app, extension and icons.
- **A2 no native components.** No `window.confirm`/`alert`, no `Alert.alert`, no stock-looking dialogs. Every
  confirmation (e.g. «غيّر الرمز») is a small custom modal in our identity, the same on web and app.
- **A3 popups and toasts redesigned** to match the identity: title type style, body text, one primary action styled as
  the rest of the system, secondary bordered, close control, spacing, motion. Avoid everything that looks AI-made.
- **A4 modal titles** use our heading font, size and colour (screenshot: «ابدأ صغيرًا جدًا» and «رمز الخصوصية» titles
  are small grey text).
- **A5 profile icon**: a nicer, smoother avatar/profile icon on web and app.

## R7-B. Texts, topic pages, reader (web + app)
- **B1** Topic page: less space between the title («إكرام الجار») and «آيات وأحاديث تعينك على هذه الطاعة».
- **B2** The read filter (الكل · غير المقروء · المقروء) sits on the same row as the sub-topic filter (الكل · حق الجار… ·
  إكرام الجار…), separated by a bold, clear «|»-like divider in our identity.
- **B3** The grade badge («صحيح», «حسن», …) moves up beside the type badge («حديث نبوي»). No check mark in any grade
  badge — just the word.
- **B4** The source appears once: keep the source badge («صحيح البخاري، رقم 2595») and remove the plain line («رواه
  البخاري، رقم 2595»). Everywhere the source sits next to the grade, it is a badge.
- **B5** Buttons on a text card: «عرض التفسير» / «عرض الشرح» are primary (theme); «تعليم كمقروء» is outlined and clear.
- **B6** Tafsirs side by side as tabs (pick المختصر / السعدي / ابن عاشور), as they were before — never stacked under
  each other — on web and app, everywhere they appear.
- **B7** Quote text looks cut (e.g. `#quote-11e4a589-7218-48bb-8db6-4a3f35898df4-text > div > blockquote`). Make sure
  the full text renders correctly on web and app.
- **B8** An ayah badge says «آية قرآنية · الأنعام 6:121»; drop the extra «القرآن الكريم».
- **B9** The «تذكير تعرف مصدره» (sources) section is web only; remove it from the app home.
- **B10** Favourites page: check it (designer reported «خطأ غير متوقع» on the live site) and fix.

## R7-C. Habits (web + app)
- **C1** Strategies: the family chips (الكل · للبناء · للترك · للعودة) go under «استراتيجية واحدة تكفي للبداية», not on
  its line.
- **C2** Strategies: review every strategy's content and its «طبّقها» flow; what is shown inside each is not accurate.
  Every one must be correct.
- **C3** Habit page: «تعديل» → «تعديل العادة». Do not show the minimum amount again lower on the page when it is in the
  habit header; it is edited from «تعديل العادة».
- **C4** Calendar: tapping a day with entries shows what was recorded that day (the two questions «ما الذي أعانك…» /
  «ما الذي صعّب عليك…», the day note and any other optional field) in a well-designed view.
- **C5** Editing a habit is reflected everywhere at once (home «ورد اليوم», عاداتي, سجلّي, widget…).
- **C6** The privacy code is optional for a «تخفّف» program: «تخطَّ» while starting; the user can set it (and choose to
  hide the program) later from inside the habit itself.
- **C7** «الحديقة» is renamed «بستان العادات» everywhere. (Owner may later make it replace «عاداتي» — not now.)

## R7-D. «صحبة» (was «رفقة»)
- **D1** Rename «رفقة» → «صحبة» everywhere: UI (web, app), notifications, nav map, glossary, docs, store text. Miss
  nothing. English stays "Circle"/"Companions" as already used unless it says "Rifqa".
- **D2** «إعداداتي» in the صحبة page moves to the top as an icon button (settings/edit icon), not a section at the bottom.
- **D3** An «دعوة» button at the top of the page opens the invite part (the code + «شارك الرمز»). The code block is
  redesigned: full width on the phone, a distinct background.
- **D4** The last-7-days calendar is redesigned and named «إنجازات الصحبة خلال آخر 7 أيام» — eye-catching.
- **D5** Rounds/status messages, modelled on the owner's sample from a real study group: a member announces a round
  («بدأت عادة», «فترة تركيز», «جلسة مذاكرة» … with what and how long, e.g. 43 دقيقة), even if it is not one of their
  habits; then «تم الحمد لله» / «لم يتم». If they do not finish, the others can send encouragement; when they finish,
  the others can send congratulations; after finishing they can start the next round straight away (time + what).
- **D6** Instead of only «أرسلت اليوم», suggested message options tailored to what the صحبة is for: share progress in
  habits, encourage and be encouraged, help someone with a message, keep them steady on an act of obedience.
- **D7** A chat-like feed of all the messages, with copy and «احتفظ بها» (keep a message for later, as a help).
- **D8** Report abuse — two kinds: report a member, report a message.
- **D9 (later, remind the owner)** Rotating the suggested messages every 2–3 days so they do not become stale, without
  showing who sent which. Not built now.
- Owner said he will send an image of the group-chat style he means; adjust D5–D7 to it when it arrives.

## R7-E. Content and data
- **E1** «أبلغ عن خطأ»: a reported text is never hidden automatically, however many reports it gets; only the owner
  hides it.
- **E2** Backup: a full database backup, encrypted (the repo is public), uploaded as a GitHub release asset of Thekra;
  the password is given to the owner only in a file in the session, never committed. Status 2026-11-10: the
  encrypted file (AES-256, `openssl enc -aes-256-cbc -pbkdf2 -iter 600000`) and the password file were sent to the
  owner; the release upload from the session was blocked by the environment's safety check, so the owner uploads it.
- Visible links: only 8,253 of the ~29k links point to public texts (the rest are hidden texts, never shown); E3
  covers those 8,253 first.
- **E3** «وجه التذكير»: after E2, write one line (Arabic + English) for every text–topic link (SinQuote 4,281,
  GoodDeedQuote 13,863, ImanBranchQuote 10,991) and add them to the database. Owner chose «all of them, straight to DB».
  Content rules hold: no quoted text, no grading claims, no promises the text does not make; a link whose text does not
  really support the topic gets a `reminderConcern` instead of an angle.

## Answers to round-6 questions
- Report rule: E1 (not «3 reporters»).
- Garden: C7.

## Status 2026-11-10 (E3 done)
- «وجه التذكير» written to production for the 8,253 public links: 6,926 lines (Arabic + English) and 1,327
  `NO_REAL_LINK` concerns (SinQuote 1,370 / 346, GoodDeedQuote 4,260 / 927, ImanBranchQuote 1,296 / 54). Only empty
  fields were written (`reminderAngle IS NULL`, `concern IS NULL`); nothing else changed. The backup of that morning
  (all 49 tables, 2026-11-10T08:55Z) was the pre-write backup; the owner has its encrypted copy.
- The concerns are listed at `GET /v1/admin/link-concerns` for the owner to decide (they do not hide a text). The count
  is high (16%): most are verses/hadiths attached to topics they do not belong to by the old keyword matching; the owner
  should review the topic mapping (worst: «التوبة والاستغفار», «ذكر الله», «الجهاد», «الغضب»).
- ~21k links to hidden/unreviewed texts have no line (never shown).
