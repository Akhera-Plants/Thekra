/**
 * Popup (and options page, opened in a tab on first install): onboarding / settings and the "today" view.
 * Plain DOM, no framework, no innerHTML: every string is set with textContent.
 */
import {
  createPlan,
  decreaseTo,
  deletePlan,
  formatHijriAr,
  isEbbOn,
  isHijriSupported,
  logDone,
  normalize,
  requiredOn,
  startSuggestion,
  todayFrom,
  toHijri,
  updatePlan,
  updateSettings,
  upsertPlan,
  type LocalDate,
  type Plan,
  type Rule,
  type Store,
} from '@thekra/practice-core';
import { deedUrl, formatAmount, habitTitle, unitLabel, type Habit } from '../catalog.js';
import { API_ORIGIN } from '../cache.js';
import { api, getCatalog, getSyncStatus, loadState, loadStore, refreshCaches, saveState, saveStore, TARGET, tokenStore } from '../ext.js';
import { translator } from '../i18n.js';
import {
  applyIncrease,
  increaseSuggestion,
  monthlyBand,
  ramadanEnd,
  reminderDaysPerWeek,
  seasonAmount,
  setEbb,
  setSeason,
} from '../progress.js';
import type { Translate } from '../quotes.js';
import { isReminderDay, remainingOn, ruleOf } from '../scheduler.js';
import type { Message, Reply } from '../messages.js';
import { AUTH_KEY, PREFS_KEY, STORE_KEY, SYNC_STATUS_KEY, type Lang, type State } from '../state.js';
import type { SyncStatus } from '../sync-runner.js';

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | number | boolean | undefined> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const HOST_ORIGINS = [`${API_ORIGIN}/*`];
const MAX_SLOTS = 6;
const EXTRA_SLOTS = ['08:00', '12:00', '15:00', '18:00', '20:00', '22:00', '06:00', '10:00', '14:00', '16:00', '21:00', '23:00'];

let state: State;
let catalog: Habit[] = [];
/** Signed-in account email, or null. */
let account: string | null = null;
let syncStatus: SyncStatus | null = null;
let view: 'today' | 'settings' = 'today';
let flash = '';

const root = document.getElementById('app') as HTMLElement;

function today(): LocalDate {
  return todayFrom(new Date());
}

function applyLang(lang: Lang): Translate {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = translator(lang);
  document.title = t('extName');
  return t;
}

function hijriText(date: LocalDate, offset: number, lang: Lang): string | null {
  if (!isHijriSupported()) return null;
  if (lang === 'ar') return formatHijriAr(date, offset);
  const hd = toHijri(date, offset);
  return `${hd.day}/${hd.month}/${hd.year} AH`;
}

function send(message: Message): Promise<Reply> {
  return (api.runtime.sendMessage(message) as Promise<Reply | undefined>).then(
    (r) => r ?? { ok: false, error: 'server' },
    () => ({ ok: false, error: 'server' }),
  );
}

/**
 * Applies a store edit to the store as it is in storage now (a sync may have merged changes since the popup
 * read it), through the practice-core store helpers so versions and tombstones stay right.
 */
async function editStore(change: (store: Store) => Store): Promise<void> {
  const next = change(await loadStore());
  await saveStore(next);
  state = { ...state, store: next };
}

function editPlan(planId: string, change: (p: Plan) => Plan): Promise<void> {
  return editStore((store) => updatePlan(store, planId, change));
}

function habitOf(plan: Plan): Habit | undefined {
  return plan.habitKey === undefined ? undefined : catalog.find((x) => x.key === plan.habitKey);
}

/** «HH:MM» in Western digits. */
function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function syncLine(t: Translate): HTMLElement | null {
  if (!account) return null;
  const s = syncStatus;
  let text = t('syncPending');
  let cls = 'sync muted';
  if (s?.state === 'ok') text = t('syncOk', clock(s.at));
  else if (s?.state === 'signedOut') text = t('syncSignedOut');
  else if (s?.state === 'error') {
    text = s.error === 'offline' ? t('syncOffline') : t('syncError');
    if (s.lastOkAt) text = `${text} ${t('syncLast', clock(s.lastOkAt))}`;
    cls = 'sync warn';
  }
  return h('p', { class: cls, role: 'status' }, text);
}

