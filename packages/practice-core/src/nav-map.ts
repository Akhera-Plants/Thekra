/**
 * One navigation map for the website and the app (owner round 5, F-34 a / W-11 c,
 * docs/plan/2026-11-07-owner-round-5.md §1; round 6 §1, docs/plan/2026-11-09-owner-round-6.md): every feature's Arabic and English name, its web route and its app route.
 * Each client has a test that compares its menus and page titles with this list, so a name or a place cannot drift
 * between the two platforms again. When a page moves or is renamed, change it here first; both clients' tests then
 * say what to follow.
 *
 * Routes:
 * - `web` is the Next.js path without the locale prefix (Arabic has none, English adds `/en`); `[id]` marks a segment.
 * - `app` is the Expo Router href. A segmented tab inside a screen is a `?tab=` query (e.g. `/habits?tab=periodic`),
 *   so a deep link can open it.
 * - `null`: the feature has no page on that platform (e.g. «رفقة» lives in the app only; the web menu links to the app).
 *
 * {@link GLOSSARY} holds the shared words every screen must use (and the ones to avoid). It is for the owner to
 * approve (round plan §1 «Shared map»); a change there is a product decision, not a refactor.
 *
 * Pure data and small helpers.
 */

/** Where a feature sits in the menus (web header groups, the app's «المزيد» groups). */
export type NavGroup =
  /** The home page / tab. */
  | 'home'
  /** «عاداتي» and what opens from it. */
  | 'habits'
  /** «أبواب الخير»: the public doors (web header group of the same name). */
  | 'doors'
  /** «المزيد»: the web header menu and the app tab (round 6: الاستراتيجيات، المحفوظات، رفقة). */
  | 'members'
  /** «الإعدادات» and its pages. */
  | 'settings';

export const NAV_GROUPS: readonly NavGroup[] = ['home', 'habits', 'doors', 'members', 'settings'];

export interface NavFeature {
  /** Stable key, kebab-case. Never reused for another feature. */
  key: string;
  ar: string;
  en: string;
  /** Web path (no locale prefix), or null when the web has no such page. */
  web: string | null;
  /** App href (Expo Router), or null when the app has no such screen. */
  app: string | null;
  group: NavGroup;
  /** The feature this one is a tab or sub-page of (its key), when it is not a page of its own. */
  parent?: string;
}

/**
 * Every page of the information architecture, both platforms. Round 6 (docs/plan/2026-11-09-owner-round-6.md §1):
 * «أهلي وناسي» and «تصفّح النصوص» are gone; «صلة الرحم والأحباب» is one act INSIDE «الأعمال الدورية» (no page, menu
 * entry or tab of its own); «عاداتي» has five tabs «اليوم · العادات · الأعمال الدورية · محاسبتي · سجلّي»; «خصّص الرئيسية»
 * lives only in the settings. Menus are built from {@link WEB_HEADER}, {@link WEB_ACCOUNT_MENU}, {@link APP_TABS},
 * {@link APP_MORE} and {@link HABITS_TABS}. In menu order within each group.
 */
