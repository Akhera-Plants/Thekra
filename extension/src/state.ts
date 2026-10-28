/**
 * What the extension keeps in `chrome.storage.local` (never `storage.sync`, roadmap §5):
 *   - `thekra.store`: the practice-core store (plans and the Hijri offset), as `serializeStore` text;
 *   - `thekra.prefs`: extension-only preferences (language, quiet days, the rule of each plan);
 *   - `thekra.catalog` / `thekra.evidence`: caches of the two API answers (see cache.ts).
 * The store never contains sin programs or relatives here: the extension creates neither.
 */
import { emptyStore, parseStore, serializeStore, validateRule, type Rule, type Store } from '@thekra/practice-core';

export const STORE_KEY = 'thekra.store';
export const PREFS_KEY = 'thekra.prefs';
export const CATALOG_KEY = 'thekra.catalog';
export const EVIDENCE_KEY = 'thekra.evidence';

export type Lang = 'ar' | 'en';

export interface Prefs {
  v: 1;
  lang: Lang;
  /** Weekdays (0 = Sunday … 6 = Saturday) with no reminders at all. */
  quietDays: number[];
  /** The recurrence of each plan, by plan id (= habit key). Defaults to the habit's `defaultRule`. */
  rules: Record<string, Rule>;
  /** True once the user saved the onboarding form. */
  onboarded: boolean;
}

export interface State {
  store: Store;
  prefs: Prefs;
}

export function defaultPrefs(): Prefs {
  return { v: 1, lang: 'ar', quietDays: [], rules: {}, onboarded: false };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Never throws; unknown or invalid fields fall back to defaults, unknown keys are dropped. */
export function parsePrefs(raw: unknown): Prefs {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return defaultPrefs();
    }
  }
  const p = isRecord(value) ? value : {};
  const out = defaultPrefs();
  if (p.lang === 'en' || p.lang === 'ar') out.lang = p.lang;
  if (Array.isArray(p.quietDays)) {
    out.quietDays = [...new Set(p.quietDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  }
  if (isRecord(p.rules)) {
    for (const [id, rule] of Object.entries(p.rules)) {
      if (validateRule(rule) === null) out.rules[id] = JSON.parse(JSON.stringify(rule)) as Rule;
    }
  }
  out.onboarded = p.onboarded === true;
  return out;
}

/** The exact values written to `chrome.storage.local`. */
export function encodeState(state: State): Record<string, string> {
  return {
    [STORE_KEY]: serializeStore(state.store),
    [PREFS_KEY]: JSON.stringify(parsePrefs(state.prefs)),
  };
}

/** Reads what `chrome.storage.local.get([STORE_KEY, PREFS_KEY])` returned. Never throws. */
export function decodeState(raw: Record<string, unknown> | undefined): State {
  const r = raw ?? {};
  const store = r[STORE_KEY] === undefined ? emptyStore() : parseStore(r[STORE_KEY]);
  // Rules of plans that no longer exist are dropped.
  const prefs = parsePrefs(r[PREFS_KEY]);
  const ids = new Set(store.plans.map((p) => p.id));
  for (const id of Object.keys(prefs.rules)) if (!ids.has(id)) delete prefs.rules[id];
  return { store, prefs };
}