// ---- Shell ---------------------------------------------------------------------------------------------

function render(): void {
  const lang = view === 'settings' && draft ? draft.lang : state.prefs.lang;
  const t = applyLang(lang);
  const tab = (name: 'today' | 'settings', label: string) => {
    const b = h('button', { type: 'button', class: 'tab', 'aria-pressed': view === name ? 'true' : 'false' }, label);
    b.addEventListener('click', () => {
      if (view === name) return;
      view = name;
      draft = null;
      flash = '';
      render();
    });
    return b;
  };
  const header = h(
    'header',
    { class: 'top' },
    h('img', { src: 'icons/icon-32.png', alt: '', width: 24, height: 24 }),
    h('h1', {}, t('extName')),
    h('nav', { class: 'tabs' }, tab('today', t('tabToday')), tab('settings', t('tabSettings'))),
  );
  const main = h('main', {});
  redrawAccount = null;
  if (view === 'today') renderToday(main, t);
  else renderSettings(main, t);
  root.replaceChildren(header, main);
}

async function hostPermissionBlock(t: Translate): Promise<HTMLElement | null> {
  if (TARGET !== 'firefox' || !api.permissions) return null;
  const has = await api.permissions.contains({ origins: HOST_ORIGINS });
  if (has) return null;
  const button = h('button', { type: 'button', class: 'secondary' }, t('hostPermission'));
  button.addEventListener('click', () => {
    // Must be called directly from the click (user gesture).
    void api.permissions.request({ origins: HOST_ORIGINS }).then(async (granted) => {
      if (granted) {
        button.remove();
        await refreshCaches(Date.now(), true);
      }
    });
  });
  return h('p', { class: 'permission' }, button);
}

// ---- Today ---------------------------------------------------------------------------------------------

function renderToday(main: HTMLElement, t: Translate): void {
  const lang = state.prefs.lang;
  const day = today();
  const offset = state.store.settings.hijriOffset;
  if (flash) {
    main.append(h('p', { class: 'flash', role: 'status' }, flash));
    flash = '';
  }
  const hijri = hijriText(day, offset, lang);
  if (hijri) main.append(h('p', { class: 'muted date' }, t('hijriToday', hijri)));
  const line = syncLine(t);
  if (line) main.append(line);

  if (state.store.plans.length === 0) {
    const go = h('button', { type: 'button', class: 'primary' }, t('goToSettings'));
    go.addEventListener('click', () => {
      view = 'settings';
      render();
    });
    main.append(h('section', { class: 'card empty' }, h('p', {}, t('todayEmpty')), go));
    return;
  }

  const plans = [...state.store.plans].sort((a, b) => (a.slots[0] ?? '').localeCompare(b.slots[0] ?? ''));
  for (const stored of plans) {
    const plan = normalize(stored, day);
    const habit = habitOf(plan);
    const fallback = habit?.defaultRule;
    const rule = ruleOf(plan, fallback);
    const label = habit ? unitLabel(habit, lang) : '';
    const amount = (n: number) => formatAmount(n, plan.unit, label);
    const required = requiredOn(plan, day);
    const done = plan.log[day] ?? 0;
    const remaining = remainingOn(plan, day);
    const due = isReminderDay(plan, fallback, state.prefs.quietDays, day, offset);

    const card = h('section', { class: 'card' });
    const title = habit ? habitTitle(habit, lang) : plan.title;
    const link = h('a', { href: deedUrl(habit?.deed ?? plan.deedSlug, lang), target: '_blank', rel: 'noopener' }, t('openDeed'));
    card.append(h('div', { class: 'row between' }, h('h2', {}, title), link));
    if (habit?.basis === 'organizational') card.append(h('p', { class: 'note' }, t('basisOrganizational')));

    card.append(h('p', { class: 'required' }, due ? t('requiredToday', amount(required)) : t('notDueToday')));
    if (done > 0) card.append(h('p', { class: 'done' }, remaining === 0 ? t('doneComplete') : t('doneToday', amount(done))));

    // Log: any partial amount counts (same-day make-up).
    const input = h('input', { type: 'number', min: 1, step: 1, value: String(remaining > 0 ? remaining : required), inputmode: 'numeric', 'aria-label': t('logLabel') });
    const logButton = h('button', { type: 'submit', class: 'primary' }, t('logButton'));
    const form = h('form', { class: 'log' }, h('label', {}, t('logLabel')), h('div', { class: 'row' }, input, logButton));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Number(input.value);
      if (!Number.isFinite(n) || n <= 0) return;
      void editPlan(plan.id, (p) => logDone(p, day, n)).then(render);
    });
    card.append(form);

    const band = monthlyBand(plan, rule, state.prefs.quietDays, day, offset);
    if (band) {
      const key = band === 'excellent' ? 'bandExcellent' : band === 'good' ? 'bandGood' : 'bandGentle';
      card.append(h('p', { class: `band band-${band}` }, t(key)));
    }

    const up = increaseSuggestion(plan, rule, state.prefs.quietDays, day, offset);
    if (up !== null) {
      const b = h('button', { type: 'button', class: 'secondary' }, t('increaseButton'));
      b.addEventListener('click', () => {
        void editPlan(plan.id, (p) => applyIncrease(p, rule, state.prefs.quietDays, day, offset)).then(render);
      });
      card.append(h('div', { class: 'offer' }, h('p', {}, t('increaseOffer', amount(up))), b));
    }

    // «يومي ثقيل» is one day (practice-core isEbbOn): yesterday's ebb shows unchecked without any write.
    card.append(toggle(t('ebbToggle'), isEbbOn(plan, day), (on) => editPlan(plan.id, (p) => setEbb(p, on, day))));

    const ramadan = isHijriSupported() ? ramadanEnd(day, offset) : null;
    const seasonUp = seasonAmount(plan);
    if (plan.season || (ramadan !== null && seasonUp !== null)) {
      const shown = plan.season ? plan.season.amount : (seasonUp as number);
      card.append(toggle(t('seasonToggle', amount(shown)), Boolean(plan.season), (on) => editPlan(plan.id, (p) => setSeason(p, on, day, offset))));
    }
    main.append(card);
  }
  void hostPermissionBlock(t).then((block) => block && main.append(block));
}