export const NAV_FEATURES: readonly NavFeature[] = [
  // ── Home ──
  { key: 'home', ar: 'الرئيسية', en: 'Home', web: '/', app: '/', group: 'home' },

  // ── عاداتي (app tab `app/(tabs)/habits.tsx`; web `/practice/*`) ──
  { key: 'habits', ar: 'عاداتي', en: 'My habits', web: '/practice', app: '/habits', group: 'habits' },
  { key: 'today', ar: 'اليوم', en: 'Today', web: '/practice', app: '/habits?tab=today', group: 'habits', parent: 'habits' },
  { key: 'my-habits', ar: 'العادات', en: 'Habits', web: '/practice/habits', app: '/habits?tab=habits', group: 'habits', parent: 'habits' },
  { key: 'periodic', ar: 'الأعمال الدورية', en: 'Periodic acts', web: '/practice/periodic', app: '/habits?tab=periodic', group: 'habits', parent: 'habits' },
  { key: 'review', ar: 'محاسبتي', en: 'My self-review', web: '/practice/review', app: '/habits?tab=review', group: 'habits', parent: 'habits' },
  { key: 'record', ar: 'سجلّي', en: 'My record', web: '/practice/record', app: '/habits?tab=record', group: 'habits', parent: 'habits' },
  { key: 'habit', ar: 'صفحة العادة', en: 'Habit page', web: '/practice/habits/[id]', app: '/practice/plan/[id]', group: 'habits', parent: 'my-habits' },
  { key: 'add', ar: 'أضف', en: 'Add', web: null, app: '/practice/add', group: 'habits', parent: 'habits' },
  { key: 'fard', ar: 'الفرائض', en: 'Obligatory prayers', web: '/practice', app: '/habits?tab=today', group: 'habits', parent: 'today' },
  { key: 'qada', ar: 'قضاء الفوائت', en: 'Making up missed prayers', web: '/practice', app: '/habits?tab=today', group: 'habits', parent: 'fard' },
  { key: 'silat', ar: 'صلة الرحم والأحباب', en: 'Ties of kinship and loved ones', web: '/practice/periodic', app: '/habits?tab=periodic', group: 'habits', parent: 'periodic' },
  { key: 'self-messages', ar: 'رسائلي إلى نفسي', en: 'My messages to myself', web: '/practice', app: '/habits', group: 'habits', parent: 'habits' },
  { key: 'leave-sin', ar: 'تخفَّف', en: 'Lighten', web: '/practice/leave-sin', app: '/practice/sin-program', group: 'habits', parent: 'my-habits' },
  { key: 'moment', ar: 'لحظة مجاهدة', en: 'A moment of striving', web: '/practice/leave-sin/moment', app: '/practice/moment', group: 'habits' },

  // ── أبواب الخير (web header links; app home doors) ──
  { key: 'good-deeds', ar: 'الطاعات', en: 'Good deeds', web: '/good-deeds', app: '/good-deeds', group: 'doors' },
  { key: 'sins', ar: 'تخفَّف من ذنب', en: 'Lighten a sin', web: '/sins', app: '/sins', group: 'doors' },
  { key: 'branches', ar: 'شعب الإيمان', en: 'The Branches of Faith', web: '/branches', app: '/branches', group: 'doors' },

  // ── «المزيد» (web header menu and app tab) ──
  { key: 'strategies', ar: 'استراتيجيات العادات', en: 'Habit strategies', web: '/practice/strategies', app: '/practice/strategies', group: 'members' },
  { key: 'saved', ar: 'المحفوظات', en: 'Saved', web: '/favorites', app: '/favorites', group: 'members' },
  { key: 'saved-texts', ar: 'النصوص', en: 'Texts', web: '/favorites', app: '/favorites?tab=texts', group: 'members', parent: 'saved' },
  { key: 'my-reminders', ar: 'تذكيراتي', en: 'My reminders', web: '/favorites/reminders', app: '/favorites?tab=reminders', group: 'members', parent: 'saved' },
  { key: 'circles', ar: 'رفقة', en: 'Companions', web: null, app: '/circles', group: 'members' },
  { key: 'garden', ar: 'الحديقة', en: 'The garden', web: null, app: '/garden', group: 'members' },
  { key: 'more', ar: 'المزيد', en: 'More', web: null, app: '/more', group: 'members' },

  // ── الإعدادات (web: only in the account menu; app: the last group of «المزيد») ──
  { key: 'settings', ar: 'الإعدادات', en: 'Settings', web: '/settings', app: '/more', group: 'settings' },
  { key: 'account', ar: 'الحساب', en: 'Account', web: '/settings', app: '/settings/account', group: 'settings', parent: 'settings' },
  { key: 'privacy', ar: 'الخصوصية والتشفير', en: 'Privacy and encryption', web: '/settings', app: '/settings/privacy', group: 'settings', parent: 'settings' },
  { key: 'notifications', ar: 'التنبيهات', en: 'Notifications', web: '/settings/notifications', app: '/settings/notifications', group: 'settings', parent: 'settings' },
  { key: 'prayer-times', ar: 'أوقات الصلاة', en: 'Prayer times', web: '/settings/prayer-times', app: '/practice/prayer-times', group: 'settings', parent: 'settings' },
  { key: 'appearance', ar: 'اللغة والمظهر', en: 'Language and appearance', web: null, app: '/settings/appearance', group: 'settings', parent: 'settings' },
  { key: 'customize-home', ar: 'خصّص الرئيسية', en: 'Customize home', web: '/settings', app: '/settings/appearance', group: 'settings', parent: 'appearance' },
  { key: 'about', ar: 'عن ذكرى', en: 'About Thekra', web: '/about', app: '/settings/about', group: 'settings', parent: 'settings' },
];

