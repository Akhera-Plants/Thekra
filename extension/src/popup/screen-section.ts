/**
 * Options: the new-tab page and prayer times (redesign §4.6). Saved at once (like the account block), independent of
 * the habits form above it. Plain DOM; every string through textContent.
 *
 * - «صفحة التبويب الجديد»: on/off (off shows only the date: an override cannot be removed at runtime), the text source
 *   (a reminder set, a chosen habit's evidence, or «تذكيراتي»), the Hijri line.
 * - «تذكيراتي»: this browser's own list (the app and the website keep theirs on their devices).
 * - «أوقات الصلاة»: city + country (method by country); asks for the AlAdhan host permission on save.
 */
import {
  addMyReminder,
  defaultMethodForCountry,
  MY_REMINDER_MAX_LENGTH,
  MY_REMINDERS_MAX,
  myReminderError,
  parsePrayerSettings,
  removeMyReminder,
  type TodayTextSource,
} from '@thekra/practice-core';
import { habitTitle, type Habit } from '../catalog.js';
import { api, getReminderSets, loadState, PRAYER_ORIGINS, refreshPrayerTimes, saveState } from '../ext.js';
import type { Translate } from '../quotes.js';
import type { Prefs } from '../state.js';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    node.setAttribute(name, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}

async function savePrefs(change: (prefs: Prefs) => Prefs): Promise<void> {
  const state = await loadState();
  await saveState({ ...state, prefs: change(state.prefs) });
}

const sourceValue = (s: TodayTextSource) => (s.kind === 'set' ? `set:${s.slug}` : s.kind === 'habit' ? `habit:${s.habitKey}` : 'mine');

function sourceOf(value: string): TodayTextSource {
  if (value.startsWith('set:')) return { kind: 'set', slug: value.slice(4) };
  if (value.startsWith('habit:')) return { kind: 'habit', habitKey: value.slice(6) };
  return { kind: 'mine' };
}

export function screenSection(t: Translate, catalog: readonly Habit[]): HTMLElement {
  const box = el('section', { class: 'card' });
  const redraw = async () => {
    const [{ prefs, store }, sets] = await Promise.all([loadState(), getReminderSets()]);
    const lang = prefs.lang;
    const parts: Node[] = [el('h2', { class: 'section' }, t('newTabHeading')), el('p', { class: 'muted small' }, t('newTabHelper'))];

    const toggle = (label: string, checked: boolean, onChange: (on: boolean) => Prefs) => {
      const input = el('input', { type: 'checkbox', checked });
      input.addEventListener('change', () => void savePrefs(() => onChange(input.checked)).then(redraw));
      return el('label', { class: 'toggle' }, input, el('span', {}, label));
    };
    parts.push(toggle(t('newTabToggle'), prefs.newTab, (on) => ({ ...prefs, newTab: on })));
    parts.push(toggle(t('newTabHijri'), prefs.showHijri, (on) => ({ ...prefs, showHijri: on })));

    // Source: «تذكيراتي», the published sets, then the evidence of the habits this browser has.
    const chosen = new Set(store.plans.map((p) => p.habitKey));
    const options: { value: string; label: string }[] = [{ value: 'mine', label: t('newTabSourceMine') }];
    for (const s of sets) options.push({ value: `set:${s.slug}`, label: lang === 'en' ? s.titleEn : s.titleAr });
    for (const h of catalog) if (chosen.has(h.key) && h.evidence.length > 0) options.push({ value: `habit:${h.key}`, label: t('newTabSourceHabit', habitTitle(h, lang)) });
    const current = sourceValue(prefs.newTabSource);
    if (!options.some((o) => o.value === current)) options.push({ value: current, label: t('newTabSourceUnavailable') });
    const select = el('select', { 'aria-label': t('newTabSource') }, ...options.map((o) => el('option', { value: o.value, selected: o.value === current }, o.label)));
    select.addEventListener('change', () => void savePrefs((p) => ({ ...p, newTabSource: sourceOf(select.value) })).then(redraw));
    parts.push(el('label', { class: 'field' }, el('span', {}, t('newTabSource')), select));

    // «تذكيراتي».
    parts.push(el('h3', { class: 'section' }, t('myRemindersHeading')));
    const list = el('ul', { class: 'log' });
    for (const r of prefs.myReminders) {
      const remove = el('button', { type: 'button', class: 'secondary' }, t('myRemindersRemove'));
      remove.addEventListener('click', () => void savePrefs((p) => ({ ...p, myReminders: removeMyReminder(p.myReminders, r.id) })).then(redraw));
      list.append(el('li', { class: 'row between' }, el('span', {}, r.text), remove));
    }
    if (prefs.myReminders.length === 0) list.append(el('li', { class: 'muted' }, t('myRemindersEmpty')));
    const input = el('input', { type: 'text', maxlength: String(MY_REMINDER_MAX_LENGTH), 'aria-label': t('myRemindersNew') });
    const message = el('p', { class: 'flash', role: 'status' });
    const add = el('button', { type: 'button', class: 'primary' }, t('myRemindersAdd'));
    add.addEventListener('click', () => {
      const problem = myReminderError(prefs.myReminders, input.value);
      if (problem) {
        message.textContent = t(`myRemindersError_${problem}`, String(MY_REMINDER_MAX_LENGTH), String(MY_REMINDERS_MAX));
        return;
      }
      void savePrefs((p) => ({ ...p, myReminders: addMyReminder(p.myReminders, input.value, crypto.randomUUID(), new Date().toISOString()) })).then(redraw);
    });
    parts.push(list, el('div', { class: 'row' }, input, add), el('p', { class: 'muted small' }, t('myRemindersDeviceOnly')), message);

    // «أوقات الصلاة».
    parts.push(el('h3', { class: 'section' }, t('prayerHeading')), el('p', { class: 'muted small' }, t('prayerHelper')));
    const city = el('input', { type: 'text', value: prefs.prayer?.city ?? '', 'aria-label': t('prayerCity') });
    const country = el('input', { type: 'text', value: prefs.prayer?.country ?? '', maxlength: '2', dir: 'ltr', 'aria-label': t('prayerCountry') });
    const status = el('p', { class: 'flash', role: 'status' });
    const save = el('button', { type: 'button', class: 'primary' }, t('prayerSave'));
    save.addEventListener('click', () => {
      const code = country.value.trim().toUpperCase();
      const next = parsePrayerSettings({ city: city.value, country: code, method: defaultMethodForCountry(code) });
      if (!next) {
        status.textContent = t('prayerInvalid');
        return;
      }
      // Asked from the click (a user gesture), as browsers require.
      const ask = api.permissions ? api.permissions.request({ origins: PRAYER_ORIGINS }) : Promise.resolve(true);
      void ask.then(async (granted) => {
        await savePrefs((p) => ({ ...p, prayer: next }));
        const result = granted ? await refreshPrayerTimes(true) : 'failed';
        status.textContent = result === 'updated' ? t('prayerSaved') : t('prayerFailed');
      });
    });
    parts.push(
      el('label', { class: 'field' }, el('span', {}, t('prayerCity')), city),
      el('label', { class: 'field' }, el('span', {}, t('prayerCountry')), country),
      save,
      status,
    );
    if (prefs.prayer) {
      const clear = el('button', { type: 'button', class: 'secondary' }, t('prayerClear'));
      clear.addEventListener('click', () => void savePrefs((p) => ({ ...p, prayer: null, prayerCache: null })).then(redraw));
      parts.push(clear);
    }
    box.replaceChildren(...parts);
  };
  void redraw();
  return box;
}
