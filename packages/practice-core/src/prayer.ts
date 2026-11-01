/**
 * Prayer-time anchors (redesign §4.6): a habit slot may be «بعد الفجر» instead of a fixed `HH:MM`. Each client fetches
 * the prayer times of the user's chosen city from AlAdhan (`https://api.aladhan.com/v1/calendarByCity/{y}/{m}`, the
 * month view of `timingsByCity`), keeps {@link PRAYER_CACHE_DAYS} days locally and resolves the anchors here. Offline
 * or before a city is set, every anchor falls back to {@link DEFAULT_ANCHOR_TIMES}; a plan keeps a fixed fallback time
 * in `slots` for each anchored slot, so older clients (and the calendar file) still have a time.
 *
 * The web push planner on the server never calls AlAdhan: the browser sends the resolved times of the next days with
 * its push subscription prefs ({@link resolvedAnchorTimes}).
 *
 * Pure; no network here. Times are local `HH:MM`, dates local `YYYY-MM-DD`.
 */
import { addDays, isValidDate, isValidTime, timeToMinutes, type LocalDate, type LocalTime } from './dates.js';

export const PRAYER_ANCHORS = ['after-fajr', 'after-dhuhr', 'after-asr', 'after-maghrib', 'after-isha', 'before-sleep'] as const;
export type PrayerAnchor = (typeof PRAYER_ANCHORS)[number];

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type Prayer = (typeof PRAYERS)[number];

/** One day's prayer times (after the user's minute offsets). */
export type PrayerTimes = Record<Prayer, LocalTime>;

/** Used when no prayer times are known for the day (offline, no city chosen). */
export const DEFAULT_PRAYER_TIMES: PrayerTimes = {
  fajr: '05:00',
  dhuhr: '12:15',
  asr: '15:30',
  maghrib: '18:00',
  isha: '19:30',
};

/** «بعد الصلاة»: minutes after the adhan time (the prayer itself and its adhkar come first). */
export const AFTER_PRAYER_MINUTES = 20;
/** «قبل النوم»: this long after isha… */
export const BEFORE_SLEEP_AFTER_ISHA_MINUTES = 120;
/** …but never earlier than this… */
export const BEFORE_SLEEP_EARLIEST: LocalTime = '21:30';
/** …and never later than this (just before the quiet hours). */
export const BEFORE_SLEEP_LATEST: LocalTime = '22:45';

/** Days of timings each client keeps. */
export const PRAYER_CACHE_DAYS = 30;
/** A manual offset per prayer, in minutes, is clamped to ±this. */
export const MAX_PRAYER_OFFSET = 60;

export function isPrayerAnchor(value: unknown): value is PrayerAnchor {
  return typeof value === 'string' && (PRAYER_ANCHORS as readonly string[]).includes(value);
}