/**
 * The web header (round 6 §1, C-07 b, C-05 a): the links, then «المزيد ▾» with its items, then the account avatar menu.
 * An item of «المزيد» is never also in the header, and vice versa (`nav-map` test). Settings are ONLY in the account menu.
 */
export const WEB_HEADER: { readonly links: readonly string[]; readonly more: readonly string[] } = {
  links: ['home', 'good-deeds', 'sins', 'branches', 'habits'],
  more: ['strategies', 'saved', 'circles'],
};

/** The account avatar menu of the web header (C-05 a): الحساب، الإعدادات، then the action {@link SIGN_OUT}. */
export const WEB_ACCOUNT_MENU: readonly string[] = ['account', 'settings'];

/** The last row of the account menu: an action, not a page. */
export const SIGN_OUT = { ar: 'تسجيل الخروج', en: 'Sign out' } as const;

/** The app's tabs (unchanged): الرئيسية · عاداتي · المزيد. */
export const APP_TABS: readonly string[] = ['home', 'habits', 'more'];

/**
 * The app's «المزيد» (round 6 §1): the web «المزيد» (+ «الحديقة», app only and unchanged, §10), then the settings rows.
 * No «تصفّح النصوص», no people page.
 */
export const APP_MORE: { readonly mine: readonly string[]; readonly settings: readonly string[] } = {
  mine: ['strategies', 'saved', 'circles', 'garden'],
  settings: ['account', 'privacy', 'notifications', 'prayer-times', 'appearance', 'about'],
};

/** The tabs of «عاداتي», in order (web routes and app `?tab=` values come from {@link NAV_FEATURES}). */
export const HABITS_TABS: readonly string[] = ['today', 'my-habits', 'periodic', 'review', 'record'];

/**
 * Keys removed in round 6 → the key to use now, so an older client build that still asks for them finds a page instead
 * of throwing (`navFeature` follows them). `browse` has no successor (the feature is gone; its old path goes home).
 * @deprecated Clients move to the new keys; remove once none asks for an old one.
 */
export const NAV_KEY_ALIASES: Readonly<Record<string, string>> = {
  wird: 'today',
  people: 'periodic',
};

/**
 * Old web paths that redirect (round plans §1). The new place is a feature's `web` route. The web client keeps its
 * redirects in step with this list. Round 6: `/practice/habits` is the «العادات» tab again (no redirect),
 * `/practice/people` and `/practice/kinship` go to «الأعمال الدورية», `/browse` goes home.
 */
export const WEB_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: '/practice/reviews', to: '/practice/review' },
  { from: '/practice/pledges', to: '/practice/review' },
  { from: '/calendar', to: '/practice/record' },
  { from: '/practice/kinship', to: '/practice/periodic' },
  { from: '/practice/people', to: '/practice/periodic' },
  { from: '/practice/my-reminders', to: '/favorites/reminders' },
  { from: '/practice/notifications', to: '/settings/notifications' },
  { from: '/practice/prayer-times', to: '/settings/prayer-times' },
  { from: '/names', to: '/' },
  { from: '/browse', to: '/' },
];

/** One shared word: the form to use and the forms to avoid, on both platforms. */
export interface GlossaryTerm {
  key: string;
  ar: string;
  en: string;
  /** Arabic words that must not be used for this meaning. */
  avoidAr: readonly string[];
  /** Why, in one line (for the owner's review). */
  note: string;
}

