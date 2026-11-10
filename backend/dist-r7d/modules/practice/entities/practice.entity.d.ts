import type { HijriDate } from '@thekra/practice-core';
import type { Basis } from '../practice-catalog.js';
export interface OccasionOccurrenceDto {
    key: string;
    date: string;
    titleAr: string;
    titleEn: string;
    deed: string;
    basis: Basis;
    hijri: HijriDate;
}