function minutesToTime(total: number): LocalTime {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** `time` moved by `minutes` (wraps around midnight). */
export function shiftTime(time: LocalTime, minutes: number): LocalTime {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** The time an anchor rings on a day with these prayer times (or the defaults). */
export function resolveAnchor(anchor: PrayerAnchor, times: PrayerTimes | undefined = undefined): LocalTime {
  const t = times ?? DEFAULT_PRAYER_TIMES;
  switch (anchor) {
    case 'after-fajr':
      return shiftTime(t.fajr, AFTER_PRAYER_MINUTES);
    case 'after-dhuhr':
      return shiftTime(t.dhuhr, AFTER_PRAYER_MINUTES);
    case 'after-asr':
      return shiftTime(t.asr, AFTER_PRAYER_MINUTES);
    case 'after-maghrib':
      return shiftTime(t.maghrib, AFTER_PRAYER_MINUTES);
    case 'after-isha':
      return shiftTime(t.isha, AFTER_PRAYER_MINUTES);
    case 'before-sleep': {
      const m = timeToMinutes(t.isha) + BEFORE_SLEEP_AFTER_ISHA_MINUTES;
      const lo = timeToMinutes(BEFORE_SLEEP_EARLIEST);
      const hi = timeToMinutes(BEFORE_SLEEP_LATEST);
      return minutesToTime(Math.min(hi, Math.max(lo, m)));
    }
  }
}

/** The fixed times anchors fall back to (no prayer times known). */
export const DEFAULT_ANCHOR_TIMES: Record<PrayerAnchor, LocalTime> = Object.fromEntries(
  PRAYER_ANCHORS.map((a) => [a, resolveAnchor(a)]),
) as Record<PrayerAnchor, LocalTime>;

export function isPrayerTimes(value: unknown): value is PrayerTimes {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return PRAYERS.every((p) => isValidTime(v[p]));
}

// ── Settings ────────────────────────────────────────────────────────────────────────────────────────────────────

/** AlAdhan calculation methods offered in settings (ids as in the AlAdhan API). */
export const ALADHAN_METHODS: readonly { id: number; ar: string; en: string }[] = [
  { id: 4, ar: 'أم القرى (مكة المكرمة)', en: 'Umm al-Qura, Makkah' },
  { id: 3, ar: 'رابطة العالم الإسلامي', en: 'Muslim World League' },
  { id: 5, ar: 'الهيئة المصرية العامة للمساحة', en: 'Egyptian General Authority of Survey' },
  { id: 1, ar: 'جامعة العلوم الإسلامية، كراتشي', en: 'University of Islamic Sciences, Karachi' },
  { id: 2, ar: 'الجمعية الإسلامية لأمريكا الشمالية', en: 'Islamic Society of North America' },
  { id: 8, ar: 'منطقة الخليج', en: 'Gulf Region' },
  { id: 9, ar: 'الكويت', en: 'Kuwait' },
  { id: 10, ar: 'قطر', en: 'Qatar' },
  { id: 16, ar: 'دبي', en: 'Dubai' },
  { id: 23, ar: 'وزارة الأوقاف الأردنية', en: 'Jordan, Ministry of Awqaf' },
  { id: 21, ar: 'المغرب', en: 'Morocco' },
  { id: 19, ar: 'الجزائر', en: 'Algeria' },
  { id: 18, ar: 'تونس', en: 'Tunisia' },
  { id: 13, ar: 'رئاسة الشؤون الدينية التركية', en: 'Diyanet, Turkey' },
  { id: 12, ar: 'اتحاد المنظمات الإسلامية في فرنسا', en: 'UOIF, France' },
  { id: 11, ar: 'سنغافورة', en: 'Singapore' },
  { id: 17, ar: 'ماليزيا', en: 'JAKIM, Malaysia' },
  { id: 20, ar: 'إندونيسيا', en: 'KEMENAG, Indonesia' },
  { id: 15, ar: 'لجنة رؤية الهلال', en: 'Moonsighting Committee' },
];

/** The method used when the country has no default of its own. */
export const FALLBACK_METHOD = 3;

const METHOD_BY_COUNTRY: Record<string, number> = {
  SA: 4, YE: 4,
  EG: 5, SD: 5, LY: 5, SY: 5, LB: 5, IQ: 5, PS: 5,
  AE: 16, KW: 9, QA: 10, BH: 8, OM: 8,
  JO: 23, MA: 21, DZ: 19, TN: 18, TR: 13, FR: 12,
  SG: 11, MY: 17, ID: 20,
  PK: 1, IN: 1, BD: 1, AF: 1,
  US: 2, CA: 2,
};

/** The default AlAdhan method for an ISO 3166 alpha-2 country code. */
export function defaultMethodForCountry(country: string): number {
  return METHOD_BY_COUNTRY[country.trim().toUpperCase()] ?? FALLBACK_METHOD;
}

export interface PrayerSettings {
  /** City name as the user typed it (AlAdhan geocodes it). */
  city: string;
  /** ISO 3166 alpha-2 code, e.g. `SA`. */
  country: string;
  /** AlAdhan method id. */
  method: number;
  /** Manual minutes added to each prayer time (−{@link MAX_PRAYER_OFFSET}…+{@link MAX_PRAYER_OFFSET}). */
  offsets: Record<Prayer, number>;
}

export const MAX_CITY_LENGTH = 80;

export function emptyOffsets(): Record<Prayer, number> {
  return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
}

/** Never throws: returns `null` when there is no usable city/country (the anchors use their default times). */
export function parsePrayerSettings(raw: unknown): PrayerSettings | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const city = typeof r.city === 'string' ? r.city.trim().slice(0, MAX_CITY_LENGTH) : '';
  const country = typeof r.country === 'string' ? r.country.trim().toUpperCase() : '';
  if (city.length === 0 || !/^[A-Z]{2}$/.test(country)) return null;
  const method =
    typeof r.method === 'number' && ALADHAN_METHODS.some((m) => m.id === r.method) ? r.method : defaultMethodForCountry(country);
  const offsets = emptyOffsets();
  const rawOffsets = typeof r.offsets === 'object' && r.offsets !== null ? (r.offsets as Record<string, unknown>) : {};
  for (const p of PRAYERS) {
    const v = rawOffsets[p];
    if (typeof v === 'number' && Number.isFinite(v)) offsets[p] = Math.max(-MAX_PRAYER_OFFSET, Math.min(MAX_PRAYER_OFFSET, Math.round(v)));
  }
  return { city, country, method, offsets };
}

/** The identity of the location+method a cache was fetched for (offsets apply later, they never refetch). */
export function prayerCacheKey(s: Pick<PrayerSettings, 'city' | 'country' | 'method'>): string {
  return `${s.city.toLowerCase()}|${s.country}|${s.method}`;
}

// ── AlAdhan ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const ALADHAN_ORIGIN = 'https://api.aladhan.com';

/** The month calendar URL (one request per month; `timingsByCity` for one day has the same parameters). */
export function alAdhanCalendarUrl(s: Pick<PrayerSettings, 'city' | 'country' | 'method'>, year: number, month: number): string {
  const q = `city=${encodeURIComponent(s.city)}&country=${encodeURIComponent(s.country)}&method=${s.method}`;
  return `${ALADHAN_ORIGIN}/v1/calendarByCity/${year}/${month}?${q}`;
}

/** The months (year, month) that cover `today` and the next {@link PRAYER_CACHE_DAYS} − 1 days. */
export function monthsToFetch(today: LocalDate, days = PRAYER_CACHE_DAYS): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (const d of [today, addDays(today, Math.max(0, days - 1))]) {
    const year = Number(d.slice(0, 4));
    const month = Number(d.slice(5, 7));
    if (!out.some((m) => m.year === year && m.month === month)) out.push({ year, month });
  }
  return out;
}