/**
 * The shared words (round plan §1 «Shared map»: for the owner to approve). Where the two platforms used different
 * words, one was picked by UX and the choice is noted.
 */
export const GLOSSARY: readonly GlossaryTerm[] = [
  {
    key: 'texts',
    ar: 'نصوص',
    en: 'texts',
    avoidAr: ['اقتباسات', 'اقتباس'],
    note: 'Owner, round 5: «اقتباسات» → «نصوص» (a verse or a hadith is not a quotation).',
  },
  {
    key: 'notifications',
    ar: 'التنبيهات',
    en: 'Notifications',
    avoidAr: ['الإشعارات'],
    note: 'The settings page of every reminder switch and time. «تذكيراتي» is a different thing (the user’s own lines).',
  },
  {
    key: 'my-reminders',
    ar: 'تذكيراتي',
    en: 'My reminders',
    avoidAr: [],
    note: 'The user’s own short lines; they live in «المحفوظات» on both platforms (F-22 a).',
  },
  {
    key: 'saved',
    ar: 'المحفوظات',
    en: 'Saved',
    avoidAr: ['المفضلة'],
    note: 'Saved texts and «تذكيراتي».',
  },
  {
    key: 'day-state',
    ar: 'حال يومي',
    en: 'My day',
    avoidAr: ['يومي ثقيل', 'عذر اليوم'],
    note: 'Round 6 (C-01r): one control that opens a list — يوم عادي · مرض شديد · انشغالات طارئة · سفر (practice-core day-state.ts).',
  },
  {
    key: 'silat',
    ar: 'صلة الرحم والأحباب',
    en: 'Ties of kinship and loved ones',
    avoidAr: ['أهلي وناسي'],
    note: 'Round 6 (C-05, C-10, C-01i): «أهلي وناسي» does not exist any more. Its people lists (kin, parents, neighbours, friends, the sick) live inside this ONE periodic act, never a page, menu entry or tab of its own.',
  },
  {
    key: 'archive',
    ar: 'الأرشيف',
    en: 'Archive',
    avoidAr: ['أوقِف مؤقتًا', 'موقوفة مؤقتًا', 'إيقاف مؤقت'],
    note: 'Round 6 (owner chat, C-01d): archive IS the old pause — one concept. At most 10; restoring after more than 3 days starts the progress again (archive.ts).',
  },
  {
    key: 'minimum',
    ar: 'القدر الأدنى',
    en: 'Minimum',
    avoidAr: ['أقل ما يمكن'],
    note: 'Round 6 (C-01r): the amount the member sets and never lowers; a hard day asks exactly it (plan.ts minimumOf).',
  },
  {
    key: 'not-done',
    ar: 'لم تتم',
    en: 'Not done',
    avoidAr: ['فاتتك', 'فشلت'],
    note: 'Round 6 (C-01j): a past asked day without a log, in a calm style; for a few days the row still asks «هل فعلتها؟» (فعلتها / لم أفعل).',
  },
  {
    key: 'self-messages',
    ar: 'رسائلي إلى نفسي',
    en: 'My messages to myself',
    avoidAr: [],
    note: 'Round 6 (C-02c): a list (add / edit / delete, at most 10) opened from the top of «عاداتي», no longer inside «محاسبتي».',
  },
  {
    key: 'qada',
    ar: 'قضاء الفوائت',
    en: 'Making up missed prayers',
    avoidAr: [],
    note: 'Round 6 (C-01a): owed prayers, a pace and a circular progress chart, inside «الفرائض».',
  },
  {
    key: 'read',
    ar: 'مقروء',
    en: 'Read',
    avoidAr: [],
    note: 'Round 6 (owner chat): «مقروء» / «غير مقروء» on texts in topic pages (reads.ts).',
  },
  {
    key: 'habit',
    ar: 'عادة',
    en: 'habit',
    avoidAr: [],
    note: 'Tracked daily, counts toward the limit of 3 and the streak.',
  },
  {
    key: 'periodic',
    ar: 'عمل دوري',
    en: 'periodic act',
    avoidAr: [],
    note: 'A reminder only (no commitment tracking); the tab is «الأعمال الدورية» (round 6).',
  },
  {
    key: 'fard',
    ar: 'الفرائض',
    en: 'Obligatory prayers',
    avoidAr: ['فروضي'],
    note: 'F-05 a: opt-in rows «صلّيتها في وقتها» / «قضاء», outside the habit limit.',
  },
  {
    key: 'mend',
    ar: 'صلّحها',
    en: 'Mend it',
    avoidAr: ['خربانة'],
    note: 'The action on a missed habit; after two missed days it offers one good deed (F-08 a).',
  },
  {
    key: 'occasion',
    ar: 'مناسبة قريبة',
    en: 'Coming occasion',
    avoidAr: ['مواسم الخير'],
    note: 'F-17: no «مواسم الخير» page; occasions show on the «سجلّي» calendar, as a home section and as an opt-in reminder.',
  },
  {
    key: 'review',
    ar: 'محاسبتي',
    en: 'My self-review',
    avoidAr: ['التزاماتي'],
    note: 'The «عاداتي» tab of «نية اليوم», the evening and weekly reviews (tabs «اليوم / الأسبوع»). Round 6: «رسائلي إلى نفسي» moved out; no «حاسب نفسك الآن».',
  },
  {
    key: 'record',
    ar: 'سجلّي',
    en: 'My record',
    avoidAr: [],
    note: 'The month calendar with occasion marks and commitment.',
  },
  {
    key: 'lighten',
    ar: 'تخفَّف من ذنب',
    en: 'Lighten a sin',
    avoidAr: ['ترك معصية', 'ترك المعصية', 'أترك معصية'],
    note: 'Round 6 (C-01f): never «ترك معصية» as a label; «تخفَّف من ذنب / من معصية» everywhere. The door opens a searchable list of sins; a program is a habit of type «تخفَّف» (covered by default). Never names the sin in menus or notifications.',
  },
  {
    key: 'moment',
    ar: 'لحظة مجاهدة',
    en: 'A moment of striving',
    avoidAr: [],
    note: 'The generic button in the header (F-09, F-32).',
  },
  {
    key: 'companions',
    ar: 'رفقة',
    en: 'Companions',
    avoidAr: ['الدوائر'],
    note: 'In the app only; the web menu shows «رفقة (في التطبيق)» (W-12 b).',
  },
];

