/**
 * Hijri (Umm al-Qura) dates through the built-in `Intl.DateTimeFormat` with the `islamic-umalqura` calendar.
 * No library and no tables: Node, modern browsers and Hermes with full ICU support it.
 *
 * Umm al-Qura can differ by a day from the moon sighting in the user's country, so every function takes an
 * `offsetDays` setting (−2…+2). The offset is added to the Gregorian date before conversion:
 *   - `+1`: the local month starts one day EARLIER than Umm al-Qura (today is already "tomorrow" in UQ);
 *   - `−1`: the local month starts one day LATER than Umm al-Qura.
 */
import { addDays, parseDate, type LocalDate } from './dates.js';

export interface HijriDate {
  year: number;
  /** 1 = Muharram … 12 = Dhu al-Hijja. */
  month: number;
  day: number;
}

export const HIJRI_OFFSET_MIN = -2;
export const HIJRI_OFFSET_MAX = 2;

const MONTH_NAMES_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
] as const;

const CALENDAR = 'islamic-umalqura';
let formatter: Intl.DateTimeFormat | null = null;
let supported: boolean | null = null;

function getFormatter(): Intl.DateTimeFormat {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(`en-u-ca-${CALENDAR}-nu-latn`, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      // The instant below is noon UTC of the wanted day; formatting it in UTC keeps the day stable on every host.
      timeZone: 'UTC',
    });
  }
  return formatter;
}

/**
 * True when this runtime really formats with the Umm al-Qura calendar. Some engines built with reduced ICU
 * silently fall back to Gregorian; callers on such runtimes should hide Hijri features rather than show wrong
 * dates (an Arafah reminder on the wrong day is worse than none).
 */
export function isHijriSupported(): boolean {
  if (supported === null) {
    try {
      const resolved = getFormatter().resolvedOptions().calendar;
      supported = resolved === CALENDAR && convertUnchecked('2026-10-28').year === 1448;
    } catch {
      supported = false;
    }
  }
  return supported;
}

// Arabic-Indic and Persian digits, in case an engine ignores `nu-latn`.
function toWesternInt(value: string): number {
  const western = value.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(
    /[۰-۹]/g,
    (c) => String(c.charCodeAt(0) - 0x06f0),
  );
  return Number.parseInt(western, 10);
}

function convertUnchecked(date: LocalDate): HijriDate {
  const { year, month, day } = parseDate(date);
  const instant = new Date(Date.UTC(year, month - 1, day, 12));
  let y = NaN;
  let m = NaN;
  let d = NaN;
  for (const part of getFormatter().formatToParts(instant)) {
    if (part.type === 'year') y = toWesternInt(part.value);
    else if (part.type === 'month') m = toWesternInt(part.value);
    else if (part.type === 'day') d = toWesternInt(part.value);
  }
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error('Hijri conversion failed: unexpected Intl output');
  }
  return { year: y, month: m, day: d };
}

/** Validates a user Hijri offset; throws a RangeError outside −2…+2 or when not an integer. */
export function assertHijriOffset(offsetDays: number): void {
  if (!Number.isInteger(offsetDays) || offsetDays < HIJRI_OFFSET_MIN || offsetDays > HIJRI_OFFSET_MAX) {
    throw new RangeError(`hijriOffset must be an integer from ${HIJRI_OFFSET_MIN} to ${HIJRI_OFFSET_MAX}`);
  }
}

/**
 * Umm al-Qura date for a local Gregorian date, shifted by the user's offset. Western digits.
 * Throws when the runtime has no Umm al-Qura support (see {@link isHijriSupported}).
 */
export function toHijri(date: LocalDate, offsetDays = 0): HijriDate {
  assertHijriOffset(offsetDays);
  if (!isHijriSupported()) {
    throw new Error('This runtime does not support the islamic-umalqura calendar');
  }
  return convertUnchecked(offsetDays === 0 ? date : addDays(date, offsetDays));
}

/** Arabic month name, e.g. 9 → «رمضان». Throws outside 1…12. */
export function hijriMonthNameAr(month: number): string {
  const name = Number.isInteger(month) ? MONTH_NAMES_AR[month - 1] : undefined;
  if (!name) throw new RangeError('Hijri month must be 1…12');
  return name;
}

/** «17 جمادى الأولى 1448 هـ» (Western digits, per the project content rules). */
export function formatHijriAr(date: LocalDate, offsetDays = 0): string {
  const h = toHijri(date, offsetDays);
  return `${h.day} ${hijriMonthNameAr(h.month)} ${h.year} هـ`;
}
