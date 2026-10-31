/**
 * What the extension keeps in `chrome.storage.local` (never `storage.sync`, roadmap §5):
 *   - `thekra.store`: the practice-core Store v2 (plans with their rule and log, settings, tombstones, sync state),
 *     as `serializeStore` text. Relatives, contacts and settings that arrive from the account are kept untouched
 *     even though the extension does not show relatives, so a later sync never deletes them. The extension never
 *     creates or reads sin programs;
 *   - `thekra.prefs`: device-only UI preferences (language, quiet days, onboarded) and, since phase 6, the new-tab page
 *     (on/off, its text source, the Hijri line), «تذكيراتي» (this browser's own list; the app and the site keep theirs)
 *     and the prayer-time city with its 30-day cache;
 *   - `thekra.auth` / `thekra.syncStatus`: account tokens and the last sync result (auth.ts, sync-runner.ts);
 *   - `thekra.catalog` / `thekra.evidence`: caches of the two public API answers (cache.ts).
 */
import {
  emptyStore,
  parseMyReminders,
  parsePrayerCache,
  parsePrayerSettings,
  parseStore,
  parseTodayTextSource,
  serializeStore,
  validateRule,
  type MyReminder,
  type Plan,
  type PrayerCache,
  type PrayerSettings,
  type Rule,
  type Store,
  type TodayTextSource,
} from '@thekra/practice-core';
import { SLUG, UUID } from './catalog.js';

export const STORE_KEY = 'thekra.store';
export const PREFS_KEY = 'thekra.prefs';
export const CATALOG_KEY = 'thekra.catalog';
export const EVIDENCE_KEY = 'thekra.evidence';
export const AUTH_KEY = 'thekra.auth';
export const SYNC_STATUS_KEY = 'thekra.syncStatus';
export const REMINDER_SETS_KEY = 'thekra.reminderSets';

export type Lang = 'ar' | 'en';

export interface Prefs {
  v: 2;
  lang: Lang;
  /** Weekdays (0 = Sunday … 6 = Saturday) with no reminders on this device. */
  quietDays: number[];
  /** True once the user saved the onboarding form. */
  onboarded: boolean;
  /**
   * The new-tab page (phase 6). Off: the override cannot be removed at runtime, so the page shows only the date on a
   * plain background.
   */
  newTab: boolean;
  /** Where the new-tab text comes from: a reminder set, a habit's evidence, or «تذكيراتي». */
  newTabSource: TodayTextSource;
  /** The Hijri date under the Gregorian one on the new-tab page. Off by default. */
  showHijri: boolean;
  /** «تذكيراتي» of this browser (practice-core: ≤ 120 characters, at most 20). */
  myReminders: MyReminder[];
  /** The city whose prayer times anchor «بعد الفجر»… reminders; null = default times. */
  prayer: PrayerSettings | null;
  prayerCache: PrayerCache | null;
}

export interface State {
  store: Store;
  prefs: Prefs;
}

export function defaultPrefs(): Prefs {
  return {
    v: 2,
    lang: 'ar',
    quietDays: [],
    onboarded: false,
    newTab: true,
    newTabSource: { kind: 'mine' },
    showHijri: false,
    myReminders: [],
    prayer: null,
    prayerCache: null,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Never throws; unknown or invalid fields fall back to defaults, unknown keys are dropped. */
export function parsePrefs(raw: unknown): Prefs {
  const value = parseJson(raw);
  const p = isRecord(value) ? value : {};
  const out = defaultPrefs();
  if (p.lang === 'en' || p.lang === 'ar') out.lang = p.lang;
  if (Array.isArray(p.quietDays)) {
    out.quietDays = [...new Set(p.quietDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  }
  out.onboarded = p.onboarded === true;
  out.newTab = p.newTab !== false;
  if (p.newTabSource !== undefined) {
    const source = parseTodayTextSource(p.newTabSource);
    // The extension offers a set, a habit's evidence or «تذكيراتي»; nothing else is a source here.
    if (source.kind === 'set' || source.kind === 'habit' || source.kind === 'mine') out.newTabSource = source;
  }
  out.showHijri = p.showHijri === true;
  out.myReminders = parseMyReminders(p.myReminders);
  out.prayer = parsePrayerSettings(p.prayer);
  out.prayerCache = parsePrayerCache(p.prayerCache);
  return out;
}

/** Plan rules kept in prefs by the first version (v1 prefs), by plan id. Read once, for the migration. */
function legacyRules(raw: unknown): Record<string, Rule> {
  const value = parseJson(raw);
  const out: Record<string, Rule> = {};
  if (!isRecord(value) || !isRecord(value.rules)) return out;
  for (const [id, rule] of Object.entries(value.rules)) {
    if (validateRule(rule) === null) out[id] = JSON.parse(JSON.stringify(rule)) as Rule;
  }
  return out;
}

/** The exact values written to `chrome.storage.local`. */
export function encodeState(state: State): Record<string, string> {
  return {
    [STORE_KEY]: serializeStore(state.store),
    [PREFS_KEY]: JSON.stringify(parsePrefs(state.prefs)),
  };
}

export interface DecodeOptions {
  /** ISO time used when a v1 store is upgraded. */
  now?: string;
  /** New plan ids for the migration (default `crypto.randomUUID`). */
  newId?: () => string;
}

export interface Decoded extends State {
  /** True when the stored data was upgraded and should be written back. */
  migrated: boolean;
}

/**
 * Reads what `chrome.storage.local.get([STORE_KEY, PREFS_KEY])` returned. Never throws.
 *
 * Upgrades the first extension version: Store v1 → v2 (practice-core `parseStore`), and plans whose id was the
 * habit key (`duha`) get a UUID id (the sync API requires one) with `habitKey` set and the rule that used to live
 * in prefs moved into `Plan.rule`. Those plans were never synced (the server rejects non-UUID ids), so they are
 * re-keyed in place without a tombstone.
 */
export function decodeState(raw: Record<string, unknown> | undefined, opts: DecodeOptions = {}): Decoded {
  const r = raw ?? {};
  const storeRaw = parseJson(r[STORE_KEY]);
  let store = r[STORE_KEY] === undefined ? emptyStore() : parseStore(r[STORE_KEY], opts.now);
  const prefs = parsePrefs(r[PREFS_KEY]);
  const rules = legacyRules(r[PREFS_KEY]);
  const prefsRaw = parseJson(r[PREFS_KEY]);
  let migrated = (isRecord(storeRaw) && storeRaw.v === 1) || (isRecord(prefsRaw) && prefsRaw.v !== 2);
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const plans = store.plans.map((p): Plan => {
    let plan = p;
    const rule = rules[p.id];
    if (!plan.rule && rule) {
      plan = { ...plan, rule };
      migrated = true;
    }
    if (!UUID.test(plan.id)) {
      const next: Plan = { ...plan, id: newId() };
      if (next.habitKey === undefined && SLUG.test(plan.id)) next.habitKey = plan.id;
      plan = next;
      migrated = true;
    }
    return plan;
  });
  store = { ...store, plans };
  return { store, prefs, migrated };
}
