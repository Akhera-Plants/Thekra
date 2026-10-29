/**
 * Prayer times on the device («بعد الفجر» reminders), with adhan 4.4.6 (batoulapps/adhan-js, MIT).
 *
 * - The place is the device's coarse location, a city from {@link PRAYER_CITIES}, or coordinates typed by the user.
 *   It is kept in the app prefs (rounded to about 1 km) and never leaves the device: no request carries it.
 * - The calculation method is the user's choice, else the region default ({@link defaultMethodFor}: Umm al-Qura in
 *   Saudi Arabia, a country's own authority where adhan has one, Muslim World League elsewhere).
 * - adhan returns absolute instants; reminders are scheduled on the device clock, so the time is read in the
 *   device's zone (`getHours`), which is the zone of the place for a device that is where it says it is.
 * Pure apart from adhan: no React Native imports, so it runs in Jest.
 */

import { CalculationMethod, Coordinates, HighLatitudeRule, PrayerTimes, type CalculationParameters } from 'adhan';
import type { LocalDate, LocalTime, PlanAnchor, Prayer } from '@thekra/practice-core';
import { nowTime } from './format';

export type PrayerMethod =
  | 'umm_al_qura'
  | 'mwl'
  | 'egyptian'
  | 'karachi'
  | 'dubai'
  | 'kuwait'
  | 'qatar'
  | 'turkey'
  | 'singapore'
  | 'north_america'
  | 'moonsighting';

/** In the order the Settings screen lists them. */
export const PRAYER_METHODS: readonly PrayerMethod[] = [
  'umm_al_qura',
  'mwl',
  'egyptian',
  'karachi',
  'dubai',
  'kuwait',
  'qatar',
  'turkey',
  'singapore',
  'north_america',
  'moonsighting',
];

const METHOD_PARAMS: Record<PrayerMethod, () => CalculationParameters> = {
  umm_al_qura: CalculationMethod.UmmAlQura,
  mwl: CalculationMethod.MuslimWorldLeague,
  egyptian: CalculationMethod.Egyptian,
  karachi: CalculationMethod.Karachi,
  dubai: CalculationMethod.Dubai,
  kuwait: CalculationMethod.Kuwait,
  qatar: CalculationMethod.Qatar,
  turkey: CalculationMethod.Turkey,
  singapore: CalculationMethod.Singapore,
  north_america: CalculationMethod.NorthAmerica,
  moonsighting: CalculationMethod.MoonsightingCommittee,
};

/** Countries whose own authority adhan implements (ISO 3166 alpha-2). Everywhere else: Muslim World League. */
const REGION_METHODS: Readonly<Record<string, PrayerMethod>> = {
  SA: 'umm_al_qura',
  AE: 'dubai',
  KW: 'kuwait',
  QA: 'qatar',
  EG: 'egyptian',
  TR: 'turkey',
  PK: 'karachi',
  SG: 'singapore',
};

export function defaultMethodFor(region: string | null | undefined): PrayerMethod {
  return (region && REGION_METHODS[region.toUpperCase()]) || 'mwl';
}

export interface PrayerCity {
  key: string;
  nameAr: string;
  nameEn: string;
  /** ISO 3166 alpha-2, for the default method. */
  region: string;
  latitude: number;
  longitude: number;
}

