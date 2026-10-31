/**
 * Service worker (Chrome/Edge) / background script (Firefox).
 *
 * Alarms: one `remind|<plan>|<date>|<time>` alarm per plan for its next reminder, recomputed on install, on
 * browser start, whenever the store or preferences change, and after each reminder fires. A «لاحقًا» press adds
 * a one-off `snooze|<plan>|<date>` alarm 30 minutes later. A `refresh` alarm refreshes the API caches (each at
 * most once a day). While signed in, a `sync` alarm syncs plans and logs every 15 minutes.
 *
 * Sync runs here only (one at a time): on sign-in, when the popup opens, 3 seconds after a local edit that left
 * something to send, and on the 15-minute alarm.
 *
 * All listeners are registered synchronously at the top level, as MV3 requires.
 */
import { logDone, normalize, requiredOn, todayFrom, updatePlan, type Plan } from '@thekra/practice-core';
import { AuthError } from './auth.js';
import { deedUrl, formatAmount, habitTitle, unitLabel, type Habit } from './catalog.js';
import {
  api,
  auth,
  getCatalog,
  getQuotes,
  getSyncStatus,
  loadState,
  loadStore,
  migrateStorage,
  refreshCaches,
  saveStore,
  setSyncStatus,
  TARGET,
  tokenStore,
} from './ext.js';
import { translator } from './i18n.js';
import { isMessage, type Message, type Reply } from './messages.js';
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
import { pendingCount, runSync, type SyncStatus } from './sync-runner.js';

const REFRESH_ALARM = 'refresh';
const REFRESH_PERIOD_MINUTES = 6 * 60;
const SYNC_ALARM = 'sync';
const SYNC_PERIOD_MINUTES = 15;
const SYNC_DEBOUNCE_MS = 3000;
const NOTIFICATION_PREFIX = 'note';

/** The v1 → v2 storage upgrade, written once per wake before anything else reads the store. */
const ready = migrateStorage().catch((err: unknown) => console.error('[thekra] migrate', err));

function queue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(async () => {
      await ready;
      return task();
    });
    tail = next.catch((err: unknown) => console.error('[thekra]', err));
    return next;
  };
}
/** Alarms, notifications and caches, one after another. */
const serial = queue();
/** Account calls and syncs, one after another (separate so a slow network never delays a reminder). */
const syncSerial = queue();

async function reschedule(): Promise<void> {
  const { store, prefs } = await loadState();
  for (const alarm of await api.alarms.getAll()) {
    if (parseAlarmName(alarm.name)?.kind === 'remind') await api.alarms.clear(alarm.name);
  }
  if (!prefs.onboarded) return;
  const habitRules = Object.fromEntries((await getCatalog()).map((h) => [h.key, h.defaultRule]));
  const reminders = upcomingReminders({
    plans: store.plans,
    quietDays: prefs.quietDays,
    hijriOffset: store.settings.hijriOffset,
    now: new Date(),
    habitRules,
  });
  for (const r of reminders) await api.alarms.create(reminderAlarmName(r), { when: r.when });
}

async function ensureAlarms(): Promise<void> {
  if (!(await api.alarms.get(REFRESH_ALARM))) {
    await api.alarms.create(REFRESH_ALARM, { delayInMinutes: 1, periodInMinutes: REFRESH_PERIOD_MINUTES });
  }
  const signedIn = (await tokenStore.get()) !== null;
  const syncAlarm = await api.alarms.get(SYNC_ALARM);
  if (signedIn && !syncAlarm) await api.alarms.create(SYNC_ALARM, { delayInMinutes: SYNC_PERIOD_MINUTES, periodInMinutes: SYNC_PERIOD_MINUTES });
  if (!signedIn && syncAlarm) await api.alarms.clear(SYNC_ALARM);
}

// ---- Sync -----------------------------------------------------------------------------------------------------