/** The feature with this key (or the successor of a removed key, {@link NAV_KEY_ALIASES}), or undefined. */
export function navFeature(key: string): NavFeature | undefined {
  const k = NAV_KEY_ALIASES[key] ?? key;
  return NAV_FEATURES.find((f) => f.key === k);
}

/** The name of a feature in a language; throws on an unknown key (a typo in a client should fail its test). */
export function navName(key: string, lang: 'ar' | 'en'): string {
  const f = navFeature(key);
  if (!f) throw new RangeError(`Unknown nav feature: ${key}`);
  return f[lang];
}

/** The features of a group, in menu order. */
export function navGroup(group: NavGroup): NavFeature[] {
  return NAV_FEATURES.filter((f) => f.group === group);
}

/** The feature whose route on a platform is exactly `route` (a page of its own first, then a tab). */
export function featureAtRoute(platform: 'web' | 'app', route: string): NavFeature | undefined {
  const matches = NAV_FEATURES.filter((f) => f[platform] === route);
  return matches.find((f) => f.parent === undefined) ?? matches[0];
}

/** The glossary entry with this key, or undefined. */
export function glossaryTerm(key: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.key === key);
}

/**
 * Words of the glossary's `avoidAr` lists found in `text` (for client tests over their message files). An avoided word
 * that is part of the preferred form of another term (e.g. «صلة الرحم» inside a kin-list label) is the client's call.
 */
export function avoidedWordsIn(text: string): { word: string; use: string }[] {
  const out: { word: string; use: string }[] = [];
  for (const term of GLOSSARY) for (const word of term.avoidAr) if (text.includes(word)) out.push({ word, use: term.ar });
  return out;
}
