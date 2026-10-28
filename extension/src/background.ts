/**
 * Service worker (Chrome/Edge) / background script (Firefox).
 *
 * Alarms: one `remind|<plan>|<date>|<time>` alarm per plan for its next reminder, recomputed on install, on
 * browser start, whenever the store or preferences change, and after each reminder fires. A «لاحقًا» press adds
 * a one-off `snooze|<plan>|<date>` alarm 30 minutes later. A `refresh` alarm refreshes the API caches
 * (each at most once a day).
 *
 * All listeners are registered synchronously at the top level, as MV3 requires.
 */
import { logDone, normalize, requiredOn, todayFrom, type Plan } from '@thekra/practice-core';
import { deedUrl, formatAmount, habitTitle, unitLabel, type Habit } from './catalog.js';
import { api, getCatalog, getQuotes, loadState, refreshCaches, saveState, TARGET } from './ext.js';
import { translator } from './i18n.js';
import { buildNotification, pickQuote } from './quotes.js';
import {
  parseAlarmName,
  reminderAlarmName,
  remainingOn,
  shouldNotify,
  snoozeAlarmName,
  snoozeUntil,
  upcomingReminders,
} from './scheduler.js';
import { PREFS_KEY, STORE_KEY } from './state.js';

const REFRESH_ALARM = 'refresh';
const REFRESH_PERIOD_MINUTES = 6 * 60;
const NOTIFICATION_PREFIX = 'note';

/** Runs tasks one after another so two reschedules never interleave. */
let queue: Promise<unknown> = Promise.resolve();
function serial(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task, task);
  queue = next.catch((err: unknown) => console.error('[thekra]', err));
  return next;
}

async function reschedule(): Promise<void> {
  const { store, prefs } = await loadState();
  for (const alarm of await api.alarms.getAll()) {
    if (parseAlarmName(alarm.name)?.kind === 'remind') await api.alarms.clear(alarm.name);
  }
  if (!prefs.onboarded) return;
  const reminders = upcomingReminders({
    plans: store.plans,
    rules: prefs.rules,
    quietDays: prefs.quietDays,
    hijriOffset: store.settings.hijriOffset,
    now: new Date(),
  });
  for (const r of reminders) await api.alarms.create(reminderAlarmName(r), { when: r.when });
}

async function ensureRefreshAlarm(): Promise<void> {
  if (!(await api.alarms.get(REFRESH_ALARM))) {
    await api.alarms.create(REFRESH_ALARM, { delayInMinutes: 1, periodInMinutes: REFRESH_PERIOD_MINUTES });
  }
}

function notificationId(planId: string, date: string): string {
  return [NOTIFICATION_PREFIX, planId, date].join('|');
}

function parseNotificationId(id: string): { planId: string; date: string } | null {
  const [prefix, planId, date] = id.split('|');
  return prefix === NOTIFICATION_PREFIX && planId && date ? { planId, date } : null;
}

function findHabit(catalog: Habit[], plan: Plan): Habit | undefined {
  return catalog.find((h) => h.key === plan.id);
}

async function showReminder(planId: string, date: string): Promise<void> {
  const { store, prefs } = await loadState();
  const stored = store.plans.find((p) => p.id === planId);
  const now = new Date();
  if (!stored || !shouldNotify(stored, date, now)) return;
  const today = todayFrom(now);
  const plan = normalize(stored, today);
  const habit = findHabit(await getCatalog(), plan);
  const lang = prefs.lang;
  const t = translator(lang);
  const amountText = formatAmount(requiredOn(plan, today), plan.unit, habit ? unitLabel(habit, lang) : '');
  const quote = habit ? pickQuote(habit.evidence, await getQuotes(), lang, t) : null;
  const text = buildNotification({ title: habit ? habitTitle(habit, lang) : plan.title, amountText, quote, t });
  const id = notificationId(plan.id, today);
  await api.notifications.clear(id);
  const options: chrome.notifications.NotificationCreateOptions = {
    type: 'basic',
    iconUrl: api.runtime.getURL('icons/icon-128.png'),
    title: text.title,
    message: text.message,
  };
  // Firefox has no notification buttons: there the popup logs the deed.
  if (TARGET === 'chrome') {
    options.buttons = [{ title: t('btnDone') }, { title: t('btnLater') }];
    options.priority = 0;
  }
  await api.notifications.create(id, options);
}

async function markDone(planId: string): Promise<void> {
  const state = await loadState();
  const today = todayFrom(new Date());
  const index = state.store.plans.findIndex((p) => p.id === planId);
  const plan = state.store.plans[index];
  if (!plan) return;
  const remaining = remainingOn(normalize(plan, today), today);
  if (remaining <= 0) return;
  const plans = [...state.store.plans];
  plans[index] = logDone(plan, today, remaining);
  await saveState({ ...state, store: { ...state.store, plans } });
}

async function openDeedPage(planId: string): Promise<void> {
  const { store, prefs } = await loadState();
  const plan = store.plans.find((p) => p.id === planId);
  if (!plan) return;
  const habit = findHabit(await getCatalog(), plan);
  await api.tabs.create({ url: deedUrl(habit?.deed ?? plan.deedSlug, prefs.lang) });
}

api.runtime.onInstalled.addListener((details) => {
  void serial(async () => {
    await ensureRefreshAlarm();
    await reschedule();
    await refreshCaches();
  });
  if (details.reason === 'install') void api.runtime.openOptionsPage();
});

api.runtime.onStartup.addListener(() => {
  void serial(async () => {
    await ensureRefreshAlarm();
    await reschedule();
    await refreshCaches();
  });
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (STORE_KEY in changes || PREFS_KEY in changes) {
    void serial(async () => {
      await reschedule();
      await refreshCaches();
    });
  }
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void serial(() => refreshCaches());
    return;
  }
  const parsed = parseAlarmName(alarm.name);
  if (!parsed) return;
  void serial(async () => {
    await showReminder(parsed.planId, parsed.date);
    if (parsed.kind === 'remind') await reschedule();
  });
});

api.notifications.onClicked.addListener((id) => {
  const parsed = parseNotificationId(id);
  if (!parsed) return;
  void serial(async () => {
    await api.notifications.clear(id);
    await openDeedPage(parsed.planId);
  });
});

api.notifications.onButtonClicked?.addListener((id, buttonIndex) => {
  const parsed = parseNotificationId(id);
  if (!parsed) return;
  void serial(async () => {
    await api.notifications.clear(id);
    if (buttonIndex === 0) {
      await markDone(parsed.planId);
    } else {
      await api.alarms.create(snoozeAlarmName(parsed.planId, parsed.date), { when: snoozeUntil(new Date()) });
    }
  });
});