/** One sync, when signed in. Records the status the popup shows. */
async function syncNow(): Promise<SyncStatus | null> {
  if (!(await tokenStore.get())) return null;
  const status = await runSync(
    { request: (path, init) => auth.request(path, init), loadStore, saveStore },
    (await getSyncStatus()) ?? undefined,
  );
  await setSyncStatus(status);
  if (status.state === 'signedOut') await api.alarms.clear(SYNC_ALARM);
  return status;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
function syncSoon(): void {
  if (debounce !== undefined) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = undefined;
    void syncSerial(async () => {
      if ((await tokenStore.get()) && pendingCount(await loadStore()) > 0) await syncNow();
    });
  }, SYNC_DEBOUNCE_MS);
}

async function signIn(email: string, password: string): Promise<Reply> {
  try {
    await auth.signIn(email, password);
  } catch (err) {
    return { ok: false, error: err instanceof AuthError ? err.code : 'server' };
  }
  await ensureAlarms();
  const status = await syncNow();
  return status?.state === 'ok' || status === null ? { ok: true } : { ok: false, error: status.error ?? 'server' };
}

async function signOut(): Promise<Reply> {
  await auth.signOut();
  // Local data stays. Forget what the server held, so a later sign-in sends everything again.
  const store = await loadStore();
  await saveStore({ ...store, sync: { lastSyncedAt: null, acked: {} } });
  await setSyncStatus(null);
  await api.alarms.clear(SYNC_ALARM);
  return { ok: true };
}

async function handleMessage(message: Message): Promise<Reply> {
  switch (message.type) {
    case 'ready':
      await ready;
      void syncSerial(syncNow);
      return { ok: true };
    case 'sync': {
      const status = await syncSerial(syncNow);
      return status === null || status.state === 'ok' ? { ok: true } : { ok: false, error: status.error ?? 'server' };
    }
    case 'signIn':
      return syncSerial(() => signIn(message.email, message.password));
    case 'signOut':
      return syncSerial(signOut);
  }
}

// ---- Reminders ------------------------------------------------------------------------------------------------

function notificationId(planId: string, date: string): string {
  return [NOTIFICATION_PREFIX, planId, date].join('|');
}

function parseNotificationId(id: string): { planId: string; date: string } | null {
  const [prefix, planId, date] = id.split('|');
  return prefix === NOTIFICATION_PREFIX && planId && date ? { planId, date } : null;
}

function findHabit(catalog: Habit[], plan: Plan): Habit | undefined {
  return plan.habitKey === undefined ? undefined : catalog.find((h) => h.key === plan.habitKey);
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
  const store = await loadStore();
  const today = todayFrom(new Date());
  const plan = store.plans.find((p) => p.id === planId);
  if (!plan) return;
  const remaining = remainingOn(normalize(plan, today), today);
  if (remaining <= 0) return;
  // practice-core store helper: a log change keeps the plan's version, logs sync per day.
  await saveStore(updatePlan(store, planId, (p) => logDone(p, today, remaining)));
}

async function openDeedPage(planId: string): Promise<void> {
  const { store, prefs } = await loadState();
  const plan = store.plans.find((p) => p.id === planId);
  if (!plan) return;
  const habit = findHabit(await getCatalog(), plan);
  await api.tabs.create({ url: deedUrl(habit?.deed ?? plan.deedSlug, prefs.lang) });
}

// ---- Listeners ------------------------------------------------------------------------------------------------

api.runtime.onInstalled.addListener((details) => {
  void serial(async () => {
    await ensureAlarms();
    await reschedule();
    await refreshCaches();
  });
  void syncSerial(syncNow);
  if (details.reason === 'install') void api.runtime.openOptionsPage();
});

api.runtime.onStartup.addListener(() => {
  void serial(async () => {
    await ensureAlarms();
    await reschedule();
    await refreshCaches();
  });
  void syncSerial(syncNow);
});

api.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (reply: Reply) => void) => {
  if (sender.id !== api.runtime.id || !isMessage(message)) return false;
  handleMessage(message).then(sendResponse, (err: unknown) => {
    console.error('[thekra]', err);
    sendResponse({ ok: false, error: 'server' });
  });
  return true; // the reply is sent asynchronously
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (STORE_KEY in changes || PREFS_KEY in changes) {
    void serial(async () => {
      await reschedule();
      await refreshCaches();
    });
  }
  if (STORE_KEY in changes) syncSoon();
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void serial(() => refreshCaches());
    return;
  }
  if (alarm.name === SYNC_ALARM) {
    void syncSerial(syncNow);
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
