/**
 * The new-tab page (redesign §4.6). Plain DOM, no innerHTML: every string is set with textContent. Everything comes
 * from chrome.storage.local (this browser's store, prefs and caches); nothing is fetched here.
 */
import { todayFrom } from '@thekra/practice-core';
import { getCatalog, getQuotes, getReminderSets, loadState } from '../ext.js';
import { translator } from '../i18n.js';
import { newTabModel } from '../newtab-model.js';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function render(): Promise<void> {
  const [state, catalog, quotes, sets] = await Promise.all([loadState(), getCatalog(), getQuotes(), getReminderSets()]);
  const lang = state.prefs.lang;
  const t = translator(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('newTabTitle');
  const now = new Date();
  const model = newTabModel({ store: state.store, prefs: state.prefs, catalog, quotes, sets, today: todayFrom(now), now, t });
  const root = document.getElementById('app') as HTMLElement;
  document.body.classList.toggle('plain', model.off);

  const head = el('header');
  head.append(el('p', 'date', model.date));
  if (model.hijri) head.append(el('p', 'hijri', model.hijri));
  const parts: HTMLElement[] = [head];

  if (!model.off) {
    if (model.text) {
      const figure = el('figure', 'text');
      figure.append(el('blockquote', undefined, model.text.text));
      if (model.text.source) figure.append(el('figcaption', undefined, model.text.source));
      parts.push(figure);
    } else {
      parts.push(el('p', 'hint', t('newTabNoText')));
    }
    if (model.hasPlans) {
      const box = el('section', 'today');
      const title = el('h2');
      title.append(el('span', undefined, t('newTabToday')), el('span', 'streak', `🔥 ${model.streak}`));
      box.append(title);
      const list = el('ul');
      for (const habit of model.habits) list.append(el('li', habit.done ? 'done' : undefined, `${habit.done ? '✓' : '○'} ${habit.title}`));
      if (model.habits.length === 0) list.append(el('li', 'done', t('newTabNothingToday')));
      box.append(list);
      parts.push(box);
    }
  }
  root.replaceChildren(...parts);
}

void render();
