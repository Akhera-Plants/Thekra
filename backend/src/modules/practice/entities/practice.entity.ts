import type { HijriDate, SyncPayload } from '@thekra/practice-core';
import type { Basis } from '../practice-catalog.js';

/** One day of a sunnah occasion, as GET /calendar/occasions lists it. */
export interface OccasionOccurrenceDto {
  key: string;
  date: string;
  titleAr: string;
  titleEn: string;
  deed: string;
  basis: Basis;
  hijri: HijriDate;
}

/** GET /me/practice. `store` is null (and `version` 0) before the first save. */
export interface PracticeStoreDto {
  store: SyncPayload | null;
  version: number;
}