/** The fallback when location is off: well-known cities (city-centre coordinates, 2 decimals). */
export const PRAYER_CITIES: readonly PrayerCity[] = [
  { key: 'makkah', nameAr: 'مكة المكرمة', nameEn: 'Makkah', region: 'SA', latitude: 21.42, longitude: 39.83 },
  { key: 'madinah', nameAr: 'المدينة المنورة', nameEn: 'Madinah', region: 'SA', latitude: 24.47, longitude: 39.61 },
  { key: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', region: 'SA', latitude: 24.71, longitude: 46.68 },
  { key: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', region: 'SA', latitude: 21.49, longitude: 39.19 },
  { key: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam', region: 'SA', latitude: 26.42, longitude: 50.09 },
  { key: 'kuwait', nameAr: 'الكويت', nameEn: 'Kuwait City', region: 'KW', latitude: 29.38, longitude: 47.98 },
  { key: 'doha', nameAr: 'الدوحة', nameEn: 'Doha', region: 'QA', latitude: 25.29, longitude: 51.53 },
  { key: 'manama', nameAr: 'المنامة', nameEn: 'Manama', region: 'BH', latitude: 26.23, longitude: 50.59 },
  { key: 'dubai', nameAr: 'دبي', nameEn: 'Dubai', region: 'AE', latitude: 25.2, longitude: 55.27 },
  { key: 'abu-dhabi', nameAr: 'أبوظبي', nameEn: 'Abu Dhabi', region: 'AE', latitude: 24.45, longitude: 54.38 },
  { key: 'muscat', nameAr: 'مسقط', nameEn: 'Muscat', region: 'OM', latitude: 23.59, longitude: 58.38 },
  { key: 'amman', nameAr: 'عمّان', nameEn: 'Amman', region: 'JO', latitude: 31.95, longitude: 35.91 },
  { key: 'jerusalem', nameAr: 'القدس', nameEn: 'Jerusalem', region: 'PS', latitude: 31.77, longitude: 35.23 },
  { key: 'damascus', nameAr: 'دمشق', nameEn: 'Damascus', region: 'SY', latitude: 33.51, longitude: 36.28 },
  { key: 'beirut', nameAr: 'بيروت', nameEn: 'Beirut', region: 'LB', latitude: 33.89, longitude: 35.5 },
  { key: 'baghdad', nameAr: 'بغداد', nameEn: 'Baghdad', region: 'IQ', latitude: 33.32, longitude: 44.37 },
  { key: 'cairo', nameAr: 'القاهرة', nameEn: 'Cairo', region: 'EG', latitude: 30.04, longitude: 31.24 },
  { key: 'khartoum', nameAr: 'الخرطوم', nameEn: 'Khartoum', region: 'SD', latitude: 15.5, longitude: 32.56 },
  { key: 'sanaa', nameAr: 'صنعاء', nameEn: "Sana'a", region: 'YE', latitude: 15.37, longitude: 44.19 },
  { key: 'rabat', nameAr: 'الرباط', nameEn: 'Rabat', region: 'MA', latitude: 34.02, longitude: -6.84 },
  { key: 'algiers', nameAr: 'الجزائر', nameEn: 'Algiers', region: 'DZ', latitude: 36.75, longitude: 3.06 },
  { key: 'tunis', nameAr: 'تونس', nameEn: 'Tunis', region: 'TN', latitude: 36.81, longitude: 10.18 },
  { key: 'istanbul', nameAr: 'إسطنبول', nameEn: 'Istanbul', region: 'TR', latitude: 41.01, longitude: 28.98 },
  { key: 'london', nameAr: 'لندن', nameEn: 'London', region: 'GB', latitude: 51.51, longitude: -0.13 },
];

/** Where prayer times are computed for. `city` is a {@link PRAYER_CITIES} key when the user picked one. */
export interface PrayerPlace {
  latitude: number;
  longitude: number;
  source: 'device' | 'city' | 'manual';
  city?: string;
}

/** Everything needed to turn an anchor into a time. */
export interface PrayerContext {
  place: Pick<PrayerPlace, 'latitude' | 'longitude'>;
  method: PrayerMethod;
}

/** About 1 km: enough for prayer times, and no finer than needed. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function prayerTimes(date: LocalDate, ctx: PrayerContext): PrayerTimes {
  const coordinates = new Coordinates(ctx.place.latitude, ctx.place.longitude);
  const params = METHOD_PARAMS[ctx.method]();
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  const [y, m, d] = date.split('-').map(Number);
  return new PrayerTimes(coordinates, new Date(y as number, (m as number) - 1, d as number), params);
}

/** The instant of `prayer` on `date` at the place. */
export function prayerInstant(prayer: Prayer, date: LocalDate, ctx: PrayerContext): Date {
  return prayerTimes(date, ctx)[prayer];
}

/** The five prayers of `date` as device-clock HH:MM. */
export function prayerClock(date: LocalDate, ctx: PrayerContext): Record<Prayer, LocalTime> {
  const times = prayerTimes(date, ctx);
  return {
    fajr: nowTime(times.fajr),
    dhuhr: nowTime(times.dhuhr),
    asr: nowTime(times.asr),
    maghrib: nowTime(times.maghrib),
    isha: nowTime(times.isha),
  };
}

const LAST_MINUTE: LocalTime = '23:59';

/**
 * The device-clock time of an anchored reminder on `date`: the prayer time plus the offset. A reminder that would
 * pass midnight (a late Isha in a northern summer) stays on its day, at 23:59.
 */
export function anchorTimeOn(anchor: Pick<PlanAnchor, 'prayer' | 'offset'>, date: LocalDate, ctx: PrayerContext): LocalTime {
  const at = new Date(prayerInstant(anchor.prayer, date, ctx).getTime() + anchor.offset * 60_000);
  const [y, m, d] = date.split('-').map(Number);
  const sameDay = at.getFullYear() === y && at.getMonth() + 1 === m && at.getDate() === d;
  return sameDay ? nowTime(at) : LAST_MINUTE;
}

/** Typical times, used for the stored slot only when no place is set yet (the reminder itself waits for a place). */
const TYPICAL: Record<Prayer, LocalTime> = { fajr: '05:00', dhuhr: '12:15', asr: '15:30', maghrib: '18:00', isha: '19:30' };

/**
 * The clock time saved in `plan.slots` for a new anchor: today's prayer time plus the offset at the place, else a
 * typical time. It is what the web, the extension and web push remind at; the phone recomputes it every day.
 * Moves forward a minute at a time when another slot already holds that time.
 */
export function anchorSlot(
  anchor: Pick<PlanAnchor, 'prayer' | 'offset'>,
  today: LocalDate,
  ctx: PrayerContext | null,
  taken: readonly LocalTime[],
): LocalTime {
  let slot = ctx ? anchorTimeOn(anchor, today, ctx) : addMinutes(TYPICAL[anchor.prayer], anchor.offset);
  for (let i = 0; i < 60 && taken.includes(slot); i++) slot = addMinutes(slot, 1);
  return slot;
}

/** HH:MM + minutes, kept within the day. */
function addMinutes(time: LocalTime, minutes: number): LocalTime {
  const total = Math.min(23 * 60 + 59, Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The method in use: the user's choice, else the default of the chosen city's country, else of the device region. */
export function effectiveMethod(place: PrayerPlace | null, method: PrayerMethod | null, deviceRegion: string | null): PrayerMethod {
  if (method) return method;
  const cityRegion = place?.city ? PRAYER_CITIES.find((c) => c.key === place.city)?.region : undefined;
  return defaultMethodFor(cityRegion ?? deviceRegion);
}

/** What anchored reminders need, or null while no place is set. */
export function prayerContext(place: PrayerPlace | null, method: PrayerMethod | null, deviceRegion: string | null): PrayerContext | null {
  return place ? { place, method: effectiveMethod(place, method, deviceRegion) } : null;
}
