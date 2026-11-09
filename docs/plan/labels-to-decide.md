# Labels to decide (owner round 6)

One list for the owner (round-6 plan §4: uncertain labels are collected here, not scattered). Each line: the label as
built, where it shows, and the alternative. Workers append their own section.

## Website (web B: header, home, settings, notifications, strategies, تخفّف, reader, share, saved, about, 404)

| Built as | Where | Alternative / question |
| --- | --- | --- |
| «استراتيجيات العادات» | header «المزيد ▾» item (nav-map name) | the brief says «الاستراتيجيات»; the shorter name would need a nav-map change on both platforms |
| «في خطتك» | a sin page's title line when this sin's «تخفّف» program runs and is open (web and app) | «برنامجك»، «تتخفّف منها» |
| «مقفل» + ✓ / «أقفل» | «تخفّف» lock state (sin page, `/practice/leave-sin`) | «مقفول» |
| «عرض التفسير» (verse) / «عرض الشرح» (hadith) | the one button on a text card | the owner wrote «عرض التفسير» for every card; for a hadith «الشرح» is the accurate word |
| «مقروء» / «غير مقروء» + filter «الكل · غير المقروء · المقروء» | text cards on topic pages (members) | — |
| «وجه التذكير» + «صياغة تحريرية من ذكرى تربط النص بالموضوع، وليست تفسيرًا…» | the reader, when a link has its line | shorter note |
| «للبناء · للترك · للعودة» | strategies filter (C-18 a) | «بناء · ترك · عودة» |
| «طبّقها على عادة» / «ابنِ الحلقة» | strategies | — |
| «ذكّرني بها» / «يُذكَّر بها» | each strategy (weekly reminder) | — |
| «نصوص تذكّرها» / «حلقة المعصية» | «لحظة مجاهدة» | «نصوص تعينك» |
| «ابدأ عشر دقائق» / «دقائق تختارها أنت» | «لحظة مجاهدة» timer | — |
| «التجربة» / «الحساب والبيانات» | settings group titles (from the reference) | «المظهر والتذكير» / «حسابي» |
| «القارئ» | settings: the reciter row | «صوت التلاوة» |
| «إخفاء برامج التخفّف» | settings switch (covering of «تخفّف» rows in «العادات») | «غطِّ برامج التخفّف» |
| «النية والمحاسبة» tab holds «محاسبة المساء» | notifications (web and app; practice-core `NOTIFICATION_GROUPS` matches) | — |
| «بواسطة تطبيق ذكرى» | last line of a shared text and the share image footer | «تمت المشاركة من ذكرى» (the C-08 mock) |
| «لم نجد هذه الصفحة» | 404 body heading | — |
| «احتفظ بما تحب أن تعود إليه.» | saved page lead (C-14) | — |

## App (app B: «المزيد», home, settings, notifications, strategies, تخفّف, لحظة مجاهدة, topic pages, reader, share, saved, رفقة, about, 404)

The app uses the same words as the web lines above wherever both have the label («عرض التفسير / عرض الشرح»، «مقروء / غير
مقروء»، «وجه التذكير»، «للبناء · للترك · للعودة»، «طبّقها على عادة»، «نصوص تذكّرها»، «حلقة المعصية»، «ابدأ عشر دقائق»، «القارئ»،
«إخفاء برامج التخفّف»، «بواسطة تطبيق ذكرى»، «احتفظ بما تحب أن تعود إليه.»). Only the app's own lines:

