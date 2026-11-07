/**
 * One navigation map for the website and the app (owner round 5, F-34 a / W-11 c,
 * docs/plan/2026-11-07-owner-round-5.md §1): every feature's Arabic and English name, its web route and its app route.
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
  /** Member features listed in «المزيد» (app) and «للأعضاء» (web). */
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
 * Every page of the round-5 information architecture, both platforms (round plan §1, App and Web tables). In menu
 * order within each group.
 */
export const NAV_FEATURES: readonly NavFeature[] = [
  // ── Home ──
  { key: 'home', ar: 'الرئيسية', en: 'Home', web: '/', app: '/', group: 'home' },
  { key: 'customize-home', ar: 'خصّص الرئيسية', en: 'Customize home', web: '/', app: '/', group: 'home', parent: 'home' },

  // ── عاداتي (app tab `app/(tabs)/habits.tsx`; web `/practice/*`) ──
  { key: 'habits', ar: 'عاداتي', en: 'My habits', web: '/practice', app: '/habits', group: 'habits' },
  { key: 'wird', ar: 'ورد اليوم', en: "Today's wird", web: '/practice', app: '/habits?tab=wird', group: 'habits', parent: 'habits' },
  { key: 'periodic', ar: 'الدورية', en: 'Periodic acts', web: '/practice/periodic', app: '/habits?tab=periodic', group: 'habits', parent: 'habits' },
  { key: 'review', ar: 'محاسبتي', en: 'My self-review', web: '/practice/review', app: '/habits?tab=review', group: 'habits', parent: 'habits' },
  { key: 'record', ar: 'سجلّي', en: 'My record', web: '/practice/record', app: '/habits?tab=record', group: 'habits', parent: 'habits' },
  { key: 'habit', ar: 'صفحة العادة', en: 'Habit page', web: '/practice/habits/[id]', app: '/practice/plan/[id]', group: 'habits', parent: 'habits' },
  { key: 'add', ar: 'أضف', en: 'Add', web: null, app: '/practice/add', group: 'habits', parent: 'habits' },
  { key: 'fard', ar: 'الفرائض', en: 'Obligatory prayers', web: '/practice', app: '/habits?tab=wird', group: 'habits', parent: 'wird' },
  { key: 'moment', ar: 'لحظة مجاهدة', en: 'A moment of striving', web: '/practice/leave-sin/moment', app: '/practice/moment', group: 'habits' },

  // ── أبواب الخير (web header group; app home doors) ──
  { key: 'leave-sin', ar: 'تخفَّف', en: 'Lighten', web: '/practice/leave-sin', app: '/practice/sin-program', group: 'doors' },
  { key: 'sins', ar: 'ساعدني أترك معصية', en: 'Help me leave a sin', web: '/sins', app: '/sins', group: 'doors' },
  { key: 'good-deeds', ar: 'الطاعات', en: 'Good deeds', web: '/good-deeds', app: '/good-deeds', group: 'doors' },
  { key: 'branches', ar: 'شعب الإيمان', en: 'The Branches of Faith', web: '/branches', app: '/branches', group: 'doors' },
  { key: 'browse', ar: 'تصفّح النصوص', en: 'Browse texts', web: '/browse', app: '/browse', group: 'doors' },

  // ── للأعضاء (web) / المزيد (app) ──
  { key: 'people', ar: 'أهلي وناسي', en: 'My family and people', web: '/practice/people', app: '/practice/kinship', group: 'members' },
  { key: 'circles', ar: 'رفقة', en: 'Companions', web: null, app: '/circles', group: 'members' },
  { key: 'saved', ar: 'المحفوظات', en: 'Saved', web: '/favorites', app: '/favorites', group: 'members' },
  { key: 'saved-texts', ar: 'النصوص', en: 'Texts', web: '/favorites', app: '/favorites?tab=texts', group: 'members', parent: 'saved' },
  { key: 'my-reminders', ar: 'تذكيراتي', en: 'My reminders', web: '/favorites/reminders', app: '/favorites?tab=reminders', group: 'members', parent: 'saved' },
  { key: 'strategies', ar: 'استراتيجيات العادات', en: 'Habit strategies', web: '/practice/strategies', app: '/practice/strategies', group: 'members' },
  { key: 'garden', ar: 'الحديقة', en: 'The garden', web: null, app: '/garden', group: 'members' },
  { key: 'more', ar: 'المزيد', en: 'More', web: null, app: '/more', group: 'members' },

  // ── الإعدادات ──
  // The app has no settings screen of its own: its rows are the last group of «المزيد».
  { key: 'settings', ar: 'الإعدادات', en: 'Settings', web: '/settings', app: '/more', group: 'settings' },
  { key: 'account', ar: 'الحساب', en: 'Account', web: '/settings', app: '/settings/account', group: 'settings', parent: 'settings' },
  { key: 'privacy', ar: 'الخصوصية والتشفير', en: 'Privacy and encryption', web: '/settings', app: '/settings/privacy', group: 'settings', parent: 'settings' },
  { key: 'notifications', ar: 'التنبيهات', en: 'Notifications', web: '/settings/notifications', app: '/settings/notifications', group: 'settings', parent: 'settings' },
  { key: 'prayer-times', ar: 'أوقات الصلاة', en: 'Prayer times', web: '/settings/prayer-times', app: '/practice/prayer-times', group: 'settings', parent: 'settings' },
  { key: 'appearance', ar: 'اللغة والمظهر', en: 'Language and appearance', web: null, app: '/settings/appearance', group: 'settings', parent: 'settings' },
  { key: 'about', ar: 'عن ذكرى', en: 'About Thekra', web: '/about', app: '/settings/about', group: 'settings', parent: 'settings' },
];