const ALADHAN_KEYS: Record<Prayer, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

/** `"04:51 (+03)"` → `"04:51"`. */
function cleanTime(v: unknown): LocalTime | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const t = `${m[1]}:${m[2]}`;
  return isValidTime(t) ? t : null;
}

/** `"01-11-2026"` → `"2026-11-01"`. */
function cleanDate(v: unknown): LocalDate | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const d = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidDate(d) ? d : null;
}

/**
 * Reads an AlAdhan `calendarByCity` (array of days) or `timingsByCity` (one day) response. Days with a missing or
 * malformed time are skipped. Never throws.
 */
export function parseAlAdhan(json: unknown): Record<LocalDate, PrayerTimes> {
  const out: Record<LocalDate, PrayerTimes> = {};
  if (typeof json !== 'object' || json === null) return out;
  const data = (json as { data?: unknown }).data;
  const days = Array.isArray(data) ? data : data !== undefined ? [data] : [];
  for (const day of days) {
    if (typeof day !== 'object' || day === null) continue;
    const d = day as { timings?: Record<string, unknown>; date?: { gregorian?: { date?: unknown } } };
    const date = cleanDate(d.date?.gregorian?.date);
    if (!date || !d.timings) continue;
    const times: Partial<PrayerTimes> = {};
    let ok = true;
    for (const p of PRAYERS) {
      const t = cleanTime(d.timings[ALADHAN_KEYS[p]]);
      if (!t) {
        ok = false;
        break;
      }
      times[p] = t;
    }
    if (ok) out[date] = times as PrayerTimes;
  }
  return out;
}

// ── Local cache ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface PrayerCache {
  /** {@link prayerCacheKey} of the settings it was fetched for. */
  key: string;
  /** Raw AlAdhan times (before offsets) per date. */
  days: Record<LocalDate, PrayerTimes>;
}

/** Never throws: a malformed cache is `null`. */
export function parsePrayerCache(raw: unknown): PrayerCache | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.key !== 'string' || typeof r.days !== 'object' || r.days === null) return null;
  const days: Record<LocalDate, PrayerTimes> = {};
  for (const [d, t] of Object.entries(r.days as Record<string, unknown>)) if (isValidDate(d) && isPrayerTimes(t)) days[d] = t;
  return { key: r.key, days };
}

/**
 * True when the cache does not belong to these settings, or has fewer than `minDays` days from `today` on (so a
 * client refetches about a week before it runs out).
 */
export function prayerCacheStale(cache: PrayerCache | null, settings: PrayerSettings, today: LocalDate, minDays = 7): boolean {
  if (!cache || cache.key !== prayerCacheKey(settings)) return true;
  for (let i = 0; i < minDays; i++) if (!cache.days[addDays(today, i)]) return true;
  return false;
}

