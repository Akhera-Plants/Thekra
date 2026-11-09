/**
 * Quran reciters (owner chat, round 6 §8 «Audio»): the member chooses a reciter in the settings; every verse card then
 * streams that reciter's per-ayah file from EveryAyah (`https://everyayah.com/data/<folder>/<SSS><AAA>.mp3`). Nothing
 * is stored or proxied by Thekra; never hadith audio.
 *
 * The folder names are EveryAyah's directory names, kept in this ONE constant ({@link RECITERS}). They could not be
 * fetched from the build environment (the host was unreachable) and are written from the site's known listing: the
 * owner / a client should play one ayah of each before release. The origin stays `https://everyayah.com` (the web's CSP
 * `media-src` already allows it).
 *
 * The choice is `settings.reciter` (synced with the settings record, sync contract «Round 6»); absent = the default
 * ({@link DEFAULT_RECITER}, the round-5 reciter). Pure.
 */
import { nowIso, type IsoTime } from './dates.js';
import { updateSettings, type Store } from './storage.js';

export const EVERYAYAH_ORIGIN = 'https://everyayah.com';
export const EVERYAYAH_DATA = `${EVERYAYAH_ORIGIN}/data/`;

export interface Reciter {
  /** Stable key, stored in the settings. Never reused. */
  key: string;
  /** EveryAyah folder name. */
  folder: string;
  ar: string;
  en: string;
}

export const RECITERS: readonly Reciter[] = [
  { key: 'alafasy', folder: 'Alafasy_128kbps', ar: 'مشاري راشد العفاسي', en: 'Mishary Rashid Alafasy' },
  { key: 'husary', folder: 'Husary_128kbps', ar: 'محمود خليل الحصري', en: 'Mahmoud Khalil Al-Husary' },
  { key: 'minshawy-murattal', folder: 'Minshawy_Murattal_128kbps', ar: 'محمد صديق المنشاوي (مرتّل)', en: 'Mohamed Siddiq Al-Minshawi (murattal)' },
  { key: 'abdul-basit-murattal', folder: 'Abdul_Basit_Murattal_192kbps', ar: 'عبد الباسط عبد الصمد (مرتّل)', en: 'Abdul Basit Abdul Samad (murattal)' },
  { key: 'ghamadi', folder: 'Ghamadi_40kbps', ar: 'سعد الغامدي', en: 'Saad Al-Ghamdi' },
  { key: 'shuraym', folder: 'Saood_ash-Shuraym_128kbps', ar: 'سعود الشريم', en: "Sa'ud Ash-Shuraym" },
  { key: 'sudais', folder: 'Abdurrahmaan_As-Sudais_192kbps', ar: 'عبد الرحمن السديس', en: 'Abdur-Rahman As-Sudais' },
];

export const RECITER_KEYS: readonly string[] = RECITERS.map((r) => r.key);
export const DEFAULT_RECITER = 'alafasy';

export function isReciterKey(value: unknown): value is string {
  return typeof value === 'string' && RECITER_KEYS.includes(value);
}

/** The reciter of a key; the default for an unknown or absent key. */
export function reciterOf(key?: string | null): Reciter {
  return RECITERS.find((r) => r.key === key) ?? (RECITERS.find((r) => r.key === DEFAULT_RECITER) as Reciter);
}

/** The member's reciter (settings, else the default). */
export function chosenReciter(store: Pick<Store, 'settings'>): Reciter {
  return reciterOf(store.settings.reciter);
}

/** The base URL of a reciter's files (ends with `/`). */
export function reciterBaseUrl(key?: string | null): string {
  return `${EVERYAYAH_DATA}${reciterOf(key).folder}/`;
}

/** One ayah's file for a reciter: `…/SSSAAA.mp3`; null for an impossible reference (surah 1–114, ayah 1–286). */
export function ayahAudioUrl(surah: number, ayah: number, reciterKey?: string | null): string | null {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1 || ayah > 286) return null;
  return `${reciterBaseUrl(reciterKey)}${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}

/** Chooses the reciter (`null` = back to the default, stored as absent). Throws on an unknown key. */
export function setReciter(store: Store, key: string | null, now: IsoTime = nowIso()): Store {
  if (key !== null && !isReciterKey(key)) throw new RangeError('Unknown reciter');
  return updateSettings(store, { reciter: key === null || key === DEFAULT_RECITER ? undefined : key }, now);
}
