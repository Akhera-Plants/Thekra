import { createHash } from 'node:crypto';
import { AFTER_PRAYER_MINUTES, DEFAULT_NOTIFICATION_PREFS, shiftTime, diffDays, formatPlanAmount, notificationPlan, NOTIFY_TEXTS, requiredOn, } from '@thekra/practice-core';
import { zonedParts, zonedToUtc } from './zoned-time.js';
export const PUSH_WINDOW_HOURS = 48;
export const MAX_PUSH_PER_WINDOW = 40;
const TEXTS = {
    ar: {
        habitBody: (amount) => `المطلوب اليوم: ${amount}`,
        kinshipTitle: 'صلة الرحم والأحباب',
        kinshipBody: (n) => `حان وقت التواصل مع ${n} من أقاربك`,
        peopleTitle: 'صلة الرحم والأحباب',
        peopleBody: (n) => `حان وقت التواصل مع ${n} من أحبابك`,
        units: { minutes: 'دقيقة', count: 'مرة', times: 'مرة' },
    },
    en: {
        habitBody: (amount) => `Today: ${amount}`,
        kinshipTitle: 'Ties of kinship and loved ones',
        kinshipBody: (n) => `Time to get in touch with ${n} of your relatives`,
        peopleTitle: 'Ties of kinship and loved ones',
        peopleBody: (n) => `Time to get in touch with ${n} of your loved ones`,
        units: { minutes: 'minutes', count: 'times', times: 'times' },
    },
};
function habitFor(plan, habits) {
    const key = plan.habitKey ?? plan.id;
    return habits.find((h) => h.key === key);
}
function formatAmount(amount, unit, habit, locale) {
    const label = habit ? (locale === 'ar' ? habit.unitLabelAr : habit.unitLabelEn) : TEXTS[locale].units[unit];
    return formatPlanAmount(amount, unit, label, locale, habit?.rakah);
}
function digestOf(item) {
    const content = JSON.stringify([item.fireAt.toISOString(), item.title, item.body, item.url, item.tag]);
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
export function sitePath(locale, path) {
    return locale === 'en' ? `/en${path}` : path;
}
function anchorPrayerTimes(times) {
    if (!times)
        return undefined;
    const back = (t) => shiftTime(t, -AFTER_PRAYER_MINUTES);
    return {
        fajr: back(times['after-fajr']),
        dhuhr: back(times['after-dhuhr']),
        asr: back(times['after-asr']),
        maghrib: back(times['after-maghrib']),
        isha: back(times['after-isha']),
    };
}
export function planPushes(input) {
    const { store, habits, timeZone, locale, now } = input;
    const end = new Date(now.getTime() + (input.windowHours ?? PUSH_WINDOW_HOURS) * 3_600_000);
    const { date: today, time: nowTime } = zonedParts(now, timeZone);
    const lastDay = zonedParts(end, timeZone).date;
    const days = diffDays(today, lastDay) + 1;
    const texts = TEXTS[locale];
    const policy = NOTIFY_TEXTS[locale];
    const plansById = new Map(store.plans.map((p) => [p.id, p]));
    const entries = notificationPlan({
        store,
        prefs: { ...(input.prefs ?? DEFAULT_NOTIFICATION_PREFS), privateMoment: false },
        today,
        now: nowTime,
        days,
        dayOptions: {
            hijriOffset: store.settings.hijriOffset,
            defaultRuleOf: (plan) => habitFor(plan, habits)?.defaultRule,
        },
        defaultSlotsOf: (plan) => habitFor(plan, habits)?.defaultSlots,
        prayerTimesOn: (date) => anchorPrayerTimes(input.anchorTimes?.[date]),
        occasions: (input.occasions ?? []).map((o) => ({ key: o.key, titleAr: o.titleAr, titleEn: o.titleEn, deed: o.deed, rule: o.rule })),
        kinds: ['habit', 'periodic', 'evening', 'friday', 'occasion', 'strategy', 'intention', 'digest'],
    });
    const occasionsByKey = new Map((input.occasions ?? []).map((o) => [o.key, o]));
    const out = [];
    for (const entry of entries) {
        const fireAt = zonedToUtc(entry.date, entry.time, timeZone);
        if (fireAt <= now || fireAt > end)
            continue;
        const practice = sitePath(locale, '/practice');
        if (entry.kind === 'habit') {
            const plan = plansById.get(entry.planId ?? '');
            if (!plan)
                continue;
            const habit = habitFor(plan, habits);
            const title = habit ? (locale === 'ar' ? habit.titleAr : habit.titleEn) : plan.title;
            const body = texts.habitBody(formatAmount(requiredOn(plan, entry.date), plan.unit, habit, locale));
            out.push({ key: entry.key, fireAt, title, body, url: practice, tag: `habit-${plan.id}` });
        }
        else if (entry.kind === 'periodic') {
            const ids = new Set(entry.relativeIds ?? []);
            const kin = store.relatives.filter((r) => ids.has(r.id)).every((r) => (r.circle ?? 'kin') === 'kin');
            const count = entry.count ?? ids.size;
            out.push({
                key: `kinship:${entry.date}`,
                fireAt,
                title: kin ? texts.kinshipTitle : texts.peopleTitle,
                body: kin ? texts.kinshipBody(count) : texts.peopleBody(count),
                url: sitePath(locale, '/practice/periodic'),
                tag: 'kinship',
            });
        }
        else if (entry.kind === 'evening') {
            out.push({ key: entry.key, fireAt, title: policy.wirdTitle, body: policy.eveningBody, url: practice, tag: 'evening' });
        }
        else if (entry.kind === 'friday') {
            out.push({ key: entry.key, fireAt, title: policy.fridayTitle, body: policy.fridayBody, url: practice, tag: 'friday' });
        }
        else if (entry.kind === 'occasion') {
            const first = occasionsByKey.get(entry.occasions?.[0] ?? '');
            if (!first)
                continue;
            out.push({
                key: entry.key,
                fireAt,
                title: policy.occasionTitle,
                body: policy.occasionBody(locale === 'ar' ? first.titleAr : first.titleEn),
                url: sitePath(locale, `/good-deeds/${encodeURIComponent(first.deed)}`),
                tag: 'occasion',
            });
        }
        else if (entry.kind === 'strategy') {
            const body = policy.strategyBody(entry.strategy ?? '');
            if (!body)
                continue;
            out.push({ key: entry.key, fireAt, title: policy.strategyTitle, body, url: sitePath(locale, '/practice/strategies'), tag: 'strategy' });
        }
        else if (entry.kind === 'intention') {
            out.push({ key: entry.key, fireAt, title: policy.intentionTitle, body: policy.intentionBody, url: sitePath(locale, '/practice/review'), tag: 'intention' });
        }
        else if (entry.kind === 'digest') {
            out.push({ key: entry.key, fireAt, title: policy.wirdTitle, body: policy.digestBody(entry.count ?? 1), url: practice, tag: 'digest' });
        }
    }
    out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || (a.key < b.key ? -1 : 1));
    return out.slice(0, input.limit ?? MAX_PUSH_PER_WINDOW).map((item) => ({ ...item, digest: digestOf(item) }));
}
//# sourceMappingURL=push-planner.js.map