| Built as | Where | Alternative / question |
| --- | --- | --- |
| «مقفل» + ✓ while locked, «في خطتك» while open (as on the web) | app sin page title line; «مقفل» tap → popup «افتح القفل» | — |
| «أقفل» | «تخفّف» page title line (locks it at once) | «اقفله الآن» |
| «تخفّف من هذه المعصية» / «أضف إلى خطتك» / «مُضاف إلى خطتك» | topic page title line (C-12) | — |
| «افعل هذا الآن» · «أو واحدة من هذه:» · «دقائق تختار أن تبدأها أنت» | «لحظة مجاهدة» panel | «فعلٌ لك الآن» |
| «قراءة النص» | the reader's title | «التفسير» / «الشرح» (round 5 titles) |
| «صياغة تحريرية من ذكرى للتذكير، وليست تفسيرًا ولا شرحًا منسوبًا لعالم.» | under «وجه التذكير» in the reader | the web's note |
| «المختصر في التفسير» · «تفسير السعدي» · «التحرير والتنوير (ابن عاشور)» | reader section headings | — |
| Strategy groups: بناء = ابدأ صغيرًا، اربطها بصلاة، «إذا… فإني…»، هيّئ مكانك، اجمعها بما تحب، ابدأ في موسم، الصحبة الصالحة · ترك = صعّب طريق المعصية، اعرف متى تضعف، اركب الموجة، أتبع السيئة الحسنة · عودة = اقضِ ما فاتك، حاسب نفسك (لا تفوّتها مرتين) | strategies filter (C-18 a) | the grouping is ours |
| «طبّقها على عادة» fills one loop question with the example (ابدأ صغيرًا → الفعل؛ اربطها بصلاة، هيّئ مكانك، ابدأ في موسم → الإشارة؛ «إذا… فإني…»، اقضِ ما فاتك → «إن… فإني…»؛ اجمعها بما تحب، حاسب نفسك → المكافأة؛ الصحبة الصالحة → النية) | strategies → the habit's loop, reviewed before saving | — |
| Notification tabs «العادات · الأعمال الدورية · النية والمحاسبة · الاستراتيجيات» | settings › التنبيهات (the row scrolls at 390px; the 4th tab is half visible until scrolled) | «الاستراتيجيات» → «أفكار» to fit one row |
| «أدخل رمز الدعوة» · «فعّل رفقة» · «دعواتي» · «أنشئ دعوة» · «ألغِ الدعوة» · «تعمل حتى …» | رفقة (invite-only, C-01k) | «اكتب رمز الدعوة» |
| «رفقة تُفتح بدعوة من عضو فيها. اطلب رمز دعوة ممن تعرف.» | رفقة, 403 CIRCLES_NOT_ENABLED | — |
| «أرسلت بلاغات كثيرة في وقت قصير. شكرًا لحرصك، وحاول بعد ساعة.» / «استقبلنا بلاغات كثيرة اليوم فتوقّف الإرسال مؤقتًا…» / «الملاحظة أطول مما نستقبل…» | «أبلغ عن خطأ» (429 REPORT_RATE_LIMITED / 429 REPORTS_PAUSED / 413) | — |
| «العودة إلى الرئيسية» | 404 button (C-22) | — |
| «إلى أبواب الخير» | saved, empty state action (was «استكشف» → the removed browse page) | — |
| «أن أتخفّف من ذنب» | onboarding goal (C-01f; was «أن أترك معصية») | «أن أتخفّف من معصية» |
| City names in Arabic (Amman → عمّان …) | «المزيد» prayer-times value, prayer-times screen | a fixed list of certain names only; others stay as typed |

## App «عاداتي» (app A: tabs, اليوم, العادات, الأعمال الدورية, محاسبتي, سجلّي, habit page, add flow, قضاء الفوائت)

Keys live in `mobile/src/lib/i18n/{ar,en}.json` under `habitsHub` unless noted.