function toggle(label: string, checked: boolean, onChange: (on: boolean) => Promise<void>): HTMLElement {
  const box = h('input', { type: 'checkbox', checked });
  box.addEventListener('change', () => {
    void onChange(box.checked).then(render);
  });
  return h('label', { class: 'toggle' }, box, h('span', {}, label));
}

// ---- Settings / onboarding -----------------------------------------------------------------------------

interface HabitDraft {
  selected: boolean;
  distance: 'far' | 'near';
  amount: number;
  /** Upper bound for the amount of an existing plan (only lowering is allowed here). */
  maxAmount?: number;
  slots: string[];
  activeDays: number;
}

interface Draft {
  lang: Lang;
  quietDays: number[];
  hijriOffset: number;
  habits: Record<string, HabitDraft>;
}

let draft: Draft | null = null;

function suggestedStart(habit: Habit, distance: 'far' | 'near'): number {
  return habit.start?.[distance] ?? (habit.unit === 'minutes' ? startSuggestion(distance) : 1);
}

/** Active days cannot exceed the days the rule fires (practice-core still needs at least 2). */
function maxActiveDays(rule: Rule): number {
  let perWeek: number | null = null;
  try {
    perWeek = reminderDaysPerWeek(rule, [], today(), 0);
  } catch {
    perWeek = null; // Hijri rule on a runtime without Umm al-Qura.
  }
  return Math.max(2, Math.min(7, Math.round(perWeek ?? 7)));
}

function defaultActiveDays(rule: Rule): number {
  return Math.min(3, maxActiveDays(rule));
}

function makeDraft(): Draft {
  const habits: Record<string, HabitDraft> = {};
  for (const habit of catalog) {
    const plan = state.store.plans.find((p) => p.habitKey === habit.key);
    if (plan) {
      const base = plan.season ? plan.season.previous : plan.amount;
      habits[habit.key] = { selected: true, distance: 'near', amount: base, maxAmount: base, slots: [...plan.slots], activeDays: plan.activeDaysPerWeek };
    } else {
      habits[habit.key] = { selected: false, distance: 'far', amount: suggestedStart(habit, 'far'), slots: [...habit.defaultSlots], activeDays: defaultActiveDays(habit.defaultRule) };
    }
  }
  return { lang: state.prefs.lang, quietDays: [...state.prefs.quietDays], hijriOffset: state.store.settings.hijriOffset, habits };
}