/** Merges fetched days into the cache (a new key starts over) and keeps only `today` … `today + days − 1`. */
export function mergePrayerCache(
  cache: PrayerCache | null,
  settings: PrayerSettings,
  fetched: Record<LocalDate, PrayerTimes>,
  today: LocalDate,
  days = PRAYER_CACHE_DAYS,
): PrayerCache {
  const key = prayerCacheKey(settings);
  const all = { ...(cache && cache.key === key ? cache.days : {}), ...fetched };
  const last = addDays(today, days - 1);
  const kept: Record<LocalDate, PrayerTimes> = {};
  for (const d of Object.keys(all).sort()) if (d >= today && d <= last) kept[d] = all[d] as PrayerTimes;
  return { key, days: kept };
}

/** The day's times with the user's offsets, or `undefined` (unknown day, other settings, no settings). */
export function prayerTimesOn(cache: PrayerCache | null, settings: PrayerSettings | null, date: LocalDate): PrayerTimes | undefined {
  if (!cache || !settings || cache.key !== prayerCacheKey(settings)) return undefined;
  const raw = cache.days[date];
  if (!raw) return undefined;
  const out = {} as PrayerTimes;
  for (const p of PRAYERS) out[p] = shiftTime(raw[p], settings.offsets[p]);
  return out;
}

/** A lookup for {@link resolveAnchor} by date, built once from the cache. */
export type PrayerTimesLookup = (date: LocalDate) => PrayerTimes | undefined;

export function prayerLookup(cache: PrayerCache | null, settings: PrayerSettings | null): PrayerTimesLookup {
  return (date) => prayerTimesOn(cache, settings, date);
}

/**
 * The anchors resolved for `days` days from `today`, as sent to the web push planner with the subscription prefs.
 * Only days with known prayer times are listed (the server falls back to the plan's fixed times otherwise).
 */
export function resolvedAnchorTimes(lookup: PrayerTimesLookup, today: LocalDate, days: number): Record<LocalDate, Record<PrayerAnchor, LocalTime>> {
  const out: Record<LocalDate, Record<PrayerAnchor, LocalTime>> = {};
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const times = lookup(date);
    if (!times) continue;
    out[date] = Object.fromEntries(PRAYER_ANCHORS.map((a) => [a, resolveAnchor(a, times)])) as Record<PrayerAnchor, LocalTime>;
  }
  return out;
}

/** Days of resolved anchor times a browser sends with its push prefs (the planner plans fewer days than this). */
export const PUSH_ANCHOR_DAYS = 14;

/** Never throws: keeps valid dates with every anchor a valid time; at most {@link PRAYER_CACHE_DAYS} entries. */
export function parseResolvedAnchorTimes(raw: unknown): Record<LocalDate, Record<PrayerAnchor, LocalTime>> {
  const out: Record<LocalDate, Record<PrayerAnchor, LocalTime>> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [d, v] of Object.entries(raw as Record<string, unknown>).slice(0, PRAYER_CACHE_DAYS)) {
    if (!isValidDate(d) || typeof v !== 'object' || v === null) continue;
    const r = v as Record<string, unknown>;
    if (PRAYER_ANCHORS.every((a) => isValidTime(r[a]))) out[d] = Object.fromEntries(PRAYER_ANCHORS.map((a) => [a, r[a]])) as Record<PrayerAnchor, LocalTime>;
  }
  return out;
}

/** «بعد الفجر» … for the clients' anchor pickers. */
export const ANCHOR_LABELS: Record<'ar' | 'en', Record<PrayerAnchor, string>> = {
  ar: {
    'after-fajr': 'بعد الفجر',
    'after-dhuhr': 'بعد الظهر',
    'after-asr': 'بعد العصر',
    'after-maghrib': 'بعد المغرب',
    'after-isha': 'بعد العشاء',
    'before-sleep': 'قبل النوم',
  },
  en: {
    'after-fajr': 'After Fajr',
    'after-dhuhr': 'After Dhuhr',
    'after-asr': 'After Asr',
    'after-maghrib': 'After Maghrib',
    'after-isha': 'After Isha',
    'before-sleep': 'Before sleep',
  },
};

// ── Deed time windows (owner, 2026-11-01: «لا تطرح أوقاتًا غير مناسبة») ─────────────────────────────────────────────

/**
 * A point of the day a deed's time starts or ends at. `sunrise` uses the day's sunrise when the client knows it
 * ({@link PrayerTimesWithSunrise}), else fajr + {@link SUNRISE_AFTER_FAJR_MINUTES}. `lastThird` is the start of the
 * last third of the night (maghrib → next fajr).
 */