| Built as (ar · en) | Where | Alternative / question |
| --- | --- | --- |
| «سامح نفسك اليوم، وأدِّ القدر الأدنى.» · «Go easy on yourself today, and keep to the minimum.» | «اليوم», under the date on a hard «حال يومي» | «سامح نفسك اليوم، والتزم بالقدر الأدنى» |
| «مرض شديد · انشغالات طارئة · سفر» · «Seriously ill · Sudden demands · Travelling» | «حال يومي» list | «ظرف طارئ» for «انشغالات طارئة» |
| «لم تتم» (strip, table) / «تمّ بعضها» · «Not done» / «Partly done» | week strip, سجلّي › أسبوع | «لم تُنجز» |
| «هل فعلتها؟» + «فعلتها / لم أفعل» + «إن لم تُجب قبل انقضاء الأيام الثلاثة تُحسب «لم تتم».» | «اليوم» card, day sheet | shorter note, or none |
| «بداية اليوم · خلال اليوم · ختام اليوم» | «اليوم › عادات اليوم» bands (by the habit's first reminder: before 10:00 / before 18:00 / after) | the band cut-offs (10:00, 18:00) are ours |
| «القدر الأدنى» (also `practice.heart.minimum`, was «أقل ما يمكن»; `practice.heart.minimumMet` «سجّلت القدر الأدنى») | «اليوم» row button, habit page row, add step 2 | — |
| «تعدّيت أصعب فترة» · «صنعت العادة» · «شارك تطورك مع الرفقة» | «العادات» rows, habit page | the owner's words, kept as written |
| «3 عادات كحد أقصى · لديك 2» | «العادات» header line | — |
| «تخفّف · مغطّى» + «اضغط لتفتحه ببصمتك أو رمز جهازك» · «Lighten · covered» | «العادات», a covered program row | «برنامج خاص» |
| «اكشفها» · «Show» | سجلّي (day sheet, حصيلة): reveal «تخفّف» after the device lock | «افتحها» |
| «الأرشيف (n من 10)» · «أرشِف» · «أعِدها» · «يبدأ تقدّمها من جديد إن أعدتها» / «تحتفظ بتقدّمها إن أعدتها حتى …» | «العادات», habit page «⋯» | «استعِدها» for «أعِدها» |
| «لديك 3 عادات» + «أرشِف عادة / احذف عادة» | «أضف» past the limit (C-01d) | — |
| «رسائلي إلى نفسي» entry line «سطر تعود إليه في يوم صعب» | top of «العادات» | the owner allowed «beside strategies» too |
| «استراتيجيات صناعة العادات والثبات» → row «استراتيجيات العادات» | «العادات», last section | — |
| «سجّل العمل» / «سُجّل اليوم» / «تعديل» / trash icon | «الأعمال الدورية» rows (C-24) | «تمّ» for «سجّل العمل» |
| «افتح القوائم» | «صلة الرحم والأحباب» row | «الأشخاص» |
| «عمل من عندك» · «An act of your own» | add a custom periodic act | «عمل تختاره» |
| «حاسب نفسك اليوم ليخفّ حسابك غدًا.» (lead) · «ثقيلٌ الآن، خفيفٌ بعد.» (week lead) | «محاسبتي» | the owner's examples, our wording |
| «خطوتك القادمة» + «{choice}: {habit}» | «محاسبتي» top card | — |
| «وقفات سابقة» · «Earlier reviews» | «محاسبتي › الأسبوع» | «محاسباتي السابقة» |
| «تعلّم من الخطأ» + «انظر الطريق الذي أوصلك إلى الترك، لتسدّه في المرة القادمة.» | سجلّي day sheet, محاسبتي, habit page «العودة بعد انقطاع» | — |
| «حاسب نفسك على ذلك الأسبوع» | day sheet of a slipped day without a review | «ابدأ محاسبة ذلك الأسبوع» |
| «انظر ما سبق الزلّة: الوقت والمكان والشعور، وسدّ ذلك الباب قبل أن يُفتح.» | day sheet, «تخفّف» part after a weak day or a slip (firm, no «سامح نفسك») | — |
| «المتابعة · حلقة العادة · التذكيرات · العودة بعد انقطاع» · «Follow-up · Habit loop · Reminders · Coming back» | habit page tabs | «العودة» (shorter, fits one row with large text) |
| «سؤالان اختياريان» + «ما الذي أعانك على الالتزام؟» / «ما الذي صعّب عليك؟» + «ملاحظة لهذا اليوم» | habit page › المتابعة | — |
| «صلّحها» (section title and button) + «إن انقطعت، فارجع في اليوم التالي بقدرك الأدنى: …» | habit page › العودة بعد انقطاع | the owner kept «صلّحها» for the button; QA also used it for the section title (it was «خطوة للعودة», the designer's name). Keep it as the title too? |
| Steps «العادة · القدر والوقت · رسالتك · المراجعة» + «كم ومتى؟» + «راجع قبل الحفظ» + «احفظ العادة» | add flow (the reference indicator, 4 numbered steps: 3 + review) | «رسالة لنفسك» for «رسالتك» |
| «قضاء الفوائت»: «قضيت n من m» · «اليوم n من 3» · «بقي n يومًا بهذا القدر» · «تتمّه نحو …» · «أنت على قدرك، بارك الله لك.» · «العدد كله / لكل صلاة» | qada screen, «الفرائض» group, سجلّي › حصيلة | «قضيتَ» with the vowel |
| «أسبوع · شهر · حصيلة» + «تسجيلات الأسبوع» | سجلّي tabs | «الحصيلة» |

## Website «عاداتي» (web A: tabs, اليوم, العادات, الأعمال الدورية, محاسبتي, سجلّي, habit page, add flow, قضاء الفوائت)

Keys live in `frontend/messages/{ar,en}.json` under `practice.*`. Where the app («App «عاداتي»» above) already has a
label, the web uses the same words; only the web's own or different lines are listed.

| Built as (ar · en) | Where | Alternative / question |
| --- | --- | --- |
| Unified with the app: «سامح نفسك اليوم، وأدِّ القدر الأدنى.» + for «تخفّف» «أما ما تتخفّف منه فاثبت على تركه اليوم؛ الثبات في اليوم الصعب أعظم أجرًا.» (now on both); the list's lead and hints are the app's | «اليوم», under the date on a hard «حال يومي» (`practice.dayState.*`, app `habitsHub.dayState.*`) | — |
| «انشغالات طارئة» · English «Sudden demands» (both) | «حال يومي» list | «Urgent matters» |
| «هل فعلتها؟» card under today's list, two rows then «المزيد (n)» · toast «سُجِّلت «لم تتم». غدًا فرصة جديدة.» | «اليوم› عادات اليوم», a day's details | — |
| «مواعيد قادمة» + «الكل» | «اليوم» side column (reference) | «القادم» |
| Group switcher «الفرائض · عادات اليوم · الأعمال الدورية» · English «Prayers · Habits · Periodic» (short to fit a phone row) | «اليوم» on a phone | the English full names «Obligatory prayers · Today's habits · Periodic acts» do not fit 390px |
| «في الأرشيف منذ {date} · إن أعدتها يبدأ تقدّمها من جديد» / «يبقى تقدّمها إن أعدتها حتى {date}» | «العادات › الأرشيف» rows | the app's wording (same meaning) |
| «عندك 3 عادات، وهو الحد» + «أرشِفها / احذفها» per habit + «رجوع» | «أضف عادة» past the limit (C-01d) | — |
| «مغطّى لخصوصيتك. اضغط واكتب رمز الخصوصية لتراه.» / «مقفل. اضغط واكتب رمز الخصوصية لتفتحه.» | a covered «تخفَّف» row («العادات», «سجلّي») | the app's «تخفّف · مغطّى» |
| «شارك تطورك مع الرفقة» (plain line, no link: «رفقة» is in the app) | «العادات» milestone lines, for a member in a circle (GET /circles/access `inCircle`) | a link to the app |
| «القوائم: الأقارب، الوالدان، الجيران، الأصدقاء، المرضى (n)» (folded) | «الأعمال الدورية › صلة الرحم والأحباب» | the app's «افتح القوائم» |
| «سجّل العمل» / «سُجّل اليوم» + «تعديل» link + trash icon (as in the app) | «الأعمال الدورية» rows (C-24) | — |
| «وقفة مع نفسك» (heading) + «حاسب نفسك اليوم ليخفّ حسابك غدًا. وقفة قصيرة صادقة، ثم خطوة واضحة.» · week: «ثقيلٌ الآن، خفيفٌ بعد.» / «ما تراجعه اليوم بصدق لا يثقل عليك غدًا.» | «محاسبتي» | — |
| «ابدأ محاسبة المساء» / «ابدأ محاسبة الأسبوع» (replace «حاسب نفسك الآن» / «ابدأ الآن») | «محاسبتي» | — |
| «لم تتم في {n} أيام» (was «فاتك {n} أيام») | weekly review card, «وقفات سابقة» | — |
| «تعلّم من الخطأ: {habit}» + 14-day bar + «آخر يوم أتممتها فيه…» + «طريق العودة: ارجع بقدر أصغر (…)، ثم ابنِ من جديد.» | سجلّي day, محاسبتي, habit page «العودة بعد انقطاع» | — |
| «أتممتها {n} يومًا من {target} تحتاجها العادة لترسخ» (66 days, practice-core `GRADUATION_MIN_DAYS`) | habit page › المتابعة › تقدّمك | — |
| «أسبوع · شهر · حصيلة» (the reference «الأسبوع · الشهر · الحصيلة») | سجلّي tabs | with «ال» |