function resizeSlots(slots: string[], count: number): string[] {
  const out = slots.slice(0, count);
  for (const s of EXTRA_SLOTS) {
    if (out.length >= count) break;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function select(options: { value: string; label: string }[], value: string, onChange: (v: string) => void, label: string): HTMLSelectElement {
  const el = h('select', { 'aria-label': label }, ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

function renderSettings(main: HTMLElement, t: Translate): void {
  if (!draft) draft = makeDraft();
  const d = draft;
  const lang = d.lang;
  const day = today();

  main.append(h('p', { class: 'intro' }, t('onboardingIntro')));
  main.append(h('h2', { class: 'section' }, t('habitsHeading')));

  for (const habit of catalog) {
    const hd = d.habits[habit.key] as HabitDraft;
    const card = h('section', { class: hd.selected ? 'card habit selected' : 'card habit' });
    const box = h('input', { type: 'checkbox', checked: hd.selected });
    box.addEventListener('change', () => {
      hd.selected = box.checked;
      render();
    });
    card.append(h('label', { class: 'habit-title' }, box, h('span', {}, habitTitle(habit, lang))));
    const hint = lang === 'en' ? habit.timeHintEn : habit.timeHintAr;
    if (hint) card.append(h('p', { class: 'muted' }, t('timeHint', hint)));
    if (habit.basis === 'organizational') card.append(h('p', { class: 'note' }, t('basisOrganizational')));

    if (hd.selected) {
      const label = unitLabel(habit, lang);
      const amountInput = h('input', { type: 'number', min: 1, step: 1, value: String(hd.amount), max: hd.maxAmount, inputmode: 'numeric', 'aria-label': t('amountLabel') });
      amountInput.addEventListener('change', () => {
        hd.amount = Number(amountInput.value);
      });
      if (hd.maxAmount === undefined) {
        const radio = (value: 'far' | 'near', text: string) => {
          const r = h('input', { type: 'radio', name: `distance-${habit.key}`, value, checked: hd.distance === value });
          r.addEventListener('change', () => {
            hd.distance = value;
            hd.amount = suggestedStart(habit, value);
            render();
          });
          return h('label', { class: 'inline' }, r, h('span', {}, text));
        };
        card.append(
          h('fieldset', {}, h('legend', {}, t('distanceLabel')), radio('far', t('distanceFar')), radio('near', t('distanceNear'))),
          h('p', { class: 'suggest' }, t('startSuggestion', formatAmount(suggestedStart(habit, hd.distance), habit.unit, label))),
          h('p', { class: 'muted' }, t('startHint')),
        );
      } else {
        card.append(h('p', { class: 'muted' }, t('amountLockedHint')));
      }
      card.append(h('label', { class: 'field' }, h('span', {}, t('amountLabel')), h('span', { class: 'row' }, amountInput, h('span', { class: 'unit' }, label))));

      const count = select(
        Array.from({ length: MAX_SLOTS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
        String(hd.slots.length),
        (v) => {
          hd.slots = resizeSlots(hd.slots, Number(v));
          render();
        },
        t('remindersPerDay'),
      );
      card.append(h('label', { class: 'field' }, h('span', {}, t('remindersPerDay')), count));
      const times = h('div', { class: 'times' });
      hd.slots.forEach((slot, i) => {
        const input = h('input', { type: 'time', value: slot, required: true, 'aria-label': `${t('reminderTimes')} ${i + 1}` });
        input.addEventListener('change', () => {
          hd.slots[i] = input.value;
        });
        times.append(input);
      });
      card.append(h('div', { class: 'field' }, h('span', {}, t('reminderTimes')), times));

      const existing = state.store.plans.find((p) => p.habitKey === habit.key);
      const maxDays = maxActiveDays(existing?.rule ?? habit.defaultRule);
      const days = select(
        Array.from({ length: maxDays - 1 }, (_, i) => ({ value: String(i + 2), label: String(i + 2) })),
        String(Math.min(hd.activeDays, maxDays)),
        (v) => {
          hd.activeDays = Number(v);
        },
        t('activeDays'),
      );
      card.append(h('label', { class: 'field' }, h('span', {}, t('activeDays')), days), h('p', { class: 'muted' }, t('activeDaysHint')));
    }
    main.append(card);
  }

  // General
  const general = h('section', { class: 'card' }, h('h2', {}, t('generalHeading')));
  const quiet = h('div', { class: 'weekdays' });
  for (let wd = 0; wd < 7; wd++) {
    const box = h('input', { type: 'checkbox', checked: d.quietDays.includes(wd) });
    box.addEventListener('change', () => {
      d.quietDays = box.checked ? [...d.quietDays, wd].sort() : d.quietDays.filter((x) => x !== wd);
    });
    quiet.append(h('label', { class: 'inline' }, box, h('span', {}, t(`weekday${wd}`))));
  }
  general.append(h('fieldset', {}, h('legend', {}, t('quietDaysLabel')), quiet));

  const preview = h('p', { class: 'muted' });
  const showPreview = () => {
    const text = hijriText(day, d.hijriOffset, lang);
    preview.textContent = text ? t('hijriToday', text) : t('hijriUnsupported');
  };
  showPreview();
  const offset = select(
    [-2, -1, 0, 1, 2].map((n) => ({ value: String(n), label: n > 0 ? `+${n}` : String(n) })),
    String(d.hijriOffset),
    (v) => {
      d.hijriOffset = Number(v);
      showPreview();
    },
    t('hijriOffsetLabel'),
  );
  general.append(h('label', { class: 'field' }, h('span', {}, t('hijriOffsetLabel')), offset), preview);

  const language = select(
    [
      { value: 'ar', label: t('languageAr') },
      { value: 'en', label: t('languageEn') },
    ],
    d.lang,
    (v) => {
      d.lang = v === 'en' ? 'en' : 'ar';
      render();
    },
    t('languageLabel'),
  );
  general.append(h('label', { class: 'field' }, h('span', {}, t('languageLabel')), language));
  main.append(general);

  const message = h('p', { class: 'flash', role: 'status' }, flash);
  const save = h('button', { type: 'button', class: 'primary wide' }, t('save'));
  save.addEventListener('click', () => {
    const error = validateDraft(d);
    if (error) {
      message.textContent = t(error);
      return;
    }
    void saveDraft(d).then(() => {
      flash = translator(d.lang)('saved');
      draft = null;
      view = 'today';
      render();
    });
  });
  main.append(save, message);

  // The account is separate from the form above: signing in or out takes effect at once.
  const accountBox = h('section', { class: 'card account' });
  redrawAccount = () => accountBox.replaceChildren(...accountContent(translator(d.lang)));
  redrawAccount();
  main.append(accountBox, h('p', { class: 'muted small' }, t('privacyNote')));
  void hostPermissionBlock(t).then((block) => block && main.append(block));
}

// ---- Account (optional) -------------------------------------------------------------------------------

/** Redraws the account block of the settings view in place (set while that view is shown). */
let redrawAccount: (() => void) | null = null;

function accountError(t: Translate, code: string): string {
  switch (code) {
    case 'invalid':
      return t('signInInvalid');
    case 'throttled':
      return t('signInThrottled');
    case 'offline':
      return t('syncOffline');
    default:
      return t('syncError');
  }
}

function accountContent(t: Translate): Node[] {
  const heading = h('h2', {}, t('accountHeading'));
  const message = h('p', { class: 'flash', role: 'status' });
  if (account) {
    const syncButton = h('button', { type: 'button', class: 'secondary' }, t('syncNow'));
    syncButton.addEventListener('click', () => {
      syncButton.disabled = true;
      void send({ type: 'sync' }).then((r) => {
        syncButton.disabled = false;
        if (!r.ok) message.textContent = accountError(t, r.error);
      });
    });
    const out = h('button', { type: 'button', class: 'secondary' }, t('signOut'));
    out.addEventListener('click', () => {
      out.disabled = true;
      void send({ type: 'signOut' });
    });
    const line = syncLine(t);
    return [heading, h('p', {}, t('signedInAs', account)), ...(line ? [line] : []), h('div', { class: 'row' }, syncButton, out), message, h('p', { class: 'muted small' }, t('syncScope'))];
  }
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, dir: 'ltr', 'aria-label': t('email') });
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true, dir: 'ltr', 'aria-label': t('password') });
  const submit = h('button', { type: 'submit', class: 'primary' }, t('signIn'));
  const form = h(
    'form',
    { class: 'signin' },
    h('label', { class: 'field' }, h('span', {}, t('email')), email),
    h('label', { class: 'field' }, h('span', {}, t('password')), password),
    submit,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit.disabled = true;
    message.textContent = '';
    void send({ type: 'signIn', email: email.value, password: password.value }).then((r) => {
      password.value = '';
      submit.disabled = false;
      if (!r.ok) message.textContent = accountError(t, r.error);
    });
  });
  return [heading, h('p', { class: 'muted' }, t('accountIntro')), form, message];
}

function validateDraft(d: Draft): string | null {
  const chosen = Object.values(d.habits).filter((x) => x.selected);
  if (chosen.length === 0 && !state.prefs.onboarded) return 'errorChooseOne';
  for (const hd of chosen) {
    if (!Number.isFinite(hd.amount) || hd.amount <= 0) return 'errorAmount';
    if (hd.slots.some((s) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) || new Set(hd.slots).size !== hd.slots.length) return 'errorSlots';
  }
  return null;
}

async function saveDraft(d: Draft): Promise<void> {
  const day = today();
  const fresh = await loadState();
  let store = fresh.store;
  for (const habit of catalog) {
    const hd = d.habits[habit.key];
    const existing = store.plans.find((p) => p.habitKey === habit.key);
    if (!hd?.selected) {
      // Unchecked: delete with a tombstone, so the deletion reaches the account too.
      if (existing) store = deletePlan(store, existing.id);
      continue;
    }
    const slots = [...hd.slots].sort();
    const activeDaysPerWeek = Math.max(2, Math.min(7, Math.round(hd.activeDays)));
    if (existing) {
      store = updatePlan(store, existing.id, (p) => {
        let plan: Plan = { ...p, title: habit.titleAr, slots, activeDaysPerWeek };
        if (!plan.rule) plan.rule = habit.defaultRule;
        const base = plan.season ? plan.season.previous : plan.amount;
        if (hd.amount < base) plan = decreaseTo(plan, hd.amount, day);
        return plan;
      });
    } else {
      const input = {
        id: crypto.randomUUID(),
        habitKey: habit.key,
        rule: habit.defaultRule,
        deedSlug: habit.deed,
        title: habit.titleAr,
        unit: habit.unit,
        amount: hd.amount,
        activeDaysPerWeek,
        slots,
        createdOn: day,
      };
      store = upsertPlan(store, createPlan(habit.ceiling !== undefined ? { ...input, ceiling: habit.ceiling } : input));
    }
  }
  // Plans without a catalog habit (e.g. made on the website) are kept untouched.
  if (d.hijriOffset !== store.settings.hijriOffset) store = updateSettings(store, { hijriOffset: d.hijriOffset });
  const next: State = { store, prefs: { ...fresh.prefs, lang: d.lang, quietDays: [...d.quietDays].sort(), onboarded: true } };
  state = next;
  await saveState(next);
}

// ---- Start ---------------------------------------------------------------------------------------------

async function start(): Promise<void> {
  // Lets the background finish any storage upgrade first, and starts a sync when signed in.
  await send({ type: 'ready' });
  let tokens;
  [state, catalog, tokens, syncStatus] = await Promise.all([loadState(), getCatalog(), tokenStore.get(), getSyncStatus()]);
  account = tokens ? tokens.email || '—' : null;
  view = state.prefs.onboarded ? 'today' : 'settings';
  render();
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const data = STORE_KEY in changes || PREFS_KEY in changes;
    const sync = AUTH_KEY in changes || SYNC_STATUS_KEY in changes;
    if (!data && !sync) return;
    void Promise.all([loadState(), tokenStore.get(), getSyncStatus()]).then(([s, tk, st]) => {
      state = s;
      account = tk ? tk.email || '—' : null;
      syncStatus = st;
      // Do not throw away an unsaved settings form: there only the account block is redrawn.
      if (view === 'today') render();
      else if (sync) redrawAccount?.();
    });
  });
}

void start();