export const WINDOW_EDGES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'lastThird'] as const;
export type WindowEdge = (typeof WINDOW_EDGES)[number];

/**
 * When a deed may be done, by the day's prayer times, with minute offsets (Duha: from sunrise + 15 to dhuhr − 10).
 * A window may cross midnight (witr: isha → fajr). `anchors` lists the «بعد الفجر»-style slots that suit the deed; an
 * empty list offers fixed times only. Written per habit in deed-schedules.yaml (pending the sheikh's review).
 */
export interface DeedWindow {
  from: WindowEdge;
  to: WindowEdge;
  fromMinutes?: number;
  toMinutes?: number;
  anchors: PrayerAnchor[];
}

/** One day's prayer times, optionally with sunrise (AlAdhan sends it). */
export type PrayerTimesWithSunrise = PrayerTimes & { sunrise?: LocalTime };

/** Sunrise when only the five prayers are known: a safe late estimate, so a Duha slot never falls before it. */
export const SUNRISE_AFTER_FAJR_MINUTES = 100;

function edgeMinutes(edge: WindowEdge, t: PrayerTimesWithSunrise): number {
  switch (edge) {
    case 'sunrise':
      return t.sunrise && isValidTime(t.sunrise) ? timeToMinutes(t.sunrise) : timeToMinutes(t.fajr) + SUNRISE_AFTER_FAJR_MINUTES;
    case 'lastThird': {
      const maghrib = timeToMinutes(t.maghrib);
      const night = timeToMinutes(t.fajr) + 1440 - maghrib;
      return (maghrib + Math.round((night * 2) / 3)) % 1440;
    }
    default:
      return timeToMinutes(t[edge]);
  }
}

/** The window's start and end as `HH:MM` on a day with these times (or the defaults). */
export function windowBounds(window: DeedWindow, times: PrayerTimesWithSunrise | undefined = undefined): { from: LocalTime; to: LocalTime } {
  const t = times ?? DEFAULT_PRAYER_TIMES;
  return {
    from: minutesToTime(edgeMinutes(window.from, t) + (window.fromMinutes ?? 0)),
    to: minutesToTime(edgeMinutes(window.to, t) + (window.toMinutes ?? 0)),
  };
}

/** Whether `time` falls inside the window (ends included; a window may cross midnight). */
export function isTimeInWindow(time: LocalTime, window: DeedWindow, times: PrayerTimesWithSunrise | undefined = undefined): boolean {
  const { from, to } = windowBounds(window, times);
  const m = timeToMinutes(time);
  const a = timeToMinutes(from);
  const b = timeToMinutes(to);
  return a <= b ? m >= a && m <= b : m >= a || m <= b;
}

/** The anchors to offer for a habit: its own list, or all of them when it has no window. */
export function anchorsFor(window: DeedWindow | undefined): readonly PrayerAnchor[] {
  return window ? window.anchors : PRAYER_ANCHORS;
}

/** A slot is suitable: an anchor the deed allows, or a fixed time inside its window (any time without a window). */
export function isSlotSuitable(
  slot: { time: LocalTime; anchor?: PrayerAnchor | null },
  window: DeedWindow | undefined,
  times: PrayerTimesWithSunrise | undefined = undefined,
): boolean {
  if (!window) return true;
  if (slot.anchor) return window.anchors.includes(slot.anchor);
  return isTimeInWindow(slot.time, window, times);
}

/** Checks a window read from the catalog; returns the first problem or null. */
export function validateDeedWindow(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'window must be a map';
  const w = value as Record<string, unknown>;
  for (const key of Object.keys(w)) if (!['from', 'to', 'fromMinutes', 'toMinutes', 'anchors'].includes(key)) return `window: unknown field "${key}"`;
  if (!(WINDOW_EDGES as readonly string[]).includes(String(w['from']))) return `window.from must be one of ${WINDOW_EDGES.join(', ')}`;
  if (!(WINDOW_EDGES as readonly string[]).includes(String(w['to']))) return `window.to must be one of ${WINDOW_EDGES.join(', ')}`;
  for (const k of ['fromMinutes', 'toMinutes']) {
    const v = w[k];
    if (v !== undefined && (!Number.isInteger(v) || Math.abs(v as number) > 180)) return `window.${k} must be an integer within ±180`;
  }
  if (!Array.isArray(w['anchors']) || !w['anchors'].every(isPrayerAnchor)) return 'window.anchors must list prayer anchors';
  return null;
}