/**
 * Old web paths that redirect (round plan §1 Web table and «Removed screens»). The new place is a feature's `web`
 * route. The web client keeps its redirects in step with this list.
 */
export const WEB_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: '/practice/reviews', to: '/practice/review' },
  { from: '/practice/pledges', to: '/practice/review' },
  { from: '/calendar', to: '/practice/record' },
  { from: '/practice/habits', to: '/practice/record' },
  { from: '/practice/kinship', to: '/practice/people' },
  { from: '/practice/my-reminders', to: '/favorites/reminders' },
  { from: '/practice/notifications', to: '/settings/notifications' },
  { from: '/practice/prayer-times', to: '/settings/prayer-times' },
  { from: '/names', to: '/' },
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
    key: 'browse',
    ar: 'تصفّح النصوص',
    en: 'Browse texts',
    avoidAr: ['استكشف', 'استكشف النصوص'],
    note: 'The web said «تصفّح», the app «استكشف النصوص». Picked «تصفّح»: it says what the page is (a library to read through), and it is the word the site already uses; «النصوص» names what is browsed.',
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
    note: 'One control on both platforms (F-34): it opens the choices «يوم ثقيل» and «عذر (مرض أو سفر)».',
  },
  {
    key: 'people',
    ar: 'أهلي وناسي',
    en: 'My family and people',
    avoidAr: [],
    note: 'F-15 a: the page holds kin, parents, neighbours, friends and the sick. «صلة الرحم» stays the name of the kin list only.',
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
    note: 'A reminder only (no commitment tracking); the tab is «الدورية».',
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
    note: 'The «عاداتي» tab of «نية اليوم», the evening and weekly reviews and «رسائلي إلى نفسي».',
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
    ar: 'تخفَّف',
    en: 'Lighten',
    avoidAr: [],
    note: 'The sin-leaving program; never names the sin in menus or notifications.',
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

/** The feature with this key, or undefined. */
export function navFeature(key: string): NavFeature | undefined {
  return NAV_FEATURES.find((f) => f.key === key);
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
